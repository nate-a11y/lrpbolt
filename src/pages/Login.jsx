// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import {
  ThemeProvider,
  CssBaseline,
  Container,
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Visibility, VisibilityOff, Mail, Key, Sun, Moon } from "@mui/icons-material";
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
  const theme = getTheme(darkMode);
  const navigate = useNavigate();

  // restore last-used email
  useEffect(() => {
    const last = localStorage.getItem("lrp:lastEmail");
    if (last) setEmail(last);
  }, []);

  const authAndRedirect = async (fn, storeEmail = false) => {
    setLoading(true);
    setError("");
    try {
      await fn();
      if (storeEmail) localStorage.setItem("lrp:lastEmail", email);
      navigate("/", { replace: true });
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container
        maxWidth="sm"
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
          <Card elevation={8} sx={{ borderRadius: 2, position: "relative" }}>
            {/* Dark Mode Toggle */}
            <IconButton
              onClick={toggleDarkMode}
              sx={{ position: "absolute", top: 8, right: 8 }}
            >
              {darkMode ? <Sun /> : <Moon />}
            </IconButton>

            <CardContent sx={{ p: 4 }}>
              <Typography variant="h4" align="center" gutterBottom>
                Driver Portal Login
              </Typography>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {/* Google Popup */}
              <Button
                fullWidth
                variant="contained"
                onClick={() => authAndRedirect(loginWithPopup)}
                disabled={loading}
                sx={{ py: 1.5, mb: 1 }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  "Continue with Google"
                )}
              </Button>

              {/* Google Redirect */}
              <Button
                fullWidth
                variant="outlined"
                onClick={() => authAndRedirect(loginWithRedirect)}
                disabled={loading}
                sx={{ py: 1.5, mb: 3 }}
              >
                {loading ? (
                  <CircularProgress size={24} />
                ) : (
                  "Google (Redirect)"
                )}
              </Button>

              {/* Email Form */}
              <Box
                component="form"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  authAndRedirect(() => loginWithEmail(email, password), true);
                }}
              >
                <TextField
                  label="Email"
                  type="email"
                  required
                  fullWidth
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Mail />
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
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Key />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPw((s) => !s)}
                          edge="end"
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
            </CardContent>
          </Card>
        </motion.div>
      </Container>
    </ThemeProvider>
  );
}
