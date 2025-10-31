import * as React from "react";
import { Button } from "@mui/material";

import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";

/**
 * useBulkDelete
 * @param {Object} options
 * @param {(ids: string[], rows: any[]) => Promise<void>} options.performDelete - required deleter
 * @param {(rows: any[]) => Promise<void>} options.performRestore - optional restore function for undo
 * @returns {Object} control api
 */
export default function useBulkDelete({ performDelete, performRestore }) {
  const { show } = useSnack();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState([]);
  const [selectedRowsCache, setSelectedRowsCache] = React.useState([]);

  const openDialog = (ids, rows) => {
    setSelectedIds(ids);
    setSelectedRowsCache(rows || []);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (!deleting) setDialogOpen(false);
  };

  const onConfirm = async () => {
    try {
      setDeleting(true);
      await performDelete(selectedIds, selectedRowsCache);
      setDialogOpen(false);
      setDeleting(false);

      // Offer UNDO
      show(`Deleted ${selectedIds.length} item(s)`, "info", {
        action: (
          <Button
            color="inherit"
            size="small"
            onClick={async () => {
              try {
                if (typeof performRestore === "function") {
                  await performRestore(selectedRowsCache);
                  show("Undo complete", "success");
                }
              } catch (err) {
                console.error("Undo failed", err);
                show("Undo failed", "error");
              }
            }}
            sx={{ fontWeight: 600 }}
          >
            Undo
          </Button>
        ),
        autoHideDuration: 6000,
      });
    } catch (err) {
      setDeleting(false);
      console.error("Bulk delete failed", err);
      show("Delete failed", "error");
    }
  };

  return {
    dialogOpen,
    deleting,
    openDialog,
    closeDialog,
    onConfirm,
  };
}
