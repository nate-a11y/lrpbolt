import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, CircularProgress, Stack } from "@mui/material";

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
import useAutoRefresh from "@/hooks/useAutoRefresh";
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
  const { liveRides = [], fetchRides, loading } = useRides();
  const [isLocked, setIsLocked] = useState(false);
  const refreshIntervalSec = 30;
  const [, setNoRideCountdown] = useState(refreshIntervalSec);

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

  const refetch = useCallback(() => fetchRides && fetchRides(), [fetchRides]);

  useAutoRefresh(refetch, 60000);

  useEffect(() => {
    if (liveRides.length) return;
    setNoRideCountdown(refreshIntervalSec);
    const t = setInterval(() => {
      setNoRideCountdown((s) => {
        if (s <= 1) {
          refetch?.();
          return refreshIntervalSec;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [liveRides.length, refetch, refreshIntervalSec]);

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

  if (loading)
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress />
      </Stack>
    );

  if (!liveRides.length)
    return (
      <EmptyRideState refreshIn={refreshIntervalSec} onRefresh={refetch} />
    );

  return (
    <Box
      sx={{
        position: "relative",
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
      {/* Your existing filter bar goes here; ensure flexWrap on mobile */}
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
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "max(16px, env(safe-area-inset-bottom))",
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
                <RideCard
                  key={ride.id}
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
  );
}
