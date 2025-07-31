/* Proprietary and confidential. See LICENSE. */
// src/App.jsx
import React, { useEffect, useMemo, useState, useRef, Suspense, lazy } from 'react';
import {
  ThemeProvider, createTheme, CssBaseline, Box, Typography, Button,
  Snackbar, Alert, Switch, Divider, TextField, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions, Toolbar, CircularProgress,
  Backdrop
} from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import InstallBanner from './components/InstallBanner';
import ChangeDriverModal from './components/ChangeDriverModal';
import SidebarNavigation from './components/SidebarNavigation';
import useDarkMode from './hooks/useDarkMode';
import DriverInfoTab from './components/DriverInfoTab';
import CalendarUpdateTab from './components/CalendarUpdateTab';
import VehicleDropGuides from './components/VehicleDropGuides';
import DriverDirectory from './components/DriverDirectory';
import ContactEscalation from './components/ContactEscalation';
import ResponsiveHeader from './components/ResponsiveHeader';
import { motion } from 'framer-motion';
import { Routes, Route } from 'react-router-dom';
import TicketGenerator from './components/TicketGenerator';
import TicketViewer from './components/TicketViewer';
import TicketScanner from './components/TicketScanner';
import Tickets from './components/Tickets';
import {
  auth, provider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, onAuthStateChanged
} from './firebase';
import { BASE_URL } from './hooks/api';
import './index.css';
import { TIMEZONE } from './constants';

const RideClaimTab = lazy(() => import('./components/RideClaimTab'));
const TimeClock = lazy(() => import('./components/TimeClock'));
const AdminTimeLog = lazy(() => import('./components/AdminTimeLog'));
const RideEntryForm = lazy(() => import('./components/RideEntryForm'));
const RideVehicleCalendar = lazy(() => import('./components/RideVehicleCalendar'));


const dayjs = window.dayjs;
dayjs.extend(window.dayjs_plugin_utc);
dayjs.extend(window.dayjs_plugin_timezone);
const CST = TIMEZONE;

const isInLockoutWindow = () => {
  const now = dayjs().tz(CST);
  const hour = now.hour();
  return hour >= 18 && hour < 20;
};

