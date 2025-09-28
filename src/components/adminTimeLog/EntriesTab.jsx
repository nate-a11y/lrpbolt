/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useState, useCallback } from "react";
import { Box, Paper, CircularProgress, Alert, TextField } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers-pro";
import { useGridApiRef } from "@mui/x-data-grid-pro";
import { writeBatch, doc } from "firebase/firestore";

import logError from "@/utils/logError.js";
import AppError from "@/utils/AppError.js";
import ConfirmBulkDeleteDialog from "@/components/datagrid/bulkDelete/ConfirmBulkDeleteDialog.jsx";
import useBulkDelete from "@/components/datagrid/bulkDelete/useBulkDelete.jsx";
import { tsToDate } from "@/utils/fsTime";
import { formatDateTime, formatClockOutOrDash } from "@/utils/time";
import { minutesBetween } from "@/utils/dates.js";
import { timestampSortComparator } from "@/utils/timeUtils.js";
import { buildTimeLogColumns } from "@/components/datagrid/columns/timeLogColumns.shared";
import { getRowId as pickId } from "@/utils/timeLogMap";

import { db } from "../../utils/firebaseInit";
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
  const [selectionModel, setSelectionModel] = useState([]);

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
    const driverName =
      typeof newRow.driverName === "string" && newRow.driverName.trim() !== ""
        ? newRow.driverName
        : (newRow.driver ?? null);
    const updates = {
      driver: driverName ?? null,
      driverName: driverName ?? null,
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

      return {
        ...newRow,
        duration,
        driverName: driverName ?? newRow.driverName,
      };
    } catch (e) {
      logError(e, `EntriesTab.processRowUpdate:${id}`);
      return oldRow;
    }
  }, []);

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

  const sharedColumns = useMemo(() => buildTimeLogColumns(), []);

  const sharedAdminColumns = useMemo(() => {
    return sharedColumns.map((col) => {
      if (col.field === "driverName") {
        return {
          ...col,
          editable: true,
          valueGetter: (params) =>
            params?.row?.driverName ?? params?.row?.driver ?? "N/A",
          valueSetter: (params) => {
            const next = { ...params.row };
            next.driverName = params.value ?? "";
            next.driver = params.value ?? null;
            return next;
          },
        };
      }
      if (col.field === "rideId") {
        return {
          ...col,
          editable: true,
          valueGetter: (params) => params?.row?.rideId ?? "N/A",
          valueSetter: (params) => {
            const next = { ...params.row };
            next.rideId = params.value ?? null;
            return next;
          },
        };
      }
      if (col.field === "clockIn") {
        return {
          ...col,
          type: "dateTime",
          editable: true,
          valueGetter: (params) =>
            params?.row?.startTime instanceof Date
              ? params.row.startTime
              : tsToDate(params?.row?.startTime),
          valueFormatter: (params) =>
            params?.value ? formatDateTime(params.value) : "N/A",
          valueSetter: (params) => {
            const next = { ...params.row };
            next.startTime = params.value ?? null;
            return next;
          },
          sortComparator: (v1, v2, cellParams1, cellParams2) =>
            timestampSortComparator(
              cellParams1?.row?.startTime,
              cellParams2?.row?.startTime,
            ),
        };
      }
      if (col.field === "clockOut") {
        return {
          ...col,
          type: "dateTime",
          editable: true,
          valueGetter: (params) =>
            params?.row?.endTime instanceof Date
              ? params.row.endTime
              : tsToDate(params?.row?.endTime),
          valueFormatter: (params) =>
            params?.value ? formatClockOutOrDash(params.value) : "—",
          valueSetter: (params) => {
            const next = { ...params.row };
            next.endTime = params.value ?? null;
            return next;
          },
          sortComparator: (v1, v2, cellParams1, cellParams2) =>
            timestampSortComparator(
              cellParams1?.row?.endTime,
              cellParams2?.row?.endTime,
            ),
        };
      }
      return col;
    });
  }, [sharedColumns]);

  const columns = useMemo(() => {
    const extras = [
      {
        field: "loggedAt",
        headerName: "Logged At",
        minWidth: 180,
        type: "dateTime",
        editable: true,
        valueGetter: (params) =>
          params?.row?.loggedAt instanceof Date
            ? params.row.loggedAt
            : tsToDate(params?.row?.loggedAt),
        valueFormatter: (params) =>
          params?.value ? formatDateTime(params.value) : "N/A",
        valueSetter: (params) => {
          const next = { ...params.row };
          next.loggedAt = params.value ?? null;
          return next;
        },
        sortComparator: (v1, v2, cellParams1, cellParams2) =>
          timestampSortComparator(
            cellParams1?.row?.loggedAt,
            cellParams2?.row?.loggedAt,
          ),
      },
      {
        field: "note",
        headerName: "Note",
        minWidth: 200,
        flex: 1,
        editable: true,
        valueGetter: (params) => params?.row?.note ?? "",
        valueFormatter: (params) => (params?.value ? params.value : "N/A"),
        valueSetter: (params) => {
          const next = { ...params.row };
          next.note = params.value ?? "";
          return next;
        },
      },
    ];
    return [...sharedAdminColumns, ...extras];
  }, [sharedAdminColumns]);

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
          const withDates = withNames.map((r) => ({
            ...r,
            startTime: tsToDate(r.startTime),
            endTime: tsToDate(r.endTime),
            loggedAt: tsToDate(r.loggedAt),
          }));
          setRows(withDates);
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
      const driverField = (
        r.driverName ??
        r.driver ??
        r.driverId ??
        r.driverEmail ??
        ""
      )
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
        r.driverName ?? r.driver ?? r.driverId ?? r.driverEmail,
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

  const performDelete = useCallback(async (ids) => {
    const backoff = (a) => new Promise((res) => setTimeout(res, 2 ** a * 100));
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const batch = writeBatch(db);
        ids.forEach((id) => batch.delete(doc(db, "timeLogs", id)));
        await batch.commit();
        return;
      } catch (err) {
        if (attempt === 2) {
          logError(err, { where: "EntriesTab", action: "bulkDelete" });
          throw new AppError(
            err.message || "Bulk delete failed",
            "FIRESTORE_DELETE",
            { collection: "timeLogs" },
          );
        }
        await backoff(attempt);
      }
    }
  }, []);

  performDelete.restore = async (rowsToRestore) => {
    const backoff = (a) => new Promise((res) => setTimeout(res, 2 ** a * 100));
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const batch = writeBatch(db);
        rowsToRestore.forEach((r) => {
          if (!r) return;
          const { id, ...rest } = r;
          batch.set(doc(db, "timeLogs", id), rest);
        });
        await batch.commit();
        return;
      } catch (err) {
        if (attempt === 2) {
          logError(err, { where: "EntriesTab", action: "bulkRestore" });
        } else {
          await backoff(attempt);
        }
      }
    }
  };

  const { dialogOpen, deleting, openDialog, closeDialog, onConfirm } =
    useBulkDelete({ performDelete });

  const handleBulkDelete = useCallback(
    async (ids) => {
      const rows = ids
        .map((id) => apiRef.current?.getRow?.(id))
        .filter(Boolean);
      openDialog(ids, rows);
    },
    [apiRef, openDialog],
  );

  const sampleRows = useMemo(() => {
    const sel = apiRef.current?.getSelectedRows?.() || new Map();
    return selectionModel.map((id) => sel.get(id)).filter(Boolean);
  }, [apiRef, selectionModel]);

  if (loading) {
    return (
      <Paper
        sx={{
          width: "100%",
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <CircularProgress size={24} />
      </Paper>
    );
  }
  if (error) {
    return (
      <Paper
        sx={{
          width: "100%",
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Alert severity="error">{error}</Alert>
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        width: "100%",
        p: 1,
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        gap: 1,
      }}
    >
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
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
      <Paper
        sx={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
        }}
      >
        <SmartAutoGrid
          rows={safeRows}
          columns={columns}
          actionsColumn={actionsColumn}
          loading={loading}
          editMode="row"
          rowModesModel={rowModesModel}
          onRowModesModelChange={(m) => setRowModesModel(m)}
          processRowUpdate={handleProcessRowUpdate}
          onProcessRowUpdateError={(e) =>
            logError(e, "EntriesTab.processRowUpdateError")
          }
          onRowEditStart={handleRowEditStart}
          onRowEditStop={handleRowEditStop}
          apiRef={apiRef}
          experimentalFeatures={{ newEditingApi: true }}
          checkboxSelection
          disableRowSelectionOnClick
          rowSelectionModel={selectionModel}
          onRowSelectionModelChange={(m) => setSelectionModel(m)}
          gridHeight="100%"
          containerSx={{ flex: 1, minHeight: 0 }}
          slotProps={{
            toolbar: {
              onDeleteSelected: handleBulkDelete,
              quickFilterPlaceholder: "Search",
            },
          }}
          pageSizeOptions={[15, 30, 60, 100]}
          getRowId={(r) =>
            pickId(r) ||
            r?.id ||
            r?.docId ||
            r?._id ||
            r?.uid ||
            JSON.stringify(r)
          }
        />
        <ConfirmBulkDeleteDialog
          open={dialogOpen}
          total={selectionModel.length}
          deleting={deleting}
          onClose={closeDialog}
          onConfirm={onConfirm}
          sampleRows={sampleRows}
        />
      </Paper>
    </Paper>
  );
}
