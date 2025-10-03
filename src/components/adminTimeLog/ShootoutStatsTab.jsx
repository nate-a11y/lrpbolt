/* Proprietary and confidential. See LICENSE. */
/* LRP hotfix: eliminate TDZ by hoisting helpers and using a column factory. 2025-10-03 */
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { doc, deleteDoc } from "firebase/firestore";
import { useGridApiRef } from "@mui/x-data-grid-pro";
import { Paper } from "@mui/material";

import { tsToDate } from "@/utils/fsTime";
import { formatTz, durationHm } from "@/utils/timeSafe";
import { timestampSortComparator } from "@/utils/timeUtils.js";
import LrpDataGridPro from "@/components/datagrid/LrpDataGridPro";

import { buildRowEditActionsColumn } from "../../columns/rowEditActions.jsx";
import { subscribeShootoutStats } from "../../hooks/firestore";
import { patchShootoutStat } from "../../hooks/api";
import { db } from "../../utils/firebaseInit";
import { enrichDriverNames } from "../../services/normalizers";

function getShootoutRowId(row) {
  return row?.id ?? row?.docId ?? row?._id ?? row?.uid ?? `${row?.driverEmail ?? "row"}-${row?.startTime ?? ""}`;
}

function createShootoutColumns({ apiRef, rowModesModel, setRowModesModel, onDelete }) {
  const baseColumns = [
    {
      field: "driver",
      headerName: "Driver",
      minWidth: 160,
      flex: 1,
      valueGetter: (params) => params?.row?.driver || "N/A",
    },
    {
      field: "driverEmail",
      headerName: "Driver Email",
      minWidth: 220,
      flex: 1.2,
      editable: true,
      valueGetter: (params) => params?.row?.driverEmail || "N/A",
    },
    {
      field: "vehicle",
      headerName: "Vehicle",
      minWidth: 140,
      flex: 1,
      editable: true,
      valueGetter: (params) => params?.row?.vehicle || "N/A",
    },
    {
      field: "startTime",
      headerName: "Start",
      minWidth: 200,
      flex: 1,
      type: "dateTime",
      editable: true,
      valueGetter: (params) => tsToDate(params?.row?.startTime),
      valueFormatter: (params) =>
        params?.value instanceof Date
          ? formatTz(params.value)
          : formatTz(tsToDate(params?.row?.startTime)) || "N/A",
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
      valueGetter: (params) => tsToDate(params?.row?.endTime),
      valueFormatter: (params) =>
        params?.value instanceof Date
          ? formatTz(params.value)
          : formatTz(tsToDate(params?.row?.endTime)) || "N/A",
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
      valueGetter: (params) =>
        durationHm(
          tsToDate(params?.row?.startTime),
          tsToDate(params?.row?.endTime),
        ) || "N/A",
    },
    {
      field: "trips",
      headerName: "Trips",
      minWidth: 120,
      type: "number",
      editable: true,
      valueGetter: (params) => params?.row?.trips ?? null,
    },
    {
      field: "passengers",
      headerName: "PAX",
      minWidth: 120,
      type: "number",
      editable: true,
      valueGetter: (params) => params?.row?.passengers ?? null,
    },
    {
      field: "createdAt",
      headerName: "Created",
      minWidth: 200,
      flex: 1,
      type: "dateTime",
      editable: true,
      valueGetter: (params) => tsToDate(params?.row?.createdAt),
      valueFormatter: (params) =>
        params?.value instanceof Date
          ? formatTz(params.value)
          : formatTz(tsToDate(params?.row?.createdAt)) || "N/A",
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
      valueGetter: (params) => params?.row?.id || "N/A",
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

  useEffect(() => {
    const unsub = subscribeShootoutStats(
      async (stats) => {
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
      },
      (e) => console.error(e),
    );
    return () => typeof unsub === "function" && unsub();
  }, []);

  const deleteShootoutStatById = useCallback(async (id) => {
    await deleteDoc(doc(db, "shootoutStats", id));
  }, []);

  const handleProcessRowUpdate = useCallback(async (newRow, oldRow) => {
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
      console.error(e);
      alert("Update failed");
      return oldRow;
    }
  }, []);

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
      <LrpDataGridPro
        id="admin-timelog-shootout-grid"
        rows={rows || []}
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
    </Paper>
  );
}
