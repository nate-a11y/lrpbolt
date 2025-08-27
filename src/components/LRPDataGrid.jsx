/* Proprietary and confidential. See LICENSE. */
// src/components/LRPDataGrid.jsx
import React, { useMemo } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { DataGridPro, GridToolbarQuickFilter } from "@mui/x-data-grid-pro";

function EmptyOverlay() {
  return (
    <Stack height="100%" alignItems="center" justifyContent="center" sx={{ color: "#9aa0a6" }}>
      <Typography variant="body2">No records to display</Typography>
    </Stack>
  );
}

function ErrorOverlay({ message }) {
  return (
    <Stack height="100%" alignItems="center" justifyContent="center" sx={{ color: "#ff6b6b", px: 2, textAlign: "center" }}>
      <Typography variant="body2">Something went wrong.</Typography>
      {message ? <Typography variant="caption">{message}</Typography> : null}
    </Stack>
  );
}

// Best-effort stable id resolver
function defaultGetRowId(row) {
  if (!row || typeof row !== "object") return undefined;
  return (
    row?.id ??
    row?.uid ??
    row?._id ??
    String(row?.docId ?? row?.key ?? "")
  );
}

const defaultValueFormatter = (params) => {
  const v = params?.value;
  if (v === 0 || v === false) return v;
  return v === undefined || v === null || v === "" ? "N/A" : v;
};

export default function LRPDataGrid(props) {
  const {
    rows,
    columns,
    loading = false,
    error = null,
    getRowId,
    checkboxSelection = false,
    autoHeight = false,
    density = "compact",
    pageSize = 25,
    sx,
    ...rest
  } = props;

  const resolvedGetRowId = getRowId || defaultGetRowId;

  const processedColumns = useMemo(
    () =>
      Array.isArray(columns)
        ? columns.map((c) => ({
            ...c,
            valueFormatter: c.valueFormatter || defaultValueFormatter,
          }))
        : [],
    [columns]
  );

  const initialState = useMemo(
    () => ({
      pagination: { paginationModel: { pageSize } },
      columns: { columnVisibilityModel: {} },
      density,
    }),
    [pageSize, density]
  );

  const slots = useMemo(
    () => ({
      noRowsOverlay: EmptyOverlay,
      errorOverlay: () => <ErrorOverlay message={typeof error === "string" ? error : null} />,
      toolbar: () => (
        <Box sx={{ p: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <GridToolbarQuickFilter debounceMs={500} />
        </Box>
      ),
    }),
    [error]
  );

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: "1px solid rgba(255,255,255,0.12)",
        bgcolor: "#0b0b0b",
        "& .MuiDataGrid-columnHeaders": { bgcolor: "#121212" },
        "& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within": { outline: "none" },
        "& .MuiDataGrid-selectedRowCount": { color: "#9aa0a6" },
        "& .MuiCheckbox-root.Mui-checked": { color: "#4cbb17" },
        "& .MuiDataGrid-row:hover": { backgroundColor: "rgba(76,187,23,0.05)" },
        ...sx,
      }}
    >
      <DataGridPro
        disableRowSelectionOnClick
        autoHeight={autoHeight}
        rows={Array.isArray(rows) ? rows : []}
        columns={processedColumns}
        getRowId={resolvedGetRowId}
        checkboxSelection={checkboxSelection}
        loading={loading}
        error={!!error}
        initialState={initialState}
        density={density}
        pageSizeOptions={[10, 25, 50, 100]}
        slots={slots}
        sx={{
          color: "#e8eaed",
          "& .MuiDataGrid-cell": { borderBottomColor: "rgba(255,255,255,0.08)" },
          "& .MuiDataGrid-columnHeaderTitle": { fontWeight: 600 },
          "& .MuiDataGrid-footerContainer": { bgcolor: "#121212" },
          "& .MuiDataGrid-virtualScroller": { overscrollBehavior: "contain" },
        }}
        {...rest}
      />
    </Box>
  );
}
