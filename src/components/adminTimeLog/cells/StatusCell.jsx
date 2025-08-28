/* Proprietary and confidential. See LICENSE. */
import { Chip } from "@mui/material";

export default function StatusCell({ value }) {
  const lower = (value || "").toLowerCase();
  const color =
    lower === "open" ? "success" : lower === "closed" ? "default" : "warning";
  return <Chip size="small" label={value ?? "—"} color={color} />;
}
