/* Proprietary and confidential. See LICENSE. */
import React, { useState, useCallback, useEffect } from "react";
import {
  GridToolbarContainer,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
  GridToolbarExport,
  GridToolbarQuickFilter,
  useGridApiContext,
} from "@mui/x-data-grid-pro";
import { Box, Button, Tooltip, Snackbar, Alert } from "@mui/material";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

/**
 * LrpGridToolbar: single source of truth for all DataGridPro toolbars.
 * - Supports both new 'slots' API (v7/8) and legacy 'components' (v5/6) via consumers.
 * - Includes debounced QuickFilter, Columns, Filter, Density, Export, and optional Delete Selected.
 * Props:
 *   onDeleteSelected?: (ids: string[]) => Promise<void> | void
 *   quickFilterPlaceholder?: string
 */
export default function LrpGridToolbar(props = {}) {
  const { onDeleteSelected, quickFilterPlaceholder = "Search…" } = props;
  const apiRef = useGridApiContext();

  const getSelectedIds = useCallback(() => {
    try {
      const state = apiRef?.current?.state || {};
      const sel =
        state?.rowSelection ??
        state?.selectionModel ??
        apiRef?.current?.getSelectedRows?.() ??
        [];
      if (sel instanceof Map) return Array.from(sel.keys());
      if (sel instanceof Set) return Array.from(sel.values());
      if (Array.isArray(sel)) return sel;
      if (sel && typeof sel === "object") return Object.keys(sel);
      return [];
    } catch {
      return [];
    }
  }, [apiRef]);

  const [snack, setSnack] = useState({
    open: false,
    msg: "",
    severity: "success",
  });

  const handleBulkDelete = useCallback(async () => {
    if (typeof onDeleteSelected !== "function") return;
    const ids = getSelectedIds();
    if (!ids.length) return;
    try {
      await onDeleteSelected(ids);
      setSnack({
        open: true,
        msg: `Deleted ${ids.length} item(s).`,
        severity: "success",
      });
    } catch {
      setSnack({
        open: true,
        msg: "Failed to delete selection.",
        severity: "error",
      });
    }
  }, [getSelectedIds, onDeleteSelected]);

  const [selectionCount, setSelectionCount] = useState(0);

  useEffect(() => {
    const update = () => setSelectionCount(getSelectedIds().length);
    update();
    const unsub = apiRef?.current?.subscribeEvent?.(
      "rowSelectionModelChange",
      update,
    );
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [apiRef, getSelectedIds]);

  return (
    <>
      <GridToolbarContainer
        className="lrp-grid-toolbar"
        sx={{
          px: 1,
          py: 0.5,
          gap: 1,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          bgcolor: "#060606",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          "& .MuiButton-root, & .MuiIconButton-root, & .MuiInputBase-root": {
            color: "rgba(255,255,255,0.92)",
          },
          "& .MuiSvgIcon-root": { color: "#4cbb17" },
        }}
      >
        <GridToolbarQuickFilter
          quickFilterParser={(v) => v.split(" ").filter(Boolean)}
          debounceMs={500}
          placeholder={quickFilterPlaceholder}
          sx={{ minWidth: 220, "& .MuiInputBase-input": { fontSize: 14 } }}
        />
        <Box sx={{ flex: 1 }} />
        <GridToolbarColumnsButton />
        <GridToolbarFilterButton />
        <GridToolbarDensitySelector />
        <GridToolbarExport
          printOptions={{ hideFooter: true, hideToolbar: true }}
        />
        {typeof onDeleteSelected === "function" && (
          <Tooltip
            title={
              selectionCount
                ? `Delete ${selectionCount} selected`
                : "Select rows to delete"
            }
          >
            <span>
              <Button
                onClick={handleBulkDelete}
                startIcon={<DeleteForeverIcon />}
                disabled={!selectionCount}
                sx={{
                  ml: 0.5,
                  bgcolor: "rgba(76,187,23,0.12)",
                  "&:hover": { bgcolor: "rgba(76,187,23,0.22)" },
                  textTransform: "none",
                }}
              >
                Delete Selected
              </Button>
            </span>
          </Tooltip>
        )}
      </GridToolbarContainer>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.severity}
          sx={{ width: "100%" }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </>
  );
}
