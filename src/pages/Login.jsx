/* Proprietary and confidential. See LICENSE. */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
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
  LinearProgress,
  useMediaQuery,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import MailIcon from "@mui/icons-material/Mail";
import KeyIcon from "@mui/icons-material/Key";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import GoogleIcon from "@mui/icons-material/Google";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  loginWithPopup,
  loginWithEmail,
  // removed loginWithRedirect (no redirect UI anymore)
  sendPasswordReset,
  registerWithEmail,
} from "../services/auth";
import { useColorMode } from "../context/ColorModeContext.jsx";

/** utils **/
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
const pwScore = (pw = "") => {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 5); // 0..5
};
function mapAuthError(err) {
  const msg = String(err?.message || "").toLowerCase();
  if (msg.includes("popup-closed")) return "Sign‑in window was closed.";
  if (msg.includes("network")) return "Network error. Check your connection.";
  if (msg.includes("too-many-requests")) return "Too many attempts. Please wait a moment.";
  if (msg.includes("wrong-password") || msg.includes("invalid-credential"))
    return "Incorrect email or password.";
  if (msg.includes("user-not-found")) return "No account found for that email.";
  if (msg.includes("email-already-in-use"))
    return "This email is already registered. Try signing in.";
  if (msg.includes("weak-password"))
    return "Password is too weak. Use at least 6 characters.";
  if (msg.includes("popup-blocked"))
    return "Popup blocked by the browser. Allow popups for this site.";
  return "Something went wrong. Please try again.";
}

