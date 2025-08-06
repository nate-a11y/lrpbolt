// src/pages/Login.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ThemeProvider,
  CssBaseline,
  Container,
  Card,
  CardContent,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Box,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import MailIcon from "@mui/icons-material/Mail";
import KeyIcon from "@mui/icons-material/Key";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  loginWithPopup,
  loginWithEmail,
  loginWithRedirect,
} from "../services/auth";
import useDarkMode from "../hooks/useDarkMode";
import getTheme from "../theme";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [darkMode, toggleDarkMode] = useDarkMode();
  const theme = useMemo(() => getTheme(darkMode), [darkMode]);
  const navigate = useNavigate();

  // Restore last-used email for convenience
  useEffect(() => {
    const last = localStorage.getItem("lrp:lastEmail");
    if (last) setEmail(last);
  }, []);

  const authAndRedirect = useCallback(
    async (fn, saveEmail = false) => {
      setLoading(true);
      setError("");
      try {
        await fn();
        if (saveEmail) localStorage.setItem("lrp:lastEmail", email);
        navigate("/", { replace: true });
      } catch (e) {
        setError(e.message || "Something went wrong, please try again.");
      } finally {
        setLoading(false);
      }
    },
    [email, navigate],
  );

  const handleGooglePopup = useCallback(
    () => authAndRedirect(loginWithPopup),
    [authAndRedirect],
  );

  const handleGoogleRedirect = useCallback(
    () => authAndRedirect(loginWithRedirect),
    [authAndRedirect],
  );

  const emailPasswordLogin = useCallback(
    () => loginWithEmail(email, password),
    [email, password],
  );

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      authAndRedirect(emailPasswordLogin, true);
    },
    [authAndRedirect, emailPasswordLogin],
  );

  const handleEmailChange = useCallback((e) => setEmail(e.target.value), []);

  const handlePasswordChange = useCallback(
    (e) => setPassword(e.target.value),
    [],
  );

  const handleTogglePw = useCallback(() => setShowPw((s) => !s), []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container
        maxWidth="xs"
        sx={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 120 }}
          style={{ width: "100%" }}
        >
          <Card elevation={6} sx={{ borderRadius: 2, position: "relative" }}>
            {/* Dark Mode Toggle */}
            <IconButton
              onClick={toggleDarkMode}
              sx={{ position: "absolute", top: 8, right: 8 }}
              size="large"
            >
              {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>

            <CardContent sx={{ p: 4 }}>
              {/* Logo + Title */}
              <Box sx={{ textAlign: "center", mb: 2 }}>
                <img
                  src="/logo192.png" // replace with your LRP logo path
                  alt="Lake Ride Pros"
                  width={48}
                  style={{ marginBottom: 8 }}
                />
                <Typography variant="h5" component="h1">
                  Driver Portal – Elite Access
                </Typography>
              </Box>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {/* Google Popup */}
              <Button
                fullWidth
                variant="contained"
                onClick={handleGooglePopup}
                disabled={loading}
                sx={{ py: 1.5 }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  "Sign in with Google"
                )}
              </Button>

              {/* OR Divider */}
              <Divider sx={{ my: 3 }}>OR</Divider>

              {/* Email Form */}
              <Box component="form" noValidate onSubmit={handleSubmit}>
                <TextField
                  label="Email"
                  type="email"
                  required
                  fullWidth
                  autoFocus
                  value={email}
                  onChange={handleEmailChange}
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MailIcon />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ mb: 2 }}
                />

                <TextField
                  label="Password"
                  type={showPw ? "text" : "password"}
                  required
                  fullWidth
                  value={password}
                  onChange={handlePasswordChange}
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <KeyIcon />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleTogglePw}
                          edge="end"
                          size="large"
                        >
                          {showPw ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ mb: 3 }}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={loading || !email || !password}
                  sx={{ py: 1.5 }}
                >
                  {loading ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    "Sign in with Email"
                  )}
                </Button>
              </Box>

              {/* Optional: Redirect-based Google in case popup is blocked */}
              <Button
                fullWidth
                variant="outlined"
                onClick={handleGoogleRedirect}
                disabled={loading}
                sx={{ mt: 2, py: 1.5 }}
              >
                {loading ? <CircularProgress size={24} /> : "Google (Redirect)"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </Container>
    </ThemeProvider>
  );
}
