/* Proprietary and confidential. See LICENSE. */
/* LRP hotfix: eliminate TDZ by hoisting helpers and using a column factory. 2025-10-03 */
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { doc, deleteDoc } from "firebase/firestore";
import { useGridApiRef } from "@mui/x-data-grid-pro";
import { Paper, CircularProgress } from "@mui/material";

import { tsToDate } from "@/utils/fsTime";
import { formatTz, durationHm } from "@/utils/timeSafe";
import { timestampSortComparator } from "@/utils/timeUtils.js";
import UniversalDataGrid from "@/components/datagrid/UniversalDataGrid";
import { EmptyState, ErrorState } from "@/components/feedback/SectionState.jsx";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";

import { buildRowEditActionsColumn } from "../../columns/rowEditActions.jsx";
import { subscribeShootoutStats } from "../../hooks/firestore";
import { patchShootoutStat } from "../../hooks/api";
import { db } from "../../utils/firebaseInit";
import { enrichDriverNames } from "../../services/normalizers";
import logError from "../../utils/logError.js";

function getShootoutRowId(row) {
  return (
    row?.id ??
    row?.docId ??
    row?._id ??
    row?.uid ??
    `${row?.driverEmail ?? "row"}-${row?.startTime ?? ""}`
  );
}

// MUI DataGrid Pro v7 API: valueGetter signature is (value, row, column, apiRef)
// and valueFormatter signature is (value, row, column, apiRef)
function createShootoutColumns({
  apiRef,
  rowModesModel,
  setRowModesModel,
  onDelete,
}) {
  const baseColumns = [
    {
      field: "driver",
      headerName: "Driver",
      minWidth: 160,
      flex: 1,
      valueGetter: (value, row) => row?.driver || "N/A",
    },
    {
      field: "driverEmail",
      headerName: "Driver Email",
      minWidth: 220,
      flex: 1.2,
      editable: true,
      valueGetter: (value, row) => row?.driverEmail || "N/A",
    },
    {
      field: "vehicle",
      headerName: "Vehicle",
      minWidth: 140,
      flex: 1,
      editable: true,
      valueGetter: (value, row) => row?.vehicle || "N/A",
    },
    {
      field: "startTime",
      headerName: "Start",
      minWidth: 200,
      flex: 1,
      type: "dateTime",
      editable: true,
      valueGetter: (value, row) => tsToDate(row?.startTime),
      valueFormatter: (value, row) =>
        value instanceof Date
          ? formatTz(value)
          : formatTz(tsToDate(row?.startTime)) || "N/A",
      valueSetter: (params) => ({
        ...params.row,
        startTime: params.value ? new Date(params.value) : null,
      }),
      sortComparator: (v1, v2, cellParams1, cellParams2) =>
        timestampSortComparator(
          cellParams1?.row?.startTime,
          cellParams2?.row?.startTime,
        ),
    },
    {
      field: "endTime",
      headerName: "End",
      minWidth: 200,
      flex: 1,
      type: "dateTime",
      editable: true,
      valueGetter: (value, row) => tsToDate(row?.endTime),
      valueFormatter: (value, row) =>
        value instanceof Date
          ? formatTz(value)
          : formatTz(tsToDate(row?.endTime)) || "N/A",
      valueSetter: (params) => ({
        ...params.row,
        endTime: params.value ? new Date(params.value) : null,
      }),
      sortComparator: (v1, v2, cellParams1, cellParams2) =>
        timestampSortComparator(
          cellParams1?.row?.endTime,
          cellParams2?.row?.endTime,
        ),
    },
    {
      field: "duration",
      headerName: "Duration",
      minWidth: 140,
      valueGetter: (value, row) =>
        durationHm(tsToDate(row?.startTime), tsToDate(row?.endTime)) || "N/A",
    },
    {
      field: "trips",
      headerName: "Trips",
      minWidth: 120,
      type: "number",
      editable: true,
      valueGetter: (value, row) => row?.trips ?? null,
    },
    {
      field: "passengers",
      headerName: "PAX",
      minWidth: 120,
      type: "number",
      editable: true,
      valueGetter: (value, row) => row?.passengers ?? null,
    },
    {
      field: "createdAt",
      headerName: "Created",
      minWidth: 200,
      flex: 1,
      type: "dateTime",
      editable: true,
      valueGetter: (value, row) => tsToDate(row?.createdAt),
      valueFormatter: (value, row) =>
        value instanceof Date
          ? formatTz(value)
          : formatTz(tsToDate(row?.createdAt)) || "N/A",
      valueSetter: (params) => ({
        ...params.row,
        createdAt: params.value ? new Date(params.value) : null,
      }),
      sortComparator: (v1, v2, cellParams1, cellParams2) =>
        timestampSortComparator(
          cellParams1?.row?.createdAt,
          cellParams2?.row?.createdAt,
        ),
    },
    {
      field: "id",
      headerName: "id",
      minWidth: 120,
      valueGetter: (value, row) => row?.id || "N/A",
    },
  ];

  const actionsColumn = buildRowEditActionsColumn({
    apiRef,
    rowModesModel,
    setRowModesModel,
    onDelete,
  });

  return [...baseColumns, actionsColumn];
}

