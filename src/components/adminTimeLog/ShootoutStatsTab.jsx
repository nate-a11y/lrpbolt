/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { doc, deleteDoc } from "firebase/firestore";
import { useGridApiRef } from "@mui/x-data-grid-pro";
import { Paper } from "@mui/material";

import { formatTz, durationHm } from "@/utils/timeSafe";
import { tsToDate } from "@/utils/fsTime";

import SmartAutoGrid from "../datagrid/SmartAutoGrid.jsx";
import { buildRowEditActionsColumn } from "../../columns/rowEditActions.jsx";
import { subscribeShootoutStats } from "../../hooks/firestore";
import { patchShootoutStat } from "../../hooks/api";
import { db } from "../../utils/firebaseInit";
import { enrichDriverNames } from "../../services/normalizers";

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

  const deleteShootoutStatById = async (id) => {
    await deleteDoc(doc(db, "shootoutStats", id));
  };

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

  const overrides = useMemo(
    () => ({
      driverEmail: { editable: true },
      vehicle: { editable: true },
      startTime: {
        editable: true,
        type: "dateTime",
        valueGetter: (p) => tsToDate(p?.row?.startTime),
        valueFormatter: (p) => formatTz(p?.value),
        valueParser: (v) => (v ? new Date(v) : null),
      },
      endTime: {
        editable: true,
        type: "dateTime",
        valueGetter: (p) => tsToDate(p?.row?.endTime),
        valueFormatter: (p) => formatTz(p?.value),
        valueParser: (v) => (v ? new Date(v) : null),
      },
      duration: {
        editable: false,
        valueGetter: (p) =>
          durationHm(tsToDate(p?.row?.startTime), tsToDate(p?.row?.endTime)),
      },
      trips: { editable: true, type: "number" },
      passengers: { editable: true, type: "number" },
      createdAt: {
        editable: true,
        type: "dateTime",
        valueGetter: (p) => tsToDate(p?.row?.createdAt),
        valueFormatter: (p) => formatTz(p?.value),
        valueParser: (v) => (v ? new Date(v) : null),
      },
    }),
    [],
  );

  const actionsColumn = useMemo(
    () =>
      buildRowEditActionsColumn({
        apiRef,
        rowModesModel,
        setRowModesModel,
        onDelete: async (id) => await deleteShootoutStatById(id),
      }),
    [apiRef, rowModesModel],
  );

  const handleRowEditStart = (params, event) => {
    event.defaultMuiPrevented = true;
  };
  const handleRowEditStop = (params, event) => {
    event.defaultMuiPrevented = true;
  };

  return (
    <Paper sx={{ width: "100%" }}>
      <SmartAutoGrid
        rows={rows || []}
        headerMap={{
          driverEmail: "Driver Email",
          driver: "Driver",
          vehicle: "Vehicle",
          startTime: "Start",
          endTime: "End",
          duration: "Duration",
          trips: "Trips",
          passengers: "PAX",
          createdAt: "Created",
          id: "id",
        }}
        order={[
          "driver",
          "driverEmail",
          "vehicle",
          "startTime",
          "endTime",
          "duration",
          "trips",
          "passengers",
          "createdAt",
          "id",
        ]}
        forceHide={["id"]}
        overrides={overrides}
        actionsColumn={actionsColumn}
        editMode="row"
        rowModesModel={rowModesModel}
        onRowModesModelChange={(m) => setRowModesModel(m)}
        processRowUpdate={handleProcessRowUpdate}
        onRowEditStart={handleRowEditStart}
        onRowEditStop={handleRowEditStop}
        apiRef={apiRef}
        experimentalFeatures={{ newEditingApi: true }}
      />
    </Paper>
  );
}
