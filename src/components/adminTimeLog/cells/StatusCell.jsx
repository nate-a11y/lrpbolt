/* Proprietary and confidential. See LICENSE. */
import React from "react";
import { Chip } from "@mui/material";

export default function StatusCell({ value }) {
  const color = value === "open" ? "success" : value === "closed" ? "default" : "warning";
  return <Chip size="small" label={value ?? "—"} color={color} />;
}
