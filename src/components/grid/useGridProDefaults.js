import * as React from "react";
import { useTheme, useMediaQuery } from "@mui/material";

import ProToolbar from "./ProToolbar.jsx";
const LS = "lrp_grid_";
function usePersist(key, initial) {
  const [v, setV] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS + key)) ?? initial;
    } catch (err) {
      void err;
      /* no-op for hot reload */
      return initial;
    }
  });
  const set = React.useCallback(
    (n) => {
      setV(n);
      try {
        localStorage.setItem(LS + key, JSON.stringify(n));
      } catch (err) {
        void err;
        /* no-op for hot reload */
      }
    },
    [key],
  );
  return [v, set];
}
export default function useGridProDefaults({ gridId, pageSize = 25 }) {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const [cvm, setCvm] = usePersist(`${gridId}_cvm`, {});
  const [order, setOrder] = usePersist(`${gridId}_order`, []);
  const [sort, setSort] = usePersist(`${gridId}_sort`, []);
  const [page, setPage] = usePersist(`${gridId}_page`, { page: 0, pageSize });
  const [density, setDensity] = usePersist(
    `${gridId}_density`,
    isXs ? "compact" : "standard",
  );
  const reset = () => {
    setCvm({});
    setOrder([]);
    setSort([]);
    setPage({ page: 0, pageSize });
    setDensity(isXs ? "compact" : "standard");
  };
  return {
    density,
    onDensityChange: setDensity,
    autoHeight: true,
    disableRowSelectionOnClick: true,
    rowBuffer: isXs ? 3 : 5,
    columnBuffer: isXs ? 2 : 4,
    pagination: true,
    paginationModel: page,
    onPaginationModelChange: setPage,
    initialState: {
      columns: { columnVisibilityModel: cvm },
      sorting: { sortModel: sort },
      columnOrder: order,
    },
    onColumnVisibilityModelChange: setCvm,
    onSortModelChange: setSort,
    onColumnOrderChange: setOrder,
    getRowId: (r) =>
      r.id ??
      r._id ??
      r.ticketId ??
      r.tripId ??
      r.docId ??
      `${gridId}-${(r.uid || r.key || Math.random().toString(36).slice(2))}`,
    slots: { toolbar: ProToolbar },
    slotProps: { toolbar: { onReset: reset } },
    sx: {
      "& .MuiDataGrid-cell": {
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      },
    },
  };
}
