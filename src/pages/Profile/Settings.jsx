import { useCallback } from "react";
import { Box, Button, Typography } from "@mui/material";

import NotificationSettingsCard from "../../components/NotificationSettingsCard.jsx";
import PageContainer from "../../components/PageContainer.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { logout } from "../../services/auth";

const APP_VERSION = import.meta.env.VITE_APP_VERSION;

function ProfilePage() {
  const { user } = useAuth();
  const handleClearCache = useCallback(() => {
    if (window.confirm("Clear cache and reload? You'll be signed out.")) {
      localStorage.clear();
      sessionStorage.clear();
      logout();
      if ("caches" in window)
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      window.location.href = window.location.origin;
    }
  }, []);
  return (
    <PageContainer>
      <NotificationSettingsCard user={user} />
      <Box sx={{ mt: 6, textAlign: "center" }}>
        <Typography
          variant="caption"
          sx={{
            color: "success.main",
            fontWeight: "bold",
            display: "block",
            mb: 1,
          }}
        >
          🚀 Version:{" "}
          <span style={{ fontFamily: "monospace" }}>
            v{APP_VERSION || "dev"}
          </span>{" "}
          • Lake Ride Pros © {new Date().getFullYear()}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          color="error"
          sx={{
            fontWeight: "bold",
            borderWidth: 2,
            "&:hover": {
              backgroundColor: "error.main",
              color: "common.white",
            },
          }}
          onClick={handleClearCache}
        >
          🧹 CLEAR CACHE & RELOAD
        </Button>
      </Box>
    </PageContainer>
  );
}

export default ProfilePage;
