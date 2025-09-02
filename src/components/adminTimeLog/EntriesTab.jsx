/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useState, useCallback } from "react";
import { Box, Paper, CircularProgress, Alert, TextField } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers-pro";
import { useGridApiRef } from "@mui/x-data-grid-pro";

import { tsToDate } from "@/utils/fsTime";
import { formatDateTime } from "@/utils/time";
import { minutesBetween } from "@/utils/dates.js";
import { formatTz, durationHm } from "@/utils/timeSafe";
import { timestampSortComparator } from "@/utils/timeUtils.js";
import logError from "@/utils/logError.js";

import { subscribeTimeLogs } from "../../hooks/firestore";
import { enrichDriverNames } from "../../services/normalizers";
import { patchTimeLog, deleteTimeLog } from "../../services/timeLogs";
import SmartAutoGrid from "../datagrid/SmartAutoGrid.jsx";
import { buildRowEditActionsColumn } from "../../columns/rowEditActions.jsx";

export default function EntriesTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [driverFilter, setDriverFilter] = useState("");
  const [startFilter, setStartFilter] = useState(null); // dayjs | null
  const [endFilter, setEndFilter] = useState(null); // dayjs | null
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
    const id = newRow?.id || newRow?.docId || newRow?._id;
    if (!id) return oldRow;

    // Build update payload (let the service convert Dates->Timestamp)
    const updates = {
      driver: newRow.driver ?? null,
      rideId: newRow.rideId ?? null,
      note: newRow.note ?? null,
    };
    if (newRow.startTime instanceof Date) updates.startTime = newRow.startTime;
    if (newRow.endTime instanceof Date) updates.endTime = newRow.endTime;
    if (newRow.loggedAt instanceof Date) updates.loggedAt = newRow.loggedAt;

    try {
      await patchTimeLog(id, updates);

      // Recompute duration on the client for immediate UX
      const start =
        newRow.startTime instanceof Date
          ? newRow.startTime
          : tsToDate(newRow.startTime);
      const end =
        newRow.endTime instanceof Date
          ? newRow.endTime
          : tsToDate(newRow.endTime);
      let duration = 0;
      if (start && end) {
        duration = Math.max(0, minutesBetween(start, end) || 0);
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
          const row = p?.row;
          const d = tsToDate(row?.startTime);
          return d || "N/A";
        },
        valueFormatter: (p) =>
          p?.value instanceof Date ? formatTz(p.value) : "N/A",
        valueParser: (v) => (v ? new Date(v) : null),
        sortComparator: timestampSortComparator,
      },
      endTime: {
        editable: true,
        type: "dateTime",
        valueGetter: (p) => {
          const row = p?.row;
          const d = tsToDate(row?.endTime);
          return d || "N/A";
        },
        valueFormatter: (p) =>
          p?.value instanceof Date ? formatTz(p.value) : "N/A",
        valueParser: (v) => (v ? new Date(v) : null),
        sortComparator: timestampSortComparator,
      },
      duration: {
        editable: false,
        type: "string",
        valueGetter: (p) => durationHm(p?.row?.startTime, p?.row?.endTime),
      },
      loggedAt: {
        editable: true,
        type: "dateTime",
        valueGetter: (p) => {
          const row = p?.row;
          const d = tsToDate(row?.loggedAt);
          return d || "N/A";
        },
        valueFormatter: (p) =>
          p?.value instanceof Date ? formatDateTime(p.value) : "N/A",
        valueParser: (v) => (v ? new Date(v) : null),
        sortComparator: timestampSortComparator,
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
        onDelete: async (_id, row) => handleDelete(row),
      }),
    [apiRef, rowModesModel, handleDelete],
  );

  const handleRowEditStart = useCallback((params, event) => {
    event.defaultMuiPrevented = true;
  }, []);
  const handleRowEditStop = useCallback((params, event) => {
    event.defaultMuiPrevented = true;
  }, []);

  useEffect(() => {
    const unsub = subscribeTimeLogs(
      async (logs) => {
        try {
          const mapped = (logs || []).map((d) => ({
            id: d.id ?? d.docId ?? d._id ?? Math.random().toString(36).slice(2),
            ...d,
          }));
          const withNames = await enrichDriverNames(mapped);
          setRows(withNames);
        } catch (e) {
          logError(e, "EntriesTab.subscribeTimeLogs.enrich");
          setError("Failed to enrich driver names.");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError(err?.message || "Failed to load time logs.");
        setLoading(false);
      },
    );
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  const filteredRows = useMemo(() => {
    const startBound = startFilter?.toDate?.() ?? null;
    const endBound = endFilter?.toDate?.() ?? null;

    return (rows || []).filter((r) => {
      const driverField = (r.driver ?? r.driverId ?? r.driverEmail ?? "")
        .toString()
        .toLowerCase();
      const driverMatch = driverFilter
        ? driverField.includes(driverFilter.toLowerCase())
        : true;

      const s = tsToDate(r.startTime);
      const e = tsToDate(r.endTime) ?? s;

      const startMatch = startBound
        ? s && s.getTime() >= startBound.getTime()
        : true;
      const endMatch = endBound ? e && e.getTime() <= endBound.getTime() : true;

      const tokens = [
        r.driver ?? r.driverId ?? r.driverEmail,
        r.rideId,
        formatDateTime(s),
        formatDateTime(e),
        formatDateTime(tsToDate(r.loggedAt)),
        r.duration ?? r.minutes ?? Math.round((r.durationMs || 0) / 60000),
        r.note,
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());

      const searchMatch = search
        ? tokens.some((t) => t.includes(search.toLowerCase()))
        : true;

      return driverMatch && startMatch && endMatch && searchMatch;
    });
  }, [rows, driverFilter, startFilter, endFilter, search]);

  const safeRows = useMemo(
    () =>
      (filteredRows || []).filter(Boolean).map((r) => {
        const s = tsToDate(r.startTime);
        const e = tsToDate(r.endTime);
        let duration =
          r.duration ?? r.minutes ?? Math.round((r.durationMs || 0) / 60000);
        if ((duration == null || Number.isNaN(duration)) && s && e) {
          duration = Math.max(0, minutesBetween(s, e) || 0);
        }
        return { ...r, duration };
      }),
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
    <Paper sx={{ width: "100%", p: 1 }}>
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
      <Paper sx={{ width: "100%" }}>
        <SmartAutoGrid
          rows={safeRows}
          headerMap={{
            driver: "Driver",
            driverEmail: "Driver Email",
            rideId: "Ride ID",
            startTime: "Clock In",
            endTime: "Clock Out",
            duration: "Duration (min)",
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
          // Hide only the truly internal fields
          forceHide={["id", "userEmail", "driverId", "mode"]}
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
          showToolbar
          pageSizeOptions={[15, 30, 60, 100]}
          getRowId={(r) =>
            r?.id ?? r?.docId ?? r?._id ?? r?.uid ?? JSON.stringify(r)
          }
        />
      </Paper>
    </Paper>
  );
}
