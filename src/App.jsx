/* Proprietary and confidential. See LICENSE. */
// src/App.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  Suspense,
  lazy,
  useCallback,
} from "react";
import {
  ThemeProvider,
  CssBaseline,
  Box,
  Typography,
  Button,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Toolbar,
  CircularProgress,
} from "@mui/material";
import { ErrorBoundary } from "react-error-boundary";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import InstallBanner from "./components/InstallBanner";
import ChangeDriverModal from "./components/ChangeDriverModal";
import SidebarNavigation from "./components/SidebarNavigation";
import useDarkMode from "./hooks/useDarkMode";
import useToast from "./hooks/useToast";
import useDrivers from "./hooks/useDrivers";
import { useDriver } from "./context/DriverContext.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { getUserAccess } from "./hooks/api";
import getTheme from "./theme";
import DriverInfoTab from "./components/DriverInfoTab";
import { logError } from "./utils/logError";
import CalendarUpdateTab from "./components/CalendarUpdateTab";
import VehicleDropGuides from "./components/VehicleDropGuides";
import DriverDirectory from "./components/DriverDirectory";
import ContactEscalation from "./components/ContactEscalation";
import ResponsiveHeader from "./components/ResponsiveHeader";
import { motion } from "framer-motion";
import { Routes, Route, Navigate } from "react-router-dom";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { logout } from "./services/auth";
import { unsubscribeAll } from "./utils/listenerRegistry";
import "./index.css";
import { TIMEZONE } from "./constants";
import useNetworkStatus from "./hooks/useNetworkStatus";
import OfflineNotice from "./components/OfflineNotice";
import { startMonitoring, stopMonitoring } from "./utils/apiMonitor";
import LoadingScreen from "./components/LoadingScreen.jsx";

const RideClaimTab = lazy(() => import("./components/RideClaimTab"));
const TimeClock = lazy(() => import("./components/TimeClock"));
const AdminTimeLog = lazy(() => import("./components/AdminTimeLog"));
const AdminUserManager = lazy(() => import("./components/AdminUserManager"));
const RideEntryForm = lazy(() => import("./components/RideEntryForm"));
const RideVehicleCalendar = lazy(
  () => import("./components/RideVehicleCalendar"),
);
const ShootoutTab = lazy(() => import("./components/ShootoutTab"));
const TicketGenerator = lazy(() => import("./components/TicketGenerator"));
const TicketViewer = lazy(() => import("./components/TicketViewer"));
const TicketScanner = lazy(() => import("./components/TicketScanner"));
const Tickets = lazy(() => import("./components/Tickets"));

dayjs.extend(utc);
dayjs.extend(timezone);
const CST = TIMEZONE;

const isInLockoutWindow = () => {
  const now = dayjs().tz(CST);
  const hour = now.hour();
  return hour >= 18 && hour < 20;
};

