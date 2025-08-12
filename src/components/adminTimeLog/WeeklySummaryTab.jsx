/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState } from "react";

export default function WeeklySummaryTab() {
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    let alive = true;
    // fetchWeeklySummary().then((data) => alive && setSummary(data));
    return () => {
      alive = false;
    };
  }, []);
  return summary ? <pre>{JSON.stringify(summary, null, 2)}</pre> : null;
}
