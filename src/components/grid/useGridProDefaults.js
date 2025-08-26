import * as React from "react";
import { useMediaQuery, useTheme } from "@mui/material";
import ProToolbar from "./ProToolbar.jsx";
import { LoadingOverlay, NoRowsOverlay, NoResultsOverlay } from "./overlays.jsx";

const LS_PREFIX = "lrp_grid_";

function usePersistedModel(key, initial) {
  const [model, setModel] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_PREFIX + key)) ?? initial;
    } catch {
      return initial;
    }
  });
  const onChange = React.useCallback(
    (next) => {
      setModel(next);
      try {
        localStorage.setItem(LS_PREFIX + key, JSON.stringify(next));
      } catch {
        // ignore storage write errors
      }
    },
    [key],
  );
  return [model, onChange];
}

export default function useGridProDefaults({ gridId, pageSize = 25 }) {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const [columnVisibilityModel, setCvm] = usePersistedModel(`${gridId}_cvm`, {});
  const [columnOrder, setColumnOrder] = usePersistedModel(`${gridId}_order`, []);
  const [sortModel, setSortModel] = usePersistedModel(`${gridId}_sort`, []);
  const [paginationModel, setPaginationModel] = usePersistedModel(
    `${gridId}_page`,
    { page: 0, pageSize },
  );

  const resetView = () => {
    setCvm({});
    setColumnOrder([]);
    setSortModel([]);
    setPaginationModel({ page: 0, pageSize });
  };

  return {
    density: isXs ? "compact" : "standard",
    autoHeight: true,
    disableRowSelectionOnClick: true,
    rowBuffer: isXs ? 3 : 5,
    columnBuffer: isXs ? 2 : 4,
    pagination: true,
    paginationModel,
    onPaginationModelChange: setPaginationModel,
    initialState: {
      columns: { columnVisibilityModel },
      sorting: { sortModel },
      columnOrder,
    },
    onColumnVisibilityModelChange: setCvm,
    onSortModelChange: setSortModel,
    onColumnOrderChange: setColumnOrder,
    getRowId: (row) =>
      row.id ??
      row._id ??
      row.ticketId ??
      row.docId ??
      `${gridId}-${row.uid ?? row.key ?? Math.random().toString(36).slice(2)}`,
    slots: {
      toolbar: ProToolbar,
      loadingOverlay: LoadingOverlay,
      noRowsOverlay: NoRowsOverlay,
      noResultsOverlay: NoResultsOverlay,
    },
    slotProps: { toolbar: { onReset: resetView } },
    sx: {
      "& .MuiDataGrid-columnHeaders": { position: "sticky", top: 0, zIndex: 1 },
      "& .MuiDataGrid-cell": {
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        overflow: "hidden",
      },
    },
  };
}
