/* Proprietary and confidential. See LICENSE. */
import React from "react";
import { Stack, IconButton, Tooltip, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

export default function ToolsCell({ row, onEdit, onDelete }) {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up("md"));
  const size = mdUp ? "medium" : "small";

  return (
    <Stack direction="row" spacing={1}>
      <Tooltip title="Edit">
        <IconButton size={size} onClick={() => onEdit?.(row)}>
          <EditIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete">
        <IconButton
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
