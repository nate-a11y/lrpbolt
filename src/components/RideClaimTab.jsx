/* Proprietary and confidential. See LICENSE. */
// src/components/RideClaimTab.jsx
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Box,
  Button,
  Stack,
  Typography,
  MenuItem,
  Snackbar,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  DataGridPro,
  GridActionsCellItem,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
  GridToolbarExport,
  GridToolbarQuickFilter,
} from "@mui/x-data-grid-pro";
import { DateRangePicker } from "@mui/x-date-pickers-pro";
import RefreshIcon from "@mui/icons-material/Refresh";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { Timestamp, orderBy } from "firebase/firestore";

import RideGroup from "../RideGroup";
import BlackoutOverlay from "./BlackoutOverlay";
import { claimRideAtomic, getUserAccess } from "../hooks/api";
import useFirestoreListener from "../hooks/useFirestoreListener";
import { fmtDow, fmtTime, fmtDate, safe, groupKey } from "../utils/rideFormatters";
import { enqueueSms } from "../services/messaging";
import { useDriver } from "../context/DriverContext.jsx";
import { withSafeColumns } from "../utils/gridFormatters";
import { dateCol, durationMinutes, toDateAny } from "@/utils/datetime";
import { useGridDoctor } from "../utils/useGridDoctor";
import { COLLECTIONS } from "../constants";
import { formatClaimSms } from "../utils/formatClaimSms.js";
import { asArray } from "../utils/arrays.js";

function ProToolbar({ onBulkClaim, selectedCount }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1 }}>
      <GridToolbarColumnsButton />
      <GridToolbarFilterButton />
      <GridToolbarDensitySelector />
      <GridToolbarExport csvOptions={{ utf8WithBom: true }} />
      <GridToolbarQuickFilter debounceMs={400} />
      <Stack direction="row" spacing={1} sx={{ ml: "auto" }}>
        <Button
          size="small"
          variant="contained"
          disabled={!selectedCount}
          onClick={onBulkClaim}
        >
          Claim Selected ({selectedCount || 0})
        </Button>
      </Stack>
    </Stack>
  );
}

dayjs.extend(utc);
dayjs.extend(timezone);

