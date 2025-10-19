// src/components/grid/actionsCol.jsx
import * as React from "react";
import { GridActionsCellItem } from "@mui/x-data-grid-pro";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

function resolveRow(params) {
  if (!params) return null;
  if (params.row) return params.row;
  const api = params.api;
  if (api && typeof api.getRow === "function") {
    try {
      return api.getRow(params.id) ?? null;
    } catch (err) {
      console.warn("[actionsCol] Failed to resolve row from api", err);
      return null;
    }
  }
  return null;
}

export default function actionsCol({ onEdit, onDelete, extra = [] } = {}) {
  return {
    field: "__actions",
    type: "actions",
    headerName: "Actions",
    width: 90,
    sortable: false,
    filterable: false,
    getActions: (params) => {
      const items = [];

      if (onEdit) {
        const handleEdit = () => {
          const row = resolveRow(params);
          if (!row) {
            console.warn("[actionsCol] Edit clicked without a row", params);
            return;
          }
          onEdit(row);
        };

        items.push(
          <GridActionsCellItem
            key="edit"
            icon={<EditIcon fontSize="small" />}
            label="Edit"
            onClick={handleEdit}
          />,
        );
      }

      if (onDelete) {
        const handleDelete = () => {
          const row = resolveRow(params);
          if (!row) {
            console.warn("[actionsCol] Delete clicked without a row", params);
            return;
          }
          onDelete(row);
        };

        items.push(
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon fontSize="small" />}
            label="Delete"
            onClick={handleDelete}
          />,
        );
      }

      return [...items, ...extra];
    },
  };
}
