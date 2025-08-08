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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
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
  // NEW (make sure these exist in services/auth)
  sendPasswordReset,
  registerWithEmail,
} from "../services/auth";
import useDarkMode from "../hooks/useDarkMode";
import getTheme from "../theme";

// basic email validation
const isEmail = (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

// friendly error messages
function mapAuthError(err) {
  const msg = String(err?.message || "").toLowerCase();
  if (msg.includes("popup-closed")) return "Sign‑in window was closed.";
  if (msg.includes("network")) return "Network error. Check your connection.";
  if (msg.includes("too-many-requests"))
    return "Too many attempts. Please wait a moment.";
  if (msg.includes("wrong-password") || msg.includes("invalid-credential"))
    return "Incorrect email or password.";
  if (msg.includes("user-not-found")) return "No account found for that email.";
  if (msg.includes("email-already-in-use"))
    return "This email is already registered. Try signing in.";
  if (msg.includes("weak-password"))
    return "Password is too weak. Use at least 6 characters.";
  if (msg.includes("popup-blocked"))
    return "Popup blocked. Try the Google (Redirect) option.";
  return "Something went wrong. Please try again.";
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // split loading states so buttons don't step on each other
  const [emailLoading, setEmailLoading] = useState(false);
  const [googlePopupLoading, setGooglePopupLoading] = useState(false);
  const [googleRedirectLoading, setGoogleRedirectLoading] = useState(false);

  // reset + register dialog state
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState("");

  const [regOpen, setRegOpen] = useState(false);
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPassword2, setRegPassword2] = useState("");
  const [regShowPw, setRegShowPw] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");

  const [error, setError] = useState("");
  const [darkMode, toggleDarkMode] = useDarkMode();
  const theme = useMemo(() => getTheme(darkMode), [darkMode]);
  const navigate = useNavigate();

  // Restore last-used email for convenience
  useEffect(() => {
    const last = localStorage.getItem("lrp:lastEmail");
    if (last) setEmail(last);
  }, []);

  const safeNavigateHome = useCallback(() => {
    navigate("/", { replace: true });
  }, [navigate]);

  const handleGooglePopup = useCallback(async () => {
    if (googlePopupLoading || emailLoading || googleRedirectLoading) return;
    setError("");
    setGooglePopupLoading(true);
    try {
      await loginWithPopup();
      safeNavigateHome();
    } catch (e) {
      setError(mapAuthError(e));
    } finally {
      setGooglePopupLoading(false);
    }
  }, [googlePopupLoading, emailLoading, googleRedirectLoading, safeNavigateHome]);

  const handleGoogleRedirect = useCallback(async () => {
    if (googleRedirectLoading || emailLoading || googlePopupLoading) return;
    setError("");
    setGoogleRedirectLoading(true);
    try {
      await loginWithRedirect(); // page will redirect
    } catch (e) {
      setError(mapAuthError(e));
      setGoogleRedirectLoading(false);
    }
  }, [googleRedirectLoading, emailLoading, googlePopupLoading]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const trimmed = email.trim();
      if (!isEmail(trimmed) || !password) return;
      if (emailLoading || googlePopupLoading || googleRedirectLoading) return;

      setError("");
      setEmailLoading(true);
      try {
        await loginWithEmail(trimmed, password);
        localStorage.setItem("lrp:lastEmail", trimmed);
        safeNavigateHome();
      } catch (e) {
        setError(mapAuthError(e));
      } finally {
        setEmailLoading(false);
      }
    },
    [email, password, emailLoading, googlePopupLoading, googleRedirectLoading, safeNavigateHome]
  );

  // Forgot Password
  const openReset = useCallback(() => {
    setResetEmail(email || "");
    setResetMsg("");
    setResetOpen(true);
  }, [email]);

  const handleSendReset = useCallback(async () => {
    const target = resetEmail.trim();
    setResetMsg("");
    if (!isEmail(target)) {
      setResetMsg("Enter a valid email address.");
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordReset(target);
      setResetMsg("If an account exists for that email, a reset link has been sent.");
    } catch (e) {
      setResetMsg(mapAuthError(e));
    } finally {
      setResetLoading(false);
    }
  }, [resetEmail]);

  // Register
  const openRegister = useCallback(() => {
    setRegOpen(true);
    setRegName("");
    setRegEmail(email || "");
    setRegPassword("");
    setRegPassword2("");
    setRegError("");
  }, [email]);

  const handleRegister = useCallback(async () => {
    const name = regName.trim();
    const em = regEmail.trim();
    const pw = regPassword;
    const pw2 = regPassword2;

    setRegError("");
    if (!name) return setRegError("Please enter your name.");
    if (!isEmail(em)) return setRegError("Enter a valid email address.");
    if (pw.length < 6) return setRegError("Password must be at least 6 characters.");
    if (pw !== pw2) return setRegError("Passwords do not match.");

    if (regLoading || googlePopupLoading || googleRedirectLoading || emailLoading) return;

    setRegLoading(true);
    try {
      await registerWithEmail(name, em, pw); // should sign the user in
      localStorage.setItem("lrp:lastEmail", em);
      setRegOpen(false);
      safeNavigateHome();
    } catch (e) {
      setRegError(mapAuthError(e));
    } finally {
      setRegLoading(false);
    }
  }, [regName, regEmail, regPassword, regPassword2, regLoading, googlePopupLoading, googleRedirectLoading, emailLoading, safeNavigateHome]);

  const handleKeyReg = useCallback((e) => {
    if (e.key === "Enter") handleRegister();
  }, [handleRegister]);

  const handleKeyReset = useCallback((e) => {
    if (e.key === "Enter") handleSendReset();
  }, [handleSendReset]);

  const handleEmailChange = useCallback((e) => setEmail(e.target.value), []);
  const handlePasswordChange = useCallback((e) => setPassword(e.target.value), []);
  const handleTogglePw = useCallback(() => setShowPw((s) => !s), []);

  const emailValid = isEmail(email);
  const anyLoading = emailLoading || googlePopupLoading || googleRedirectLoading;

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
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>

            <CardContent sx={{ p: 4 }}>
              {/* Logo + Title */}
              <Box sx={{ textAlign: "center", mb: 2 }}>
                <img
                  src="/android-chrome-192x192.png"
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
                disabled={anyLoading}
                sx={{ py: 1.5 }}
              >
                {googlePopupLoading ? (
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
                  disabled={anyLoading}
                  error={!!email && !emailValid}
                  helperText={!!email && !emailValid ? "Enter a valid email" : " "}
                  autoComplete="email"
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
                  disabled={anyLoading}
                  autoComplete="current-password"
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
                          aria-label={showPw ? "Hide password" : "Show password"}
                        >
                          {showPw ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ mb: 1.5 }}
                />

                <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
                  <Button
                    variant="text"
                    size="small"
                    onClick={openReset}
                    disabled={anyLoading}
                  >
                    Forgot password?
                  </Button>
                  <Button
                    variant="text"
                    size="small"
                    onClick={openRegister}
                    disabled={anyLoading}
                  >
                    Create account
                  </Button>
                </Stack>

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={anyLoading || !emailValid || password.length === 0}
                  sx={{ py: 1.5 }}
                >
                  {emailLoading ? (
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
                disabled={anyLoading}
                sx={{ mt: 2, py: 1.5 }}
              >
                {googleRedirectLoading ? (
                  <CircularProgress size={24} />
                ) : (
                  "Google (Redirect)"
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </Container>

      {/* Forgot Password Dialog */}
      <Dialog open={resetOpen} onClose={() => !resetLoading && setResetOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Reset password</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Enter your email and we’ll send you a password reset link.
          </Typography>
          <TextField
            label="Email"
            type="email"
            fullWidth
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            onKeyDown={handleKeyReset}
            disabled={resetLoading}
            error={!!resetEmail && !isEmail(resetEmail)}
            helperText={!!resetEmail && !isEmail(resetEmail) ? "Enter a valid email" : " "}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <MailIcon />
                </InputAdornment>
              ),
            }}
          />
          {resetMsg && (
            <Alert severity={resetMsg.startsWith("If an account") ? "success" : "error"}>
              {resetMsg}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)} disabled={resetLoading}>
            Close
          </Button>
          <Button
            onClick={handleSendReset}
            variant="contained"
            disabled={resetLoading || !isEmail(resetEmail)}
            startIcon={resetLoading ? <CircularProgress size={16} /> : null}
          >
            {resetLoading ? "Sending…" : "Send reset link"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Register Dialog */}
      <Dialog open={regOpen} onClose={() => !regLoading && setRegOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Create account</DialogTitle>
        <DialogContent dividers>
          {regError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {regError}
            </Alert>
          )}
          <Stack spacing={2}>
            <TextField
              label="Full name"
              fullWidth
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              disabled={regLoading}
              autoFocus
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              disabled={regLoading}
              error={!!regEmail && !isEmail(regEmail)}
              helperText={!!regEmail && !isEmail(regEmail) ? "Enter a valid email" : " "}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MailIcon />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Password"
              type={regShowPw ? "text" : "password"}
              fullWidth
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              onKeyDown={handleKeyReg}
              disabled={regLoading}
              helperText="Use at least 6 characters."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <KeyIcon />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setRegShowPw((s) => !s)}
                      edge="end"
                      size="large"
                      aria-label={regShowPw ? "Hide password" : "Show password"}
                    >
                      {regShowPw ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Confirm password"
              type={regShowPw ? "text" : "password"}
              fullWidth
              value={regPassword2}
              onChange={(e) => setRegPassword2(e.target.value)}
              onKeyDown={handleKeyReg}
              disabled={regLoading}
              error={regPassword2.length > 0 && regPassword2 !== regPassword}
              helperText={
                regPassword2.length > 0 && regPassword2 !== regPassword
                  ? "Passwords do not match."
                  : " "
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRegOpen(false)} disabled={regLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleRegister}
            variant="contained"
            disabled={
              regLoading ||
              !regName.trim() ||
              !isEmail(regEmail) ||
              regPassword.length < 6 ||
              regPassword !== regPassword2
            }
            startIcon={regLoading ? <CircularProgress size={16} /> : null}
          >
            {regLoading ? "Creating…" : "Create account"}
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}
