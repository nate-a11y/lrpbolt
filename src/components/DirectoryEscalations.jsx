/* Proprietary and confidential. See LICENSE. */
import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Box,
  Stack,
  Tabs,
  Tab,
  Typography,
  Paper,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ContactEmergencyIcon from "@mui/icons-material/ContactEmergency";

import PageContainer from "./PageContainer.jsx";
import DriverDirectory from "./DriverDirectory.jsx";
import EscalationGuide from "./EscalationGuide.jsx";

const TAB_OPTIONS = [
  { value: "directory", label: "Driver Directory" },
  { value: "escalations", label: "Escalation Guide" },
];

const TabPanel = React.memo(function TabPanel({
  activeValue,
  value,
  children,
}) {
  return (
    <Box
      role="tabpanel"
      id={`directory-escalations-tabpanel-${value}`}
      aria-labelledby={`directory-escalations-tab-${value}`}
      hidden={activeValue !== value}
      sx={{ pt: 3 }}
    >
      {activeValue === value ? children : null}
    </Box>
  );
});

export default function DirectoryEscalations({ initialTab = "directory" }) {
  const theme = useTheme();
  const tabs = useMemo(() => TAB_OPTIONS, []);

  const defaultTab = useMemo(
    () =>
      tabs.some((tab) => tab.value === initialTab) ? initialTab : tabs[0].value,
    [initialTab, tabs],
  );

  const [active, setActive] = useState(defaultTab);

  useEffect(() => {
    setActive(defaultTab);
  }, [defaultTab]);

  const handleChange = useCallback((event, newValue) => {
    setActive(newValue);
  }, []);

  return (
    <PageContainer>
      <Stack spacing={3} sx={{ width: "100%" }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              display: "inline-flex",
              p: 1.25,
              borderRadius: 2,
              background: (t) =>
                `linear-gradient(180deg, ${alpha(t.palette.primary.main, 0.28)} 0%, ${alpha(
                  t.palette.primary.main,
                  0.08,
                )} 100%)`,
              border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.35)}`,
              color: theme.palette.success.main,
            }}
          >
            <ContactEmergencyIcon fontSize="large" />
          </Box>
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                color: "#fff",
                textTransform: "none",
                letterSpacing: 0.5,
              }}
            >
              Directory & Escalations
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)" }}>
              Quickly find contact info or escalation paths without leaving this
              page.
            </Typography>
          </Box>
        </Stack>

        <Paper
          elevation={0}
          sx={{
            borderRadius: 2,
            border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.25)}`,
            background: (t) => alpha(t.palette.common.black, 0.85),
            "& .MuiTabs-flexContainer": { gap: { xs: 0.5, sm: 1 } },
          }}
        >
          <Tabs
            value={active}
            onChange={handleChange}
            variant="scrollable"
            allowScrollButtonsMobile
            TabIndicatorProps={{
              sx: { backgroundColor: theme.palette.success.main },
            }}
            sx={{
              minHeight: 56,
              px: { xs: 1, sm: 1.5 },
              "& .MuiTab-root": {
                minHeight: 56,
                textTransform: "none",
                fontWeight: 700,
                color: "rgba(255,255,255,0.72)",
              },
              "& .MuiTab-root.Mui-selected": { color: "#fff" },
            }}
          >
            {tabs.map((tab) => (
              <Tab
                key={tab.value}
                value={tab.value}
                label={tab.label}
                id={`directory-escalations-tab-${tab.value}`}
                aria-controls={`directory-escalations-tabpanel-${tab.value}`}
              />
            ))}
          </Tabs>
        </Paper>

        <TabPanel activeValue={active} value="directory">
          <DriverDirectory
            disableContainer
            showHeading={false}
            sx={{ mt: 0 }}
          />
        </TabPanel>

        <TabPanel activeValue={active} value="escalations">
          <EscalationGuide
            showHeading={false}
            sx={{ px: 0, maxWidth: "100%", mx: 0 }}
          />
        </TabPanel>
      </Stack>
    </PageContainer>
  );
}
