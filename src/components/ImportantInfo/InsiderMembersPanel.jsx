import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";

import InsiderEditorDialog from "@/components/ImportantInfo/InsiderEditorDialog.jsx";
import {
  deleteInsider,
  restoreInsider,
  subscribeInsiders,
} from "@/services/insiders.js";
import logError from "@/utils/logError.js";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";

const MEMBERSHIP_TYPES = ["business", "family", "individual"];
const LEVELS = ["bronze", "silver", "gold", "diamond"];

function formatTitle(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function InsiderMembersPanel({ isAdmin = false }) {
  const { show } = useSnack();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [dialogState, setDialogState] = useState({
    open: false,
    initial: null,
  });
  const [deletePending, setDeletePending] = useState(() => new Set());

  useEffect(() => {
    const unsubscribe = subscribeInsiders(
      { limit: 1000 },
      ({ rows: nextRows, error: nextError }) => {
        if (nextError) {
          logError(nextError, {
            where: "InsiderMembersPanel.subscribe",
          });
          setError(nextError);
          setLoading(false);
          show("Failed to load insider members.", "error");
          return;
        }
        setRows(Array.isArray(nextRows) ? nextRows : []);
        setError(null);
        setLoading(false);
      },
    );

    return () => {
      try {
        unsubscribe?.();
      } catch (unsubscribeError) {
        logError(unsubscribeError, {
          where: "InsiderMembersPanel.unsubscribe",
        });
      }
    };
  }, [show]);

  const visibleRows = useMemo(() => {
    const source = Array.isArray(rows) ? rows : [];
    if (isAdmin) return source;
    return source.filter((row) => row && row.isActive !== false);
  }, [isAdmin, rows]);

  const grouped = useMemo(() => {
    const structure = {};
    MEMBERSHIP_TYPES.forEach((type) => {
      structure[type] = {};
      LEVELS.forEach((level) => {
        structure[type][level] = [];
      });
    });

    visibleRows.forEach((row) => {
      const type =
        typeof row.membershipType === "string"
          ? row.membershipType.toLowerCase()
          : "individual";
      const level =
        typeof row.level === "string" ? row.level.toLowerCase() : "bronze";
      if (!structure[type]) {
        structure[type] = {};
        LEVELS.forEach((lvl) => {
          structure[type][lvl] = [];
        });
      }
      if (!structure[type][level]) {
        structure[type][level] = [];
      }
      structure[type][level].push(row);
    });

    return structure;
  }, [visibleRows]);

  const openCreateDialog = useCallback(() => {
    setDialogState({ open: true, initial: null });
  }, []);

  const openEditDialog = useCallback((row) => {
    setDialogState({ open: true, initial: row });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogState({ open: false, initial: null });
  }, []);

  const handleDelete = useCallback(
    async (row) => {
      if (!row?.id) return;
      // eslint-disable-next-line no-alert
      const confirmed = window.confirm("Delete this insider member?");
      if (!confirmed) return;
      setDeletePending((prev) => new Set(prev).add(row.id));
      const snapshot = {
        ...row,
        members: Array.isArray(row.members)
          ? row.members.map((member) => ({ ...member }))
          : [],
      };
      try {
        await deleteInsider(row.id);
        show(`Deleted “${row.name || "member"}”.`, "info", {
          autoHideDuration: 6000,
          action: (
            <Button
              color="inherit"
              size="small"
              sx={{ fontWeight: 600 }}
              onClick={async () => {
                try {
                  await restoreInsider(snapshot);
                  show("Undo complete.", "success");
                } catch (undoError) {
                  logError(undoError, {
                    where: "InsiderMembersPanel.undoDelete",
                    payload: { id: snapshot.id },
                  });
                  show("Failed to undo delete.", "error");
                }
              }}
            >
              Undo
            </Button>
          ),
        });
      } catch (deleteError) {
        logError(deleteError, {
          where: "InsiderMembersPanel.delete",
          payload: { id: row.id },
        });
        show("Failed to delete insider member.", "error");
      } finally {
        setDeletePending((prev) => {
          const next = new Set(prev);
          next.delete(row.id);
          return next;
        });
      }
    },
    [show],
  );

  const hasRows = visibleRows.length > 0;

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
      >
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Insider Members
        </Typography>
        {isAdmin ? (
          <Button
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
            variant="contained"
            color="primary"
            sx={{ fontWeight: 600 }}
          >
            Add Member
          </Button>
        ) : null}
      </Stack>

      {loading ? (
        <Box
          sx={{
            py: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress color="inherit" size={32} />
        </Box>
      ) : null}

      {error ? (
        <Alert
          severity="error"
          sx={{ bgcolor: (t) => alpha(t.palette.error.main, 0.12) }}
        >
          Failed to load insider members. Please try again.
        </Alert>
      ) : null}

      {!loading && !hasRows && !error ? (
        <Alert
          severity="info"
          sx={{ bgcolor: (t) => alpha(t.palette.common.white, 0.04) }}
        >
          No insider members yet.
        </Alert>
      ) : null}

      {MEMBERSHIP_TYPES.map((type) => (
        <Box
          key={type}
          sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
        >
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, textTransform: "capitalize" }}
          >
            {type}
          </Typography>
          <Divider
            sx={{ borderColor: (t) => alpha(t.palette.common.white, 0.08) }}
          />
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            }}
          >
            {LEVELS.map((level) => {
              const list = grouped?.[type]?.[level] || [];
              return (
                <Card
                  key={`${type}-${level}`}
                  sx={{
                    bgcolor: (t) => t.palette.background.paper,
                    borderRadius: 2,
                    border: (t) => `1px solid ${t.palette.divider}`,
                    minHeight: 180,
                    display: "flex",
                    flexDirection: "column",
                  }}
                  elevation={0}
                >
                  <CardHeader
                    title={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          size="small"
                          label={formatTitle(level)}
                          sx={{
                            textTransform: "capitalize",
                            bgcolor:
                              level === "diamond"
                                ? "rgba(180,180,200,0.18)"
                                : level === "gold"
                                  ? "rgba(255,215,0,0.18)"
                                  : level === "silver"
                                    ? "rgba(192,192,192,0.18)"
                                    : "rgba(205,127,50,0.18)",
                            border: "1px solid",
                            borderColor:
                              level === "diamond"
                                ? "rgba(180,180,200,0.35)"
                                : level === "gold"
                                  ? "rgba(255,215,0,0.35)"
                                  : level === "silver"
                                    ? "rgba(192,192,192,0.35)"
                                    : "rgba(205,127,50,0.35)",
                          }}
                        />
                        <Typography variant="subtitle2" sx={{ opacity: 0.7 }}>
                          {list.length}{" "}
                          {list.length === 1 ? "entry" : "entries"}
                        </Typography>
                      </Stack>
                    }
                    sx={{ pb: 0, alignItems: "center" }}
                  />
                  <CardContent sx={{ flexGrow: 1 }}>
                    {list.length === 0 ? (
                      <Typography
                        variant="body2"
                        sx={{ opacity: 0.6, fontStyle: "italic" }}
                      >
                        No entries.
                      </Typography>
                    ) : (
                      <Stack spacing={1.25}>
                        {list.map((row) => {
                          const isDeleteBusy = deletePending.has(row.id);
                          const members = Array.isArray(row.members)
                            ? row.members
                            : [];
                          return (
                            <Box
                              key={row.id}
                              sx={(t) => ({
                                display: "flex",
                                gap: 1,
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                borderRadius: 1.5,
                                border: (t) => `1px solid ${t.palette.divider}`,
                                bgcolor: t.palette.background.paper,
                                p: 1.25,
                              })}
                            >
                              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                                <Typography sx={{ fontWeight: 700 }}>
                                  {row.name || "Untitled"}
                                </Typography>
                                {(type === "business" || type === "family") &&
                                members.length ? (
                                  <Box
                                    sx={{
                                      display: "flex",
                                      gap: 0.5,
                                      flexWrap: "wrap",
                                      mt: 0.75,
                                    }}
                                  >
                                    {members.map((member, index) => (
                                      <Chip
                                        key={`${row.id}-member-${index}`} // eslint-disable-line react/no-array-index-key
                                        label={member?.name || "Member"}
                                        size="small"
                                      />
                                    ))}
                                  </Box>
                                ) : null}
                                {row.notes ? (
                                  <Typography
                                    variant="body2"
                                    sx={{ mt: 0.75, opacity: 0.7 }}
                                  >
                                    {row.notes}
                                  </Typography>
                                ) : null}
                              </Box>

                              <Stack spacing={0.75} alignItems="flex-end">
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                >
                                  <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 600 }}
                                  >
                                    Points:
                                  </Typography>
                                  <Typography variant="body2">
                                    {Number(row.points ?? 0)}
                                  </Typography>
                                </Stack>

                                {isAdmin ? (
                                  <Stack direction="row" spacing={0.5}>
                                    <Tooltip title="Edit">
                                      <span>
                                        <IconButton
                                          size="small"
                                          color="inherit"
                                          disabled={isDeleteBusy}
                                          onClick={() => openEditDialog(row)}
                                        >
                                          <EditIcon fontSize="small" />
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                      <span>
                                        <IconButton
                                          size="small"
                                          color="inherit"
                                          disabled={isDeleteBusy}
                                          onClick={() => handleDelete(row)}
                                        >
                                          <DeleteOutlineIcon fontSize="small" />
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                  </Stack>
                                ) : null}
                              </Stack>
                            </Box>
                          );
                        })}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        </Box>
      ))}

      {dialogState.open ? (
        <InsiderEditorDialog
          open={dialogState.open}
          initial={dialogState.initial}
          onClose={() => {
            closeDialog();
          }}
        />
      ) : null}
    </Box>
  );
}
