import * as React from "react";
import { Button } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

export default function BulkDeleteButton({ disabled, count, onClick }) {
  if (!count) return null;
  return (
    <Button
      size="small"
      variant="contained"
      color="error"
      startIcon={<DeleteIcon />}
      onClick={onClick}
      disabled={disabled}
      sx={{
        textTransform: "none",
        ml: 1,
        backgroundColor: (t) => t.palette.error.main,
        "&:hover": { backgroundColor: (t) => t.palette.error.dark },
      }}
    >
      Delete Selected ({count})
    </Button>
  );
}
