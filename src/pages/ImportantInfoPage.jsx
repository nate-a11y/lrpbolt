import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  CircularProgress,
  Tab,
  Tabs,
  Typography,
  Fab,
  Zoom,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import dayjs from "dayjs";

import SmsSendDialog from "@/components/ImportantInfo/SmsSendDialog.jsx";
import ImportantInfoList from "@/components/ImportantInfo/ImportantInfoList.jsx";
import ImportantInfoAdmin from "@/components/ImportantInfo/ImportantInfoAdmin.jsx";
import InsiderMembersPanel from "@/components/ImportantInfo/InsiderMembersPanel.jsx";
import {
  subscribeImportantInfo,
  updateImportantInfo,
} from "@/services/importantInfoService.js";
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
  const [showScrollTop, setShowScrollTop] = useState(false);

  const isAdmin = role === "admin";

  // Track scroll position for scroll-to-top FAB
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Setting error state on subscription failure
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Switching tab when user loses admin access
      setTab("promos_partners");
    }
  }, [isAdmin, tab]);

  const activeItems = useMemo(() => {
    const now = dayjs();
    return items.filter((item) => {
      if (!item || item.isActive === false) {
        return false;
      }

      // Filter out items scheduled for future publication
      if (item.publishDate) {
        const publishDate = dayjs(item.publishDate);
        if (publishDate.isValid() && publishDate.isAfter(now)) {
          return false;
        }
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

  const handleSmsSent = useCallback(
    async (itemId) => {
      if (!itemId) return;
      try {
        // Increment sendCount for analytics tracking
        const item = items.find((r) => r.id === itemId);
        const currentCount =
          typeof item?.sendCount === "number" ? item.sendCount : 0;
        await updateImportantInfo(itemId, { sendCount: currentCount + 1 });
      } catch (err) {
        logError(err, { where: "ImportantInfoPage.handleSmsSent", itemId });
        // Don't show error to user - this is a background operation
      }
    },
    [items],
  );

  const handleScrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
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
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          📋 Important Information
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
        onSuccess={handleSmsSent}
        item={selectedItem}
      />

      {/* Scroll to Top FAB */}
      <Zoom in={showScrollTop} unmountOnExit>
        <Fab
          size="medium"
          color="primary"
          onClick={handleScrollToTop}
          sx={{
            position: "fixed",
            right: 16,
            bottom: `calc(24px + env(safe-area-inset-bottom, 0px))`,
            zIndex: (t) => t.zIndex.tooltip + 1,
            backgroundColor: (t) => t.palette.primary.main,
            boxShadow: (t) =>
              `0 4px 16px ${alpha(t.palette.primary.main, 0.4)}`,
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": {
              backgroundColor: (t) => t.palette.primary.dark,
              transform: "scale(1.1)",
              boxShadow: (t) =>
                `0 6px 20px ${alpha(t.palette.primary.main, 0.5)}`,
            },
            "&:active": {
              transform: "scale(0.95)",
            },
          }}
          aria-label="Scroll to top"
        >
          <KeyboardArrowUpIcon />
        </Fab>
      </Zoom>
    </Box>
  );
}
