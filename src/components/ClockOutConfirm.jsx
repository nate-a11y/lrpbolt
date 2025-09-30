/* Proprietary and confidential. See LICENSE. */
import { useCallback, useEffect, useState } from "react";
import { Button, Snackbar } from "@mui/material";

import { clockOutActiveSession } from "@/services/timeclockActions";
import { openTimeClockModal } from "@/services/uiBus";
import logError from "@/utils/logError.js";

export default function ClockOutConfirm() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    function handleClockOutRequest() {
      setResult(null);
      setBusy(false);
      setOpen(true);
    }
    function handleOpenClock() {
      openTimeClockModal();
    }
    window.addEventListener("lrp:clockout-request", handleClockOutRequest);
    window.addEventListener("lrp:open-timeclock", handleOpenClock);
    return () => {
      window.removeEventListener("lrp:clockout-request", handleClockOutRequest);
      window.removeEventListener("lrp:open-timeclock", handleOpenClock);
    };
  }, []);

  const handleClose = useCallback((_, reason) => {
    if (reason === "clickaway") return;
    setOpen(false);
  }, []);

  const handleConfirm = useCallback(async () => {
    try {
      setBusy(true);
      await clockOutActiveSession();
      setResult("ok");
    } catch (error) {
      logError(error, { where: "ClockOutConfirm", action: "clockOut" });
      setResult("err");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }, []);

  const handleResultClose = useCallback(() => {
    setResult(null);
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
                bgcolor: "#4cbb17",
                color: "#060606",
                ml: 1,
                "&:hover": { bgcolor: "#46aa15" },
              }}
            >
              Confirm
            </Button>
          </>
        }
        onClose={handleClose}
      />
      <Snackbar
        open={result === "ok"}
        autoHideDuration={2500}
        message="Clocked out"
        onClose={handleResultClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
      <Snackbar
        open={result === "err"}
        autoHideDuration={3500}
        message="Clock out failed"
        onClose={handleResultClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}
