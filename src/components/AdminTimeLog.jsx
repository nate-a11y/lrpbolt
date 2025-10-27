/* Proprietary and confidential. See LICENSE. */
import React, { useState, memo } from "react";
import { Tabs, Tab, Box } from "@mui/material";

import ErrorBoundary from "@/components/feedback/ErrorBoundary.jsx";
import useIsMobile from "@/hooks/useIsMobile.js";

import PageContainer from "./PageContainer.jsx";
import EntriesTab from "./adminTimeLog/EntriesTab.jsx";
import WeeklySummaryTab from "./adminTimeLog/WeeklySummaryTab.jsx";

function AdminTimeLog() {
  const [tab, setTab] = useState(0);
  const { isMdDown } = useIsMobile();

  return (
    <ErrorBoundary>
      <PageContainer pt={2} pb={2} sx={{ gap: 1 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          textColor="inherit"
          indicatorColor="primary"
          aria-label="Admin Time Log Tabs"
          variant={isMdDown ? "scrollable" : "standard"}
          scrollButtons={isMdDown ? "auto" : false}
          allowScrollButtonsMobile
          sx={{
            "& .MuiTab-root": { textTransform: "none", minHeight: 40 },
            mb: 1,
          }}
        >
          <Tab label="Logs" />
          <Tab label="Weekly Summary" />
          {/* Temporarily hidden - can be re-enabled later if needed */}
          {/* <Tab label="Shootout Sessions" /> */}
          {/* <Tab label="Shootout Summary" /> */}
        </Tabs>
        <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
          {tab === 0 && <EntriesTab />}
          {tab === 1 && <WeeklySummaryTab />}
          {/* Temporarily hidden - can be re-enabled later if needed */}
          {/* {tab === 2 && <ShootoutStatsTab />} */}
          {/* {tab === 3 && <ShootoutSummaryTab />} */}
        </Box>
      </PageContainer>
    </ErrorBoundary>
  );
}

export default memo(AdminTimeLog);
