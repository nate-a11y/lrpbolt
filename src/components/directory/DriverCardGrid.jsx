import { useState, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { Box, Pagination, Stack, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";

/**
 * DriverCardGrid - Container for driver cards with search and pagination
 */
export default function DriverCardGrid({
  drivers = [],
  renderCard,
  searchPlaceholder = "Search name, LRP #, email, vehicle…",
  pageSize = 12,
  title = "Driver Directory",
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  // Filter drivers based on search
  const filteredDrivers = useMemo(() => {
    if (!searchQuery.trim()) return drivers;

    const query = searchQuery.toLowerCase();
    return drivers.filter((driver) => {
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
  }, [drivers, searchQuery]);

  // Paginate drivers
  const totalPages = Math.ceil(filteredDrivers.length / pageSize);
  const paginatedDrivers = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredDrivers.slice(start, end);
  }, [filteredDrivers, page, pageSize]);

  // Reset page when search changes
  const handleSearchChange = useCallback((event) => {
    setSearchQuery(event.target.value);
    setPage(1);
  }, []);

  const handlePageChange = useCallback((event, value) => {
    setPage(value);
    // Scroll to top of grid
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <Box sx={{ width: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header with search */}
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
              InputProps={{
                disableUnderline: true,
                sx: { color: (t) => t.palette.text.primary },
              }}
            />
          </Stack>
        </Box>

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
