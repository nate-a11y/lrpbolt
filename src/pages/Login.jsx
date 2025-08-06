import React, { useState } from "react";
import {
  Button,
  TextField,
  Alert,
  Box,
  CircularProgress,
  Container,
  Typography,
  ThemeProvider,
  CssBaseline,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  loginWithPopup,
  loginWithEmail,
  loginWithRedirect
} from "../services/auth";
import useDarkMode from "../hooks/useDarkMode";
import getTheme from "../theme";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [darkMode] = useDarkMode();
  const theme = getTheme(darkMode);

  const authAndRedirect = async (fn) => {
    setLoading(true);
    setError("");
    try {
      await fn();
      navigate("/", { replace: true });
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="sm">
        <Box mt={8}>
          <Typography variant="h4" align="center" gutterBottom>
            Driver Portal Login
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <Button
            fullWidth
            variant="contained"
            onClick={() => authAndRedirect(loginWithPopup)}
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? <CircularProgress size={24} /> : "Sign in with Google (Popup)"}
          </Button>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => authAndRedirect(loginWithRedirect)}
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? <CircularProgress size={24} /> : "Sign in with Google (Redirect)"}
          </Button>
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              authAndRedirect(() => loginWithEmail(email, password));
            }}
            mt={2}
          >
            <TextField
              label="Email"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              sx={{ mt: 1 }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : "Sign in with Email"}
            </Button>
          </Box>
        </Box>
      </Container>
    </ThemeProvider>
  );
}