const preloadDriverList = async () => {
  const cached = localStorage.getItem("lrp_driverList");
  const expires = localStorage.getItem("lrp_driverList_exp");
  const now = Date.now();
  if (cached && expires && now < parseInt(expires, 10)) return;

  try {
    const res = await fetch(`${BASE_URL}?type=driverEmails`);
    const data = await res.json();
    localStorage.setItem("lrp_driverList", JSON.stringify(data));
    localStorage.setItem("lrp_driverList_exp", now + 86400000);
  } catch {
    // ignore preload errors
  }
};
preloadDriverList();
export default function App() {
  const [darkMode, setDarkMode] = useDarkMode();
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(() => localStorage.getItem("lrp_driver") || '');
  const [tabIndex, setTabIndex] = useState(() => parseInt(localStorage.getItem("lrp_tabIndex") || 0, 10));
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("lrpUser")) || null);
  const [role, setRole] = useState(() => localStorage.getItem("lrpRole") || null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const [showEliteBadge, setShowEliteBadge] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [changeDriverOpen, setChangeDriverOpen] = useState(false);
  const [isLockedOut, setIsLockedOut] = useState(isInLockoutWindow());
  const [isAppReady, setIsAppReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const isFullyReady = isAppReady && !!selectedDriver;
  const hasFetchedRef = useRef(false);

  const fetchDrivers = async (userEmail) => {
    const cached = localStorage.getItem("lrp_driverList");
    const expires = localStorage.getItem("lrp_driverList_exp");
    const now = Date.now();

    let data;

    if (cached && expires && now < parseInt(expires, 10)) {
      data = JSON.parse(cached);
    } else {
      try {
        const res = await fetch(`${BASE_URL}?type=driverEmails`);
        data = await res.json();
        localStorage.setItem("lrp_driverList", JSON.stringify(data));
        localStorage.setItem("lrp_driverList_exp", now + 86400000);
      } catch (err) {
        console.error("Failed to fetch drivers:", err);
        data = [];
      }
    }

    const names = data.map(d => d.name);
    setDrivers(names);

    const match = data.find(d => d.email?.toLowerCase() === userEmail?.toLowerCase());
    const resolvedName = match?.name || userEmail || '';

    return resolvedName;
  };

  const fetchRole = async (email) => {
    try {
      const cached = localStorage.getItem("lrp_roles");
      const expires = localStorage.getItem("lrp_roles_exp");
      const now = Date.now();
      let data;

      if (cached && expires && now < parseInt(expires, 10)) {
        data = JSON.parse(cached);
      } else {
        const res = await fetch(`${BASE_URL}?type=access`);
        data = await res.json();
        localStorage.setItem("lrp_roles", JSON.stringify(data));
        localStorage.setItem("lrp_roles_exp", now + 86400000);
      }

      const match = data.find(u => u.email.toLowerCase() === email.toLowerCase());
      const access = match?.access || 'User';
      setRole(access);
      localStorage.setItem("lrpRole", access);
    } catch (err) {
      console.error("Failed to fetch role:", err);
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(";").forEach(cookie => {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      });
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) await reg.unregister();
      }
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) await caches.delete(name);
      }
      const dbs = await indexedDB.databases?.();
      for (const db of dbs || []) {
        await indexedDB.deleteDatabase(db.name);
      }
      window.location.reload();
    } catch (err) {
      setToast({ open: true, message: "Sign out failed", severity: "error" });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!hasFetchedRef.current) {
        hasFetchedRef.current = true;

        if (u) {
          localStorage.setItem("lrpUser", JSON.stringify(u));
          setUser(u);
          await fetchRole(u.email);
          const driverName = await fetchDrivers(u.email);
          setSelectedDriver(driverName);
          localStorage.setItem("lrp_driver", driverName);
          setTimeout(() => setIsAppReady(true), 50);
        } else {
          setUser(null);
          setRole(null);
          setSelectedDriver('');
          localStorage.removeItem("lrpUser");
          localStorage.removeItem("lrpRole");
          localStorage.removeItem("lrp_driver");
          setIsAppReady(true);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setIsLockedOut(isInLockoutWindow()), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (showEliteBadge) {
      const t = setTimeout(() => setShowEliteBadge(false), 5000);
      return () => clearTimeout(t);
    }
  }, [showEliteBadge]);
  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    try {
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const u = result.user;
  
      localStorage.setItem("lrpUser", JSON.stringify(u));
      setUser(u);
  
      setShowEliteBadge(true);
  
      await fetchRole(u.email);
      const driverName = await fetchDrivers(u.email);
      setSelectedDriver(driverName);
      localStorage.setItem("lrp_driver", driverName);
    } catch (err) {
      setToast({ open: true, message: err.message, severity: 'error' });
    } finally {
      setAuthLoading(false);
    }
  };
  
  
  const handleEmailAuth = async () => {
    setAuthLoading(true);
    try {
      const result = isRegistering
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);
      
      const u = result.user;
      localStorage.setItem("lrpUser", JSON.stringify(u));
      setUser(u);
  
      setShowEliteBadge(true);
  
      await fetchRole(u.email);
      const driverName = await fetchDrivers(u.email);
      setSelectedDriver(driverName);
      localStorage.setItem("lrp_driver", driverName);
    } catch (err) {
      setToast({ open: true, message: err.message, severity: 'error' });
    } finally {
      setAuthLoading(false);
    }
  };
  
  const theme = useMemo(() => createTheme({
    palette: { mode: darkMode ? 'dark' : 'light', primary: { main: '#4cbb17' } },
    typography: { fontFamily: 'Inter, sans-serif' }
  }), [darkMode]);

  if (!user || !role) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: '100vh',
            background: darkMode ? 'linear-gradient(135deg, #111, #1e1e1e)' : 'linear-gradient(135deg, #e0ffe7, #ffffff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2
          }}
        >
          <Paper elevation={6} sx={{ p: 4, maxWidth: 420, width: '100%', borderRadius: 3, textAlign: 'center' }}>
            <img src="https://lakeridepros.xyz/Color%20logo%20-%20no%20background.png" alt="Logo" style={{ height: 56, marginBottom: 16 }} />
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main' }}>🚀 Driver Portal – Elite Access</Typography>
            <Button fullWidth variant="contained" onClick={handleGoogleLogin} sx={{ mb: 2 }} disabled={authLoading}>
              SIGN IN WITH GOOGLE
            </Button>
            <Divider sx={{ my: 2 }}>OR</Divider>
            <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth sx={{ mb: 2 }} />
            <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth sx={{ mb: 2 }} />
            <Button fullWidth variant="outlined" onClick={handleEmailAuth} disabled={authLoading}>
              {isRegistering ? 'REGISTER & SIGN IN' : 'SIGN IN WITH EMAIL'}
            </Button>
            <Button fullWidth size="small" onClick={() => setIsRegistering(!isRegistering)} sx={{ mt: 1 }} disabled={authLoading}>
              {isRegistering ? 'Already have an account? Sign In' : 'Need an account? Register'}
            </Button>
            <Box display="flex" justifyContent="center" mt={3}>
              <Typography variant="caption">🌙 Dark Mode</Typography>
              <Switch checked={darkMode} onChange={() => setDarkMode(!darkMode)} size="small" />
            </Box>
          </Paper>
        </Box>
        <Backdrop
          sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
          open={authLoading}
        >
          <CircularProgress color="inherit" />
        </Backdrop>
      </ThemeProvider>
    );
  }

  if (!isFullyReady) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
  selectedDriver={selectedDriver}
  role={role}
  onChangeDriver={() => setChangeDriverOpen(true)}
  onSignOut={() => setSignOutConfirmOpen(true)}
  setTabIndex={setTabIndex}
