import React, { useState } from "react";
import { Box, Paper, TextField, Button, Typography, Stack, IconButton, Tooltip } from "@mui/material";
import BrandGradient from "../components/BrandGradient.jsx";
import { useColorMode } from "../context/ColorModeContext.jsx";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";

export default function Login() {
  const { mode, toggle } = useColorMode();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  return (
    <Box sx={(t) => ({ minHeight: "100vh", bgcolor: t.palette.background.default, display: "grid", placeItems: "center", p: 2 })}>
      <Paper elevation={4} sx={(t) => ({ width: "100%", maxWidth: 420, borderRadius: t.shape.borderRadius })}>
        <BrandGradient glow height={6} />
        <Box sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="h6" fontWeight={800}>Lake Ride Pros — Sign in</Typography>
            <Tooltip title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
              <IconButton onClick={toggle} size="small" aria-label="toggle color mode">
                {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>
          </Stack>
          <Stack spacing={2}>
            <TextField label="Email" type="email" fullWidth value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField label="Password" type="password" fullWidth value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" variant="contained" color="primary" fullWidth>Sign In</Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
