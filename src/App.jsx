/* Proprietary and confidential. See LICENSE. */
// src/App.jsx
import React, {
  useEffect,
  useState,
  useRef,
  Suspense,
  lazy,
  useCallback,
} from "react";
import {
  Box,
  Typography,
  Button,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

import InstallBanner from "./components/InstallBanner";
import ChangeDriverModal from "./components/ChangeDriverModal";
import useToast from "./hooks/useToast";
import useDrivers from "./hooks/useDrivers";
import { useDriver } from "./context/DriverContext.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import FcmToaster from "./components/FcmToaster.jsx";
import NotificationsOptInDialog from "./components/NotificationsOptInDialog.jsx";
import { getUserAccess } from "./hooks/api";
import { ensureFcmToken } from "./utils/fcm";
import DriverInfoTab from "./components/DriverInfoTab";
import CalendarUpdateTab from "./components/CalendarUpdateTab";
import VehicleDropGuides from "./components/VehicleDropGuides";
import DriverDirectory from "./components/DriverDirectory";
import ContactEscalation from "./components/ContactEscalation";
import { motion } from "framer-motion";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { logout } from "./services/auth";
import "./index.css";
import { TIMEZONE } from "./constants";
import useNetworkStatus from "./hooks/useNetworkStatus";
import OfflineNotice from "./components/OfflineNotice";
import { startMonitoring, stopMonitoring } from "./utils/apiMonitor";
import { initAnalytics, trackPageView } from "./utils/analytics";
import LoadingScreen from "./components/LoadingScreen.jsx";
import AppShell from "./layout/AppShell.jsx";

const RideClaimTab = lazy(() => import("./components/RideClaimTab"));
const TimeClock = lazy(() => import("./components/TimeClock"));
const AdminTimeLog = lazy(() => import("./components/AdminTimeLog"));
const AdminUserManager = lazy(() => import("./components/AdminUserManager"));
const RideEntryForm = lazy(() => import("./components/RideEntryForm"));
const NotificationsCenter = lazy(() => import("./pages/Admin/NotificationsCenter.jsx"));
const ProfilePage = lazy(() => import("./pages/Profile/Settings.jsx"));
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

function App() {
  const { driver, setDriver } = useDriver();
  const { fetchDrivers } = useDrivers();
  const { user, authLoading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // one-time init
    initAnalytics();
  }, []);

  useEffect(() => {
    // fire on route change only
    trackPageView(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    ensureFcmToken(user).catch((e) =>
      console.warn("[LRP] ensureFcmToken:", e?.message || e)
    );
  }, [user]);
  const { toast, showToast, closeToast } = useToast("success");
  const handleRefresh = useCallback(() => window.location.reload(), []);
  const [showEliteBadge, setShowEliteBadge] = useState(false);
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

  const openChangeDriver = useCallback(() => setChangeDriverOpen(true), []);
  const closeChangeDriver = useCallback(() => setChangeDriverOpen(false), []);

  const noop = useCallback(() => {}, []);

  const handleClearCache = useCallback(() => {
    if (window.confirm("Clear cache and reload? You'll be signed out.")) {
      localStorage.clear();
      sessionStorage.clear();
      logout();
      if ("caches" in window)
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      window.location.href = window.location.origin;
    }
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      startMonitoring();
      return () => stopMonitoring();
    }
  }, []);

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

  if (authLoading || !driver) {
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
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <InstallBanner />
        <AppShell onRefresh={handleRefresh} onChangeDriver={openChangeDriver}>
          <Suspense fallback={<CircularProgress />}> 
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
                      <TimeClock driver={selectedDriver} setIsTracking={noop} />
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
                  <Route path="/settings" element={<ProfilePage />} />
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
                    path="/admin/notifications"
                    element={
                      isAdmin ? <NotificationsCenter /> : <Navigate to="/" />
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
            </Suspense>

            {isAdmin && (
              <ChangeDriverModal
                open={changeDriverOpen}
                onClose={closeChangeDriver}
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
            <NotificationsOptInDialog user={user} />
            <FcmToaster />

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
                      color: "common.white",
                    },
                  }}
                  onClick={handleClearCache}
                >
                  🧹 CLEAR CACHE & RELOAD
                </Button>
              </Box>
            </motion.div>
          </AppShell>
        </LocalizationProvider>
    );
}

export default App;
