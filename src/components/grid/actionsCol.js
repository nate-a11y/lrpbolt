/* eslint-disable import/order */
import * as React from "react";
import { GridActionsCellItem } from "@mui/x-data-grid-pro";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

/**
 * Factory for a standardized actions column for MUI DataGridPro.
 * Usage:
 *   columns = [...dataCols, actionsColFactory({ onEdit, onDelete })]
 */
export function actionsColFactory({
  onEdit,
  onDelete,
  headerName = "",
  width = 90,
  getRowParams, // optional: mapper to massage params before handlers
} = {}) {
  return {
    field: "actions",
    type: "actions",
    headerName,
    width,
    sortable: false,
    filterable: false,
    getActions: (params) => {
      const p = typeof getRowParams === "function" ? getRowParams(params) : params;
      const items = [];

      if (typeof onEdit === "function") {
        items.push(
          React.createElement(GridActionsCellItem, {
            key: "edit",
            icon: React.createElement(EditIcon, null),
            label: "Edit",
            onClick: () => onEdit(p.row, p),
            showInMenu: false,
          })
        );
      }

      if (typeof onDelete === "function") {
        items.push(
          React.createElement(GridActionsCellItem, {
            key: "delete",
            icon: React.createElement(DeleteIcon, null),
            label: "Delete",
            onClick: () => onDelete(p.row, p),
            showInMenu: false,
          })
        );
      }

      return items;
    },
  };
}

export default actionsColFactory;
