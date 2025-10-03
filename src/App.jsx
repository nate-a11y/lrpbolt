/* Proprietary and confidential. See LICENSE. */
// src/App.jsx
import {
  useEffect,
  useState,
  useRef,
  Suspense,
  lazy,
  useCallback,
} from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Typography,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers-pro";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

import ErrorBoundary from "@/components/dev/ErrorBoundary.jsx";
import ClockOutConfirm from "@/components/ClockOutConfirm.jsx";
import NotifDiag from "@/components/NotifDiag.jsx";
import GlobalChrome from "@/components/GlobalChrome.jsx";
import PermissionGate from "@/components/PermissionGate.jsx";
import useActiveClockSession from "@/hooks/useActiveClockSession";
import { updateTimeLog } from "@/services/fs";
import { on } from "@/services/uiBus";
import logError from "@/utils/logError.js";

import "./index.css";
import InstallBanner from "./components/InstallBanner";
import ChangeDriverModal from "./components/ChangeDriverModal";
import { useToast } from "./context/ToastProvider.jsx";
import useDrivers from "./hooks/useDrivers";
import { useDriver } from "./context/DriverContext.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import NotificationsOptInDialog from "./components/NotificationsOptInDialog.jsx";
import { getUserAccess } from "./hooks/api";
import { ensureFcmToken } from "./utils/fcm";
import DriverInfoTab from "./components/DriverInfoTab";
import DirectoryEscalations from "./components/DirectoryEscalations.jsx";
import { logout } from "./services/auth";
import useNetworkStatus from "./hooks/useNetworkStatus";
import OfflineNotice from "./components/OfflineNotice";
import { startMonitoring, stopMonitoring } from "./utils/apiMonitor";
import { initAnalytics, trackPageView } from "./utils/analytics";
import LoadingScreen from "./components/LoadingScreen.jsx";
import AppShell from "./layout/AppShell.jsx";
import PhoneNumberPrompt from "./components/PhoneNumberPrompt.jsx";
import CalendarHubLazy from "./pages/lazy/CalendarHub.lazy.jsx";
const APP_VERSION = import.meta.env.VITE_APP_VERSION;
if (import.meta.env.PROD && typeof APP_VERSION !== "undefined") {
  console.info("LRP version:", APP_VERSION);
}

const ClaimRides = lazy(() => import("./pages/ClaimRides.jsx"));
const TimeClock = lazy(() => import("./components/TimeClock"));
const AdminTimeLog = lazy(() => import("./components/AdminTimeLog"));
const AdminUserManager = lazy(() => import("./components/AdminUserManager"));
const RideEntryForm = lazy(() => import("./components/RideEntryForm"));
const NotificationsCenter = lazy(
  () => import("./pages/Admin/NotificationsCenter.jsx"),
);
const ProfilePage = lazy(() => import("./pages/Profile/Settings.jsx"));
const ShootoutTab = lazy(() => import("./components/ShootoutTab"));
const TicketViewer = lazy(() => import("./components/TicketViewer"));
const Tickets = lazy(() => import("./components/Tickets"));