export default function Login() {
  const prefersReducedMotion = useReducedMotion();
  const upMd = useMediaQuery("(min-width:900px)");
  const { mode, toggle } = useColorMode();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [caps, setCaps] = useState(false);

  // button loads
  const [emailLoading, setEmailLoading] = useState(false);
  const [googlePopupLoading, setGooglePopupLoading] = useState(false);

  // dialogs
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

    const anyLoading = emailLoading || googlePopupLoading;
    const [error, setError] = useState("");
    const navigate = useNavigate();
    const emailRef = useRef(null);
    const cardRef = useRef(null);

    const safeNavigateHome = useCallback(() => {
      navigate("/", { replace: true });
    }, [navigate]);

    const handleGooglePopup = useCallback(async () => {
      if (anyLoading) return;
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
    }, [anyLoading, safeNavigateHome]);

    // Restore last-used email
    useEffect(() => {
      const last = localStorage.getItem("lrp:lastEmail");
      if (last) setEmail(last);
    }, []);

    // Global shortcuts
    useEffect(() => {
      const onKey = (e) => {
        const mod = e.ctrlKey || e.metaKey;
        if (mod && e.key.toLowerCase() === "k") {
          e.preventDefault(); toggle();
        }
        if (mod && e.key.toLowerCase() === "g") {
          e.preventDefault(); handleGooglePopup();
        }
        if (mod && e.key === "/") {
          e.preventDefault(); emailRef.current?.focus();
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [toggle, handleGooglePopup]);

    const emailValid = isEmail(email);
    const score = pwScore(password);

    const handleSubmit = useCallback(
      async (e) => {
        e.preventDefault();
        const trimmed = email.trim();
        if (!isEmail(trimmed) || !password) return;
        if (anyLoading) return;

      setError("");
      setEmailLoading(true);
      try {
        await loginWithEmail(trimmed, password);
        localStorage.setItem("lrp:lastEmail", trimmed);
        safeNavigateHome();
      } catch (e2) {
        setError(mapAuthError(e2));
        // subtle shake on error
        try {
          cardRef.current?.animate(
            [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }],
            { duration: 300, easing: "ease-in-out" }
          );
        } catch (_) {}
      } finally {
        setEmailLoading(false);
      }
    },
    [email, password, anyLoading, safeNavigateHome]
  );

  // CapsLock detect
  const onPwKeyDown = useCallback((e) => {
    setCaps(e.getModifierState && e.getModifierState("CapsLock"));
    if (e.key === "Enter") handleSubmit(e);
  }, [handleSubmit]);

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
    if (regLoading || anyLoading) return;

    setRegLoading(true);
    try {
      await registerWithEmail(name, em, pw); // signs in
      localStorage.setItem("lrp:lastEmail", em);
      setRegOpen(false);
      safeNavigateHome();
    } catch (e) {
      setRegError(mapAuthError(e));
    } finally {
      setRegLoading(false);
    }
  }, [regName, regEmail, regPassword, regPassword2, regLoading, anyLoading, safeNavigateHome]);

  const handleKeyReg = useCallback((e) => {
    if (e.key === "Enter") handleRegister();
  }, [handleRegister]);

    return (
      <>
        {/* Animated BG */}
        <Box
        sx={{
          position: "fixed",
          inset: 0,
          background: (t) =>
            t.palette.mode === "dark"
              ? "radial-gradient(1200px 600px at 10% -10%, rgba(99,102,241,.25), transparent 60%), radial-gradient(1000px 700px at 110% 110%, rgba(34,197,94,.18), transparent 60%), linear-gradient(180deg, #0b0f19 0%, #0b0f19 100%)"
              : "radial-gradient(1200px 600px at 0% -20%, rgba(99,102,241,.18), transparent 60%), radial-gradient(1000px 700px at 120% 120%, rgba(59,130,246,.15), transparent 60%), linear-gradient(180deg, #f7f9fc 0%, #eef2f7 100%)",
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        {!prefersReducedMotion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
            style={{ width: "100%", height: "100%" }}
          />
        )}
        </Box>

        <Container
        maxWidth="sm"
        sx={{
          position: "relative",
          zIndex: 1,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          px: { xs: 2, sm: 3 },
        }}
      >
        <motion.div
          initial={prefersReducedMotion ? false : { y: 24, opacity: 0 }}
          animate={prefersReducedMotion ? {} : { y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
          style={{ width: "100%" }}
        >
          <Card
            ref={cardRef}
            elevation={8}
            sx={{
              borderRadius: 3,
              backdropFilter: "saturate(120%) blur(10px)",
              backgroundColor: (t) =>
                t.palette.mode === "dark"
                  ? "rgba(17, 24, 39, 0.75)"
                  : "rgba(255,255,255,0.8)",
              overflow: "hidden",
            }}
          >
            {/* Top bar: theme toggle */}
            <Box sx={{ display: "flex", justifyContent: "flex-end", p: 1 }}>
              <IconButton
                onClick={toggle}
                size="large"
                aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Box>

            <CardContent sx={{ pt: 0, px: { xs: 3, sm: 5 }, pb: 4 }}>
              {/* Brand / Title */}
              <Box sx={{ textAlign: "center", mb: 2 }}>
                <img
                  src="/android-chrome-192x192.png"
                  alt="Lake Ride Pros"
                  width={56}
                  height={56}
                  style={{ marginBottom: 8 }}
                />
                <Typography variant={upMd ? "h4" : "h5"} fontWeight={800}>
                  Driver Portal
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  Elite access for LRP operators
                </Typography>
              </Box>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {/* Google popup only */}
              <Button
                fullWidth
                variant="contained"
                onClick={handleGooglePopup}
                disabled={anyLoading}
                startIcon={!googlePopupLoading && <GoogleIcon />}
                sx={{
                  py: 1.5,
                  fontWeight: 700,
                  mb: 2,
                }}
              >
                {googlePopupLoading ? (
                  <CircularProgress size={22} color="inherit" />
                ) : (
                  "Continue with Google"
                )}
              </Button>

              <Divider sx={{ my: 2 }}>or</Divider>

              {/* Email form */}
              <Box component="form" noValidate onSubmit={handleSubmit}>
                <TextField
                  inputRef={emailRef}
                  label="Email"
                  type="email"
                  required
                  fullWidth
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={anyLoading}
                  error={!!email && !emailValid}
                  helperText={!!email && !emailValid ? "Enter a valid email" : " "}
                  autoComplete="email"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start"><MailIcon /></InputAdornment>
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
                  onKeyDown={onPwKeyDown}
                  disabled={anyLoading}
                  autoComplete="current-password"
                  helperText={
                    caps ? "Caps Lock is ON" : (password ? " " : " ")
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start"><KeyIcon /></InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPw((s) => !s)}
                          edge="end"
                          size="large"
                          aria-label={showPw ? "Hide password" : "Show password"}
                        >
                          {showPw ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Password strength (visual only; no blocking) */}
                <Box sx={{ mt: 1, mb: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={(score / 5) * 100}
                    sx={{
                      height: 6,
                      borderRadius: 999,
                      "& .MuiLinearProgress-bar": { borderRadius: 999 },
                    }}
                  />
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    Strength: {["Very weak","Weak","Okay","Good","Strong","Elite"][score]}
                  </Typography>
                </Box>

                <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
                  <Button variant="text" size="small" onClick={openReset} disabled={anyLoading}>
                    Forgot password?
                  </Button>
                  <Button variant="text" size="small" onClick={openRegister} disabled={anyLoading}>
                    Create account
                  </Button>
                </Stack>

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={anyLoading || !emailValid || password.length === 0}
                  sx={{ py: 1.5, fontWeight: 700 }}
                >
                  {emailLoading ? <CircularProgress size={22} color="inherit" /> : "Sign in"}
                </Button>

                {/* helper shortcuts */}
                <Typography variant="caption" sx={{ display: "block", mt: 2, opacity: 0.6, textAlign: "center" }}>
                  Shortcuts: <b>Enter</b> Sign in • <b>Ctrl/Cmd+G</b> Google • <b>Ctrl/Cmd+K</b> Toggle theme
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </motion.div>
      </Container>

      {/* Forgot Password Dialog */}
      <Dialog open={resetOpen} onClose={() => !resetLoading && setResetOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Reset password</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Enter your email and we’ll send a password reset link.
          </Typography>
          <TextField
            label="Email"
            type="email"
            fullWidth
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendReset()}
            disabled={resetLoading}
            error={!!resetEmail && !isEmail(resetEmail)}
            helperText={!!resetEmail && !isEmail(resetEmail) ? "Enter a valid email" : " "}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><MailIcon /></InputAdornment>
              ),
            }}
          />
          {resetMsg && (
            <Alert sx={{ mt: 1 }} severity={resetMsg.startsWith("If an account") ? "success" : "error"}>
              {resetMsg}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)} disabled={resetLoading}>Close</Button>
          <Button
            onClick={handleSendReset}
            variant="contained"
            disabled={resetLoading || !isEmail(resetEmail)}
            startIcon={resetLoading ? <CircularProgress size={16} /> : null}
          >
            {resetLoading ? "Sending…" : "Send reset"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Register Dialog */}
      <Dialog open={regOpen} onClose={() => !regLoading && setRegOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Create account</DialogTitle>
        <DialogContent dividers>
          {regError && <Alert severity="error" sx={{ mb: 2 }}>{regError}</Alert>}
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
                  <InputAdornment position="start"><MailIcon /></InputAdornment>
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
                  <InputAdornment position="start"><KeyIcon /></InputAdornment>
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
          <Button onClick={() => setRegOpen(false)} disabled={regLoading}>Cancel</Button>
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
      </>
    );
}