export default function ShootoutStatsTab() {
  const [rows, setRows] = useState([]);
  const apiRef = useGridApiRef();
  const [rowModesModel, setRowModesModel] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { show: showSnack } = useSnack();

  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsub = subscribeShootoutStats(
      async (stats) => {
        try {
          const mapped = (stats || []).map((s) => ({
            id: s.id ?? s.docId ?? s._id ?? Math.random().toString(36).slice(2),
            ...s,
          }));
          const withNames = await enrichDriverNames(mapped);
          const withDates = withNames.map((r) => ({
            ...r,
            startTime: tsToDate(r.startTime),
            endTime: tsToDate(r.endTime),
            createdAt: tsToDate(r.createdAt),
          }));
          setRows(withDates);
          setError(null);
        } catch (err) {
          logError(err, { where: "ShootoutStatsTab", action: "process" });
          setError("Failed to prepare shootout stats.");
        } finally {
          setLoading(false);
        }
      },
      (e) => {
        logError(e, { where: "ShootoutStatsTab", action: "subscribe" });
        setError(e?.message || "Failed to load shootout stats.");
        setLoading(false);
      },
    );
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [refreshKey]);

  const deleteShootoutStatById = useCallback(async (id) => {
    await deleteDoc(doc(db, "shootoutStats", id));
  }, []);

  const handleProcessRowUpdate = useCallback(
    async (newRow, oldRow) => {
      try {
        await patchShootoutStat(newRow.id, {
          driverEmail: newRow.driverEmail,
          vehicle: newRow.vehicle,
          trips: newRow.trips,
          passengers: newRow.passengers,
          startTime: newRow.startTime,
          endTime: newRow.endTime,
          createdAt: newRow.createdAt,
        });
        return newRow;
      } catch (e) {
        logError(e, {
          where: "ShootoutStatsTab",
          action: "update",
          id: newRow?.id,
        });
        showSnack("Failed to update session", "error");
        return oldRow;
      }
    },
    [showSnack],
  );

  const columns = useMemo(
    () =>
      createShootoutColumns({
        apiRef,
        rowModesModel,
        setRowModesModel,
        onDelete: deleteShootoutStatById,
      }),
    [apiRef, rowModesModel, setRowModesModel, deleteShootoutStatById],
  );

  const initialState = useMemo(
    () => ({
      pagination: { paginationModel: { pageSize: 15, page: 0 } },
      columns: { columnVisibilityModel: { id: false } },
    }),
    [],
  );

  const handleRowEditStart = (params, event) => {
    event.defaultMuiPrevented = true;
  };
  const handleRowEditStop = (params, event) => {
    event.defaultMuiPrevented = true;
  };

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
        <ErrorState
          description={error}
          onAction={() => setRefreshKey((key) => key + 1)}
        />
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      {rows?.length ? (
        <UniversalDataGrid
          id="admin-timelog-shootout-grid"
          columns={columns}
          editMode="row"
          rowModesModel={rowModesModel}
          onRowModesModelChange={(m) => setRowModesModel(m)}
          processRowUpdate={handleProcessRowUpdate}
          onRowEditStart={handleRowEditStart}
          onRowEditStop={handleRowEditStop}
          apiRef={apiRef}
          getRowId={getShootoutRowId}
          experimentalFeatures={{ newEditingApi: true }}
          checkboxSelection
          disableRowSelectionOnClick
          density="compact"
          initialState={initialState}
          pageSizeOptions={[15, 30, 60]}
          autoHeight={false}
          sx={{ flex: 1, minHeight: 0 }}
        />
      ) : (
        <EmptyState
          title="No shootout stats"
          description="Completed shootout sessions will appear here once recorded."
          actionLabel="Refresh"
          onAction={() => setRefreshKey((key) => key + 1)}
        />
      )}
    </Paper>
  );
}
