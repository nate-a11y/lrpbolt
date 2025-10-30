/* Proprietary and confidential. See LICENSE. */
import React from "react";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import { GridActionsCellItem, GridRowModes } from "@mui/x-data-grid-pro";

import logError from "@/utils/logError.js";

/**
 * Build an actions column that supports row editing with save/cancel and optional delete.
 */
export function buildRowEditActionsColumn({
  apiRef,
  rowModesModel,
  setRowModesModel,
  onDelete,
  field = "__actions",
  headerName = "Actions",
  width = 150,
}) {
  const handleEditClick = (id) => () => {
    setRowModesModel((m) => ({ ...m, [id]: { mode: GridRowModes.Edit } }));
  };

  const handleSaveClick = (id) => () => {
    setRowModesModel((m) => ({ ...m, [id]: { mode: GridRowModes.View } }));
  };

  const handleCancelClick = (id) => () => {
    setRowModesModel((m) => ({
      ...m,
      [id]: { mode: GridRowModes.View, ignoreModifications: true },
    }));
  };

  const handleDeleteClick = (id, row) => async () => {
    if (typeof onDelete !== "function") return;
    // eslint-disable-next-line no-alert
    const ok = window.confirm("Delete this record?");
    if (!ok) return;
    try {
      await onDelete(id, row);
    } catch (err) {
      logError({ where: "rowEditActions.delete", id, row }, err);
      // eslint-disable-next-line no-alert
      alert("Delete failed. Check console.");
    }
  };

  return {
    field,
    type: "actions",
    headerName,
    width,
    getActions: (params) => {
      if (!params) {
        logError({
          where: "rowEditActions.getActions",
          reason: "missing-params",
        });
        return [];
      }

      const { id, row: paramsRow } = params;
      if (id == null) {
        logError({
          where: "rowEditActions.getActions",
          reason: "missing-id",
          params,
        });
        return [];
      }

      const resolvedRow = paramsRow ?? apiRef?.current?.getRow?.(id) ?? null;
      if (!resolvedRow) {
        logError(
          { where: "rowEditActions.getActions", reason: "missing-row", id },
          new Error("Unable to resolve row for actions"),
        );
      }
      const row = resolvedRow ?? {};
      const isInEditMode = rowModesModel?.[id]?.mode === GridRowModes.Edit;
      if (isInEditMode) {
        const items = [
          <GridActionsCellItem
            key="save"
            icon={<SaveIcon fontSize="small" />}
            label="Save"
            onClick={handleSaveClick(id)}
          />,
          <GridActionsCellItem
            key="cancel"
            icon={<CloseIcon fontSize="small" />}
            label="Cancel"
            onClick={handleCancelClick(id)}
          />,
        ];
        if (onDelete) {
          items.push(
            <GridActionsCellItem
              key="delete"
              icon={<DeleteIcon fontSize="small" />}
              label="Delete"
              onClick={handleDeleteClick(id, row)}
            />,
          );
        }
        return items;
      }
      const items = [
        <GridActionsCellItem
          key="edit"
          icon={<EditIcon fontSize="small" />}
          label="Edit"
          onClick={handleEditClick(id)}
        />,
      ];
      if (onDelete) {
        items.push(
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon fontSize="small" />}
            label="Delete"
            onClick={handleDeleteClick(id, row)}
          />,
        );
      }
      return items;
    },
  };
}
