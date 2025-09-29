/* Proprietary and confidential. See LICENSE. */
import { memo, useContext } from "react";
import { Box } from "@mui/material";

import { ActiveClockContext } from "@/context/ActiveClockContext.jsx";

function TimeClockDebugPill() {
  const { hasActive, docId, debug } = useContext(ActiveClockContext);
  const text = hasActive ? `active • ${docId || "—"}` : `no-active • ${debug?.reason || debug?.source || "—"}`;
  return (
    <Box
      sx={{
        position: "fixed",
        left: 8,
        bottom: 8,
        p: 0.5,
        borderRadius: 1,
        bgcolor: "rgba(255,255,255,0.08)",
        color: "#fff",
        fontSize: 11,
        zIndex: 3000,
      }}
    >
      {text}
    </Box>
  );
}
export default memo(TimeClockDebugPill);
