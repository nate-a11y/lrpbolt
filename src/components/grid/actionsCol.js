import { GridActionsCellItem } from "@mui/x-data-grid-pro";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { buildActionsCol } from "@/utils/gridFormatters";

export function actionsColFactory({ onEdit, onDelete }) {
  return buildActionsCol((params) => {
    const items = [];
    if (onEdit) {
      items.push(
        <GridActionsCellItem
          key="edit"
          icon={<EditIcon />}
          label="Edit"
          onClick={() => onEdit(params.id, params.row)}
        />,
      );
    }
    if (onDelete) {
      items.push(
        <GridActionsCellItem
          key="delete"
          icon={<DeleteIcon />}
          label="Delete"
          onClick={() => onDelete(params.id, params.row)}
          showInMenu
        />,
      );
    }
    return items;
  });
}

