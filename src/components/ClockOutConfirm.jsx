/* Proprietary and confidential. See LICENSE. */
// allow-color-literal-file

import { useCallback, useEffect, useState } from "react";
import { Button, Snackbar } from "@mui/material";

import { clockOutActiveSession } from "@/services/timeclockActions";
import { clearClockNotification } from "@/pwa/clockNotifications";
import { openTimeClockModal } from "@/services/uiBus";
import { consumePendingSwEvent } from "@/pwa/swMessages";
import logError from "@/utils/logError.js";

export default function ClockOutConfirm() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    function onReq() {
      setResult(null);
      setOpen(true);
    }
    function onOpen() {
      openTimeClockModal();
    }
    function onSuccess() {
      setBusy(false);
      setOpen(false);
      setResult("ok");
    }
    function onFailure() {
      setBusy(false);
      setOpen(false);
      setResult("err");
    }

    try {
      if (consumePendingSwEvent("SW_CLOCK_OUT_REQUEST")) onReq();
      if (consumePendingSwEvent("SW_OPEN_TIME_CLOCK")) onOpen();
      if (consumePendingSwEvent("CLOCKOUT_OK")) onSuccess();
      if (consumePendingSwEvent("CLOCKOUT_FAILED")) onFailure();
    } catch (e) {
      logError(e, { where: "ClockOutConfirm", action: "drainPending" });
    }

    window.addEventListener("lrp:clockout-request", onReq);
    window.addEventListener("lrp:open-timeclock", onOpen);
    window.addEventListener("lrp:clockout-success", onSuccess);
    window.addEventListener("lrp:clockout-failure", onFailure);
    return () => {
      window.removeEventListener("lrp:clockout-request", onReq);
      window.removeEventListener("lrp:open-timeclock", onOpen);
      window.removeEventListener("lrp:clockout-success", onSuccess);
      window.removeEventListener("lrp:clockout-failure", onFailure);
    };
  }, []);

  const handleConfirm = useCallback(async () => {
    try {
      setBusy(true);
      await clockOutActiveSession();
      try {
        await clearClockNotification();
      } catch (error) {
        logError(error, { where: "ClockOutConfirm", action: "clearClock" });
      }
      setBusy(false);
      setResult("ok");
      setOpen(false);
    } catch (e) {
      logError(e, { where: "ClockOutConfirm", action: "clockOut" });
      setBusy(false);
      setResult("err");
      setOpen(false);
    }
  }, []);

  return (
    <>
      <Snackbar
        open={open}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        message={busy ? "Clocking out..." : "Clock out now?"}
        action={
          <>
            <Button
              onClick={() => setOpen(false)}
              disabled={busy}
              sx={{ color: "rgba(255,255,255,0.85)" }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={busy}
              sx={{
                bgcolor: (t) => t.palette.primary.main,
                color: "#060606",
                ml: 1,
                "&:hover": { bgcolor: "#46aa15" },
              }}
            >
              Confirm
            </Button>
          </>
        }
        onClose={(_, r) => {
          if (r !== "clickaway") setOpen(false);
        }}
      />
      <Snackbar
        open={result === "ok"}
        autoHideDuration={2500}
        message="Clocked out"
        onClose={() => setResult(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
      <Snackbar
        open={result === "err"}
        autoHideDuration={3500}
        message="Clock out failed"
        onClose={() => setResult(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}
