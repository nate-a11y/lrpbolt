import { useCallback, useMemo } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import DiagnosticsPanel from "@/components/DiagnosticsPanel.jsx";
import VersionBadge from "@/components/VersionBadge.jsx";
import { getFlag } from "@/services/observability";

import NotificationSettingsCard from "../../components/NotificationSettingsCard.jsx";
import PageContainer from "../../components/PageContainer.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { logout } from "../../services/auth";
import { getAppVersion } from "../../utils/appVersion.js";

const APP_VERSION = getAppVersion();

function ProfilePage() {
  const { user, role } = useAuth();
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
  const showDiagnostics = useMemo(
    () => role === "admin" || getFlag("diag.panel"),
    [role],
  );
  return (
    <PageContainer>
      <NotificationSettingsCard user={user} />
      {showDiagnostics && (
        <Box sx={{ mt: 1 }}>
          <DiagnosticsPanel />
        </Box>
      )}
      <Box sx={{ mt: 1, textAlign: "center" }}>
        <Stack spacing={1} alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography
              variant="caption"
              sx={{ color: "success.main", fontWeight: "bold" }}
            >
              🚀
            </Typography>
            <VersionBadge
              value={APP_VERSION}
              dense
              size="small"
              sx={{
                bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                border: (t) =>
                  `1px solid ${alpha(t.palette.primary.main, 0.4)}`,
              }}
            />
          </Stack>
          <Typography
            variant="caption"
            sx={{ color: "success.main", fontWeight: "bold" }}
          >
            Lake Ride Pros © {new Date().getFullYear()}
          </Typography>
        </Stack>
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
