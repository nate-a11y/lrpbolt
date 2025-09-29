/* Proprietary and confidential. See LICENSE. */
import { memo, useContext } from "react";
import { Box } from "@mui/material";

import { ActiveClockContext } from "@/context/ActiveClockContext.jsx";

function TimeClockDebugPill() {
  const { hasActive, docId } = useContext(ActiveClockContext);

  return (
    <Box
      sx={{
        position: "fixed",
        left: 8,
        bottom: 8,
        p: 0.5,
        borderRadius: 1,
        bgcolor: hasActive ? "rgba(76,187,23,0.25)" : "rgba(255,255,255,0.08)",
        color: "#fff",
        fontSize: 11,
        zIndex: 3000,
      }}
    >
      {hasActive ? `active • doc:${String(docId || "—")}` : "no-active"}
    </Box>
  );
}

export default memo(TimeClockDebugPill);
