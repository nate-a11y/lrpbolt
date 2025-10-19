import { useCallback, useEffect, useState } from "react";
import { Box, Button, Typography } from "@mui/material";

import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import { useAuth } from "@/context/AuthContext.jsx";
import TicketFormDialog from "@/tickets/TicketFormDialog.jsx";
import TicketGrid from "@/tickets/TicketGrid.jsx";
import TicketDetailDrawer from "@/tickets/TicketDetailDrawer.jsx";
import logError from "@/utils/logError.js";

export default function TicketsPage() {
  const { user } = useAuth();
  const { show } = useSnack();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleOpen = useCallback(() => {
    if (!user) {
      show("Please sign in to create a support ticket.", "warning");
      return;
    }
    setDialogOpen(true);
  }, [show, user]);

  const handleClose = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const handleSelect = useCallback((ticket) => {
    if (!ticket) return;
    setSelectedTicket(ticket);
    setDrawerOpen(true);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    if (!selectedTicket) {
      setDrawerOpen(false);
    }
  }, [drawerOpen, selectedTicket]);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setSelectedTicket(null);
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        if (url.hash.startsWith("#/tickets")) {
          url.hash = "#/tickets";
          window.history.replaceState(null, "", url.toString());
        }
      } catch (err) {
        logError(err, { where: "TicketsPage.clearHash" });
      }
    }
  }, []);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        p: { xs: 2, md: 3 },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Support Tickets
        </Typography>
        <Button
          variant="contained"
          onClick={handleOpen}
          sx={{ bgcolor: "#4cbb17", "&:hover": { bgcolor: "#3aa40f" } }}
        >
          New Support Ticket
        </Button>
      </Box>

      <TicketGrid onSelect={handleSelect} activeTicketId={selectedTicket?.id} />

      <TicketFormDialog
        open={dialogOpen}
        onClose={handleClose}
        currentUser={user}
      />

      <TicketDetailDrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        ticket={selectedTicket}
        currentUser={user}
      />
    </Box>
  );
}
