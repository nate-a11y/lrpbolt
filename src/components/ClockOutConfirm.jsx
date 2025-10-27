/* Proprietary and confidential. See LICENSE. */
// allow-color-literal-file

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
} from "@mui/material";

import { clearClockNotification } from "@/pwa/clockNotifications";
import { openTimeClockModal } from "@/services/uiBus";
import { consumePendingSwEvent } from "@/pwa/swMessages";
import logError from "@/utils/logError.js";

export default function ClockOutConfirm({ activeTimeLogId, performClockOut }) {
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

      if (!activeTimeLogId) {
        logError(new Error("No active time log ID"), {
          where: "ClockOutConfirm",
          action: "clockOut",
        });
        setBusy(false);
        setResult("err");
        setOpen(false);
        return;
      }

      const success = await performClockOut(activeTimeLogId);

      if (success) {
        try {
          await clearClockNotification();
        } catch (error) {
          logError(error, { where: "ClockOutConfirm", action: "clearClock" });
        }
      }

      setBusy(false);
      setResult(success ? "ok" : "err");
      setOpen(false);
    } catch (e) {
      logError(e, { where: "ClockOutConfirm", action: "clockOut" });
      setBusy(false);
      setResult("err");
      setOpen(false);
    }
  }, [activeTimeLogId, performClockOut]);

  return (
    <>
      <Dialog
        open={open}
        onClose={(_, reason) => {
          if (reason !== "backdropClick" && !busy) {
            setOpen(false);
          }
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            m: 0,
          },
        }}
      >
        <DialogTitle>Clock Out</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {busy
              ? "Clocking out..."
              : "Are you sure you want to clock out now?"}
          </DialogContentText>
          {busy && (
            <CircularProgress
              size={24}
              sx={{ display: "block", mx: "auto", mt: 2 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={busy}
            variant="contained"
            color="primary"
            autoFocus
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

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
