/* Proprietary and confidential. See LICENSE. */
import React, { useState } from "react";
import { Box, Tabs, Tab } from "@mui/material";

import EntriesTab from "./adminTimeLog/EntriesTab.jsx";
import WeeklySummaryTab from "./adminTimeLog/WeeklySummaryTab.jsx";
import ShootoutStatsTab from "./adminTimeLog/ShootoutStatsTab.jsx";
import ShootoutSummaryTab from "./adminTimeLog/ShootoutSummaryTab.jsx";

export default function AdminTimeLog() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ p: 2 }}>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        textColor="inherit"
        indicatorColor="primary"
        aria-label="Admin Time Log Tabs"
        sx={{ "& .MuiTab-root": { textTransform: "none", minHeight: 40 }, mb: 1 }}
      >
        <Tab label="Logs" />
        <Tab label="Weekly Summary" />
        <Tab label="Shootout Sessions" />
        <Tab label="Shootout Summary" />
      </Tabs>
      {tab === 0 && <EntriesTab />}
      {tab === 1 && <WeeklySummaryTab />}
      {tab === 2 && <ShootoutStatsTab />}
      {tab === 3 && <ShootoutSummaryTab />}
    </Box>
  );
}
