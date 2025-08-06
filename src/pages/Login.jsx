import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Divider,
  TextField,
  Snackbar,
  Alert,
  CircularProgress,
  Backdrop,
} from "@mui/material";
import { Navigate } from "react-router-dom";
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../firebase";
import useDarkMode from "../hooks/useDarkMode";
import useToast from "../hooks/useToast";
import getTheme from "../theme";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { useAuth } from "../context/AuthContext.jsx";
import LoadingScreen from "../components/LoadingScreen.jsx";

export default function Login() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authInProgress, setAuthInProgress] = useState(false);
  const { toast, showToast, closeToast } = useToast("success");
  const [darkMode] = useDarkMode();
  const initRef = useRef(false);

  const theme = useMemo(() => getTheme(darkMode), [darkMode]);

  const handleCredentialResponse = useCallback((response) => {
    console.log("[Google One Tap] Credential received:", response);
    if (!response?.credential) {
      console.error("[Google One Tap] No credential returned", response);
      return;
    }
    const credential = GoogleAuthProvider.credential(response.credential);
    signInWithCredential(auth, credential)
      .then((res) =>
        console.log("[Google One Tap] Sign in success:", res.user),
      )
      .catch((err) =>
        console.error("[Google One Tap] Sign in error:", err),
      );
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    console.log("[Google One Tap] Initializing...");
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error("[Google One Tap] Missing client ID.");
      return;
    }
    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
      });
      window.google.accounts.id.prompt(() => {
        console.log("[Google One Tap] Prompt displayed.");
      });
    }
  }, [handleCredentialResponse]);

  const manualGoogleSignIn = useCallback(() => {
    console.log("[Google Button] Clicked.");
    signInWithPopup(auth, new GoogleAuthProvider()).catch((err) =>
      console.error("[Google Button] Sign in error:", err),
    );
  }, []);

  const handleEmailAuth = useCallback(async () => {
    setAuthInProgress(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("[Email/Password Login] Attempt complete.");
    } catch (err) {
      showToast(err.message, "error");
      setAuthInProgress(false);
    }
  }, [email, password, showToast]);

  if (loading) return <LoadingScreen />;
  if (user) {
    console.log("[Login] User authenticated. Redirecting to dashboard.");
    return <Navigate to="/dashboard" />;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div id="one-tap-container" />
      <Box
        sx={{
          minHeight: "100vh",
          background: darkMode
            ? "linear-gradient(135deg, #111, #1e1e1e)"
            : "linear-gradient(135deg, #e0ffe7, #ffffff)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Paper
          elevation={6}
          sx={{
            p: 4,
            maxWidth: 420,
            width: "100%",
            borderRadius: 3,
            textAlign: "center",
          }}
        >
          <img
            src="https://lakeridepros.xyz/Color%20logo%20-%20no%20background.png"
            alt="Logo"
            style={{ height: 56, marginBottom: 16 }}
          />
          <Typography
            variant="h6"
            sx={{ mb: 2, fontWeight: "bold", color: "primary.main" }}
          >
            🚀 Driver Portal – Elite Access
          </Typography>
          <Button
            fullWidth
            variant="contained"
            onClick={manualGoogleSignIn}
            sx={{ mb: 2 }}
            disabled={authInProgress}
          >
            Sign in with Google
          </Button>
          <Divider sx={{ my: 2 }}>OR</Divider>
          <TextField
            fullWidth
            margin="dense"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={authInProgress}
          />
          <TextField
            fullWidth
            margin="dense"
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={authInProgress}
          />
          <Button
            fullWidth
            sx={{ mt: 2 }}
            variant="outlined"
            onClick={handleEmailAuth}
            disabled={authInProgress}
          >
            Login
          </Button>
        </Paper>
        <Snackbar open={toast.open} autoHideDuration={3000} onClose={closeToast}>
          <Alert severity={toast.severity} variant="filled" onClose={closeToast}>
            {toast.message}
          </Alert>
        </Snackbar>
        <Backdrop open={authInProgress} sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </Box>
    </ThemeProvider>
  );
}
