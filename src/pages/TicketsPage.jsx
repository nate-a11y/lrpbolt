import { useCallback, useEffect, useState } from "react";
import { Box, Button, Typography } from "@mui/material";

import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import { useAuth } from "@/context/AuthContext.jsx";
import TicketFormDialog from "@/tickets/TicketFormDialog.jsx";
import TicketGrid from "@/tickets/TicketGrid.jsx";
import TicketDetailDrawer from "@/tickets/TicketDetailDrawer.jsx";
import logError from "@/utils/logError.js";

export default function TicketsPage() {
  const { user, role } = useAuth();
  const { show } = useSnack();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [optimisticTicket, setOptimisticTicket] = useState(null);

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

  const handleTicketUpdated = useCallback((patched) => {
    if (!patched) return;
    const patchId =
      patched.id || patched.ticketId || patched.docId || patched._id || null;
    if (!patchId) return;
    setSelectedTicket((prev) => {
      if (!prev) return prev;
      const prevIds = [prev.id, prev.ticketId, prev.docId, prev._id].filter(
        Boolean,
      );
      if (!prevIds.includes(patchId)) {
        return prev;
      }
      return { ...prev, ...patched };
    });
    setOptimisticTicket({ ...patched, _optimisticAt: Date.now() });
  }, []);

  const handleTicketCreated = useCallback((created) => {
    if (!created) return;
    const createdId =
      created.id || created.ticketId || created.docId || created._id || null;
    if (!createdId) return;
    setOptimisticTicket({ ...created, _optimisticAt: Date.now() });
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    if (!selectedTicket) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Closing drawer when ticket is deselected
      setDrawerOpen(false);
    }
  }, [drawerOpen, selectedTicket]);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setSelectedTicket(null);
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        // Clear query parameters that trigger auto-open
        url.searchParams.delete("id");
        url.searchParams.delete("ticketId");
        // Clear hash-based query if present
        if (url.hash.includes("?")) {
          url.hash = url.hash.split("?")[0];
        } else if (url.hash.startsWith("#/tickets")) {
          url.hash = "#/tickets";
        }
        window.history.replaceState(null, "", url.toString());
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
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          🎫 Support Tickets
        </Typography>
        <Button
          variant="contained"
          onClick={handleOpen}
          sx={{
            bgcolor: (t) => t.palette.primary.main,
            "&:hover": { bgcolor: (t) => t.palette.primary.dark },
          }}
        >
          New Support Ticket
        </Button>
      </Box>

      <TicketGrid
        onSelect={handleSelect}
        activeTicketId={selectedTicket?.id}
        optimisticTicket={optimisticTicket}
      />

      <TicketFormDialog
        open={dialogOpen}
        onClose={handleClose}
        currentUser={user}
        onSaved={handleTicketCreated}
      />

      <TicketDetailDrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        ticket={selectedTicket}
        currentUser={user}
        isAdmin={role === "admin"}
        onTicketUpdated={handleTicketUpdated}
      />
    </Box>
  );
}
