/* Proprietary and confidential. See LICENSE. */
import React from "react";
import { GridActionsCellItem } from "@mui/x-data-grid-pro";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

export function nativeActionsColumn({ onEdit, onDelete }) {
  return {
    field: "__actions",
    type: "actions",
    headerName: "Actions",
    width: 100,
    getActions: (params) => {
      const items = [];
      if (typeof onEdit === "function") {
        items.push(
          <GridActionsCellItem
            key="edit"
            icon={<EditIcon fontSize="small" />}
            label="Edit"
            onClick={() => onEdit(params.row)}
            showInMenu={false}
          />
        );
      }
      if (typeof onDelete === "function") {
        items.push(
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon fontSize="small" />}
            label="Delete"
            onClick={() => onDelete(params.row)}
            showInMenu={false}
          />
        );
      }
      return items;
    },
  };
}
