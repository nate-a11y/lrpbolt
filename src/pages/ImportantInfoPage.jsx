import { useEffect, useMemo, useState, useCallback } from "react";
import { Box, CircularProgress, Tab, Tabs, Typography } from "@mui/material";

import SmsSendDialog from "@/components/ImportantInfo/SmsSendDialog.jsx";
import ImportantInfoList from "@/components/ImportantInfo/ImportantInfoList.jsx";
import ImportantInfoAdmin from "@/components/ImportantInfo/ImportantInfoAdmin.jsx";
import InsiderMembersPanel from "@/components/ImportantInfo/InsiderMembersPanel.jsx";
import { subscribeImportantInfo } from "@/services/importantInfoService.js";
import { useAuth } from "@/context/AuthContext.jsx";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import logError from "@/utils/logError.js";
import { PROMO_PARTNER_CATEGORIES } from "@/constants/importantInfo.js";

export default function ImportantInfoPage() {
  const { role } = useAuth();
  const { show } = useSnack();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("promos_partners");
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
    if (!isAdmin && tab === "admin") {
      setTab("promos_partners");
    }
  }, [isAdmin, tab]);

  const activeItems = useMemo(() => {
    return items.filter((item) => {
      if (!item || item.isActive === false) {
        return false;
      }
      const label = item?.category ? String(item.category) : "";
      return PROMO_PARTNER_CATEGORIES.includes(label);
    });
  }, [items]);

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
    if (tab === "promos_partners" && loading) {
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

    if (tab === "promos_partners") {
      return (
        <ImportantInfoList
          items={activeItems}
          loading={loading}
          error={error}
          onSendSms={handleSendSms}
        />
      );
    }

    if (tab === "insiders") {
      return <InsiderMembersPanel isAdmin={isAdmin} />;
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

      <Tabs
        value={tab}
        onChange={handleTabChange}
        variant="scrollable"
        sx={{
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          "& .MuiTabs-indicator": { bgcolor: (t) => t.palette.primary.main },
        }}
      >
        <Tab
          label="Promotions & Partners"
          value="promos_partners"
          sx={{ fontWeight: 600 }}
        />
        <Tab
          label="Insider Members"
          value="insiders"
          sx={{ fontWeight: 600 }}
        />
        {isAdmin ? (
          <Tab label="Admin" value="admin" sx={{ fontWeight: 600 }} />
        ) : null}
      </Tabs>

      {renderContent()}

      <SmsSendDialog
        open={smsOpen}
        onClose={handleCloseSms}
        item={selectedItem}
      />
    </Box>
  );
}
