/* eslint-disable react-hooks/refs -- MUI DataGrid pattern: apiRef.current is the official way to access grid state */
import * as React from "react";
import { useMemo } from "react";
import {
  useGridApiContext,
  useGridRootProps,
  GridFooterContainer,
  GridPagination,
} from "@mui/x-data-grid-pro";
import { Box, Typography } from "@mui/material";

export default function SafeGridFooter() {
  const apiRef = useGridApiContext();
  const rootProps = useGridRootProps();

  // Never call gridRowSelectionSelector; it throws if the slice is undefined.

  const selectedCount = useMemo(() => {
    const sel = apiRef?.current?.state?.rowSelection;
    if (!sel) return 0;
    // sel can be a Set (v6/7) or array (custom wrappers). Normalize.
    if (typeof sel.size === "number") return sel.size;
    if (Array.isArray(sel)) return sel.length;
    return 0;
  }, [apiRef]);

  const pagination = apiRef?.current?.state?.pagination;

  const rowCount = apiRef?.current?.state?.rows?.totalRowCount ?? 0;

  return (
    <GridFooterContainer>
      {!rootProps.hideFooterSelectedRowCount && (
        <Box sx={{ pl: 2 }}>
          <Typography variant="caption" component="span">
            Selected: {selectedCount}
          </Typography>
        </Box>
      )}
      <Box sx={{ flex: 1 }} />
      {rootProps.pagination && pagination ? (
        <Box sx={{ display: "flex", alignItems: "center", pr: 2, gap: 2 }}>
          <Typography
            variant="caption"
            component="span"
            aria-label="grid-row-count"
          >
            Rows: {rowCount}
          </Typography>
          <GridPagination />
        </Box>
      ) : null}
    </GridFooterContainer>
  );
}
