/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useState, useCallback } from "react";
import { Box, Paper, CircularProgress, Alert, TextField } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers-pro";
import { doc, deleteDoc } from "firebase/firestore";
import { useGridApiRef } from "@mui/x-data-grid-pro";

import SmartAutoGrid from "../datagrid/SmartAutoGrid.jsx";
import ResponsiveScrollBox from "../datagrid/ResponsiveScrollBox.jsx";
import { buildRowEditActionsColumn } from "../../columns/rowEditActions.jsx";
import { db } from "../../utils/firebaseInit";
import { subscribeTimeLogs } from "../../hooks/firestore";
import { patchTimeLog } from "../../hooks/api";
import { enrichDriverNames } from "../../services/normalizers";
import { formatDateTime } from "../../utils/formatters.js";

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
    try {
      await deleteDoc(doc(db, "timeLogs", row.id));
    } catch (e) {
      console.error(e);
      alert("Failed to delete time log");
    }
  }, []);

  const handleProcessRowUpdate = useCallback(async (newRow, oldRow) => {
    try {
      await patchTimeLog(newRow.id, {
        driver: newRow.driver,
        rideId: newRow.rideId,
        startTime: newRow.startTime,
        endTime: newRow.endTime,
        loggedAt: newRow.loggedAt,
        durationMin: newRow.duration,
        note: newRow.note,
      });
      return newRow;
    } catch (e) {
      console.error(e);
      alert("Update failed");
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
        valueGetter: (p) => p?.row?.startTime?.toDate?.() || null,
      },
      endTime: {
        editable: true,
        type: "dateTime",
        valueGetter: (p) => p?.row?.endTime?.toDate?.() || null,
      },
      duration: { editable: true, type: "number" },
      loggedAt: {
        editable: true,
        type: "dateTime",
        valueGetter: (p) => p?.row?.loggedAt?.toDate?.() || null,
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
          ? (r.endTime ?? r.startTime)?.getTime() <=
            endFilter.toDate().getTime()
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
              .some((v) =>
                String(v).toLowerCase().includes(search.toLowerCase()),
              )
          : true;
        return driverMatch && startMatch && endMatch && searchMatch;
      });
    }, [rows, driverFilter, startFilter, endFilter, search]);

  const safeRows = useMemo(
    () =>
      (filteredRows || [])
        .filter(Boolean)
        .map((r) => ({
          ...r,
          duration:
            r.duration ??
            r.minutes ??
            Math.round((r.durationMs || 0) / 60000),
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
      <Box
        sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1 }}
      >
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
          order={["driver","driverEmail","rideId","startTime","endTime","duration","loggedAt","note","id","userEmail","driverId","mode"]}
          forceHide={["note","id","userEmail","driverId","mode","driver","driverEmail"]}
          overrides={overrides}
          actionsColumn={actionsColumn}
          loading={loading}
          editMode="row"
          rowModesModel={rowModesModel}
          onRowModesModelChange={(m) => setRowModesModel(m)}
          processRowUpdate={handleProcessRowUpdate}
          onRowEditStart={handleRowEditStart}
          onRowEditStop={handleRowEditStop}
          apiRef={apiRef}
          experimentalFeatures={{ newEditingApi: true }}
        />
        </ResponsiveScrollBox>
    </Paper>
  );
}

