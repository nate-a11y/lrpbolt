import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  memo,
} from "react";
import { Snackbar, Alert } from "@mui/material";

const ToastContext = createContext({ enqueue: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const enqueue = useCallback((message, options = {}) => {
    setToast({ message, ...options });
  }, []);

  const handleClose = useCallback(() => setToast(null), []);

  const value = useMemo(() => ({ enqueue }), [enqueue]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={toast?.autoHideDuration ?? 4000}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }}
      >
        <Alert
          onClose={handleClose}
          severity={toast?.severity || "info"}
          variant="filled"
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export default memo(ToastProvider);
