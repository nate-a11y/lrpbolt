/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useState, useCallback } from "react";
import { Box, Paper, CircularProgress, Alert, TextField } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers-pro";
import { useGridApiRef } from "@mui/x-data-grid-pro";

import { tsToDate } from "@/utils/fsTime";
import { formatDateTime } from "@/utils/time";
import { minutesBetween } from "@/utils/dates.js";
import logError from "@/utils/logError.js";

import { subscribeTimeLogs } from "../../hooks/firestore";
import { enrichDriverNames } from "../../services/normalizers";
import { patchTimeLog, deleteTimeLog } from "../../services/timeLogs";

import SmartAutoGrid from "../datagrid/SmartAutoGrid.jsx";
import ResponsiveScrollBox from "../datagrid/ResponsiveScrollBox.jsx";
import { buildRowEditActionsColumn } from "../../columns/rowEditActions.jsx";

export default function EntriesTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [driverFilter, setDriverFilter] = useState("");
  const [startFilter, setStartFilter] = useState(null);
  const [endFilter, setEndFilter] = useState(null);
  const [search, setSearch] = useState("");
  const apiRef = useGridApiRef();
  const [rowModesModel, setRowModesModel] = useState({});

  const handleDelete = useCallback(async (row) => {
    if (!window.confirm("Delete this time log?")) return;
    const id = row?.id || row?.docId || row?._id;
    if (!id) return;
    try {
      await deleteTimeLog(id);
    } catch (e) {
      logError(e, `EntriesTab.delete:${id}`);
      alert("Failed to delete time log");
    }
  }, []);

  const handleProcessRowUpdate = useCallback(async (newRow, oldRow) => {
    const id = newRow.id || newRow.docId || newRow._id;
    if (!id) return oldRow;
    const updates = {
      driver: newRow.driver,
      rideId: newRow.rideId,
      note: newRow.note,
    };
    if (newRow.startTime instanceof Date) updates.startTime = newRow.startTime;
    if (newRow.endTime instanceof Date) updates.endTime = newRow.endTime;
    if (newRow.loggedAt instanceof Date) updates.loggedAt = newRow.loggedAt;
    if (typeof newRow.duration === "number") updates.duration = newRow.duration;

    try {
      await patchTimeLog(id, updates);
      let duration = newRow.duration;
      if (newRow.startTime && newRow.endTime) {
        duration = minutesBetween(newRow.startTime, newRow.endTime);
      }
      return { ...newRow, duration };
    } catch (e) {
      logError(e, `EntriesTab.processRowUpdate:${id}`);
      return oldRow;
    }
  }, []);

  const overrides = useMemo(
    () => ({
      driver: { editable: true },
      rideId: { editable: true },
      startTime: {
        editable: true,
        type: "dateTime",
        valueGetter: (p) => {
          const d = tsToDate(p?.row?.startTime);
          return d ?? "N/A";
        },
        valueFormatter: (p) => formatDateTime(p?.value),
        valueParser: (v) => (v ? new Date(v) : null),
      },
      endTime: {
        editable: true,
        type: "dateTime",
        valueGetter: (p) => {
          const d = tsToDate(p?.row?.endTime);
          return d ?? "N/A";
        },
        valueFormatter: (p) => formatDateTime(p?.value),
        valueParser: (v) => (v ? new Date(v) : null),
      },
      duration: { editable: true, type: "number" },
      loggedAt: {
        editable: true,
        type: "dateTime",
        valueGetter: (p) => {
          const d = tsToDate(p?.row?.loggedAt);
          return d ?? "N/A";
        },
        valueFormatter: (p) => formatDateTime(p?.value),
        valueParser: (v) => (v ? new Date(v) : null),
      },
      note: { editable: true },
    }),
    [],
  );

  const actionsColumn = useMemo(
    () =>
      buildRowEditActionsColumn({
        apiRef,
        rowModesModel,
        setRowModesModel,
        onDelete: async (id, row) => await handleDelete(row),
      }),
    [apiRef, rowModesModel, handleDelete],
  );

  const handleRowEditStart = (params, event) => {
    event.defaultMuiPrevented = true;
  };
  const handleRowEditStop = (params, event) => {
    event.defaultMuiPrevented = true;
  };

  useEffect(() => {
    const unsub = subscribeTimeLogs(
      async (logs) => {
        const withNames = await enrichDriverNames(logs || []);
        setRows(withNames);
        setLoading(false);
      },
      (err) => {
        setError(err?.message || "Failed to load time logs.");
        setLoading(false);
      },
    );
    return () => typeof unsub === "function" && unsub();
  }, []);

  const filteredRows = useMemo(() => {
    return (rows || []).filter((r) => {
      const driverMatch = driverFilter
        ? (r.driverId ?? r.driverEmail)
            ?.toLowerCase()
            .includes(driverFilter.toLowerCase())
        : true;
      const startMatch = startFilter
        ? r.startTime?.getTime() >= startFilter.toDate().getTime()
        : true;
      const endMatch = endFilter
        ? (r.endTime ?? r.startTime)?.getTime() <= endFilter.toDate().getTime()
        : true;
      const searchMatch = search
        ? [
            r.driverId ?? r.driverEmail,
            r.rideId,
            formatDateTime(r.startTime),
            formatDateTime(r.endTime),
            formatDateTime(r.loggedAt),
            r.duration ?? r.minutes ?? Math.round((r.durationMs || 0) / 60000),
          ]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(search.toLowerCase()))
        : true;
      return driverMatch && startMatch && endMatch && searchMatch;
    });
  }, [rows, driverFilter, startFilter, endFilter, search]);

  const safeRows = useMemo(
    () =>
      (filteredRows || []).filter(Boolean).map((r) => ({
        ...r,
        duration:
          r.duration ?? r.minutes ?? Math.round((r.durationMs || 0) / 60000),
      })),
    [filteredRows],
  );

  if (loading) {
    return (
      <Box p={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }
  if (error) {
    return (
      <Box p={2}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 1 }}>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1 }}>
        <TextField
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
        />
        <TextField
          label="Driver"
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
          size="small"
        />
        <DatePicker
          label="Start after"
          value={startFilter}
          onChange={(v) => setStartFilter(v)}
          slotProps={{ textField: { size: "small" } }}
        />
        <DatePicker
          label="End before"
          value={endFilter}
          onChange={(v) => setEndFilter(v)}
          slotProps={{ textField: { size: "small" } }}
        />
      </Box>
      <ResponsiveScrollBox>
        <SmartAutoGrid
          rows={safeRows}
          headerMap={{
            driver: "Driver",
            driverEmail: "Driver Email",
            rideId: "Ride ID",
            startTime: "Clock In",
            endTime: "Clock Out",
            duration: "Duration",
            loggedAt: "Logged At",
            note: "Note",
            id: "id",
            userEmail: "userEmail",
            driverId: "driverId",
            mode: "mode",
          }}
          order={[
            "driver",
            "driverEmail",
            "rideId",
            "startTime",
            "endTime",
            "duration",
            "loggedAt",
            "note",
            "id",
            "userEmail",
            "driverId",
            "mode",
          ]}
          forceHide={[
            "note",
            "id",
            "userEmail",
            "driverId",
            "mode",
            "driver",
            "driverEmail",
          ]}
          overrides={overrides}
          actionsColumn={actionsColumn}
          loading={loading}
          editMode="row"
          rowModesModel={rowModesModel}
          onRowModesModelChange={(m) => setRowModesModel(m)}
          processRowUpdate={handleProcessRowUpdate}
          onProcessRowUpdateError={(e) => console.error(e)}
          onRowEditStart={handleRowEditStart}
          onRowEditStop={handleRowEditStop}
          apiRef={apiRef}
          experimentalFeatures={{ newEditingApi: true }}
          getRowId={(r) => r.id || r.docId || r._id}
        />
      </ResponsiveScrollBox>
    </Paper>
  );
}
