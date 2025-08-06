import React, { useCallback, useMemo, useState } from "react";
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
import { Navigate, useNavigate } from "react-router-dom";
import {
  GoogleAuthProvider,
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
import { logError } from "../utils/logError";

export default function Login() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authInProgress, setAuthInProgress] = useState(false);
  const { toast, showToast, closeToast } = useToast("success");
  const [darkMode] = useDarkMode();
  const navigate = useNavigate();

    const theme = useMemo(() => getTheme(darkMode), [darkMode]);

    const manualGoogleSignIn = useCallback(async () => {
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
        navigate("/rides", { replace: true });
      } catch (err) {
        logError(err, "Login");
      }
    }, [navigate]);

    const handleEmailAuth = useCallback(async () => {
      setAuthInProgress(true);
      try {
        await signInWithEmailAndPassword(auth, email, password);
        navigate("/rides", { replace: true });
      } catch (err) {
        logError(err, "Login");
        showToast(err?.message || "Login failed", "error");
        setAuthInProgress(false);
      }
    }, [email, password, showToast, navigate]);

  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/rides" replace />;

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
