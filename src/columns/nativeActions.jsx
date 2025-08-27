/* Proprietary and confidential. See LICENSE. */
import React from "react";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { GridActionsCellItem } from "@mui/x-data-grid-pro";

/**
 * Build a DataGridPro "actions" column with native MUI Edit/Delete entries.
 * Null-safe and stable, no empty catch blocks.
 *
 * @param {Object} opts
 * @param {string} [opts.field="actions"] - Column field id.
 * @param {string} [opts.headerName="Actions"] - Column header text.
 * @param {(id:any, row:Object)=>void} [opts.onEdit] - Edit handler.
 * @param {(id:any, row:Object)=>Promise<void>|void} [opts.onDelete] - Delete handler.
 * @param {boolean} [opts.showInMenu=true] - Show in row menu instead of inline icons.
 * @returns {import("@mui/x-data-grid-pro").GridColDef}
 */
export function buildNativeActionsColumn(opts = {}) {
  const {
    field = "actions",
    headerName = "Actions",
    onEdit,
    onDelete,
    showInMenu = true,
  } = opts;

  return {
    field,
    type: "actions",
    headerName,
    width: 90,
    sortable: false,
    filterable: false,
    disableColumnMenu: false,
    getActions: (params) => {
      const id = params?.id;
      const row = params?.row || {};
      const items = [];

      if (typeof onEdit === "function") {
        items.push(
          <GridActionsCellItem
            key="edit"
            icon={<EditIcon fontSize="small" />}
            label="Edit"
            onClick={() => onEdit(id, row)}
            showInMenu={showInMenu}
          />
        );
      }

      if (typeof onDelete === "function") {
        items.push(
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon fontSize="small" />}
            label="Delete"
            onClick={async () => {
              // Basic confirm; replace with your Snackbar/Undo flow if desired.
              const ok = window.confirm("Delete this record?");
              if (!ok) return;
              try {
                await onDelete(id, row);
              } catch (err) {
                // Standardized logging hook if you have one:
                // logError(err, { where: "nativeActions.delete", id });
                console.error("Delete failed in nativeActions:", err);
                alert("Delete failed. Check console for details.");
              }
            }}
            showInMenu={showInMenu}
          />
        );
      }

      return items;
    },
  };
}
