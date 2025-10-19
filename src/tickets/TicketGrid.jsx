import { memo, useCallback, useEffect, useMemo, useState } from "react";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Box, Chip, IconButton, Tooltip } from "@mui/material";

import LrpDataGridPro from "@/components/datagrid/LrpDataGridPro.jsx";
import { subscribeTickets } from "@/services/tickets.js";
import logError from "@/utils/logError.js";
import { formatDateTime } from "@/utils/time";

const STATUS_COLOR = {
  open: "warning",
  pending: "info",
  closed: "default",
  resolved: "success",
  breached: "error",
};

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

  const columns = useMemo(() => {
    return [
      {
        field: "title",
        headerName: "Title",
        flex: 1,
        minWidth: 220,
        valueGetter: (params) => params?.row?.title || "N/A",
        naFallback: true,
      },
      {
        field: "category",
        headerName: "Category",
        width: 150,
        renderCell: (params) => {
          const label = params?.row?.category || "N/A";
          return <Chip size="small" label={label} />;
        },
      },
      {
        field: "status",
        headerName: "Status",
        width: 140,
        renderCell: (params) => {
          const status = String(params?.row?.status || "open").toLowerCase();
          const color = STATUS_COLOR[status] || "default";
          return <Chip size="small" color={color} label={status || "N/A"} />;
        },
      },
      {
        field: "assignee",
        headerName: "Assignee",
        width: 160,
        valueGetter: (params) =>
          params?.row?.assignee?.displayName ||
          params?.row?.assignee?.userId ||
          "N/A",
        naFallback: true,
      },
      {
        field: "updatedAt",
        headerName: "Updated",
        width: 200,
        valueGetter: (params) => formatDateTime(params?.row?.updatedAt),
        naFallback: true,
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
  }, [handleSelect]);

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
        getRowId={(row) => row?.id}
        loading={loading}
        error={gridError}
        quickFilterPlaceholder="Search tickets"
        onRowClick={(params) => handleSelect(params?.row)}
        disableRowSelectionOnClick
        getRowClassName={getRowClassName}
        sx={{
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
