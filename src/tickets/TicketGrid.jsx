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

import LrpDataGridPro from "@/components/datagrid/LrpDataGridPro.jsx";
import { subscribeTickets } from "@/services/tickets.js";
import logError from "@/utils/logError.js";
import { formatDateTime } from "@/utils/time";

function NoTicketsOverlay() {
  return (
    <Box sx={{ p: 4, textAlign: "center", opacity: 0.6 }}>
      No Support Tickets Found 🚀
    </Box>
  );
}

function TicketsErrorOverlay({ message }) {
  return (
    <Box sx={{ p: 4, textAlign: "center", color: "#ff5252" }}>
      Error loading tickets. Try again.
      {message ? (
        <Typography variant="body2" sx={{ mt: 1, opacity: 0.7 }}>
          {message}
        </Typography>
      ) : null}
    </Box>
  );
}

function TicketGrid({ onSelect, activeTicketId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeTickets({}, (result) => {
      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setRows(result?.rows || []);
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
  }, []);

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
        onSelect(row);
      }
    },
    [onSelect],
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

  const getAssigneeDisplayName = useCallback((row) => {
    const assignee = row?.assignee;
    if (!assignee) return "Unassigned";
    if (typeof assignee === "string") {
      return assignee.trim() || "Unassigned";
    }
    if (typeof assignee.displayName === "string" && assignee.displayName) {
      return assignee.displayName;
    }
    if (typeof assignee.name === "string" && assignee.name) {
      return assignee.name;
    }
    if (typeof assignee.userId === "string" && assignee.userId) {
      return assignee.userId;
    }
    return "Unassigned";
  }, []);

  const renderCategoryChip = useCallback((params) => {
    const raw = params?.row?.category;
    const isMissing = !raw;
    const label = isMissing ? "N/A" : String(raw);
    return (
      <Chip
        label={label}
        size="small"
        sx={{
          bgcolor: "#2e2e2e",
          color: "#4cbb17",
          textTransform: isMissing ? "none" : "capitalize",
          fontWeight: 500,
        }}
      />
    );
  }, []);

  const renderStatusChip = useCallback((params) => {
    const statusRaw = params?.row?.status;
    const status = statusRaw ? String(statusRaw).toLowerCase() : "open";
    const isClosed = status === "closed" || status === "resolved";
    const label = status
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ""))
      .join(" ");
    return (
      <Chip
        label={label || "Open"}
        size="small"
        sx={{
          bgcolor: isClosed ? "rgba(76,187,23,0.15)" : "rgba(255,193,7,0.15)",
          color: isClosed ? "#4cbb17" : "#ffc107",
          textTransform: "capitalize",
          fontWeight: 600,
        }}
      />
    );
  }, []);

  const renderAssigneeCell = useCallback(
    (params) => {
      const displayName = getAssigneeDisplayName(params?.row);
      const firstLetter = displayName?.trim()?.charAt(0)?.toUpperCase() || "?";
      return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Avatar
            sx={{
              bgcolor: "#4cbb17",
              width: 26,
              height: 26,
              fontSize: 13,
            }}
          >
            {firstLetter}
          </Avatar>
          <Typography variant="body2" sx={{ color: "inherit" }}>
            {displayName}
          </Typography>
        </Box>
      );
    },
    [getAssigneeDisplayName],
  );

  const columns = useMemo(() => {
    const resolveTitle = (row) => {
      if (!row) return "N/A";
      const candidates = [
        row.title,
        row.subject,
        row.summary,
        row.name,
        row.ticketTitle,
      ];
      for (const value of candidates) {
        if (typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }
      return "N/A";
    };

    return [
      {
        field: "title",
        headerName: "Title",
        flex: 1,
        minWidth: 220,
        valueGetter: (params) => resolveTitle(params?.row),
      },
      {
        field: "category",
        headerName: "Category",
        width: 150,
        renderCell: renderCategoryChip,
        valueGetter: (params) => params?.row?.category || "N/A",
      },
      {
        field: "status",
        headerName: "Status",
        width: 140,
        renderCell: renderStatusChip,
        valueGetter: (params) => params?.row?.status || "open",
      },
      {
        field: "assignee",
        headerName: "Assignee",
        width: 180,
        renderCell: renderAssigneeCell,
        valueGetter: (params) => getAssigneeDisplayName(params?.row),
      },
      {
        field: "updatedAt",
        headerName: "Updated",
        width: 200,
        valueGetter: (params) => formatDateTime(params?.row?.updatedAt),
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
  }, [
    getAssigneeDisplayName,
    handleSelect,
    renderAssigneeCell,
    renderCategoryChip,
    renderStatusChip,
  ]);

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
        getRowId={(row) => row?.id || row?.ticketId}
        loading={loading}
        error={gridError}
        quickFilterPlaceholder="Search tickets"
        onRowClick={(params) => handleSelect(params?.row)}
        disableRowSelectionOnClick
        getRowClassName={getRowClassName}
        slots={gridSlots}
        sx={{
          bgcolor: "#0c0c0c",
          color: "#fff",
          border: "none",
          "& .MuiDataGrid-row:hover": {
            bgcolor: "rgba(76,187,23,0.05)",
          },
          "& .status-breached": {
            bgcolor: "rgba(244, 67, 54, 0.18)",
          },
          "& .status-open": {
            bgcolor: "rgba(76, 187, 23, 0.12)",
          },
          "& .priority-urgent": {
            borderLeft: "3px solid #f44336",
          },
          "& .priority-high": {
            borderLeft: "3px solid #ff9800",
          },
          "& .row-active": {
            outline: "2px solid #4cbb17",
            outlineOffset: -2,
          },
        }}
      />
    </Box>
  );
}

export default memo(TicketGrid);