/>
      <Box sx={{ display: 'flex' }}>
        <SidebarNavigation tabIndex={tabIndex} setTabIndex={setTabIndex} role={role} />
        <Box
  component="main"
  sx={{
    flexGrow: 1,
    p: 3,
    maxWidth: '100%',
    mt: '64px', // keep this for AppBar spacing
    ml: 0       // ← remove sidebar offset here
  }}
>
          <Toolbar />
          <Suspense fallback={<CircularProgress />}>
            <ErrorBoundary
              fallbackRender={({ error }) => (
                <Typography color="error" sx={{ mt: 4 }}>
                  🚨 Something went wrong: {error.message}
                </Typography>
              )}
            >
<Routes>
  <Route
    path="/"
    element={
      <RideClaimTab
        driver={selectedDriver}
        isAdmin={role === 'Admin'}
        isLockedOut={role !== 'Admin' && isLockedOut}
      />
    }
  />
  <Route path="/rides" element={
    <RideClaimTab
      driver={selectedDriver}
      isAdmin={role === 'Admin'}
      isLockedOut={role !== 'Admin' && isLockedOut}
    />
  } />
  <Route path="/clock" element={<TimeClock driver={selectedDriver} setIsTracking={() => {}} />} />
  <Route path="/scan" element={<TicketScanner />} />
  <Route path="/info" element={<DriverInfoTab />} />
  <Route path="/drop-guides" element={<VehicleDropGuides />} />
  <Route path="/directory" element={<DriverDirectory />} />
  <Route path="/calendar" element={<CalendarUpdateTab />} />
  <Route path="/escalation" element={<ContactEscalation />} />
  <Route path="/vehicle-calendar" element={<RideVehicleCalendar />} />
  <Route path="/admin-time-log" element={<AdminTimeLog driver={selectedDriver} />} />
    <Route path="/ride-entry" element={<RideEntryForm />} />
  <Route path="/Tickets" element={<Tickets />} />
  <Route path="/generate-ticket" element={<TicketGenerator />} />
  <Route path="/ticket/:ticketId" element={<TicketViewer />} />
  <Route
    path="*"
    element={
      <Typography sx={{ mt: 6, textAlign: 'center', color: 'error.main' }}>
        🚧 404 — Page Not Found
      </Typography>
    }
  />
</Routes>


            </ErrorBoundary>
          </Suspense>
  
          <Dialog open={signOutConfirmOpen} onClose={() => setSignOutConfirmOpen(false)}>
            <DialogTitle sx={{ fontWeight: 'bold', color: '#d32f2f' }}>💥 Confirm Sign Out</DialogTitle>
            <DialogContent dividers>
              <Typography>
                Are you sure you want to <strong>log out of Beast Mode™</strong>?
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSignOutConfirmOpen(false)}>Cancel</Button>
              <Button onClick={handleSignOut} variant="contained" color="error">
                Log Me Out
              </Button>
            </DialogActions>
          </Dialog>
  
          <ChangeDriverModal
            open={changeDriverOpen}
            onClose={() => setChangeDriverOpen(false)}
            drivers={drivers}
            currentDriver={selectedDriver}
            setDriver={(d) => {
              setSelectedDriver(d);
              localStorage.setItem("lrp_driver", d);
            }}
          />
  
          <Snackbar
            open={toast.open}
            autoHideDuration={3000}
            onClose={() => setToast({ ...toast, open: false })}
          >
            <Alert severity={toast.severity} variant="filled">{toast.message}</Alert>
          </Snackbar>
  
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
          >
            <Box
              sx={{
                mt: 6,
                py: 3,
                px: 3,
                borderTop: '2px dashed',
                borderColor: 'primary.main',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                fontSize: '0.9rem',
                color: 'text.secondary',
                backgroundColor: (theme) =>
                  theme.palette.mode === 'dark' ? '#111' : '#f4fff4',
                textAlign: 'center',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'success.main',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                🚀 Version: <span style={{ fontFamily: 'monospace' }}>v2.3.5</span> • Lake Ride Pros © {new Date().getFullYear()}
              </Typography>
  
              <Button
                size="small"
                variant="outlined"
                color="error"
                sx={{
                  fontWeight: 'bold',
                  borderWidth: 2,
                  '&:hover': {
                    backgroundColor: 'error.main',
                    color: '#fff',
                  },
                }}
                onClick={() => {
                  if (window.confirm("Clear cache and reload? You'll be signed out.")) {
                    localStorage.clear();
                    sessionStorage.clear();
                    if (auth?.signOut) auth.signOut();
                    if ('caches' in window) caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
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
