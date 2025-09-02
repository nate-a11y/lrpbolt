/* Proprietary and confidential. See LICENSE. */
import React from "react";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { GridActionsCellItem } from "@mui/x-data-grid-pro";

export function buildNativeActionsColumn(opts = {}) {
  const {
    field = "__actions",
    headerName = "Actions",
    onEdit,
    onDelete,
    showInMenu = false,
    width = 90,
  } = opts;

  return {
    field,
    type: "actions",
    headerName,
    width,
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
          />,
        );
      }
      if (typeof onDelete === "function") {
        items.push(
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon fontSize="small" />}
            label="Delete"
            onClick={async () => {
              const ok = window.confirm("Delete this record?");
              if (!ok) return;
              try {
                await onDelete(id, row);
              } catch (err) {
                console.error("Delete failed in nativeActions:", err);
                alert("Delete failed. Check console.");
              }
            }}
            showInMenu={showInMenu}
          />,
        );
      }
      return items;
    },
  };
}
