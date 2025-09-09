import React, { useCallback, useMemo, useState } from "react";
import { Box, Stack, CircularProgress } from "@mui/material";

import BatchClaimBar from "@/components/claims/BatchClaimBar.jsx";
import RideCard from "@/components/claims/RideCard.jsx";
import RideGroup from "@/components/claims/RideGroup.jsx";
import { useAuth } from "@/context/AuthContext.jsx";
import { useToast } from "@/context/ToastProvider.jsx";
import useAutoRefresh from "@/hooks/useAutoRefresh";
import useClaimSelection from "@/hooks/useClaimSelection";
import useRides from "@/hooks/useRides";
import { claimRideOnce } from "@/services/claims";
import { tsToDayjs } from "@/utils/claimTime";

export default function ClaimRides() {
  const toast = useToast();
  const sel = useClaimSelection((r) => r?.id);
  const [bulkLoading, setBulkLoading] = useState(false);
  const { user } = useAuth();
  const { liveRides = [], fetchRides } = useRides();

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

  const onClaim = useCallback(
    async (ride) => {
      try {
        await claimRideOnce(ride.id, user);
        toast.show?.("Ride claimed", { severity: "success" });
        refetch?.();
      } catch (e) {
        toast.show?.(e.message || "Failed to claim", { severity: "error" });
      }
    },
    [toast, refetch, user],
  );

  const onClaimAll = useCallback(async () => {
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
  }, [sel, toast, user, refetch]);

  if (!liveRides.length)
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress />
      </Stack>
    );

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, maxWidth: 1100, mx: "auto", pb: 10 }}>
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
      />
    </Box>
  );
}
