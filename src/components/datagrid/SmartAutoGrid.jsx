/* Proprietary and confidential. See LICENSE. */
import { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Box } from "@mui/material";
import { DataGridPro, useGridApiRef } from "@mui/x-data-grid-pro";

import { toV8Model } from "./selectionV8";

/**
 * SmartAutoGrid – shared wrapper with safe defaults for MUI X Pro v8.
 * - Always provides a controlled v8 rowSelectionModel: { ids: Set, type: 'include' | 'exclude' }.
 * - Guards rows/columns arrays and getRowId stability.
 */
export default function SmartAutoGrid(props) {
  const {
    rows,
    columns,
    getRowId,
    checkboxSelection = true,
    disableRowSelectionOnClick = false,
    rowSelectionModel, // may be array/Set/object; we normalize
    onRowSelectionModelChange, // must emit v8 object
    initialState,
    columnVisibilityModel,
    ...rest
  } = props;

  const apiRef = useGridApiRef();

  const safeRows = Array.isArray(rows) ? rows : [];
  const safeCols = useMemo(
    () => (Array.isArray(columns) ? columns : []),
    [columns],
  );

  const safeGetRowId = useCallback(
    (row) => {
      try {
        if (typeof getRowId === "function") return getRowId(row);
        if (row && (row.id || row.uid || row._id))
          return row.id ?? row.uid ?? row._id;
      } catch (err) {
        console.warn("getRowId error; falling back to JSON key", err);
      }
      return JSON.stringify(row);
    },
    [getRowId],
  );

  // Internal v8 selection model
  const [internalRsm, setInternalRsm] = useState({
    ids: new Set(),
    type: "include",
  });

  // If parent passes something, normalize it; else use internal
  const externalNormalized = useMemo(
    () => toV8Model(rowSelectionModel),
    [rowSelectionModel],
  );
  const controlledRsm =
    rowSelectionModel !== undefined ? externalNormalized : internalRsm;

  const handleRsmChange = useCallback(
    (next, details) => {
      const clean = toV8Model(next);
      setInternalRsm(clean);
      if (typeof onRowSelectionModelChange === "function") {
        onRowSelectionModelChange(clean, details);
      }
    },
    [onRowSelectionModelChange],
  );

  const safeInitialState = useMemo(
    () => ({
      density: "compact",
      ...initialState,
      filter: {
        ...initialState?.filter,
        filterModel: {
          quickFilterValues:
            initialState?.filter?.filterModel?.quickFilterValues ?? [],
          items: initialState?.filter?.filterModel?.items ?? [],
        },
      },
    }),
    [initialState],
  );

  return (
    <Box sx={{ height: "100%", width: "100%" }}>
      <DataGridPro
        apiRef={apiRef}
        rows={safeRows}
        columns={safeCols}
        getRowId={safeGetRowId}
        checkboxSelection={checkboxSelection}
        disableRowSelectionOnClick={disableRowSelectionOnClick}
        rowSelectionModel={controlledRsm}
        onRowSelectionModelChange={handleRsmChange}
        initialState={safeInitialState}
        columnVisibilityModel={columnVisibilityModel}
        pagination
        autoHeight={rest.autoHeight ?? false}
        density={rest.density ?? "compact"}
        {...rest}
      />
    </Box>
  );
}

SmartAutoGrid.propTypes = {
  rows: PropTypes.array,
  columns: PropTypes.array,
  getRowId: PropTypes.func,
  checkboxSelection: PropTypes.bool,
  disableRowSelectionOnClick: PropTypes.bool,
  rowSelectionModel: PropTypes.any,
  onRowSelectionModelChange: PropTypes.func,
  initialState: PropTypes.object,
  columnVisibilityModel: PropTypes.object,
};