function App() {
  const { driver, setDriver } = useDriver();
  const { fetchDrivers } = useDrivers();
  const { user, authLoading, role: authRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { enqueue } = useToast();
  const { timeLogId: activeTimeLogId } = useActiveClockSession();
  const clockOutInFlightRef = useRef(false);
  const pendingClockOutRef = useRef(false);
  const pendingClockOutTimerRef = useRef(null);

  useEffect(() => {
    // one-time init
    initAnalytics();
  }, []);

  const performClockOut = useCallback(
    async (id) => {
      if (!id || clockOutInFlightRef.current) return false;

      clockOutInFlightRef.current = true;
      try {
        await updateTimeLog(id, { endTime: "server" });
        enqueue("Clocked out successfully.", { severity: "success" });
        return true;
      } catch (error) {
        logError(error, { where: "App", action: "clockOutRequest", id });
        enqueue("Failed to end session.", { severity: "error" });
        return false;
      } finally {
        clockOutInFlightRef.current = false;
      }
    },
    [enqueue],
  );

  useEffect(() => {
    // fire on route change only
    trackPageView(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const unsubscribe = on("OPEN_TIME_CLOCK", () => {
      navigate("/clock");
    });
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [navigate]);

  useEffect(() => {
    const unsubscribe = on("CLOCK_OUT_REQUEST", async () => {
      if (clockOutInFlightRef.current) return;

      if (activeTimeLogId) {
        await performClockOut(activeTimeLogId);
        return;
      }

      pendingClockOutRef.current = true;
      if (!pendingClockOutTimerRef.current) {
        pendingClockOutTimerRef.current = setTimeout(() => {
          if (pendingClockOutRef.current) {
            enqueue("No active session to clock out.", { severity: "warning" });
            pendingClockOutRef.current = false;
          }
          pendingClockOutTimerRef.current = null;
        }, 2000);
      }
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [activeTimeLogId, enqueue, performClockOut]);

  useEffect(() => {
    if (!pendingClockOutRef.current) return;
    if (!activeTimeLogId) return;
    if (clockOutInFlightRef.current) return;

    pendingClockOutRef.current = false;
    if (pendingClockOutTimerRef.current) {
      clearTimeout(pendingClockOutTimerRef.current);
      pendingClockOutTimerRef.current = null;
    }
    performClockOut(activeTimeLogId);
  }, [activeTimeLogId, performClockOut]);

  useEffect(
    () => () => {
      if (pendingClockOutTimerRef.current) {
        clearTimeout(pendingClockOutTimerRef.current);
        pendingClockOutTimerRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    if (!user) return;
    ensureFcmToken(user).catch((e) =>
      console.warn("[LRP] ensureFcmToken:", e?.message || e),
    );
  }, [user]);
  const handleRefresh = useCallback(() => window.location.reload(), []);
  const [showEliteBadge, setShowEliteBadge] = useState(false);
  const [changeDriverOpen, setChangeDriverOpen] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
  const [phonePromptOpen, setPhonePromptOpen] = useState(false);
  const isFullyReady = isAppReady && !!driver;
  const hasFetchedRef = useRef(false);
  const hadUserRef = useRef(!!localStorage.getItem("lrpUser"));
  const selectedDriver = driver?.name || "";
  const isAdmin = authRole === "admin";

  const {
    showOffline,
    retry: retryConnection,
    dismiss: dismissOffline,
  } = useNetworkStatus(() =>
    enqueue("✅ Reconnected", { severity: "success" }),
  );

  const openChangeDriver = useCallback(() => setChangeDriverOpen(true), []);
  const closeChangeDriver = useCallback(() => setChangeDriverOpen(false), []);

  const noop = useCallback(() => {}, []);

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
          if (!String(record.phone || "").trim()) {
            setPhonePromptOpen(true);
          }
        } else {
          enqueue("Access denied", { severity: "error" });
          await logout();
          setDriver(null);
        }
        setTimeout(() => setIsAppReady(true), 50);
      })();
    } else {
      setDriver(null);
      if (hadUserRef.current) {
        enqueue("Session expired. Please log in again.", { severity: "error" });
      }
      setIsAppReady(true);
    }
  }, [user, fetchDrivers, setDriver, enqueue]);

  useEffect(() => {
    const handler = (e) => {
      const reg = e.detail?.registration;
      enqueue("New version available — Reload", {
        severity: "info",
        action: (
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              try {
                reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
              } catch (e) {
                void e; // ignore
              }
              window.location.reload();
            }}
          >
            Reload
          </Button>
        ),
      });
    };
    window.addEventListener("SW_UPDATED", handler);
    return () => window.removeEventListener("SW_UPDATED", handler);
  }, [enqueue]);

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
        <ErrorBoundary>
          <Suspense
            fallback={
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  py: 4,
                }}
              >
                <LinearProgress
                  sx={{ width: { xs: "100%", sm: "60%" } }}
                  aria-label="Loading routes"
                />
              </Box>
            }
          >
            <Routes>
              <Route path="/" element={<Navigate to="/rides" replace />} />
              <Route path="/rides" element={<ClaimRides />} />
              <Route path="/__/auth/iframe" element={<div />} />
              <Route
                path="/clock"
                element={
                  <TimeClock driver={selectedDriver} setIsTracking={noop} />
                }
              />
              <Route path="/shootout" element={<ShootoutTab />} />
              <Route
                path="/scan"
                element={<Navigate to="/tickets" replace />}
              />
              <Route path="/info" element={<DriverInfoTab />} />
              <Route
                path="/drop-guides"
                element={<Navigate to="/info" replace />}
              />
              <Route
                path="/vehicle-tips"
                element={<Navigate to="/info" replace />}
              />
              <Route path="/directory" element={<DirectoryEscalations />} />
              <Route path="/calendar" element={<CalendarHubLazy />} />
              <Route
                path="/escalation"
                element={<DirectoryEscalations initialTab="escalations" />}
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
                element={isAdmin ? <AdminUserManager /> : <Navigate to="/" />}
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
                path="/tickets/scan"
                element={<Navigate to="/tickets" replace />}
              />
              <Route
                path="/generate-ticket"
                element={
                  <Navigate
                    to={isAdmin ? "/tickets?tab=generate" : "/tickets"}
                    replace
                  />
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
        </ErrorBoundary>

        {isAdmin && (
          <ChangeDriverModal
            open={changeDriverOpen}
            onClose={closeChangeDriver}
          />
        )}

        <OfflineNotice
          open={showOffline}
          onRetry={retryConnection}
          onClose={dismissOffline}
        />
        <PhoneNumberPrompt
          open={phonePromptOpen}
          email={user.email}
          onClose={() => setPhonePromptOpen(false)}
        />
        <NotificationsOptInDialog user={user} />
        {!authLoading && <PermissionGate user={user} />}
        <GlobalChrome />
        <ClockOutConfirm />
        <NotifDiag />
      </AppShell>
    </LocalizationProvider>
  );
}

export default App;
