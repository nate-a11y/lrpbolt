/* Proprietary and confidential. See LICENSE. */
import { memo, useContext } from "react";
import { Box } from "@mui/material";

import { ActiveClockContext } from "@/context/ActiveClockContext.jsx";

function TimeClockDebugPill() {
  const { hasActive, docId, debug } = useContext(ActiveClockContext);
  const schema = debug?.schema;
  const path = debug?.path || (schema ? "locked" : "probe");
  const line1 = hasActive ? `active • ${docId || "—"}` : "no-active";
  const line2 = schema
    ? `${schema.collection}.${schema.idField} (${schema.idValueKind}) ${schema.confidence || ""}`
    : path;
  const line3 = debug?.keys
    ? `${debug.keys.startKey || "-"} | ${debug.keys.endKey || "-"} | ${debug.keys.activeKey || "-"}`
    : debug?.reason || "";
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
      <Box component="div" sx={{ opacity: 0.8 }}>
        {line2}
      </Box>
      {line3 ? (
        <Box component="div" sx={{ opacity: 0.8 }}>
          {line3}
        </Box>
      ) : null}
    </Box>
  );
}

export default memo(TimeClockDebugPill);
