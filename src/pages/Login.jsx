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
import { useNavigate } from "react-router-dom";
import { GoogleAuthProvider, signInWithCredential, signInWithRedirect, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, provider } from "../firebase";
import useDarkMode from "../hooks/useDarkMode";
import useToast from "../hooks/useToast";
import getTheme from "../theme";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authInProgress, setAuthInProgress] = useState(false);
  const { toast, showToast, closeToast } = useToast("success");
  const [darkMode] = useDarkMode();
  const initRef = useRef(false);

  const theme = useMemo(() => getTheme(darkMode), [darkMode]);

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error("🚨 VITE_GOOGLE_CLIENT_ID is missing from environment variables.");
      return;
    }
    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (!response?.credential) {
            console.error("🚨 One Tap returned no credential", response);
            return;
          }
          try {
            const credential = GoogleAuthProvider.credential(
              response.credential,
            );
            const result = await signInWithCredential(auth, credential);
            console.log("Current user:", auth.currentUser);
            if (import.meta.env.DEV && result.user) {
              console.log(
                "✅ One Tap signed in",
                result.user.email,
                result.user.uid,
              );
            }
            navigate("/dashboard");
          } catch (err) {
            console.error("🚨 Firebase sign-in failed", err);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: false,
      });
      window.google.accounts.id.prompt();
    }
  }, [navigate, loading]);

  const handleGoogleLogin = useCallback(async () => {
    setAuthInProgress(true);
    try {
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithRedirect(auth, provider);
    } catch (err) {
      showToast(err.message, "error");
      setAuthInProgress(false);
    }
  }, [showToast]);

  const handleEmailAuth = useCallback(async () => {
    setAuthInProgress(true);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate("/dashboard");
    } catch (err) {
      showToast(err.message, "error");
      setAuthInProgress(false);
    }
  }, [isRegistering, email, password, showToast, navigate]);

  if (loading) return null;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
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
            onClick={handleGoogleLogin}
            sx={{ mb: 2 }}
            disabled={authInProgress}
          >
            SIGN IN WITH GOOGLE
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
            {isRegistering ? "REGISTER" : "LOGIN"}
          </Button>
          <Button
            fullWidth
            color="secondary"
            sx={{ mt: 1 }}
            onClick={() => setIsRegistering(!isRegistering)}
            disabled={authInProgress}
          >
            {isRegistering ? "Have an account? Login" : "Need an account? Register"}
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
