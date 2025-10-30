import { useState, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import DeleteIcon from "@mui/icons-material/Delete";

/**
 * RideCardGrid - Container for ride cards with search, filters, pagination
 */
export default function RideCardGrid({
  rides = [],
  renderCard,
  loading = false,
  error = null,
  onBulkDelete,
  searchPlaceholder = "Search rides...",
  pageSize = 12,
  title,
  emptyMessage = "No rides to display",
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Filter rides based on search
  const filteredRides = useMemo(() => {
    if (!searchQuery.trim()) return rides;

    const query = searchQuery.toLowerCase();
    return rides.filter((ride) => {
      const searchableText = [
        ride?.id,
        ride?.rideId,
        ride?.tripId,
        ride?.vehicle,
        ride?.vehicleLabel,
        ride?.vehicleName,
        ride?.rideType,
        ride?.type,
        ride?.notes,
        ride?.pickup,
        ride?.dropoff,
        ride?.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [rides, searchQuery]);

  // Paginate rides
  const totalPages = Math.ceil(filteredRides.length / pageSize);
  const paginatedRides = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredRides.slice(start, end);
  }, [filteredRides, page, pageSize]);

  // Reset page when search changes
  const handleSearchChange = useCallback((event) => {
    setSearchQuery(event.target.value);
    setPage(1);
  }, []);

  const handlePageChange = useCallback((event, value) => {
    setPage(value);
  }, []);

  // Selection handlers
  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredRides.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRides.map((r) => r.id)));
    }
  }, [selectedIds.size, filteredRides]);

  const handleSelectRide = useCallback((rideId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rideId)) {
        next.delete(rideId);
      } else {
        next.add(rideId);
      }
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    onBulkDelete?.(Array.from(selectedIds));
    setSelectedIds(new Set());
  }, [selectedIds, onBulkDelete]);

  const allSelected = useMemo(
    () => filteredRides.length > 0 && selectedIds.size === filteredRides.length,
    [filteredRides.length, selectedIds.size],
  );

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Paper
          sx={{
            p: 3,
            bgcolor: (t) => alpha(t.palette.error.main, 0.1),
            border: (t) => `1px solid ${t.palette.error.main}`,
            borderRadius: 2,
          }}
        >
          <Typography variant="subtitle1" color="error">
            Error loading rides
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
            {error.message || "An unexpected error occurred"}
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header with search and bulk actions */}
      <Stack spacing={2} sx={{ mb: 2.5 }}>
        {title && (
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: (t) => alpha(t.palette.primary.main, 0.6),
            }}
          >
            {title}
          </Typography>
        )}

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
        >
          <TextField
            size="small"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={handleSearchChange}
            sx={{
              maxWidth: { sm: 400 },
              bgcolor: (t) => t.palette.background.paper,
            }}
            InputProps={{
              sx: { color: (t) => t.palette.text.primary },
            }}
          />

          <Stack direction="row" spacing={1.5} alignItems="center">
            {onBulkDelete && (
              <>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={allSelected}
                      indeterminate={selectedIds.size > 0 && !allSelected}
                      onChange={handleSelectAll}
                      disabled={filteredRides.length === 0}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      Select All ({selectedIds.size}/{filteredRides.length})
                    </Typography>
                  }
                />
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<DeleteIcon />}
                  onClick={handleBulkDelete}
                  disabled={selectedIds.size === 0}
                >
                  Delete ({selectedIds.size})
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </Stack>

      {/* Loading state */}
      {loading && rides.length === 0 ? (
        <Box sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Loading rides...
          </Typography>
        </Box>
      ) : null}

      {/* Empty state */}
      {!loading && filteredRides.length === 0 ? (
        <Box sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="body1" sx={{ opacity: 0.8 }}>
            {searchQuery ? "No rides match your search" : emptyMessage}
          </Typography>
        </Box>
      ) : null}

      {/* Card grid */}
      {filteredRides.length > 0 ? (
        <>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(auto-fill, minmax(380px, 1fr))",
              },
              gap: 2.5,
              mb: 3,
            }}
          >
            {paginatedRides.map((ride) =>
              renderCard({
                ride,
                selected: selectedIds.has(ride.id),
                onSelect: () => handleSelectRide(ride.id),
              }),
            )}
          </Box>

          {/* Pagination */}
          {totalPages > 1 && (
            <Stack
              direction="row"
              justifyContent="center"
              sx={{ mt: 2, mb: 2 }}
            >
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
                size="large"
              />
            </Stack>
          )}
        </>
      ) : null}
    </Box>
  );
}

RideCardGrid.propTypes = {
  rides: PropTypes.array,
  renderCard: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.object,
  onBulkDelete: PropTypes.func,
  searchPlaceholder: PropTypes.string,
  pageSize: PropTypes.number,
  title: PropTypes.string,
  emptyMessage: PropTypes.string,
};
