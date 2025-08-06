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
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import { motion } from "framer-motion";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useAuth } from "../context/AuthContext.jsx";
import { TIMEZONE } from "../constants";
import { updateRide } from "../hooks/api";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);
import {
  normalizeDate,
  normalizeTime,
  parseDuration,
  formatDuration,
} from "../utils/timeUtils";

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
  sheetName = "RideQueue",
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
    (row) => {
      const parsed = parseDuration(row?.RideDuration || "");
      const rawTime = dayjs(
        `2000-01-01 ${row?.PickupTime}`,
        "YYYY-MM-DD h:mm A",
      );
      const time24 = rawTime.isValid() ? rawTime.format("HH:mm") : "";
      const rawDate = dayjs(row?.Date, ["MM/DD/YYYY", "YYYY-MM-DD"]);
      const dateISO = rawDate.isValid() ? rawDate.format("YYYY-MM-DD") : "";

      setEditedRow({
        ...row,
        PickupTime: time24,
        Date: dateISO,
        DurationHours: parsed.hours,
        DurationMinutes: parsed.minutes,
      });

      setEditMode(true);
    },
    [setEditedRow, setEditMode],
  );

  const { user } = useAuth();
  const currentUser = user?.email || "Unknown";

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

    const finalDuration = formatDuration(
      editedRow.DurationHours,
      editedRow.DurationMinutes,
    );
    const formattedTime = dayjs(
      `2000-01-01 ${editedRow.PickupTime}`,
      "YYYY-MM-DD HH:mm",
    )
      .tz(TIMEZONE)
      .format("h:mm A");
    const formattedDate = dayjs(editedRow.Date).format("MM/DD/YYYY");

    const payload = {
      Date: formattedDate,
      PickupTime: formattedTime,
      RideDuration: finalDuration,
      RideType: editedRow.RideType,
      Vehicle: editedRow.Vehicle,
      RideNotes: editedRow.RideNotes,
      LastModifiedBy: currentUser,
    };

    const hasChanges = Object.entries(payload).some(([key, newVal]) => {
      const originalVal =
        key === "RideDuration"
          ? selectedRow[key]
          : selectedRow[key]?.toString().trim();
      return newVal !== originalVal;
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
      const result = await updateRide(editedRow.id, payload, sheetName);
      if (!result.success) throw new Error(result.message || "Update failed");

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
        renderCell: (params) => (
          <Tooltip title={params.value}>
            <Box display="flex" alignItems="center" gap={1}>
              {params.value}
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
      {isMobile && (
        <Box textAlign="center" py={1} bgcolor="#fff3cd" color="#856404">
          👉 Swipe horizontally to view more columns
        </Box>
      )}

      <Box sx={{ width: "100%", overflowX: "auto" }}>
        <DataGrid
          getRowId={(row) => row.id}
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
          getRowClassName={(params) => (params.row.fading ? "fade-out" : "")}
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
