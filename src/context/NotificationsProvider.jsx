import {
  createContext,
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useContext,
  memo,
} from "react";
import { Snackbar, Alert } from "@mui/material";

import { onForegroundMessageSafe } from "../services/fcm";

const NotificationsContext = createContext({
  notify: () => {},
  lastMessageRef: { current: null },
});

function NotificationsProvider({ children }) {
  const queueRef = useRef([]);
  const [current, setCurrent] = useState(null);
  const processingRef = useRef(false);
  const lastMessageRef = useRef(null);

  const process = useCallback(() => {
    if (processingRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    processingRef.current = true;
    setCurrent(next);
  }, []);

  const notify = useCallback(
    (n) => {
      const now = Date.now();
      const last = lastMessageRef.current;
      if (
        last &&
        last.title === n.title &&
        last.body === n.body &&
        now - last.time < 2000
      ) {
        return;
      }
      lastMessageRef.current = { ...n, time: now };
      queueRef.current.push(n);
      process();
    },
    [process],
  );

  const handleClose = useCallback(() => {
    processingRef.current = false;
    setCurrent(null);
    setTimeout(process, 0);
  }, [process]);

  useEffect(() => {
    if (import.meta.env.VITE_ENABLE_FCM !== "true") return undefined;
    return onForegroundMessageSafe((payload) => {
      const title =
        payload.notification?.title || payload.data?.title || "Notification";
      const body =
        payload.notification?.body ||
        payload.data?.body ||
        payload.data?.message ||
        "You have a new message.";
      notify({ title, body, data: payload.data });
    });
  }, [notify]);

  const value = useMemo(() => ({ notify, lastMessageRef }), [notify]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <Snackbar
        open={Boolean(current)}
        autoHideDuration={4000}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={handleClose}
          severity="info"
          variant="filled"
          sx={{ width: "100%" }}
        >
          <strong>{current?.title}</strong>
          {current?.body ? ` — ${current.body}` : ""}
        </Alert>
      </Snackbar>
    </NotificationsContext.Provider>
  );
}

export default memo(NotificationsProvider);
export const useNotifications = () => useContext(NotificationsContext);
