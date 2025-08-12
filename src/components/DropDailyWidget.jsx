/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Stack,
  Chip,
  Tooltip,
  Button,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Skeleton,
} from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import ScienceIcon from "@mui/icons-material/Science";
import EventIcon from "@mui/icons-material/Event";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../utils/firebaseInit";
import { callDropDailyRidesNow } from "../utils/functions";
import { useDriver } from "../context/DriverContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

const Stat = ({ label, value, tip }) => (
  <Tooltip title={tip || ""}>
    <Chip
      label={`${label}: ${value ?? 0}`}
      size="small"
      sx={{ fontWeight: 600, bgcolor: "action.selected" }}
    />
  </Tooltip>
);

export default function DropDailyWidget() {
  const { driver } = useDriver();
  const isAdmin = (driver?.access || "").toLowerCase() === "admin";
  const { user, authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [last, setLast] = useState(null);
  const [dryOpen, setDryOpen] = useState(false);
  const [dryBusy, setDryBusy] = useState(false);
  const [dryStats, setDryStats] = useState(null);
  const [toast, setToast] = useState({
    open: false,
    msg: "",
    severity: "success",
  });

  useEffect(() => {
    if (authLoading || !user) return;
    const ref = doc(db, "AdminMeta", "lastDropDaily");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setLoading(false);
        setLast(snap.exists() ? snap.data() : null);
      },
      (err) => {
        console.error("AdminMeta subscribe failed", err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [authLoading, user]);

  const ranAtString = useMemo(() => {
    const ts = last?.ranAt;
    if (!ts || !ts.toDate) return "—";
    const d = ts.toDate();
    return `${dayjs(d).format("MMM D, YYYY h:mm A")} (${dayjs(d).fromNow()})`;
  }, [last]);

  const stats = last?.stats || {};
  const nextRunStatic = "Daily at 7:30 PM America/Chicago";

  async function handleDryRun() {
    setDryBusy(true);
    try {
      const res = await callDropDailyRidesNow({ dryRun: true });
      setDryStats(res?.stats || {});
      setDryOpen(true);
    } catch (e) {
      console.error(e);
      setToast({
        open: true,
        severity: "error",
        msg: "Dry-run failed. See console.",
      });
    } finally {
      setDryBusy(false);
    }
  }

  return (
    <Card elevation={2} sx={{ borderRadius: 3 }}>
      <CardHeader
        avatar={<HistoryIcon color="primary" />}
        title={
          <Typography variant="subtitle1" fontWeight={700}>
            Daily Drop Status
          </Typography>
        }
        subheader={
          <Stack direction="row" spacing={1} alignItems="center">
            <InfoOutlinedIcon fontSize="small" />
            <Typography variant="caption" color="text.secondary">
              Next schedule: {nextRunStatic}
            </Typography>
          </Stack>
        }
        action={
          isAdmin && (
            <Tooltip title="Preview what the drop will do (no writes)">
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ScienceIcon />}
                  onClick={handleDryRun}
                  disabled={dryBusy}
                >
                  {dryBusy ? "Running…" : "Dry-run"}
                </Button>
              </span>
            </Tooltip>
          )
        }
        sx={{ pb: 0.5 }}
      />
      <CardContent sx={{ pt: 1.5 }}>
        {loading ? (
          <Box>
            <Skeleton width={220} />
            <Skeleton width="100%" height={38} />
          </Box>
        ) : (
          <Stack spacing={1.2}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
            >
              <EventIcon fontSize="small" />
              <Typography variant="body2" fontWeight={600}>
                Last run:
              </Typography>
              <Typography variant="body2">{ranAtString}</Typography>
            </Stack>
            <Divider light />
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Stat label="Imported" value={stats.imported} />
              <Stat label="Duplicates" value={stats.duplicatesFound} />
              <Stat label="Skipped (no TripID)" value={stats.skippedNoTripId} />
              <Stat label="Queue Unclaimed" value={stats.queueUnclaimed} />
              <Stat label="Queue Total" value={stats.queueTotal} />
              <Stat label="Queue Cleared" value={stats.queueCleared} />
              <Stat label="Live Docs" value={stats.liveDocs} />
              <Stat label="Live Unclaimed" value={stats.liveUnclaimed} />
            </Stack>
          </Stack>
        )}
      </CardContent>

      <Dialog
        open={dryOpen}
        onClose={() => setDryOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Dry-run Results</DialogTitle>
        <DialogContent dividers>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Stat label="Imported" value={dryStats?.imported} />
            <Stat label="Duplicates" value={dryStats?.duplicatesFound} />
            <Stat
              label="Skipped (no TripID)"
              value={dryStats?.skippedNoTripId}
            />
            <Stat label="Queue Unclaimed" value={dryStats?.queueUnclaimed} />
            <Stat label="Queue Total" value={dryStats?.queueTotal} />
            <Stat label="Queue Cleared" value={dryStats?.queueCleared} />
            <Stat label="Live Docs" value={dryStats?.liveDocs} />
            <Stat label="Live Unclaimed" value={dryStats?.liveUnclaimed} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Card>
  );
}
