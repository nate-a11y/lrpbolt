/* Proprietary and confidential. See LICENSE. */
import { useEffect, useState, useMemo, useCallback } from "react";
import { Box, Button, Chip, Stack } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { diagShowSwNotification } from "@/pwa/clockNotifications";

const ENABLED =
  String(import.meta?.env?.VITE_DEBUG_NOTIFICATIONS || "")
    .toLowerCase()
    .trim() === "true";

function getPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

function getControlled() {
  if (typeof navigator === "undefined") return false;
  return Boolean(navigator.serviceWorker?.controller);
}

function formatRegistrations(list) {
  return (list || []).map((registration) => ({
    scope: registration.scope,
    script:
      registration.active?.scriptURL ||
      registration.waiting?.scriptURL ||
      registration.installing?.scriptURL ||
      "unknown",
  }));
}

export default function NotifDiag() {
  const [perm, setPerm] = useState(getPermission);
  const [controlled, setControlled] = useState(getControlled);
  const [regs, setRegs] = useState([]);
  const [swReady, setSwReady] = useState(null);

  useEffect(() => {
    if (!ENABLED) return undefined;

    const onMessage = (event) => {
      const type = event?.data?.type;
      if (type === "SW_READY" || type === "PONG") {
        setSwReady({ v: event?.data?.v, scope: event?.data?.scope });
      }
    };

    const onControllerChange = () => setControlled(getControlled());

    navigator.serviceWorker?.addEventListener?.("message", onMessage);
    navigator.serviceWorker?.addEventListener?.(
      "controllerchange",
      onControllerChange,
    );

    (async () => {
      try {
        const list = await navigator.serviceWorker?.getRegistrations?.();
        setRegs(formatRegistrations(list));
      } catch (error) {
        console.error("[NotifDiag] registrations failed", error);
      }
    })();

    return () => {
      navigator.serviceWorker?.removeEventListener?.("message", onMessage);
      navigator.serviceWorker?.removeEventListener?.(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  useEffect(() => {
    if (!ENABLED) return undefined;

    let cancelled = false;

    const ping = async () => {
      try {
        const registration = await navigator.serviceWorker?.ready.catch(
          () => null,
        );
        if (cancelled) return;
        const target =
          navigator.serviceWorker?.controller || registration?.active;
        target?.postMessage?.({ type: "PING" });
      } catch (error) {
        console.error("[NotifDiag] ping failed", error);
      }
    };

    ping();
    const interval = setInterval(ping, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!ENABLED) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initializing permission state on mount
    setPerm(getPermission());

    setControlled(getControlled());
  }, []);

  const permChipColor = useMemo(() => {
    if (perm === "granted") return "success";
    if (perm === "denied") return "error";
    return "default";
  }, [perm]);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    const res = await Notification.requestPermission();
    setPerm(res);
  }, []);

  const handlePageNotify = useCallback(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    try {
      new Notification("Page Notification", { body: "Fallback test" });
    } catch (error) {
      console.error("[NotifDiag] page notify failed", error);
    }
  }, []);

  if (!ENABLED) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        right: 8,
        bottom: 8,
        zIndex: 4000,
        p: 1.5,
        bgcolor: (t) => alpha(t.palette.common.black, 0.75),
        color: "text.primary",
        borderRadius: 1,
        minWidth: 220,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: "center" }}>
        <Chip size="small" label={`perm:${perm}`} color={permChipColor} />
        <Chip
          size="small"
          label={controlled ? "controlled" : "not-controlled"}
        />
        <Chip size="small" label={swReady ? `SW v${swReady.v}` : "SW ?"} />
      </Stack>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
        <Button size="small" variant="contained" onClick={requestPermission}>
          Ask Permission
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => diagShowSwNotification("Diag from page")}
        >
          SW Notify
        </Button>
        <Button size="small" variant="outlined" onClick={handlePageNotify}>
          Page Notify
        </Button>
      </Stack>
      <Box
        sx={{
          mt: 1,
          fontSize: 11,
          opacity: 0.8,
          maxHeight: 100,
          overflowY: "auto",
        }}
      >
        {regs.length
          ? regs.map((reg, index) => (
              <div key={reg.scope || index}>
                {reg.scope} → {reg.script}
              </div>
            ))
          : "no regs"}
      </Box>
    </Box>
  );
}
