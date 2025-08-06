import React, { useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Divider,
  TextField,
  Alert,
  CircularProgress,
  Backdrop,
} from "@mui/material";
import { Navigate, useNavigate } from "react-router-dom";
import { loginWithPopup, loginWithRedirect, loginWithEmail } from "../firebase";
import useDarkMode from "../hooks/useDarkMode";
import getTheme from "../theme";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { useAuth } from "../context/AuthContext.jsx";
import LoadingScreen from "../components/LoadingScreen.jsx";

export default function Login() {
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [darkMode] = useDarkMode();
  const navigate = useNavigate();

  const theme = useMemo(() => getTheme(darkMode), [darkMode]);

  const handlePopup = async () => {
    setLoading(true);
    try {
      await loginWithPopup();
      navigate("/");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRedirect = async () => {
    setLoading(true);
    try {
      await loginWithRedirect();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      navigate("/");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return <LoadingScreen />;
  if (user) return <Navigate to="/" replace />;

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
            onClick={handlePopup}
            sx={{ mb: 2 }}
            disabled={loading}
          >
            Sign in with Google (Popup)
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={handleRedirect}
            sx={{ mb: 2 }}
            disabled={loading}
          >
            Sign in with Google (Redirect)
          </Button>
          <Divider sx={{ my: 2 }}>OR</Divider>
          <Box component="form" onSubmit={handleEmailLogin}>
            <TextField
              fullWidth
              margin="dense"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <TextField
              fullWidth
              margin="dense"
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <Button
              fullWidth
              sx={{ mt: 2 }}
              variant="outlined"
              type="submit"
              disabled={loading}
            >
              Login
            </Button>
          </Box>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Paper>
        <Backdrop open={loading} sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
          <CircularProgress color="inherit" />
        </Backdrop>
      </Box>
    </ThemeProvider>
  );
}
