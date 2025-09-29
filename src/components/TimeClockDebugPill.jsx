/* Proprietary and confidential. See LICENSE. */
import { memo, useContext } from "react";
import { Box } from "@mui/material";

import { ActiveClockContext } from "@/context/ActiveClockContext.jsx";

function TimeClockDebugPill() {
  const { hasActive, docId, debug } = useContext(ActiveClockContext);
  const rdy = debug?.allReady ? "✓" : "…";
  const line1 = hasActive
    ? `active${rdy} • ${docId || "—"}`
    : `no-active${rdy}`;
  const line2 = debug?.uid ? `uid:${debug.uid}` : "";
  const line3 = debug?.keys
    ? `${debug.keys.startKey || "-"} | ${debug.keys.endKey || "-"} | ${debug.keys.activeKey || "-"}`
    : typeof debug?.reason === "string"
      ? debug.reason
      : "";
  return (
    <Box
      sx={{
        position: "fixed",
        left: 8,
        bottom: 8,
        p: 0.75,
        borderRadius: 1,
        bgcolor: hasActive ? "rgba(76,187,23,0.25)" : "rgba(255,255,255,0.08)",
        color: "#fff",
        fontSize: 11,
        zIndex: 3000,
        lineHeight: 1.2,
      }}
    >
      <Box component="div">{line1}</Box>
      {line2 ? (
        <Box component="div" sx={{ opacity: 0.8 }}>
          {line2}
        </Box>
      ) : null}
      {line3 ? (
        <Box component="div" sx={{ opacity: 0.8 }}>
          {line3}
        </Box>
      ) : null}
    </Box>
  );
}
export default memo(TimeClockDebugPill);
