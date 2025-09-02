/* Proprietary and confidential. See LICENSE. */
import React, { useState, memo } from "react";
import { Tabs, Tab } from "@mui/material";

import PageContainer from "./PageContainer.jsx";
import EntriesTab from "./adminTimeLog/EntriesTab.jsx";
import WeeklySummaryTab from "./adminTimeLog/WeeklySummaryTab.jsx";
import ShootoutStatsTab from "./adminTimeLog/ShootoutStatsTab.jsx";
import ShootoutSummaryTab from "./adminTimeLog/ShootoutSummaryTab.jsx";

function AdminTimeLog() {
  const [tab, setTab] = useState(0);

  return (
    <PageContainer pt={2} pb={2}>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        textColor="inherit"
        indicatorColor="primary"
        aria-label="Admin Time Log Tabs"
        sx={{
          "& .MuiTab-root": { textTransform: "none", minHeight: 40 },
          mb: 1,
        }}
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
    </PageContainer>
  );
}

export default memo(AdminTimeLog);
