import {
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import PropTypes from "prop-types";
import { Alert, Snackbar } from "@mui/material";

const SnackbarContext = createContext({ show: () => {} });

export function useSnack() {
  return useContext(SnackbarContext);
}

function SnackbarProvider({ children }) {
  const [snack, setSnack] = useState(null);

  const show = useCallback((message, severity = "info", options = {}) => {
    if (!message) return;
    const allowedSeverities = new Set(["success", "info", "warning", "error"]);
    const preferredSeverity =
      typeof severity === "string" && allowedSeverities.has(severity)
        ? severity
        : options?.severity && allowedSeverities.has(options.severity)
          ? options.severity
          : "info";
    const next = {
      ...options,
      key: Date.now(),
      message,
      severity: preferredSeverity,
    };
    if (typeof window !== "undefined") {
      window.__LRP_LIVE_MSG__ = message;
      window.dispatchEvent(
        new CustomEvent("lrp:live-region", { detail: message || "" }),
      );
    }
    setSnack(next);
  }, []);

  const handleClose = useCallback((_, reason) => {
    if (reason === "clickaway") return;
    setSnack(null);
  }, []);

  const contextValue = useMemo(() => ({ show }), [show]);

  const autoHideDuration = snack?.autoHideDuration ?? 4000;
  const anchorOrigin = snack?.anchorOrigin || {
    vertical: "bottom",
    horizontal: "center",
  };

  return (
    <SnackbarContext.Provider value={contextValue}>
      {children}
      <Snackbar
        key={snack?.key}
        open={Boolean(snack)}
        onClose={handleClose}
        autoHideDuration={autoHideDuration}
        anchorOrigin={anchorOrigin}
        TransitionProps={{
          onExited: () => {
            setSnack(null);
          },
        }}
        sx={{
          maxWidth: "min(100%, 560px)",
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }}
      >
        <Alert
          variant="filled"
          severity={snack?.severity || "info"}
          onClose={snack?.dismissible === false ? undefined : handleClose}
          action={snack?.action}
          sx={{
            alignItems: "center",
            gap: 1,
          }}
        >
          {snack?.message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
}

SnackbarProvider.propTypes = {
  children: PropTypes.node,
};

export default memo(SnackbarProvider);
