// src/components/grid/actionsCol.jsx
import * as React from 'react';
import { GridActionsCellItem } from '@mui/x-data-grid-pro';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

export default function actionsCol({ onEdit, onDelete, extra = [] } = {}) {
  return {
    field: '__actions',
    type: 'actions',
    headerName: 'Actions',
    width: 90,
    getActions: (params) => {
      const items = [];
      if (onEdit) items.push(
        <GridActionsCellItem
          key="edit"
          icon={<EditIcon />}
          label="Edit"
          onClick={() => onEdit(params.row)}
        />
      );
      if (onDelete) items.push(
        <GridActionsCellItem
          key="delete"
          icon={<DeleteIcon />}
          label="Delete"
          onClick={() => onDelete(params.row)}
        />
      );
      return [...items, ...extra];
    },
  };
}
