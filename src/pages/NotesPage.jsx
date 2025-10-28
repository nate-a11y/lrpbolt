import { useEffect, useMemo, useState, useCallback } from "react";
import { Box, CircularProgress, Tab, Tabs, Typography } from "@mui/material";

import NotesList from "@/components/Notes/NotesList.jsx";
import NotesAdmin from "@/components/Notes/NotesAdmin.jsx";
import { subscribeNotes } from "@/services/notesService.js";
import { useAuth } from "@/context/AuthContext.jsx";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import logError from "@/utils/logError.js";

export default function NotesPage() {
  const { role } = useAuth();
  const { show } = useSnack();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("view");

  const isAdmin = role === "admin";

  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = subscribeNotes({
        onData: (rows) => {
          setNotes(Array.isArray(rows) ? rows : []);
          setLoading(false);
          setError(null);
        },
        onError: (err) => {
          logError(err, { where: "NotesPage.subscribe" });
          setError(err);
          setLoading(false);
          show("Failed to load notes.", "error");
        },
      });
    } catch (err) {
      logError(err, { where: "NotesPage.subscribeInit" });
      setError(err);
      setLoading(false);
      show("Failed to start notes feed.", "error");
    }
    return () => {
      try {
        unsub();
      } catch (err) {
        logError(err, { where: "NotesPage.unsubscribe" });
      }
    };
  }, [show]);

  useEffect(() => {
    if (!isAdmin && tab === "admin") {
      setTab("view");
    }
  }, [isAdmin, tab]);

  const activeNotes = useMemo(() => {
    return notes.filter((note) => note && note.isActive !== false);
  }, [notes]);

  const handleTabChange = useCallback((_, next) => {
    setTab(next);
  }, []);

  const renderContent = () => {
    if (tab === "view" && loading) {
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

    if (tab === "view") {
      return <NotesList notes={activeNotes} loading={loading} error={error} />;
    }

    return <NotesAdmin notes={notes} loading={loading} error={error} />;
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
          📝 Reservation Notes
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary" }}>
          Quick reference notes and templates for common reservation types.
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
        <Tab label="View Notes" value="view" sx={{ fontWeight: 600 }} />
        {isAdmin ? (
          <Tab label="Admin" value="admin" sx={{ fontWeight: 600 }} />
        ) : null}
      </Tabs>

      {renderContent()}
    </Box>
  );
}
