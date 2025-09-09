import * as React from "react";
import { enqueueSnackbar } from "notistack";

/**
 * useBulkDelete
 * @param {Object} options
 * @param {(ids: string[], rows: any[]) => Promise<void>} options.performDelete - required deleter
 * @returns {Object} control api
 */
export default function useBulkDelete({ performDelete }) {
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
      enqueueSnackbar(`Deleted ${selectedIds.length} item(s)`, {
        variant: "info",
        action: () => (
          <button
            onClick={async () => {
              try {
                if (typeof performDelete.restore === "function") {
                  await performDelete.restore(selectedRowsCache);
                  enqueueSnackbar("Undo complete", { variant: "success" });
                }
              } catch (err) {
                console.error("Undo failed", err);
                enqueueSnackbar("Undo failed", { variant: "error" });
              }
            }}
            style={{
              background: "transparent",
              color: "#4cbb17",
              border: "none",
              cursor: "pointer",
            }}
          >
            Undo
          </button>
        ),
        autoHideDuration: 6000,
      });
    } catch (err) {
      setDeleting(false);
      console.error("Bulk delete failed", err);
      enqueueSnackbar("Delete failed", { variant: "error" });
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
