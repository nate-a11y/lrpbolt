/* Proprietary and confidential. See LICENSE. */
import React, { useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

export default function CopyButton({
  value,
  label = "Copy",
  size = "small",
  onCopied,
}) {
  const [open, setOpen] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value || "");
      setOpen(true);
      setTimeout(() => setOpen(false), 1000);
      onCopied?.();
    } catch (e) {
      console.error("Copy failed", e);
    }
  };
  return (
    <Tooltip title={open ? "Copied!" : label} open={open}>
      <IconButton size={size} onClick={handleCopy} aria-label={label}>
        <ContentCopyIcon fontSize="inherit" />
      </IconButton>
    </Tooltip>
  );
}
