import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, Stack } from "@mui/material";

import BlackoutOverlay, {
  BLACKOUT_END_HOUR,
  BLACKOUT_START_HOUR,
} from "@/components/BlackoutOverlay.jsx";
import BatchClaimBar from "@/components/claims/BatchClaimBar.jsx";
import RideCard from "@/components/claims/RideCard.jsx";
import RideGroup from "@/components/claims/RideGroup.jsx";
import EmptyRideState from "@/components/claim/EmptyRideState.jsx";
import { useAuth } from "@/context/AuthContext.jsx";
import { useToast } from "@/context/ToastProvider.jsx";
import useAutoRefresh from "@/hooks/useAutoRefresh";
import useClaimSelection from "@/hooks/useClaimSelection";
import useRides from "@/hooks/useRides";
import { claimRideOnce } from "@/services/claims";
import { TIMEZONE } from "@/constants.js";
import { tsToDayjs } from "@/utils/claimTime";
import { dayjs } from "@/utils/time";

export default function ClaimRides() {
  const toast = useToast();
  const sel = useClaimSelection((r) => r?.id);
  const [bulkLoading, setBulkLoading] = useState(false);
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

  const ridesByVehicleDate = useMemo(() => {
    const groups = new Map();
    liveRides.forEach((ride) => {
      const start = tsToDayjs(ride?.startTime || ride?.pickupTime);
      const dateLabel = start ? start.format("ddd, MMM D") : "N/A";
      const vehicle = ride?.vehicleLabel || ride?.vehicle || "Vehicle";
      const key = `${vehicle}|${dateLabel}`;
      if (!groups.has(key)) {
        groups.set(key, { title: `${vehicle} • ${dateLabel}`, rides: [] });
      }
      groups.get(key).rides.push(ride);
    });
    return Array.from(groups.values());
  }, [liveRides]);

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

  const onClaim = useCallback(
    async (ride) => {
      if (lockedOut) {
        toast.show?.("Ride claims locked until 8:00 PM (CT)", {
          severity: "warning",
        });
        return;
      }
      try {
        await claimRideOnce(ride.id, user);
        toast.show?.("Ride claimed", { severity: "success" });
        refetch?.();
      } catch (e) {
        toast.show?.(e.message || "Failed to claim", { severity: "error" });
      }
    },
    [toast, refetch, user, lockedOut],
  );

  const onClaimAll = useCallback(async () => {
    if (lockedOut) {
      toast.show?.("Ride claims locked until 8:00 PM (CT)", {
        severity: "warning",
      });
      return;
    }
    setBulkLoading(true);
    const ids = sel.selectedIds.slice(0);
    try {
      sel.clear(); // optimistic
      let ok = 0;
      for (const id of ids) {
        try {
          await claimRideOnce(id, user);
          ok += 1;
        } catch (e) {
          console.error(e);
        }
      }
      toast.show?.(`${ok} ${ok === 1 ? "ride" : "rides"} claimed`, {
        severity: "success",
        autoHideDuration: 4000,
        actionLabel: "Undo",
      });
      refetch?.();
    } catch {
      toast.show?.("Failed to claim selected", { severity: "error" });
    } finally {
      setBulkLoading(false);
    }
  }, [sel, toast, user, refetch, lockedOut]);

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

      <Stack spacing={2.5}>
        {ridesByVehicleDate?.map((g, idx) => (
          <RideGroup
            key={g.groupId || g.title || idx}
            title={g.title}
            total={g.rides?.length || 0}
            onSelectAll={() =>
              g.rides?.forEach((r) => !sel.isSelected(r) && sel.toggle(r))
            }
          >
            {g.rides?.map((ride) => (
              <RideCard
                key={ride.id}
                ride={ride}
                selected={sel.isSelected(ride)}
                onToggleSelect={() => sel.toggle(ride)}
                onClaim={() => onClaim(ride)}
                claimDisabled={lockedOut}
                claiming={false}
                highlight={Boolean(ride.__isNew)}
              />
            ))}
          </RideGroup>
        ))}
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
