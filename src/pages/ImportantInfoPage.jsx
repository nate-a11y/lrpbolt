import { useEffect, useMemo, useState, useCallback } from "react";
import { Box, CircularProgress, Tab, Tabs, Typography } from "@mui/material";

import SmsSendDialog from "@/components/ImportantInfo/SmsSendDialog.jsx";
import ImportantInfoList from "@/components/ImportantInfo/ImportantInfoList.jsx";
import ImportantInfoAdmin from "@/components/ImportantInfo/ImportantInfoAdmin.jsx";
import { subscribeImportantInfo } from "@/services/importantInfoService.js";
import { useAuth } from "@/context/AuthContext.jsx";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import logError from "@/utils/logError.js";

export default function ImportantInfoPage() {
  const { role } = useAuth();
  const { show } = useSnack();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0);
  const [selectedItem, setSelectedItem] = useState(null);
  const [smsOpen, setSmsOpen] = useState(false);

  const isAdmin = role === "admin";

  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = subscribeImportantInfo({
        onData: (rows) => {
          setItems(Array.isArray(rows) ? rows : []);
          setLoading(false);
          setError(null);
        },
        onError: (err) => {
          logError(err, { where: "ImportantInfoPage.subscribe" });
          setError(err);
          setLoading(false);
          show("Failed to load important info.", "error");
        },
      });
    } catch (err) {
      logError(err, { where: "ImportantInfoPage.subscribeInit" });
      setError(err);
      setLoading(false);
      show("Failed to start important info feed.", "error");
    }
    return () => {
      try {
        unsub();
      } catch (err) {
        logError(err, { where: "ImportantInfoPage.unsubscribe" });
      }
    };
  }, [show]);

  useEffect(() => {
    if (!isAdmin && tab !== 0) {
      setTab(0);
    }
  }, [isAdmin, tab]);

  const activeItems = useMemo(
    () => items.filter((item) => item && item.isActive !== false),
    [items],
  );

  const handleTabChange = useCallback((_, next) => {
    setTab(next);
  }, []);

  const handleSendSms = useCallback((item) => {
    if (!item) return;
    setSelectedItem(item);
    setSmsOpen(true);
  }, []);

  const handleCloseSms = useCallback(() => {
    setSmsOpen(false);
    setSelectedItem(null);
  }, []);

  const renderContent = () => {
    if (loading) {
      return (
        <Box
          sx={{
            py: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress color="inherit" />
        </Box>
      );
    }

    if (tab === 0 || !isAdmin) {
      return (
        <ImportantInfoList
          items={activeItems}
          loading={loading}
          error={error}
          onSendSms={handleSendSms}
        />
      );
    }

    return <ImportantInfoAdmin items={items} loading={loading} error={error} />;
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        p: { xs: 2, md: 3 },
        color: "text.primary",
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Important Information
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary" }}>
          Effortlessly share official Lake Ride Pros promotions, premier
          partners, and referral rewards with your guests.
        </Typography>
      </Box>

      {isAdmin ? (
        <Tabs
          value={tab}
          onChange={handleTabChange}
          sx={{
            borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
            "& .MuiTabs-indicator": { bgcolor: "#4cbb17" },
          }}
        >
          <Tab label="For Drivers" value={0} sx={{ fontWeight: 600 }} />
          <Tab label="Admin" value={1} sx={{ fontWeight: 600 }} />
        </Tabs>
      ) : null}

      {renderContent()}

      <SmsSendDialog
        open={smsOpen}
        onClose={handleCloseSms}
        item={selectedItem}
      />
    </Box>
  );
}