const RideClaimTab = ({ driver, isAdmin = true, isLockedOut = false }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [rides, setRides] = useState([]);
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [claimLog, setClaimLog] = useState([]);
  const [loadingRides, setLoadingRides] = useState(false);
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [selectedRides, setSelectedRides] = useState(new Set());
  const { driver: driverProfile } = useDriver();
  const [dateRange, setDateRange] = useState([null, null]); // [start, end]
  const [selectionModel, setSelectionModel] = useState([]);

  const groupedRides = useMemo(() => {
    const grouped = {};
    for (const r of rides) {
      const key = `${safe(r.vehicle)}___${fmtDow(r.pickupTime)}___${groupKey(
        r.pickupTime,
      )}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    }
    return grouped;
  }, [rides]);

  const uniqueVehicles = useMemo(
    () => Array.from(new Set(rides.map((r) => r.vehicle))),
    [rides],
  );

  const rows = useMemo(() => {
    return rides
      .map((r) => {
        const id = r.id || r.tripId;
        const dt = toDateAny(r.pickupTime ?? r.PickupTime);
        if (!dt) return null;
        return {
          id,
          tripId: r.tripId,
          vehicle: safe(r.vehicle),
          pickupTime: dt,
          weekday: fmtDow(dt),
          timeBucket: groupKey(dt),
          rideType: safe(r.rideType),
          rideNotes: safe(r.rideNotes, "none"),
          rideDuration: Number(r.rideDuration ?? r.RideDuration ?? 0),
        };
      })
      .filter(Boolean)
      .filter((row) => {
        const [start, end] = dateRange;
        if (!start && !end) return true;
        const ms = row.pickupTime.getTime();
        const okStart = start ? ms >= new Date(start).getTime() : true;
        const okEnd = end ? ms <= new Date(end).getTime() : true;
        return okStart && okEnd;
      });
  }, [rides, dateRange]);


  const showToast = (message, severity = "success") =>
    setToast({ open: true, message, severity });

  const toggleRideSelection = useCallback((id) => {
    setSelectedRides((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleGroupSelection = useCallback((ids) => {
    setSelectedRides((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      ids.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  }, []);

  const clearSelections = useCallback((ids) => {
    setSelectedRides((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  // Requires Firestore index: Firestore Database > Indexes > liveRides.pickupTime ASC
  const rideQuery = useMemo(() => [orderBy("pickupTime", "asc")], []);
  const liveRides = useFirestoreListener(COLLECTIONS.LIVE_RIDES, rideQuery);

  const claimRide = useCallback(
    async (tripId) => {
      const ride = rides.find((r) => r.tripId === tripId || r.id === tripId);
      if (!ride) throw new Error("Ride not found");

      const rawPickup = ride.pickupTime ?? ride.PickupTime;
      const pickupDate = toDateAny(rawPickup);
      const pickupTime =
        rawPickup instanceof Timestamp
          ? rawPickup
          : Timestamp.fromDate(pickupDate || new Date());

      await claimRideAtomic(ride.id || ride.tripId, driver, {
        pickupTime,
        rideDuration: Number(ride.rideDuration ?? ride.RideDuration ?? 0),
      });

      try {
        const email = driverProfile?.email;
        if (email) {
          const record = await getUserAccess(email);
          const phone = record?.phone;
          if (phone) {
            const body = formatClaimSms(ride, pickupTime);
            await enqueueSms({ to: phone, body, context: { tripId: ride.tripId } });
          }
        }
      } catch (err) {
        console.error("Failed to enqueue SMS", err);
      }

      setClaimLog((prev) => [
        ...prev,
        {
          tripId: ride.tripId,
          vehicle: ride.vehicle,
          pickupTime,
          rideDuration: Number(ride.rideDuration ?? ride.RideDuration ?? 0),
          rideType: ride.rideType,
          rideNotes: ride.rideNotes,
          claimedAt: new Date(),
        },
      ]);
      return true;
    },
    [rides, driver, driverProfile],
  );

  const handleClaim = useCallback(
    (id) => {
      claimRide(id);
    },
    [claimRide],
  );

  const rawColumns = useMemo(
    () => [
      dateCol("pickupTime", "Pickup", { minWidth: 180, flex: 1 }),
      { field: "vehicle", headerName: "Vehicle", minWidth: 140, flex: 1 },
      { field: "rideType", headerName: "Type", minWidth: 120 },
      {
        field: "rideDuration",
        headerName: "Duration",
        width: 120,
        valueFormatter: ({ value, api, id }) => {
          if (Number.isFinite(value)) return `${value}m`;
          const row = api.getRow(id);
          const mins = durationMinutes(
            row?.pickupTime,
            row?.endTime ?? row?.dropoffTime,
          );
          return mins == null ? "—" : `${mins}m`;
        },
      },
      { field: "rideNotes", headerName: "Notes", minWidth: 220, flex: 2 },
      {
        field: "actions",
        type: "actions",
        headerName: "Actions",
        minWidth: 120,
        getActions: (params) => [
          <GridActionsCellItem
            key="claim"
            icon={<CheckCircleIcon />}
            label="Claim"
            onClick={() => handleClaim(params.id)}
            showInMenu={false}
          />,
        ],
      },
    ],
    [handleClaim],
  );

  const columns = useMemo(() => withSafeColumns(rawColumns), [rawColumns]);

  useGridDoctor({ name: "RideClaimTab", rows, columns });

  useEffect(() => {
    if (rows?.[0]) console.debug("claim rows sample", rows[0]);
  }, [rows, columns]);

  // ✅ Update rides from shared hook
  useEffect(() => {
    if (driver && !isLockedOut) {
      setRides(liveRides);
      setLoadingRides(false);
    }
  }, [driver, isLockedOut, liveRides]);

  const soonMins = 30;
  const getRowClassName = (params) => {
    const minutesUntil = Math.floor(
      (new Date(params.row.pickupTime) - Date.now()) / 60000,
    );
    return minutesUntil >= 0 && minutesUntil <= soonMins
      ? "lrp-row-soon"
      : "";
  };

  const selectedSet = useMemo(
    () => new Set(selectionModel ?? []),
    [selectionModel],
  );
  const selectedCount = selectedSet.size;
  const selectedMinutes = useMemo(
    () =>
      rows.reduce(
        (sum, r) => sum + (selectedSet.has(r.id) ? r.rideDuration || 0 : 0),
        0,
      ),
    [rows, selectedSet],
  );
  const pinnedRows = useMemo(
    () => [
      {
        id: "__summary__",
        vehicle: "Selected",
        rideType: "",
        rideNotes: `${selectedCount} ride(s) selected`,
        rideDuration: selectedMinutes,
        pickupTime: null,
      },
    ],
    [selectedCount, selectedMinutes],
  );

  // Group rides by date first, then vehicle for a tree view
  const rowGroupingModel = useMemo(() => ["timeBucket", "vehicle"], []);

  const onBulkClaim = useCallback(async () => {
    for (const id of selectionModel) {
      try {
        await claimRide(id);
      } catch (e) {
        console.error("Bulk claim failed", e);
      }
    }
    setSelectionModel([]);
    showToast("✅ Claimed selected rides", "success");
  }, [selectionModel, claimRide]);

  return (
    <Box position="relative">
      {isLockedOut && (
        <BlackoutOverlay
          isAdmin={isAdmin}
          isLocked={isLockedOut}
          onUnlock={() => showToast("🔥 Real-time updates active", "info")}
        />
      )}

      <Box
        display="flex"
        gap={2}
        mb={2}
        flexDirection={isMobile ? "column" : "row"}
      >
        <TextField
          select
          label="Day"
          size="small"
          value={dayFilter}
          onChange={(e) => setDayFilter(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <CalendarTodayIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 160, flex: isMobile ? 1 : "inherit" }}
        >
          <MenuItem value="">All</MenuItem>
          {[
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ].map((d) => (
            <MenuItem key={d} value={d}>
              {d}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Vehicle"
          size="small"
          value={vehicleFilter}
          onChange={(e) => setVehicleFilter(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <DirectionsCarIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 160, flex: isMobile ? 1 : "inherit" }}
        >
          <MenuItem value="">All</MenuItem>
          {uniqueVehicles.map((v) => (
            <MenuItem key={v} value={v}>
              {v}
            </MenuItem>
          ))}
        </TextField>
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          slotProps={{ textField: { size: "small", fullWidth: isMobile } }}
        />

        <Button
          variant="outlined"
          color="primary"
          startIcon={
            loadingRides ? <CircularProgress size={16} /> : <RefreshIcon />
          }
          onClick={() => showToast("🔥 Real-time updates active", "info")}
          disabled={loadingRides}
          sx={{ alignSelf: isMobile ? "stretch" : "center" }}
        >
          Refresh
        </Button>
      </Box>

      {isMobile ? (
        loadingRides ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight={200}
          >
            <Typography variant="body1" color="text.secondary" mr={2}>
              Loading rides...
            </Typography>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <>
            {Object.entries(groupedRides).map(([gKey, rides]) => {
              const [vehicle, day] = gKey.split("___");
              if (
                (vehicleFilter && vehicle !== vehicleFilter) ||
                (dayFilter && day !== dayFilter)
              )
                return null;

              return (
                <RideGroup
                  key={gKey}
                  groupKey={gKey}
                  rides={rides}
                  onClaim={claimRide}
                  showToast={showToast}
                  selectedRides={selectedRides}
                  onToggleSelect={toggleRideSelection}
                  onGroupToggle={toggleGroupSelection}
                  onClearSelected={clearSelections}
                />
              );
            })}

            {Object.keys(groupedRides).length === 0 && (
              <Typography
                variant="body1"
                color="text.secondary"
                textAlign="center"
                mt={5}
              >
                🚫 No unclaimed rides available right now.
              </Typography>
            )}
          </>
        )
      ) : (
        <Box
          sx={{
            height: 600,
            width: "100%",
            "& .lrp-row-soon": (theme) => ({
              background:
                theme.palette.mode === "dark"
                  ? "rgba(76,187,23,0.08)"
                  : "rgba(76,187,23,0.12)",
            }),
            "& .MuiDataGrid-cell": {
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            },
          }}
        >
          <DataGridPro
            rows={rows ?? []}
            columns={columns}
            loading={loadingRides}
            checkboxSelection
            disableRowSelectionOnClick
            autoHeight={false}
            density="compact"
            rowGroupingModel={rowGroupingModel}
            groupingColDef={{
              headerName: "Date / Vehicle",
              minWidth: 220,
              valueFormatter: (params) =>
                params?.rowNode?.groupingField === "timeBucket"
                  ? fmtDate(params?.value)
                  : params?.value ?? "—",
            }}
            initialState={{
              sorting: { sortModel: [{ field: "pickupTime", sort: "asc" }] },
              columns: { columnVisibilityModel: { rideNotes: !isMobile } },
            }}
            onRowSelectionModelChange={(m) => setSelectionModel(asArray(m))}
            rowSelectionModel={selectionModel ?? []}
            slots={{ toolbar: ProToolbar }}
            slotProps={{ toolbar: { onBulkClaim, selectedCount } }}
            getRowClassName={getRowClassName}
            pinnedRows={{ bottom: pinnedRows }}
            sx={{ borderRadius: 2 }}
            getRowId={(r) => r.id ?? r.ticketId ?? r._id}
          />
        </Box>
      )}

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ ...toast, open: false })}
      >
        <Alert severity={toast.severity} variant="filled">
          {toast.message}
        </Alert>
      </Snackbar>

      {claimLog.length > 0 && (
        <Box mt={4} data-testid="claim-log">
          {claimLog.map((entry, idx) => (
            <Box key={idx} mb={3}>
              <Typography>Trip ID: {entry.tripId}</Typography>
              <Typography>Vehicle: {safe(entry.vehicle)}</Typography>
              <Typography>
                Date/Time: {fmtDate(entry.pickupTime)} {fmtTime(entry.pickupTime)}
              </Typography>
              <Typography>
                Duration: {
                  (() => {
                    const m = durationMinutes(
                      entry.pickupTime,
                      entry.pickupTime + entry.rideDuration * 60000,
                    );
                    return m == null ? "—" : `${m}m`;
                  })()
                }
              </Typography>
              <Typography>Trip Type: {safe(entry.rideType)}</Typography>
              <Typography>
                Trip Notes: {safe(entry.rideNotes, "none")}
              </Typography>
              <Typography mt={2}>
                Claimed At: {fmtDate(entry.claimedAt)} {fmtTime(entry.claimedAt)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default RideClaimTab;
