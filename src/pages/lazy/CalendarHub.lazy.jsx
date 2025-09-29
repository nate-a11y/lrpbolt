/* Proprietary and confidential. See LICENSE. */
import { lazy, Suspense } from "react";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";

const CalendarHub = lazy(() => import("../CalendarHub.jsx"));

export default function CalendarHubLazy() {
  return (
    <Suspense
      fallback={
        <Box
          sx={{
            minHeight: 240,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 3,
          }}
        >
          <Stack spacing={1} alignItems="center">
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary">
              Loading calendar…
            </Typography>
          </Stack>
        </Box>
      }
    >
      <CalendarHub />
    </Suspense>
  );
}