export default function App() {
  const [darkMode, setDarkMode] = useDarkMode();
  const { driver, setDriver } = useDriver();
  const { fetchDrivers } = useDrivers();
  const { user, loading } = useAuth();
  const { toast, showToast, closeToast } = useToast("success");
  const [showEliteBadge, setShowEliteBadge] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [changeDriverOpen, setChangeDriverOpen] = useState(false);
  const [isLockedOut, setIsLockedOut] = useState(isInLockoutWindow());
  const [isAppReady, setIsAppReady] = useState(false);
  const isFullyReady = isAppReady && !!driver;
  const hasFetchedRef = useRef(false);
  const hadUserRef = useRef(!!localStorage.getItem("lrpUser"));
  const selectedDriver = driver?.name || "";
  const role = driver?.access || "";
  const isAdmin = role === "admin";
  const APP_VERSION = import.meta.env.VITE_APP_VERSION;

  const {
    showOffline,
    retry: retryConnection,
    dismiss: dismissOffline,
  } = useNetworkStatus(() => showToast("✅ Reconnected", "success"));

  useEffect(() => {
    if (import.meta.env.DEV) {
      startMonitoring();
      return () => stopMonitoring();
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      hadUserRef.current = false;
      await logout();
      // Tear down any shared listeners to prevent duplicate subscriptions
      unsubscribeAll();
      setDriver(null);
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(";").forEach((cookie) => {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
        document.cookie =
          name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      });
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) await reg.unregister();
      }
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) await caches.delete(name);
      }
      const dbs = await indexedDB.databases?.();
      for (const db of dbs || []) {
        await indexedDB.deleteDatabase(db.name);
      }
      window.location.reload();
    } catch (err) {
      logError(err, "App:signOut");
      showToast("Sign out failed", "error");
    }
  }, [showToast, setDriver]);

  useEffect(() => {
    if (!hasFetchedRef.current) hasFetchedRef.current = true;
    if (user) {
      hadUserRef.current = true;
      setShowEliteBadge(true);
      (async () => {
        const record = await getUserAccess(user.email);
        if (record) {
          const access = record.access?.toLowerCase() || "driver";
          await setDriver({
            id: record.id,
            name: record.name,
            email: user.email,
            access,
          });
          if (import.meta.env.DEV) {
            console.log("Authenticated:", user.email, "role:", access);
          }
          fetchDrivers();
        } else {
          showToast("Access denied", "error");
          await logout();
          setDriver(null);
        }
        setTimeout(() => setIsAppReady(true), 50);
      })();
    } else {
      setDriver(null);
      if (hadUserRef.current) {
        showToast("Session expired. Please log in again.", "error");
      }
      setIsAppReady(true);
    }
  }, [user, fetchDrivers, setDriver, showToast]);

  useEffect(() => {
    const interval = setInterval(
      () => setIsLockedOut(isInLockoutWindow()),
      5000,
    );
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (showEliteBadge) {
      const t = setTimeout(() => setShowEliteBadge(false), 5000);
      return () => clearTimeout(t);
    }
  }, [showEliteBadge]);

  const theme = useMemo(() => getTheme(darkMode), [darkMode]);

  if (loading || !driver) {
    return <LoadingScreen />;
  }

  if (!isFullyReady) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <CssBaseline />
        <InstallBanner />
        <ResponsiveHeader
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onChangeDriver={() => setChangeDriverOpen(true)}
          onSignOut={() => setSignOutConfirmOpen(true)}
        />
        <Box sx={{ display: "flex" }}>
          <SidebarNavigation />
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              p: 3,
              maxWidth: "100%",
              mt: "64px", // keep this for AppBar spacing
              ml: 0, // ← remove sidebar offset here
            }}
          >
            <Toolbar />
            <Suspense fallback={<CircularProgress />}>
              <ErrorBoundary
                fallbackRender={({ error }) => (
                  <Typography color="error" sx={{ mt: 4 }}>
                    🚨 Something went wrong:{" "}
                    {error?.message || JSON.stringify(error)}
                  </Typography>
                )}
              >
                <Routes>
                  <Route path="/" element={<Navigate to="/rides" replace />} />
                  <Route
                    path="/rides"
                    element={
                      <RideClaimTab
                        driver={selectedDriver}
                        isAdmin={isAdmin}
                        isLockedOut={!isAdmin && isLockedOut}
                      />
                    }
                  />
                  <Route path="/__/auth/iframe" element={<div />} />
                  <Route
                    path="/clock"
                    element={
                      <TimeClock
                        driver={selectedDriver}
                        setIsTracking={() => {}}
                      />
                    }
                  />
                  <Route path="/shootout" element={<ShootoutTab />} />
                  <Route path="/scan" element={<TicketScanner />} />
                  <Route path="/info" element={<DriverInfoTab />} />
                  <Route path="/drop-guides" element={<VehicleDropGuides />} />
                  <Route path="/directory" element={<DriverDirectory />} />
                  <Route path="/calendar" element={<CalendarUpdateTab />} />
                  <Route path="/escalation" element={<ContactEscalation />} />
                  <Route
                    path="/vehicle-calendar"
                    element={<RideVehicleCalendar />}
                  />
                  <Route
                    path="/admin-time-log"
                    element={
                      isAdmin ? (
                        <AdminTimeLog driver={selectedDriver} />
                      ) : (
                        <Navigate to="/" />
                      )
                    }
                  />
                  <Route
                    path="/admin-user-manager"
                    element={
                      isAdmin ? <AdminUserManager /> : <Navigate to="/" />
                    }
                  />
                  <Route
                    path="/ride-entry"
                    element={isAdmin ? <RideEntryForm /> : <Navigate to="/" />}
                  />
                  <Route path="/tickets" element={<Tickets />} />
                  <Route
                    path="/generate-ticket"
                    element={
                      isAdmin ? <TicketGenerator /> : <Navigate to="/" />
                    }
                  />
                  <Route path="/ticket/:ticketId" element={<TicketViewer />} />
                  <Route
                    path="*"
                    element={
                      <Typography
                        sx={{ mt: 6, textAlign: "center", color: "error.main" }}
                      >
                        🚧 404 — Page Not Found
                      </Typography>
                    }
                  />
                </Routes>
              </ErrorBoundary>
            </Suspense>

            <Dialog
              open={signOutConfirmOpen}
              onClose={() => setSignOutConfirmOpen(false)}
            >
              <DialogTitle sx={{ fontWeight: "bold", color: "#d32f2f" }}>
                💥 Confirm Sign Out
              </DialogTitle>
              <DialogContent dividers>
                <Typography>
                  Are you sure you want to{" "}
                  <strong>log out of Beast Mode™</strong>?
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setSignOutConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSignOut}
                  variant="contained"
                  color="error"
                >
                  Log Me Out
                </Button>
              </DialogActions>
            </Dialog>

            {isAdmin && (
              <ChangeDriverModal
                open={changeDriverOpen}
                onClose={() => setChangeDriverOpen(false)}
              />
            )}

            <Snackbar
              open={toast.open}
              autoHideDuration={3000}
              onClose={closeToast}
            >
              <Alert
                severity={toast.severity}
                variant="filled"
                onClose={closeToast}
              >
                {toast.message}
              </Alert>
            </Snackbar>

            <OfflineNotice
              open={showOffline}
              onRetry={retryConnection}
              onClose={dismissOffline}
            />

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
            >
              <Box
                sx={{
                  mt: 6,
                  py: 3,
                  px: 3,
                  borderTop: "2px dashed",
                  borderColor: "primary.main",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  fontSize: "0.9rem",
                  color: "text.secondary",
                  backgroundColor: (theme) =>
                    theme.palette.mode === "dark" ? "#111" : "#f4fff4",
                  textAlign: "center",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: "success.main",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  🚀 Version:{" "}
                  <span style={{ fontFamily: "monospace" }}>
                    v{import.meta.env.VITE_APP_VERSION || "dev"}
                  </span>{" "}
                  • Lake Ride Pros © {new Date().getFullYear()}
                </Typography>

                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  sx={{
                    fontWeight: "bold",
                    borderWidth: 2,
                    "&:hover": {
                      backgroundColor: "error.main",
                      color: "#fff",
                    },
                  }}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Clear cache and reload? You'll be signed out.",
                      )
                    ) {
                      localStorage.clear();
                      sessionStorage.clear();
                      logout();
                      if ("caches" in window)
                        caches
                          .keys()
                          .then((keys) =>
                            keys.forEach((k) => caches.delete(k)),
                          );
                      window.location.href = window.location.origin;
                    }
                  }}
                >
                  🧹 CLEAR CACHE & RELOAD
                </Button>
              </Box>
            </motion.div>
          </Box>
        </Box>
      </LocalizationProvider>
    </ThemeProvider>
  );
}
