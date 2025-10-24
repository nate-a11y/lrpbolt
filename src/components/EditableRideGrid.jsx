/* Proprietary and confidential. See LICENSE. */
import { useMemo, useCallback } from "react";
import { Paper, useTheme, IconButton } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

import { getField } from "@/utils/gridCells";
import { durationMinutes } from "@/utils/datetime";
import { actionsCol } from "@/utils/gridFormatters";
import { vfTime, vfDurationHM } from "@/utils/vf";

import useMediaQuery from "../hooks/useMediaQuery";
import { useGridDoctor } from "../utils/useGridDoctor";

import SmartAutoGrid from "./datagrid/SmartAutoGrid.jsx";

export default function EditableRideGrid({
  rows,
  onDelete,
  onEdit,
  loading = false,
}) {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const initialState = useMemo(
    () => ({
      columns: {
        columnVisibilityModel: {
          rideNotes: !isXs,
          createdBy: !isXs,
          lastModifiedBy: !isXs,
        },
      },
    }),
    [isXs],
  );
  const handleEdit = useCallback(
    (row) => {
      if (onEdit) onEdit(row);
    },
    [onEdit],
  );
  const handleDelete = useCallback(
    (id) => {
      if (onDelete) onDelete(id);
    },
    [onDelete],
  );

  const columns = useMemo(
    () => [
      { field: "tripId", headerName: "Ride ID", width: 110, minWidth: 120 },
      {
        field: "pickupTime",
        headerName: "Start",
        valueFormatter: vfTime,
      },
      {
        field: "endTime",
        headerName: "End",
        valueGetter: (value, row) => row?.endTime ?? row?.dropoffTime ?? "N/A",
        valueFormatter: vfTime,
      },
      {
        field: "rideDuration",
        headerName: "Duration",
        valueGetter: (value, row) => {
          const val =
            row?.rideDuration ??
            durationMinutes(
              getField(row, "pickupTime"),
              row?.endTime ?? getField(row, "dropoffTime"),
            );
          return val ?? "N/A";
        },
        valueFormatter: vfDurationHM,
        sortComparator: (a, b) => (Number(a) || 0) - (Number(b) || 0),
      },
      { field: "rideType", headerName: "Type", flex: 1, minWidth: 140 },
      { field: "vehicle", headerName: "Vehicle", flex: 1, minWidth: 140 },
      { field: "rideNotes", headerName: "Notes", flex: 1.5, minWidth: 160 },
      actionsCol(({ row }) => (
        <>
          <IconButton size="small" onClick={() => handleEdit(row)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => handleDelete(row.id)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </>
      )),
    ],
    [handleEdit, handleDelete],
  );

  const stableRows = useMemo(() => rows ?? [], [rows]);

  useGridDoctor({ name: "EditableRideGrid", rows: stableRows, columns });

  return (
    <Paper sx={{ width: "100%", display: "flex", flexDirection: "column" }}>
      <SmartAutoGrid
        rows={stableRows}
        columnsCompat={columns}
        loading={loading}
        checkboxSelection
        disableRowSelectionOnClick
        getRowClassName={(params) => (params.row?.fading ? "fading" : "")}
        initialState={initialState}
        getRowId={(r) =>
          r?.id ?? r?.uid ?? r?._id ?? r?.docId ?? JSON.stringify(r)
        }
      />
    </Paper>
  );
}
