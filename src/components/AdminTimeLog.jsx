/* Proprietary and confidential. See LICENSE. */
import React, { useState } from "react";
import { Box, Tabs, Tab } from "@mui/material";
import PageContainer from "./PageContainer.jsx";
import EntriesTab from "./adminTimeLog/EntriesTab.jsx";
import WeeklySummaryTab from "./adminTimeLog/WeeklySummaryTab.jsx";
import ShootoutStatsTab from "./adminTimeLog/ShootoutStatsTab.jsx";

export default function AdminTimeLog() {
  const [tab, setTab] = useState(0);

  return (
    <PageContainer pt={2} pb={4}>
      <Box sx={{ mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          <Tab label="Entries" />
          <Tab label="Weekly Summary" />
          <Tab label="Shootout Stats" />
        </Tabs>
      </Box>
      {tab === 0 && <EntriesTab />}
      {tab === 1 && <WeeklySummaryTab />}
      {tab === 2 && <ShootoutStatsTab />}
    </PageContainer>
  );
}

