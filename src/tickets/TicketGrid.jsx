import { memo, useCallback, useEffect, useMemo, useState } from "react";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  Avatar,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import LrpDataGridPro from "@/components/datagrid/LrpDataGridPro.jsx";
import { subscribeTickets } from "@/services/tickets.js";
import logError from "@/utils/logError.js";
import { formatDateTime } from "@/utils/time.js";
const cap = (value) => {
  if (value === null || value === undefined) return "N/A";
  const text = String(value).trim();
  if (!text) return "N/A";
  const lower = text.toLowerCase();
  if (lower === "n/a" || lower === "na") {
    return "N/A";
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const formatUpdatedAt = (params) => {
  const v = params?.value ?? null;
  const formatted = formatDateTime(v);
  return formatted || "N/A";
};

function NoTicketsOverlay() {
  return (
    <Box sx={{ p: 4, textAlign: "center", opacity: 0.6 }}>
      No Support Tickets Found 🚀
    </Box>
  );
}

function TicketsErrorOverlay({ message }) {
  return (
    <Box sx={{ p: 4, textAlign: "center", color: (t) => t.palette.error.main }}>
      Error loading tickets. Try again.
      {message ? (
        <Typography variant="body2" sx={{ mt: 1, opacity: 0.7 }}>
          {message}
        </Typography>
      ) : null}
    </Box>
  );
}

function TicketGrid({
  onSelect,
  activeTicketId,
  optimisticTicket: _optimisticTicket,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const normalizeTicketRow = useCallback((ticket) => {
    if (!ticket) {
      return {
        id: "",
        title: "N/A",
        category: "n/a",
        status: "n/a",
        priority: "n/a",
        assigneeName: "Unassigned",
        assigneeInitial: "U",
        updatedAt: null,
        updatedAtSource: null,
        _source: null,
      };
    }

    const fallbackId =
      ticket.id ||
      ticket.ticketId ||
      ticket.docId ||
      ticket._id ||
      ticket.docID ||
      ticket.documentId ||
      "";

    const title =
      typeof ticket.title === "string" && ticket.title.trim()
        ? ticket.title.trim()
        : "";

    const category =
      typeof ticket.category === "string" && ticket.category.trim()
        ? ticket.category.trim().toLowerCase()
        : "n/a";

    const status =
      typeof ticket.status === "string" && ticket.status.trim()
        ? ticket.status.trim().toLowerCase()
        : "n/a";

    const priority =
      typeof ticket.priority === "string" && ticket.priority.trim()
        ? ticket.priority.trim().toLowerCase()
        : "n/a";

    const assignee = ticket.assignee || null;
    const assigneeName =
      (typeof assignee?.displayName === "string" &&
        assignee.displayName.trim()) ||
      (typeof assignee?.email === "string" && assignee.email.trim()) ||
      (typeof assignee?.name === "string" && assignee.name.trim()) ||
      (typeof assignee?.userId === "string" && assignee.userId.trim()) ||
      (typeof assignee === "string" && assignee.trim()) ||
      "Unassigned";

    const initialSource = assigneeName.trim();
    const assigneeInitial = initialSource
      ? initialSource.charAt(0).toUpperCase()
      : "U";

    const updatedAtSource =
      ticket.updatedAtSource ||
      ticket.updatedAtTimestamp ||
      ticket.updatedAtRaw ||
      ticket.updatedAt ||
      null;

    let updatedAtMillis = 0;
    if (updatedAtSource && typeof updatedAtSource.toMillis === "function") {
      updatedAtMillis = Number(updatedAtSource.toMillis()) || 0;
    } else if (
      updatedAtSource &&
      typeof updatedAtSource.valueOf === "function" &&
      Number.isFinite(Number(updatedAtSource.valueOf()))
    ) {
      updatedAtMillis = Number(updatedAtSource.valueOf()) || 0;
    } else if (typeof updatedAtSource === "number") {
      updatedAtMillis = Number(updatedAtSource);
    }

    if (!Number.isFinite(updatedAtMillis) || updatedAtMillis <= 0) {
      updatedAtMillis = null;
    }

    return {
      ...ticket,
      id: fallbackId,
      title,
      category,
      status,
      priority,
      assigneeName,
      assigneeInitial,
      updatedAtSource: updatedAtSource || null,
      updatedAt: updatedAtMillis,
      _source: ticket,
    };
  }, []);

  const buildTicketPayload = useCallback((row) => {
    if (!row) return null;
    if (!row._source) {
      return row;
    }
    const updated =
      row.updatedAtSource || row._source?.updatedAt || row.updatedAt;
    return {
      ...row._source,
      ...row,
      updatedAt: updated,
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsubscribe = subscribeTickets({}, (result) => {
      if (result?.error) {
        setError(result.error);
        setRows([]);
        setLoading(false);
        return;
      }
      const incoming = Array.isArray(result?.rows) ? result.rows : [];
      setRows(incoming.map((ticket) => normalizeTicketRow(ticket)));
      setError(null);
      setLoading(false);
    });

    return () => {
      try {
        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
      } catch (err) {
        logError(err, { where: "TicketGrid.cleanup" });
      }
    };
  }, [normalizeTicketRow]);

  const handleSelect = useCallback(
    (row) => {
      if (!row) return;
      setSelectedId(row.id);
      if (typeof window !== "undefined") {
        try {
          const url = new URL(window.location.href);
          url.hash = `#/tickets?id=${row.id}`;
          window.history.replaceState(null, "", url.toString());
        } catch (err) {
          logError(err, { where: "TicketGrid.updateHash" });
        }
      }
      if (typeof onSelect === "function") {
        onSelect(buildTicketPayload(row));
      }
    },
    [buildTicketPayload, onSelect],
  );

  const extractIdFromLocation = useCallback(() => {
    if (typeof window === "undefined") return null;
    try {
      const url = new URL(window.location.href);
      if (url.hash.includes("?")) {
        const params = new URLSearchParams(url.hash.split("?")[1]);
        const id = params.get("id");
        if (id) return id;
      }
      const searchId =
        url.searchParams.get("ticketId") || url.searchParams.get("id");
      return searchId || null;
    } catch (err) {
      logError(err, { where: "TicketGrid.extractId" });
      return null;
    }
  }, []);

  useEffect(() => {
    const checkAndOpen = () => {
      const id = extractIdFromLocation();
      if (!id) return;
      if (selectedId === id) return;
      const match = rows.find((row) => row.id === id);
      if (match) {
        handleSelect(match);
      }
    };
    checkAndOpen();
  }, [extractIdFromLocation, handleSelect, rows, selectedId]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = () => {
      const id = extractIdFromLocation();
      if (!id) return;
      const match = rows.find((row) => row.id === id);
      if (match) {
        handleSelect(match);
      }
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [extractIdFromLocation, handleSelect, rows]);

  const renderCategoryChip = useCallback((params) => {
    const value = params?.row?.category;
    const label = cap(value);
    const isMissing = label === "N/A";
    return (
      <Chip
        label={label}
        size="small"
        sx={{
          bgcolor: (t) =>
            t.palette.mode === "dark"
              ? t.palette.grey[900]
              : t.palette.grey[200],
          color: (t) => t.palette.primary.main,
          textTransform: isMissing ? "none" : "capitalize",
          fontWeight: 500,
        }}
      />
    );
  }, []);

  const renderStatusChip = useCallback((params) => {
    const statusValue = params?.row?.status;
    if (!statusValue) {
      return (
        <Chip
          label="N/A"
          size="small"
          sx={{
            bgcolor: (t) => alpha(t.palette.common.white, 0.08),
            color: (t) => t.palette.text.secondary,
            fontWeight: 500,
          }}
        />
      );
    }
    const status = String(statusValue).toLowerCase();
    const isClosed = status === "closed" || status === "resolved";
    const label = status
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ""))
      .join(" ");
    return (
      <Chip
        label={label || "N/A"}
        size="small"
        sx={(t) => ({
          bgcolor: isClosed
            ? alpha(t.palette.primary.main, 0.15)
            : alpha(t.palette.warning.main, 0.15),
          color: isClosed ? t.palette.primary.main : t.palette.warning.main,
          textTransform: label ? "capitalize" : "none",
          fontWeight: 600,
        })}
      />
    );
  }, []);

  const renderAssigneeCell = useCallback((params) => {
    const label = params?.row?.assigneeName || "Unassigned";
    const firstLetter =
      params?.row?.assigneeInitial ||
      (label && label !== "N/A"
        ? label.trim().charAt(0)?.toUpperCase() || "?"
        : "?");
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Avatar
          sx={{
            bgcolor: (t) => t.palette.primary.main,
            width: 26,
            height: 26,
            fontSize: 13,
          }}
        >
          {firstLetter}
        </Avatar>
        <Typography variant="body2" sx={{ color: "inherit" }}>
          {label}
        </Typography>
      </Box>
    );
  }, []);

  const columns = useMemo(() => {
    return [
      {
        field: "title",
        headerName: "Title",
        flex: 1,
        minWidth: 220,
        valueGetter: (params) => {
          const t = params?.row?.title ?? params?.row?._source?.title;
          return typeof t === "string" && t.trim() ? t : "N/A";
        },
      },
      {
        field: "category",
        headerName: "Category",
        width: 150,
        renderCell: renderCategoryChip,
        valueGetter: (params) => {
          const raw = params?.row?.category;
          if (!raw) return "N/A";
          return raw === "n/a" ? "N/A" : raw;
        },
      },
      {
        field: "status",
        headerName: "Status",
        width: 140,
        renderCell: renderStatusChip,
        valueGetter: (params) => {
          const raw = params?.row?.status;
          if (!raw) return "N/A";
          return raw === "n/a" ? "N/A" : raw;
        },
      },
      {
        field: "assignee",
        headerName: "Assignee",
        width: 180,
        renderCell: renderAssigneeCell,
        valueGetter: (params) => params?.row?.assigneeName || "Unassigned",
      },
      {
        field: "updatedAt",
        headerName: "Updated",
        width: 200,
        valueGetter: (params) =>
          params?.row?.updatedAtSource ??
          params?.row?.updatedAt ??
          params?.row?._source?.updatedAt ??
          null,
        valueFormatter: formatUpdatedAt,
      },
      {
        field: "actions",
        headerName: "",
        width: 80,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <Tooltip title="View support ticket">
            <span>
              <IconButton
                size="small"
                onClick={() => handleSelect(params?.row)}
                aria-label="View support ticket details"
              >
                <InfoOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        ),
      },
    ];
  }, [handleSelect, renderAssigneeCell, renderCategoryChip, renderStatusChip]);

  const getRowClassName = useCallback(
    (params) => {
      const row = params?.row || {};
      const status = String(row.status || "").toLowerCase();
      const priority = String(row.priority || "").toLowerCase();
      const classes = [];
      if (status) classes.push(`status-${status}`);
      if (priority) classes.push(`priority-${priority}`);
      if (row.id === selectedId) classes.push("row-active");
      return classes.join(" ");
    },
    [selectedId],
  );

  const gridError = useMemo(() => {
    if (!error) return null;
    return { message: error?.message || String(error) };
  }, [error]);

  const gridSlots = useMemo(
    () => ({
      noRowsOverlay: NoTicketsOverlay,
      errorOverlay: TicketsErrorOverlay,
    }),
    [],
  );

  useEffect(() => {
    if (!activeTicketId) {
      setSelectedId(null);
    }
  }, [activeTicketId]);

  return (
    <Box sx={{ width: "100%", minHeight: 320 }}>
      <LrpDataGridPro
        id="support-tickets-grid"
        rows={rows}
        columns={columns}
        getRowId={(row) =>
          row?.id ||
          row?.ticketId ||
          row?.docId ||
          row?._id ||
          row?.docID ||
          row?.documentId
        }
        loading={loading}
        error={gridError}
        quickFilterPlaceholder="Search tickets"
        onRowClick={(params) => handleSelect(params?.row)}
        disableRowSelectionOnClick
        getRowClassName={getRowClassName}
        slots={gridSlots}
        sx={{
          bgcolor: (t) => t.palette.background.paper,
          color: (t) => t.palette.text.primary,
          border: "none",
          "& .MuiDataGrid-row:hover": {
            bgcolor: (t) => alpha(t.palette.primary.main, 0.05),
          },
          "& .status-breached": {
            bgcolor: (t) => alpha(t.palette.error.main, 0.18),
          },
          "& .status-open": {
            bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
          },
          "& .priority-urgent": {
            borderLeft: (t) => `3px solid ${t.palette.error.main}`,
          },
          "& .priority-high": {
            borderLeft: (t) => `3px solid ${t.palette.warning.main}`,
          },
          "& .row-active": {
            outline: (t) => `2px solid ${t.palette.primary.main}`,
            outlineOffset: -2,
          },
        }}
      />
    </Box>
  );
}

export default memo(TicketGrid);
