import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Stack,
  Typography,
  Grow,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

import BlackoutOverlay, {
  BLACKOUT_END_HOUR,
  BLACKOUT_START_HOUR,
} from "@/components/BlackoutOverlay.jsx";
import BatchClaimBar from "@/components/claims/BatchClaimBar.jsx";
import RideCard, {
  getRideNotes,
  isClaimable,
} from "@/components/claims/RideCard.jsx";
import RideGroup from "@/components/claims/RideGroup.jsx";
import EmptyRideState from "@/components/claim/EmptyRideState.jsx";
import { useAuth } from "@/context/AuthContext.jsx";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import useClaimSelection from "@/hooks/useClaimSelection";
import useRides from "@/hooks/useRides";
import { claimRideOnce, undoClaimRide } from "@/services/claims";
import { TIMEZONE } from "@/constants.js";
import { tsToDayjs } from "@/utils/claimTime";
import { dayjs } from "@/utils/time";

export default function ClaimRides() {
  const { show: showSnack } = useSnack();
  const showToast = useCallback(
    (message, severity = "info", options = {}) =>
      showSnack(message, severity, options),
    [showSnack],
  );
  const sel = useClaimSelection((r) => r?.id);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [openNotes, setOpenNotes] = useState({});
  const [isClaiming, setIsClaiming] = useState({});
  const { user, role } = useAuth();
  const { liveRides = [], fetchRides, loading, hasFetchedOnce } = useRides();
  const [isLocked, setIsLocked] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadingRef = useRef(loading);

  const checkLockout = useCallback(() => {
    const now = dayjs().tz(TIMEZONE);
    const h = now.hour();
    setIsLocked(h >= BLACKOUT_START_HOUR && h < BLACKOUT_END_HOUR);
  }, []);

  useEffect(() => {
    checkLockout();
    const t = setInterval(checkLockout, 30000);
    return () => clearInterval(t);
  }, [checkLockout]);

  const lockedOut = useMemo(
    () => role !== "admin" && isLocked,
    [role, isLocked],
  );

  const createNow = useCallback(() => {
    const tzGuess = dayjs.tz?.guess?.() || TIMEZONE;
    const now = dayjs();
    return typeof now.tz === "function" ? now.tz(tzGuess) : now;
  }, []);

  useEffect(() => {
    if (loadingRef.current && !loading) {
      setLastUpdated(createNow());
      setRefreshing(false);
    } else if (!loading && !lastUpdated && hasFetchedOnce) {
      setLastUpdated(createNow());
    }
    loadingRef.current = loading;
  }, [createNow, hasFetchedOnce, lastUpdated, loading]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return "Never";
    try {
      const tzGuess = dayjs.tz?.guess?.() || TIMEZONE;
      return typeof lastUpdated.tz === "function"
        ? lastUpdated.tz(tzGuess).format("ddd, MMM D • h:mm A z")
        : lastUpdated.format("ddd, MMM D • h:mm A");
    } catch (error) {
      void error;
      return lastUpdated.format("ddd, MMM D • h:mm A");
    }
  }, [lastUpdated]);

  const isRefreshing = useMemo(
    () => refreshing || (loading && hasFetchedOnce),
    [hasFetchedOnce, loading, refreshing],
  );

  const ridesWithNotes = useMemo(
    () =>
      (liveRides || []).map((ride) => ({
        ...ride,
        __notes: getRideNotes(ride),
      })),
    [liveRides],
  );

  const rideMap = useMemo(() => {
    const map = new Map();
    ridesWithNotes.forEach((ride) => {
      if (ride?.id) {
        map.set(ride.id, ride);
      }
    });
    return map;
  }, [ridesWithNotes]);

  const ridesByVehicleDate = useMemo(() => {
    if (!ridesWithNotes.length) return [];
    const groups = new Map();
    ridesWithNotes.forEach((ride) => {
      const start = tsToDayjs(ride?.startTime || ride?.pickupTime);
      const dateKey = start
        ? start.startOf("day").format("YYYY-MM-DD")
        : "unknown";
      const dateLabel = start ? start.format("ddd, MMM D") : "N/A";
      const vehicle =
        ride?.vehicleName || ride?.vehicleLabel || ride?.vehicle || "Vehicle";
      const key = `${dateKey}|${vehicle}`;
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          dateLabel,
          vehicle,
          dateValue: start
            ? start.startOf("day").valueOf()
            : Number.MAX_SAFE_INTEGER,
          rides: [],
        });
      }
      groups.get(key).rides.push(ride);
    });
    const sorted = Array.from(groups.values()).sort((a, b) => {
      if (a.dateValue !== b.dateValue) return a.dateValue - b.dateValue;
      return a.vehicle.localeCompare(b.vehicle);
    });
    return sorted.map((group) => ({
      ...group,
      title: `${group.vehicle} • ${group.dateLabel}`,
      rides: group.rides.slice().sort((a, b) => {
        const aStart = tsToDayjs(a?.startTime || a?.pickupTime);
        const bStart = tsToDayjs(b?.startTime || b?.pickupTime);
        const aValue = aStart ? aStart.valueOf() : Number.MAX_SAFE_INTEGER;
        const bValue = bStart ? bStart.valueOf() : Number.MAX_SAFE_INTEGER;
        return aValue - bValue;
      }),
    }));
  }, [ridesWithNotes]);

  const refetch = useCallback(async () => {
    if (typeof fetchRides !== "function") return;
    await fetchRides();
  }, [fetchRides]);

  const handleRefresh = useCallback(async () => {
    if (!refetch) return;
    try {
      setRefreshing(true);
      await refetch();
    } catch (error) {
      setRefreshing(false);
      showToast(error?.message || "Failed to refresh rides", "error");
    }
  }, [refetch, showToast]);

  const handleToggleNotes = useCallback((rideId) => {
    setOpenNotes((prev) => ({ ...prev, [rideId]: !prev[rideId] }));
  }, []);

  const onUndoClaim = useCallback(
    async (claimedRide) => {
      if (!claimedRide?.id) return;
      try {
        await undoClaimRide(claimedRide.id, user);
        showToast("Ride restored to queue", "info");
        refetch?.();
      } catch (e) {
        showToast(e.message || "Unable to undo", "error");
      }
    },
    [refetch, showToast, user],
  );

  const handleClaim = useCallback(
    async (ride) => {
      if (!ride?.id) return;
      if (lockedOut) {
        showToast("Ride claims locked until 8:00 PM (CT)", "warning");
        return;
      }
      if (!isClaimable(ride)) {
        showToast("Ride is no longer available", "info");
        return;
      }
      setIsClaiming((prev) => ({ ...prev, [ride.id]: true }));
      try {
        const claimed = await claimRideOnce(ride.id, user);
        sel.deselectMany?.([ride]);
        showToast("Ride claimed", "success", {
          autoHideDuration: 6000,
          action: (
            <Button
              color="inherit"
              size="small"
              onClick={() => onUndoClaim(claimed)}
            >
              Undo
            </Button>
          ),
        });
        refetch?.();
      } catch (e) {
        showToast(e.message || "Failed to claim", "error");
      } finally {
        setIsClaiming((prev) => ({ ...prev, [ride.id]: false }));
      }
    },
    [lockedOut, onUndoClaim, refetch, sel, showToast, user],
  );

  const onClaimAll = useCallback(async () => {
    if (lockedOut) {
      showToast("Ride claims locked until 8:00 PM (CT)", "warning");
      return;
    }
    setBulkLoading(true);
    const ids = sel.selectedIds.slice(0);
    const eligibleIds = ids.filter((id) => {
      const ride = rideMap.get(id);
      return ride ? isClaimable(ride) : false;
    });
    try {
      sel.clear(); // optimistic
      let ok = 0;
      for (const id of eligibleIds) {
        const ride = rideMap.get(id);
        try {
          await claimRideOnce(id, user);
          ok += 1;
          if (ride) {
            setIsClaiming((prev) => ({ ...prev, [ride.id]: false }));
          }
        } catch (e) {
          console.error(e);
        }
      }
      showToast(`${ok} ${ok === 1 ? "ride" : "rides"} claimed`, "success");
      refetch?.();
    } catch {
      showToast("Failed to claim selected", "error");
    } finally {
      setBulkLoading(false);
    }
  }, [lockedOut, refetch, rideMap, sel, showToast, user]);

  if (!hasFetchedOnce)
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress />
      </Stack>
    );

  if (!liveRides.length)
    return (
      <EmptyRideState
        onRefresh={handleRefresh}
        refreshing={isRefreshing}
        lastUpdatedLabel={lastUpdatedLabel}
      />
    );

  return (
    <Box sx={{ position: "relative", minHeight: "100%", isolation: "isolate" }}>
      {/* Decorative background */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          overflow: "hidden",
        }}
      >
        {/* svg / gradient art */}
      </Box>

      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          isolation: "isolate",
          px: { xs: 1, sm: 2 },
          maxWidth: 1100,
          mx: "auto",
          pb: 10,
        }}
      >
        <BlackoutOverlay
          isAdmin={role === "admin"}
          isLocked={isLocked}
          onUnlock={checkLockout}
        />
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          sx={{ mb: 2.5, gap: 2, flexWrap: "wrap", rowGap: 1 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                color: "common.white",
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Live ride queue
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", mt: 0.5 }}
            >
              Last updated {lastUpdatedLabel}
            </Typography>
          </Box>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            useFlexGap
            flexWrap="wrap"
            sx={{ rowGap: 1 }}
          >
            <Chip
              label={`${liveRides.length} ride${liveRides.length === 1 ? "" : "s"} available`}
              color="primary"
              variant="outlined"
              sx={{
                borderColor: "rgba(76,187,23,0.6)",
                color: "primary.main",
                fontWeight: 600,
                backgroundColor: "rgba(76,187,23,0.08)",
              }}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleRefresh}
              disabled={isRefreshing}
              startIcon={
                isRefreshing ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <RefreshIcon />
                )
              }
              sx={{
                borderRadius: 9999,
                px: 3,
                py: 0.9,
                fontWeight: 700,
                color: "#060606",
                minWidth: 160,
                "&:hover": { filter: "brightness(1.08)" },
              }}
            >
              {isRefreshing ? "Refreshing…" : "Refresh queue"}
            </Button>
          </Stack>
        </Stack>

        {loading && hasFetchedOnce ? (
          <LinearProgress
            color="primary"
            sx={{
              height: 3,
              borderRadius: 9999,
              mb: 2.5,
              backgroundColor: "rgba(255,255,255,0.12)",
            }}
          />
        ) : null}

        {/* Filters bar placeholder; keep flexWrap for responsive layouts */}
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          sx={{ mb: 2 }}
        >
          {/* Filters... */}
        </Stack>

        <Stack
          spacing={2.5}
          sx={{
            overflow: "visible",
            WebkitOverflowScrolling: "touch",
            paddingBottom: "max(16px, env(safe-area-inset-bottom))",
            "& > *": { overflow: "visible" },
            "& > section:last-of-type": { mb: 2 },
          }}
        >
          {ridesByVehicleDate?.map((g) => {
            const selectedCount =
              g.rides?.filter((r) => sel.isSelected(r)).length || 0;
            const allSelected =
              selectedCount > 0 && selectedCount === g.rides.length;
            return (
              <RideGroup
                key={g.id || g.title}
                title={g.title}
                total={g.rides?.length || 0}
                allSelected={allSelected}
                onSelectAll={() => sel.toggleMany(g.rides)}
              >
                {g.rides?.map((ride) => (
                  <Grow in timeout={180} key={ride.id}>
                    <div>
                      <RideCard
                        ride={ride}
                        selected={sel.isSelected(ride)}
                        onToggleSelect={() => sel.toggle(ride)}
                        onClaim={() => handleClaim(ride)}
                        claiming={Boolean(isClaiming[ride.id])}
                        notes={ride.__notes}
                        notesOpen={Boolean(openNotes[ride.id])}
                        onToggleNotes={() => handleToggleNotes(ride.id)}
                        highlight={Boolean(ride.__isNew)}
                      />
                    </div>
                  </Grow>
                ))}
              </RideGroup>
            );
          })}
        </Stack>

        <BatchClaimBar
          count={sel.count}
          onClear={sel.clear}
          onClaimAll={onClaimAll}
          loading={bulkLoading}
          disabled={lockedOut}
        />
      </Box>
    </Box>
  );
}
