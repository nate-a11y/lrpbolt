import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Pagination,
  Stack,
  TextField,
  Typography,
  Chip,
  Button,
  Menu,
  MenuItem,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

import { exportToCSV, exportAllAsVCard } from "../../utils/exportContacts";

/**
 * DriverCardGrid - Container for driver cards with search and pagination
 */
export default function DriverCardGrid({
  drivers = [],
  renderCard,
  searchPlaceholder = "Search name, LRP #, email, vehicle… (Ctrl/Cmd+K)",
  pageSize = 12,
  title = "Driver Directory",
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const searchInputRef = useRef(null);

  // Keyboard shortcut: Ctrl/Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Extract unique vehicles and roles from drivers
  const { vehicleTypes, roles } = useMemo(() => {
    const vehiclesSet = new Set();
    const rolesSet = new Set();

    drivers.forEach((driver) => {
      if (Array.isArray(driver?.vehicles)) {
        driver.vehicles.forEach((v) => vehiclesSet.add(v));
      }
      if (Array.isArray(driver?.roles)) {
        driver.roles.forEach((r) => rolesSet.add(r));
      }
    });

    return {
      vehicleTypes: Array.from(vehiclesSet).sort(),
      roles: Array.from(rolesSet).sort(),
    };
  }, [drivers]);

  // Filter drivers based on search and filters
  const filteredDrivers = useMemo(() => {
    let result = drivers;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((driver) => {
        const searchableText = [
          driver?.name,
          driver?.lrp,
          driver?.email,
          driver?.phone,
          ...(Array.isArray(driver?.vehicles) ? driver.vehicles : []),
          ...(Array.isArray(driver?.roles) ? driver.roles : []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(query);
      });
    }

    // Apply vehicle filter
    if (selectedVehicle) {
      result = result.filter(
        (driver) =>
          Array.isArray(driver?.vehicles) &&
          driver.vehicles.includes(selectedVehicle),
      );
    }

    // Apply role filter
    if (selectedRole) {
      result = result.filter(
        (driver) =>
          Array.isArray(driver?.roles) && driver.roles.includes(selectedRole),
      );
    }

    return result;
  }, [drivers, searchQuery, selectedVehicle, selectedRole]);

  // Paginate drivers
  const totalPages = Math.ceil(filteredDrivers.length / pageSize);
  const paginatedDrivers = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredDrivers.slice(start, end);
  }, [filteredDrivers, page, pageSize]);

  // Reset page when search or filters change
  const handleSearchChange = useCallback((event) => {
    setSearchQuery(event.target.value);
    setPage(1);
  }, []);

  const handlePageChange = useCallback((event, value) => {
    setPage(value);
    // Scroll to top of grid
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleVehicleFilter = useCallback((vehicle) => {
    setSelectedVehicle((prev) => (prev === vehicle ? null : vehicle));
    setPage(1);
  }, []);

  const handleRoleFilter = useCallback((role) => {
    setSelectedRole((prev) => (prev === role ? null : role));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedVehicle(null);
    setSelectedRole(null);
    setSearchQuery("");
    setPage(1);
  }, []);

  const hasActiveFilters = Boolean(
    selectedVehicle || selectedRole || searchQuery.trim(),
  );

  // Export handlers
  const handleExportClick = useCallback((event) => {
    setExportMenuAnchor(event.currentTarget);
  }, []);

  const handleExportClose = useCallback(() => {
    setExportMenuAnchor(null);
  }, []);

  const handleExportCSV = useCallback(() => {
    exportToCSV(filteredDrivers, "driver-directory.csv");
    handleExportClose();
  }, [filteredDrivers, handleExportClose]);

  const handleExportVCard = useCallback(() => {
    exportAllAsVCard(filteredDrivers, "driver-directory.vcf");
    handleExportClose();
  }, [filteredDrivers, handleExportClose]);

  return (
    <Box sx={{ width: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header with search */}
      <Stack spacing={2} sx={{ mb: 2.5 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ flexWrap: "wrap", gap: 1 }}
        >
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

          {/* Export button */}
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownloadIcon />}
            onClick={handleExportClick}
            disabled={filteredDrivers.length === 0}
            sx={{
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            Export ({filteredDrivers.length})
          </Button>
        </Stack>

        <Box
          sx={{
            borderRadius: 2,
            p: 1,
            background: (t) =>
              `linear-gradient(180deg, ${alpha(t.palette.primary.main, 0.15)} 0%, ${alpha(
                t.palette.primary.main,
                0.06,
              )} 100%)`,
            border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.35)}`,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <SearchIcon sx={{ color: (t) => t.palette.primary.main }} />
            <TextField
              variant="standard"
              fullWidth
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder={searchPlaceholder}
              inputRef={searchInputRef}
              InputProps={{
                disableUnderline: true,
                sx: { color: (t) => t.palette.text.primary },
              }}
            />
          </Stack>
        </Box>

        {/* Filter chips */}
        {(vehicleTypes.length > 0 || roles.length > 0) && (
          <Box>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mb: 1 }}
            >
              <FilterListIcon
                sx={{ fontSize: 18, color: (t) => t.palette.text.secondary }}
              />
              <Typography
                variant="caption"
                sx={{ opacity: 0.7, fontWeight: 700 }}
              >
                FILTERS:
              </Typography>
            </Stack>

            {/* Vehicle filters */}
            {vehicleTypes.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography
                  variant="caption"
                  sx={{ opacity: 0.6, display: "block", mb: 0.5 }}
                >
                  Vehicle Types:
                </Typography>
                <Stack
                  direction="row"
                  spacing={0.75}
                  sx={{ flexWrap: "wrap", gap: 0.75 }}
                >
                  {vehicleTypes.map((vehicle) => (
                    <Chip
                      key={vehicle}
                      label={vehicle}
                      size="small"
                      onClick={() => handleVehicleFilter(vehicle)}
                      color={
                        selectedVehicle === vehicle ? "success" : "default"
                      }
                      variant={
                        selectedVehicle === vehicle ? "filled" : "outlined"
                      }
                      sx={{
                        fontSize: "0.75rem",
                        height: 26,
                        "& .MuiChip-label": { px: 1.5 },
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {/* Role filters */}
            {roles.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography
                  variant="caption"
                  sx={{ opacity: 0.6, display: "block", mb: 0.5 }}
                >
                  Roles:
                </Typography>
                <Stack
                  direction="row"
                  spacing={0.75}
                  sx={{ flexWrap: "wrap", gap: 0.75 }}
                >
                  {roles.map((role) => (
                    <Chip
                      key={role}
                      label={role}
                      size="small"
                      onClick={() => handleRoleFilter(role)}
                      color={selectedRole === role ? "success" : "default"}
                      variant={selectedRole === role ? "filled" : "outlined"}
                      sx={{
                        fontSize: "0.75rem",
                        height: 26,
                        "& .MuiChip-label": { px: 1.5 },
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {/* Clear filters button */}
            {hasActiveFilters && (
              <Chip
                label="Clear All Filters"
                size="small"
                onDelete={clearFilters}
                color="error"
                variant="outlined"
                sx={{
                  fontSize: "0.75rem",
                  height: 26,
                  "& .MuiChip-label": { px: 1.5 },
                }}
              />
            )}
          </Box>
        )}

        {/* Result count */}
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          Showing {paginatedDrivers.length} of {filteredDrivers.length} driver
          {filteredDrivers.length === 1 ? "" : "s"}
          {searchQuery &&
            ` matching "${searchQuery.length > 30 ? searchQuery.substring(0, 30) + "…" : searchQuery}"`}
        </Typography>
      </Stack>

      {/* Empty state */}
      {filteredDrivers.length === 0 ? (
        <Box sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="body1" sx={{ opacity: 0.8 }}>
            {searchQuery
              ? "No drivers match your search"
              : "No drivers to display"}
          </Typography>
        </Box>
      ) : null}

      {/* Card grid */}
      {filteredDrivers.length > 0 ? (
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
            {paginatedDrivers.map((driver) =>
              renderCard({
                driver,
                key: driver?.id || driver?.lrp || driver?.email,
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
                showFirstButton
                showLastButton
              />
            </Stack>
          )}
        </>
      ) : null}

      {/* Export menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={handleExportClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        <MenuItem onClick={handleExportCSV}>
          <Stack spacing={1} direction="row" alignItems="center">
            <FileDownloadIcon fontSize="small" />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Export as CSV
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Spreadsheet format
              </Typography>
            </Box>
          </Stack>
        </MenuItem>
        <MenuItem onClick={handleExportVCard}>
          <Stack spacing={1} direction="row" alignItems="center">
            <FileDownloadIcon fontSize="small" />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Export as vCard
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Import to contacts app
              </Typography>
            </Box>
          </Stack>
        </MenuItem>
      </Menu>
    </Box>
  );
}

DriverCardGrid.propTypes = {
  drivers: PropTypes.array,
  renderCard: PropTypes.func.isRequired,
  searchPlaceholder: PropTypes.string,
  pageSize: PropTypes.number,
  title: PropTypes.string,
};
