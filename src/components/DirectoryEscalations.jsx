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
  Fade,
  Badge,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ContactEmergencyIcon from "@mui/icons-material/ContactEmergency";
import DirectoryIcon from "@mui/icons-material/Contacts";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";

import DRIVER_LIST from "../data/driverDirectory";

import PageContainer from "./PageContainer.jsx";
import DriverDirectory from "./DriverDirectory.jsx";
import EscalationGuide from "./EscalationGuide.jsx";

const TAB_OPTIONS = [
  {
    value: "directory",
    label: "Driver Directory",
    icon: DirectoryIcon,
  },
  {
    value: "escalations",
    label: "Escalation Guide",
    icon: SupportAgentIcon,
  },
];

// Fallback escalation contacts (same as in EscalationGuide)
const FALLBACK_ESCALATIONS = [
  {
    name: "Jim Brentlinger (LRP1)",
    phone: "573.353.2849",
    email: "Jim@lakeridepros.com",
  },
  {
    name: "Nate Bullock (LRP2)",
    phone: "417.380.8853",
    email: "Nate@lakeridepros.com",
  },
  {
    name: "Michael Brandt (LRP3)",
    phone: "573.286.9110",
    email: "Michael@lakeridepros.com",
  },
];

const TabPanel = React.memo(function TabPanel({
  activeValue,
  value,
  children,
}) {
  const isActive = activeValue === value;

  return (
    <Box
      role="tabpanel"
      id={`directory-escalations-tabpanel-${value}`}
      aria-labelledby={`directory-escalations-tab-${value}`}
      hidden={!isActive}
      sx={{ pt: 3 }}
    >
      <Fade in={isActive} timeout={300}>
        <Box>{isActive ? children : null}</Box>
      </Fade>
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

  // Calculate counts
  const driverCount = useMemo(() => DRIVER_LIST.length, []);
  const escalationCount = useMemo(() => FALLBACK_ESCALATIONS.length, []);

  const getTabLabel = useCallback(
    (tab) => {
      const count = tab.value === "directory" ? driverCount : escalationCount;
      const Icon = tab.icon;

      return (
        <Stack direction="row" spacing={1} alignItems="center">
          {Icon && <Icon sx={{ fontSize: 20 }} />}
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, fontSize: "0.875rem" }}
          >
            {tab.label}
          </Typography>
          <Badge
            badgeContent={count}
            color="success"
            sx={{
              "& .MuiBadge-badge": {
                position: "relative",
                transform: "none",
                fontSize: "0.75rem",
                fontWeight: 700,
                minWidth: 24,
                height: 20,
              },
            }}
          />
        </Stack>
      );
    },
    [driverCount, escalationCount],
  );

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
              variant="h5"
              sx={{
                fontWeight: 700,
                color: (t) => t.palette.text.primary,
              }}
            >
              📞 Directory & Escalations
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: (t) => t.palette.text.secondary }}
            >
              Quickly find contact info or escalation paths without leaving this
              page.
            </Typography>
          </Box>
        </Stack>

        <Paper
          elevation={0}
          sx={{
            borderRadius: 2,
            border: (t) => `1px solid ${t.palette.divider}`,
            backgroundColor: (t) =>
              t.palette.mode === "dark"
                ? t.palette.grey[900]
                : t.palette.background.paper,
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
                color: (t) => t.palette.text.secondary,
              },
              "& .MuiTab-root.Mui-selected": {
                color: (t) => t.palette.text.primary,
              },
            }}
          >
            {tabs.map((tab) => (
              <Tab
                key={tab.value}
                value={tab.value}
                label={getTabLabel(tab)}
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
