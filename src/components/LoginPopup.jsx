import React, { useState } from "react";
import { Button, Stack } from "@mui/material";
import { loginWithPopup, loginWithRedirect } from "../services/auth";
import { logError } from "../utils/logError";

export default function LoginPopup() {
  const [loading, setLoading] = useState(false);

  const handlePopup = async () => {
    setLoading(true);
    try {
      await loginWithPopup();
    } catch (err) {
      logError(err, "LoginPopup:Popup");
    } finally {
      setLoading(false);
    }
  };

  const handleRedirect = async () => {
    setLoading(true);
    try {
      await loginWithRedirect();
    } catch (err) {
      logError(err, "LoginPopup:Redirect");
      setLoading(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Button variant="contained" fullWidth onClick={handlePopup} disabled={loading}>
        Sign in with Google (Popup)
      </Button>
      <Button variant="contained" fullWidth onClick={handleRedirect} disabled={loading}>
        Sign in with Google (Redirect)
      </Button>
    </Stack>
  );
}

