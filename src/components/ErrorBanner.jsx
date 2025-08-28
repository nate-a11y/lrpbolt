import { Alert } from "@mui/material";
export default function ErrorBanner({ error }) {
  if (!error) return null;
  const msg =
    error.code === "permission-denied"
      ? "You don’t have permission to view this."
      : error.message || "Something went wrong.";
  return (
    <Alert severity="error" sx={{ mb: 2 }}>
      {msg}
    </Alert>
  );
}
