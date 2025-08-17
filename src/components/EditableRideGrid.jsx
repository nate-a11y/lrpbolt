/* Proprietary and confidential. See LICENSE. */
import React, { useState, useMemo, useCallback } from "react";
import {
  DataGrid,
  GridActionsCellItem,
  GridToolbarContainer,
  GridToolbarColumnsButton,
} from "@mui/x-data-grid";
import {
  Box,
  MenuItem,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  TextField,
  Button,
  FormHelperText,
  FormControl,
  Tooltip,
  Grid,
  Snackbar,
  Alert,
  CircularProgress,
  IconButton,
  Stack,
  Paper,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import { motion } from "framer-motion";
import useMediaQuery from "@mui/material/useMediaQuery";
import { TIMEZONE, COLLECTIONS } from "../constants";
import { patchRide } from "../services/rides";
import useAuth from "../hooks/useAuth.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { logError } from "../utils/logError";

dayjs.extend(utc);
dayjs.extend(timezone);
import { parseDuration } from "../utils/timeUtils";

const vehicleOptions = [
  "LRPBus - Limo Bus",
  "LRPSHU - Shuttle",
  "LRPSPR - Sprinter",
  "LRPSQD - Rescue Squad",
];
const rideTypeOptions = ["P2P", "Round-Trip", "Hourly"];

const EditableRideGrid = ({
  rows,
  onDelete,
  loading = false,
  refreshRides,
  collectionName = COLLECTIONS.RIDE_QUEUE,
  onSave,
}) => {
  const isMobile = useMediaQuery("(max-width:600px)");
  const [columnVisibilityModel, setColumnVisibilityModel] = useState({});
  const [selectedRow, setSelectedRow] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedRow, setEditedRow] = useState(null);
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const logoUrl =
    "https://lakeridepros.xyz/Color%20logo%20-%20no%20background.png";

  const handleStartEdit = useCallback(
    (row = {}) => {
      // Use raw Firestore values when available to avoid parsing issues
      const pickup = dayjs(row.pickupTime || row.PickupTime, [
        dayjs.ISO_8601,
        "YYYY-MM-DD h:mm A",
      ]);
      const time24 = pickup.isValid()
        ? pickup.tz(TIMEZONE).format("HH:mm")
        : "";
      const dateISO = pickup.isValid()
        ? pickup.tz(TIMEZONE).format("YYYY-MM-DD")
        : "";

      // Prefer numeric duration minutes, fall back to formatted string
      const minutes = typeof row.rideDuration === "number" ? row.rideDuration : 0;
      const dur = minutes
        ? { hours: Math.floor(minutes / 60), minutes: minutes % 60 }
        : parseDuration(row?.RideDuration || "");

      setSelectedRow(row);
      setEditedRow({
        ...row,
        PickupTime: time24,
        Date: dateISO,
        DurationHours: dur.hours,
        DurationMinutes: dur.minutes,
        RideNotes: row.RideNotes === "N/A" ? "" : row.RideNotes,
      });

      setEditMode(true);
    },
    [setEditedRow, setEditMode],
  );

  const { user } = useAuth();

  const validationErrors = useMemo(() => {
    if (!editedRow) return {};
    const errors = {};
    ["TripID", "Date", "PickupTime", "RideType", "Vehicle"].forEach((field) => {
      if (!editedRow[field] || editedRow[field].toString().trim() === "") {
        errors[field] = "Required";
      }
    });
    return errors;
  }, [editedRow]);

  const isValid = Object.keys(validationErrors).length === 0;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);

    const rideDurationMinutes =
      parseInt(editedRow.DurationHours || 0, 10) * 60 +
      parseInt(editedRow.DurationMinutes || 0, 10);

    const pickup = dayjs(
      `${editedRow.Date} ${editedRow.PickupTime}`,
      "YYYY-MM-DD HH:mm",
    ).tz(TIMEZONE);

    const patch = {
      tripId: editedRow.TripID,
      pickupTime: pickup.isValid() ? pickup.toDate() : null,
      rideDuration: rideDurationMinutes,
      rideType: editedRow.RideType,
      vehicle: editedRow.Vehicle,
      rideNotes: editedRow.RideNotes,
    };

    const hasChanges = Object.entries(patch).some(([key, newVal]) => {
      const originalVal = selectedRow[key];
      if (newVal instanceof Date && originalVal instanceof Date) {
        return newVal.getTime() !== originalVal.getTime();
      }
      return newVal !== (originalVal ?? null);
    });

    if (!hasChanges) {
      setSnack({
        open: true,
        message: "⚠️ No changes to save.",
        severity: "info",
      });
      setSaving(false);
      return;
    }

    try {
      if (onSave) {
        await onSave(editedRow.id, patch);
      } else {
        await patchRide(
          collectionName,
          editedRow.id,
          patch,
          user?.email || "Unknown",
        );
      }

      setSnack({
        open: true,
        message: "✅ Ride updated successfully.",
        severity: "success",
      });
      setSelectedRow(null);
      setEditMode(false);
      if (refreshRides) {
        refreshRides();
      }
    } catch (err) {
      logError(err, "EditableRideGrid:updateRide");
      setSnack({
        open: true,
        message: `❌ ${err?.message || JSON.stringify(err)}`,
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        field: "TripID",
        headerName: "Trip ID",
        minWidth: 120,
        flex: 1,
        renderCell: (params = {}) => (
          <Tooltip title={params?.value}>
            <Box display="flex" alignItems="center" gap={1}>
              {params?.value}
              <Tooltip title="Click row to view ride details">
                <InfoOutlinedIcon fontSize="small" color="action" />
              </Tooltip>
            </Box>
          </Tooltip>
        ),
      },
      { field: "Date", headerName: "Date", minWidth: 110, flex: 1 },
      {
        field: "PickupTime",
        headerName: "Pickup Time",
        minWidth: 100,
        flex: 1,
      },
      { field: "RideDuration", headerName: "Duration", minWidth: 100, flex: 1 },
      { field: "RideType", headerName: "Ride Type", minWidth: 120, flex: 1 },
      { field: "Vehicle", headerName: "Vehicle", minWidth: 150, flex: 1.5 },
      { field: "RideNotes", headerName: "Notes", minWidth: 180, flex: 2 },
      { field: "CreatedBy", headerName: "Created By", minWidth: 140, flex: 1 },
      {
        field: "LastModifiedBy",
        headerName: "Modified By",
        minWidth: 140,
        flex: 1,
      },
      {
        field: "actions",
        type: "actions",
        width: 80,
        getActions: (params) => [
          <GridActionsCellItem
            key="edit"
            icon={<EditIcon />}
            label="Edit"
            onClick={() => {
              setSelectedRow(params.row);
              handleStartEdit(params.row);
            }}
          />,
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon />}
            label="Delete"
            onClick={() => onDelete(params.row.id)}
          />,
        ],
      },
    ],
    [setSelectedRow, handleStartEdit, onDelete],
  );

  const CustomToolbar = () => (
    <GridToolbarContainer sx={{ justifyContent: "space-between", px: 1 }}>
      <GridToolbarColumnsButton />
        <Tooltip title="Reload ride data from Google Sheets">
          <span>
            <Button
              onClick={refreshRides}
              disabled={loading}
              variant="outlined"
              color="primary"
              size="small"
              startIcon={
                loading ? (
                  <CircularProgress size={16} sx={{ color: "inherit" }} />
                ) : (
                  <RefreshIcon />
                )
              }
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </span>
        </Tooltip>
    </GridToolbarContainer>
  );

  return (
    <>
      {isMobile ? (
        <>
          <Box textAlign="right" mb={1}>
            <Button
              onClick={refreshRides}
              disabled={loading}
              variant="outlined"
              size="small"
              startIcon={
                loading ? (
                  <CircularProgress size={16} sx={{ color: "inherit" }} />
                ) : (
                  <RefreshIcon />
                )
              }
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </Box>
          <Stack spacing={2}>
            {rows.map((row) => (
              <Paper
                key={row.id}
                variant="outlined"
                sx={{ p: 2 }}
                className={row.fading ? "fade-out" : ""}
              >
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="flex-start"
                >
                  <Box>
                    <Typography variant="subtitle2">{row.TripID}</Typography>
                    <Typography variant="body2">Date: {row.Date}</Typography>
                    <Typography variant="body2">
                      Pickup: {row.PickupTime}
                    </Typography>
                    <Typography variant="body2">
                      Duration: {row.RideDuration}
                    </Typography>
                    <Typography variant="body2">Type: {row.RideType}</Typography>
                    <Typography variant="body2">
                      Vehicle: {row.Vehicle}
                    </Typography>
                    {row.RideNotes && (
                      <Typography variant="body2">
                        Notes: {row.RideNotes}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedRow(row);
                        handleStartEdit(row);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => onDelete(row.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Box>
              </Paper>
            ))}
          </Stack>
        </>
      ) : (
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <DataGrid
            getRowId={(row) => row?.id}
            rows={rows}
            columns={columns}
            autoHeight
            pageSize={5}
            loading={loading}
            disableRowSelectionOnClick
            onRowClick={(params) => {
              setEditMode(false); // just in case
              setSelectedRow(params.row);
              setViewMode(true);
            }}
            columnVisibilityModel={columnVisibilityModel}
            onColumnVisibilityModelChange={setColumnVisibilityModel}
            components={{ Toolbar: CustomToolbar }}
            getRowClassName={(params = {}) => (params?.row?.fading ? "fade-out" : "")}
            sx={{
              "& .MuiDataGrid-columnHeaders": {
                position: "sticky",
                top: 0,
                zIndex: 1,
                bgcolor: "background.paper",
              },
            }}
          />
        </Box>
      )}

      <style>
        {`
          @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; transform: scale(0.98); }
          }
          .fade-out {
            animation: fadeOut 0.4s ease-in-out forwards;
          }
        `}
      </style>

      <Dialog
        open={editMode}
        onClose={() => {
          setEditMode(false);
          setEditedRow(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          Ride Details
          <motion.img
            src={logoUrl}
            alt="Lake Ride Pros Logo"
            initial={{ scale: 0.5, opacity: 0, rotate: -15 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 12,
              delay: 0.2,
            }}
            style={{
              height: 32,
              marginLeft: "8px",
              filter: "drop-shadow(0 0 2px rgba(0,0,0,0.4))",
            }}
          />
        </DialogTitle>

        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                label="Date"
                type="date"
                fullWidth
                name="Date"
                value={editedRow?.Date || ""}
                onChange={(e) =>
                  setEditedRow({ ...editedRow, Date: e.target.value })
                }
                InputLabelProps={{ shrink: true }}
                error={!!validationErrors.Date}
                helperText={validationErrors.Date}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Pickup Time"
                type="time"
                fullWidth
                name="PickupTime"
                value={editedRow?.PickupTime || ""}
                onChange={(e) =>
                  setEditedRow({ ...editedRow, PickupTime: e.target.value })
                }
                InputLabelProps={{ shrink: true }}
                error={!!validationErrors.PickupTime}
                helperText={validationErrors.PickupTime}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Hours"
                type="number"
                fullWidth
                value={editedRow?.DurationHours || ""}
                onChange={(e) =>
                  setEditedRow({ ...editedRow, DurationHours: e.target.value })
                }
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Minutes"
                type="number"
                fullWidth
                value={editedRow?.DurationMinutes || ""}
                onChange={(e) =>
                  setEditedRow({
                    ...editedRow,
                    DurationMinutes: e.target.value,
                  })
                }
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth error={!!validationErrors.RideType}>
                <Select
                  value={editedRow?.RideType || ""}
                  onChange={(e) =>
                    setEditedRow({ ...editedRow, RideType: e.target.value })
                  }
                  displayEmpty
                >
                  <MenuItem value="" disabled>
                    Select Ride Type
                  </MenuItem>
                  {rideTypeOptions.map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {opt}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>{validationErrors.RideType}</FormHelperText>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth error={!!validationErrors.Vehicle}>
                <Select
                  value={editedRow?.Vehicle || ""}
                  onChange={(e) =>
                    setEditedRow({ ...editedRow, Vehicle: e.target.value })
                  }
                  displayEmpty
                >
                  <MenuItem value="" disabled>
                    Select Vehicle
                  </MenuItem>
                  {vehicleOptions.map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {opt}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>{validationErrors.Vehicle}</FormHelperText>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Ride Notes"
                fullWidth
                multiline
                rows={2}
                value={editedRow?.RideNotes || ""}
                onChange={(e) =>
                  setEditedRow({ ...editedRow, RideNotes: e.target.value })
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditMode(false);
              setEditedRow(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            color="primary"
            disabled={!isValid || saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={viewMode}
        onClose={() => setViewMode(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          Ride Details
          <motion.img
            src={logoUrl}
            alt="Lake Ride Pros Logo"
            initial={{ scale: 0.5, opacity: 0, rotate: -15 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 12,
              delay: 0.2,
            }}
            style={{
              height: 32,
              marginLeft: "8px",
              filter: "drop-shadow(0 0 2px rgba(0,0,0,0.4))",
            }}
          />
        </DialogTitle>

        <DialogContent dividers>
          {selectedRow ? (
            <Box>
              <Typography>
                <strong>Trip ID:</strong>{" "}
                <span style={{ color: "limegreen", fontWeight: 600 }}>
                  {selectedRow.TripID}
                </span>
              </Typography>

              <Typography>
                <strong>Date:</strong> {selectedRow.Date}
              </Typography>
              <Typography>
                <strong>Pickup Time:</strong> {selectedRow.PickupTime}
              </Typography>
              <Typography>
                <strong>Duration:</strong> {selectedRow.RideDuration}
              </Typography>
              <Typography>
                <strong>Ride Type:</strong> {selectedRow.RideType}
              </Typography>
              <Typography>
                <strong>Vehicle:</strong> {selectedRow.Vehicle}
              </Typography>
              <Typography>
                <strong>Notes:</strong> {selectedRow.RideNotes}
              </Typography>
              <Typography>
                <strong>Created By:</strong> {selectedRow.CreatedBy}
              </Typography>
              <Typography>
                <strong>Last Modified By:</strong> {selectedRow.LastModifiedBy}
              </Typography>
            </Box>
          ) : (
            <Typography>No ride selected</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button onClick={() => setViewMode(false)}>Close</Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={() => {
                handleStartEdit(selectedRow);
                setViewMode(false);
              }}
              variant="contained"
              color="primary"
            >
              Edit
            </Button>
          </motion.div>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={(event, reason) => {
          if (reason !== "clickaway") {
            setSnack({ ...snack, open: false });
          }
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity} sx={{ width: "100%" }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default EditableRideGrid;
