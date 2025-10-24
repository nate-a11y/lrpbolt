/* Proprietary and confidential. See LICENSE. */
import { Stack, IconButton, Tooltip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

import useMediaQuery from "../../../hooks/useMediaQuery";

export default function ToolsCell({ row, onEdit, onDelete }) {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up("md"));
  const size = mdUp ? "medium" : "small";

  return (
    <Stack direction="row" spacing={1}>
      <Tooltip title="Edit">
        <IconButton
          aria-label="edit entry"
          size={size}
          onClick={() => onEdit?.(row)}
        >
          <EditIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete">
        <IconButton
          aria-label="delete entry"
          size={size}
          color="error"
          onClick={() => onDelete?.(row)}
        >
          <DeleteIcon />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
