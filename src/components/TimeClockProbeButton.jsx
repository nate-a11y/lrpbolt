/* Proprietary and confidential. See LICENSE. */
import { useEffect, useState } from "react";
import { Button } from "@mui/material";
import { getAuth } from "firebase/auth";

import { loadDetectedSchema } from "@/config/timeclockSchema";

export default function TimeClockProbeButton() {
  const [txt, setTxt] = useState("Probe Schema");
  useEffect(() => {
    const s = loadDetectedSchema();
    setTxt(
      s
        ? `Schema: ${s.collection}.${s.idField} (${s.idValueKind})`
        : "Probe Schema",
    );
  }, []);
  return (
    <Button
      variant="outlined"
      size="small"
      sx={{ position: "fixed", left: 8, bottom: 52, zIndex: 3001 }}
      onClick={() => {
        const s = loadDetectedSchema();
        const u = getAuth().currentUser;
        console.info("[TimeClock schema cached]", s);
        console.info("[Auth]", { uid: u?.uid, email: u?.email });
        alert(
          s
            ? `Using ${s.collection}.${s.idField} (${s.idValueKind})`
            : "No schema cached",
        );
      }}
    >
      {txt}
    </Button>
  );
}
