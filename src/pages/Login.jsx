import React, { useState } from "react";
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Stack,
  Checkbox,
  FormControlLabel,
  Link,
  IconButton,
  Divider,
} from "@mui/material";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import { useAuth } from "../context/AuthContext.jsx";
import { useColorMode } from "../context/ColorModeContext.jsx";
import BrandGradient from "../components/BrandGradient.jsx";
import LoginPopup from "../components/LoginPopup.jsx";

export default function Login() {
  const { signIn, sendPasswordReset } = useAuth();
  const { mode, toggle } = useColorMode();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  const onSubmit = async (e) => {
    e.preventDefault();
    await signIn(email, password, remember);
  };

  const onForgot = async (e) => {
    e.preventDefault();
    await sendPasswordReset(email);
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}>
      <Paper sx={{ width: "100%", maxWidth: 420, position: "relative" }}>
        <BrandGradient />
        <IconButton onClick={toggle} sx={{ position: "absolute", top: 8, right: 8 }}>
          {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
        <Box component="form" onSubmit={onSubmit} sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
            Lake Ride Pros — Sign in
          </Typography>
          <Stack spacing={2}>
            <LoginPopup />
            <Divider>or</Divider>
            <TextField label="Email" type="email" fullWidth value={email} onChange={(e) => setEmail(e.target.value)} required />
            <TextField label="Password" type="password" fullWidth value={password} onChange={(e) => setPassword(e.target.value)} required />
            <FormControlLabel control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />} label="Remember me" />
            <Button type="submit" variant="contained" color="primary" fullWidth>
              Sign In
            </Button>
            <Link href="#" onClick={onForgot} underline="hover" sx={{ alignSelf: "flex-end" }}>
              Forgot password?
            </Link>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}

