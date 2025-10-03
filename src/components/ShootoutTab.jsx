/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState, useCallback, useMemo, memo } from "react";
import { Box, Paper } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { GridActionsCellItem } from "@mui/x-data-grid-pro";
import {
  addDoc,
  collection,
  doc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import LrpDataGridPro from "@/components/datagrid/LrpDataGridPro";
import ErrorBoundary from "@/components/feedback/ErrorBoundary.jsx";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import { EmptyState, ErrorState } from "@/components/feedback/SectionState.jsx";
import LoadingButtonLite from "@/components/inputs/LoadingButtonLite.jsx";
import PageContainer from "@/components/PageContainer.jsx";
import { vibrateOk, vibrateWarn } from "@/utils/haptics.js";
import { tsToDayjs, formatHMFromMinutes } from "@/utils/timeUtils.js";

import { mapSnapshotToRows, enrichDriverNames } from "../services/normalizers";
import { db } from "../utils/firebaseInit";
import { useAuth } from "../context/AuthContext.jsx";
import logError from "../utils/logError.js";

function ShootoutTab() {
  const { user } = useAuth();
  const [sessionRows, setSessionRows] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startBusy, setStartBusy] = useState(false);
  const [endBusy, setEndBusy] = useState(false);
  const [subscriptionKey, setSubscriptionKey] = useState(0);
  const { show: showSnack } = useSnack();

  const announce = useCallback((message) => {
    if (typeof window === "undefined") return;
    window.__LRP_LIVE_MSG__ = message || "";
    try {
      window.dispatchEvent(
        new CustomEvent("lrp:live-region", { detail: message || "" }),
      );
    } catch (announceError) {
      if (import.meta.env.DEV) {
        console.warn(
          "[ShootoutTab] live region dispatch failed",
          announceError,
        );
      }
    }
  }, []);

  const showSuccessSnack = useCallback(
    (message, options = {}) => {
      if (!message) return;
      vibrateOk();
      announce(message);
      showSnack(message, "success", options);
    },
    [announce, showSnack],
  );

  const showWarnOrErrorSnack = useCallback(
    (message, severity = "warning", options = {}) => {
      if (!message) return;
      vibrateWarn();
      announce(message);
      showSnack(message, severity, options);
    },
    [announce, showSnack],
  );

  useEffect(() => {
    if (!user?.email) {
      setSessionRows([]);
      setActiveId(null);
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, "shootoutStats"),
      where("driverEmail", "==", user.email.toLowerCase()),
      orderBy("startTime", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        (async () => {
          try {
            const base = mapSnapshotToRows("shootoutStats", snap);
            const withNames = await enrichDriverNames(base);
            setSessionRows(withNames);
            const openRow = withNames.find((row) => !row?.endTime);
            setActiveId(openRow ? openRow.id : null);
          } catch (processingError) {
            logError(processingError, {
              area: "ShootoutTab",
              action: "processSnapshot",
            });
            setError(processingError);
          } finally {
            setLoading(false);
          }
        })();
      },
      (snapshotError) => {
        logError(snapshotError, { area: "ShootoutTab", action: "snapshot" });
        setError(snapshotError);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [subscriptionKey, user?.email]);

  const handleStart = useCallback(async () => {
    if (!user?.email || startBusy || endBusy) return;
    setStartBusy(true);
    try {
      const docRef = await addDoc(collection(db, "shootoutStats"), {
        driverEmail: user.email.toLowerCase(),
        startTime: serverTimestamp(),
        endTime: null,
        vehicle: null,
        trips: null,
        passengers: null,
        createdAt: serverTimestamp(),
      });
      setActiveId(docRef.id);
      showSuccessSnack("Shootout session started");
    } catch (err) {
      logError(err, { area: "ShootoutTab", action: "start" });
      showWarnOrErrorSnack("Failed to start session.", "error");
    } finally {
      setStartBusy(false);
    }
  }, [endBusy, showSuccessSnack, showWarnOrErrorSnack, startBusy, user?.email]);

  const handleEnd = useCallback(async () => {
    if (!activeId || endBusy) return;
    setEndBusy(true);
    try {
      await updateDoc(doc(db, "shootoutStats", activeId), {
        endTime: serverTimestamp(),
      });
      setActiveId(null);
      showSuccessSnack("Shootout session ended");
    } catch (err) {
      logError(err, { area: "ShootoutTab", action: "end", id: activeId });
      showWarnOrErrorSnack("Failed to end session.", "error");
    } finally {
      setEndBusy(false);
    }
  }, [activeId, endBusy, showSuccessSnack, showWarnOrErrorSnack]);

  const handleDelete = useCallback(
    async (id) => {
      if (!id) return;
      try {
        await deleteDoc(doc(db, "shootoutStats", String(id)));
        if (activeId === id) {
          setActiveId(null);
        }
        showSuccessSnack("Session deleted");
      } catch (err) {
        logError(err, { area: "ShootoutTab", action: "delete", id });
        showWarnOrErrorSnack("Failed to delete session.", "error");
      }
    },
    [activeId, showSuccessSnack, showWarnOrErrorSnack],
  );

  const running = Boolean(activeId);

  const getRowId = useCallback((row) => {
    if (row?.id != null) return String(row.id);
    if (row?.docId != null) return String(row.docId);
    return null;
  }, []);

  const columns = useMemo(() => {
    const formatTimestamp = (value) => {
      const dj = tsToDayjs(value);
      return dj ? dj.format("MMM D, h:mm A") : "N/A";
    };
    return [
      {
        field: "driver",
        headerName: "Driver",
        flex: 1,
        minWidth: 160,
        valueGetter: (params) =>
          params?.row?.driver ||
          params?.row?.driverName ||
          params?.row?.driverEmail ||
          "N/A",
      },
      {
        field: "vehicle",
        headerName: "Vehicle",
        flex: 0.8,
        minWidth: 140,
        valueGetter: (params) => params?.row?.vehicle || "N/A",
      },
      {
        field: "startTime",
        headerName: "Start",
        flex: 1,
        minWidth: 180,
        valueGetter: (params) => formatTimestamp(params?.row?.startTime),
      },
      {
        field: "endTime",
        headerName: "End",
        flex: 1,
        minWidth: 180,
        valueGetter: (params) => formatTimestamp(params?.row?.endTime),
      },
      {
        field: "duration",
        headerName: "Duration",
        flex: 0.6,
        minWidth: 140,
        valueGetter: (params) => {
          const row = params?.row || {};
          const raw = row.duration;
          if (raw != null && Number.isFinite(Number(raw))) {
            return formatHMFromMinutes(Number(raw));
          }
          const start = row.startTime;
          const end = row.endTime;
          const startDj = tsToDayjs(start);
          const endDj = tsToDayjs(end);
          if (!startDj || !endDj) return "N/A";
          const mins = endDj.diff(startDj, "minute");
          return Number.isFinite(mins) && mins >= 0
            ? formatHMFromMinutes(mins)
            : "N/A";
        },
      },
      {
        field: "trips",
        headerName: "Trips",
        flex: 0.4,
        minWidth: 100,
        valueGetter: (params) => {
          const value = params?.row?.trips;
          return Number.isFinite(Number(value)) ? Number(value) : "N/A";
        },
      },
      {
        field: "passengers",
        headerName: "PAX",
        flex: 0.4,
        minWidth: 100,
        valueGetter: (params) => {
          const value = params?.row?.passengers;
          return Number.isFinite(Number(value)) ? Number(value) : "N/A";
        },
      },
      {
        field: "actions",
        type: "actions",
        headerName: "Actions",
        getActions: (params) => [
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon />}
            label="Delete session"
            onClick={() => handleDelete(params.id)}
            aria-label="Delete session"
          />,
        ],
      },
    ];
  }, [handleDelete]);

  const rows = useMemo(
    () => (Array.isArray(sessionRows) ? sessionRows : []),
    [sessionRows],
  );

  return (
    <ErrorBoundary>
      <PageContainer>
        <Box sx={{ display: "flex", gap: 2, mb: 1 }}>
          {running ? (
            <LoadingButtonLite
              variant="contained"
              color="error"
              onClick={handleEnd}
              loading={endBusy}
              loadingText="Ending…"
            >
              End Session
            </LoadingButtonLite>
          ) : (
            <LoadingButtonLite
              variant="contained"
              color="success"
              onClick={handleStart}
              loading={startBusy}
              loadingText="Starting…"
            >
              Start Session
            </LoadingButtonLite>
          )}
        </Box>
        <Paper sx={{ width: "100%", display: "flex", flexDirection: "column" }}>
          {error ? (
            <ErrorState
              onAction={() => {
                setError(null);
                setSubscriptionKey((key) => key + 1);
              }}
            />
          ) : !loading && rows.length === 0 ? (
            <EmptyState
              title="No shootout sessions"
              description="Start a session to capture shuttle shootout stats."
              actionLabel={!running ? "Start session" : undefined}
              onAction={!running ? handleStart : undefined}
            />
          ) : (
            <LrpDataGridPro
              id="shootout-sessions-grid"
              rows={rows}
              columns={columns}
              getRowId={getRowId}
              loading={loading}
              checkboxSelection
              disableRowSelectionOnClick
              density="compact"
              autoHeight
              slotProps={{
                toolbar: {
                  quickFilterPlaceholder: "Search sessions",
                },
              }}
            />
          )}
        </Paper>
      </PageContainer>
    </ErrorBoundary>
  );
}

export default memo(ShootoutTab);
