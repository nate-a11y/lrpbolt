/* Proprietary and confidential. See LICENSE. */
import { useEffect, useState } from "react";
import { Alert, Snackbar } from "@mui/material";

export default function FcmToaster() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      const n = e.detail?.notification;
      if (!n) return;
      setToast({ title: n.title || "Notification", body: n.body || "" });
    };
    window.addEventListener("LRP_FCM_MESSAGE", handler);
    return () => window.removeEventListener("LRP_FCM_MESSAGE", handler);
  }, []);

  const open = Boolean(toast);
  return (
    <Snackbar
      open={open}
      autoHideDuration={4000}
      onClose={() => setToast(null)}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    >
      <Alert onClose={() => setToast(null)} severity="info" variant="filled" sx={{ width: "100%" }}>
        <strong>{toast?.title}</strong>{toast?.body ? ` — ${toast.body}` : ""}
      </Alert>
    </Snackbar>
  );
}
