import { useMemo, useCallback, useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Link as MuiLink,
} from "@mui/material";

import { IMPORTANT_INFO_CATEGORIES } from "@/constants/importantInfo.js";
import { formatDateTime, toDayjs } from "@/utils/time.js";

function normalizeRows(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && item.isActive !== false)
    .map((item) => {
      const rawCategory = item?.category ? String(item.category) : "";
      const normalizedCategory = IMPORTANT_INFO_CATEGORIES.includes(rawCategory)
        ? rawCategory
        : null;
      return { ...item, _cat: normalizedCategory };
    })
    .filter((item) => item._cat);
}

function ensureString(value) {
  if (value == null) return "";
  return String(value);
}

function toTelHref(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/[^\d+]/g, "");
  if (!digits) return null;
  return `tel:${digits}`;
}

function matchesQuery(row, query) {
  if (!query) return true;
  const haystack = [
    row?.title,
    row?.blurb,
    row?.details,
    row?._cat,
    row?.phone,
    row?.url,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function getUpdatedAtValue(input) {
  const d = toDayjs(input);
  return d ? d.valueOf() : 0;
}

export default function ImportantInfoList({
  items,
  loading,
  onSendSms,
  error,
}) {
  const rows = useMemo(() => normalizeRows(items), [items]);
  const hasRows = rows.length > 0;
  const showError = Boolean(error) && !loading;
  const showEmpty = !showError && !loading && !hasRows;

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState("title");

  const categories = useMemo(() => ["All", ...IMPORTANT_INFO_CATEGORIES], []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const filteredRows = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const safeCategory = IMPORTANT_INFO_CATEGORIES.includes(categoryFilter)
      ? categoryFilter
      : "All";

    const filtered = rows.filter((row) => {
      if (!row) return false;
      if (safeCategory !== "All" && row._cat !== safeCategory) {
        return false;
      }
      return matchesQuery(row, q);
    });

    filtered.sort((a, b) => {
      if (sortBy === "title") {
        return ensureString(a?.title).localeCompare(ensureString(b?.title));
      }
      if (sortBy === "category") {
        const aLabel = ensureString(a?._cat);
        const bLabel = ensureString(b?._cat);
        return aLabel.localeCompare(bLabel);
      }
      const aTs = getUpdatedAtValue(a?.updatedAt);
      const bTs = getUpdatedAtValue(b?.updatedAt);
      return bTs - aTs;
    });

    return filtered;
  }, [rows, debouncedQuery, categoryFilter, sortBy]);

  const handleSendClick = useCallback(
    (row) => {
      if (!row) return;
      onSendSms?.(row);
    },
    [onSendSms],
  );

  if (showError) {
    return (
      <Box sx={{ p: 2, color: "white" }}>
        <Stack
          spacing={1.5}
          sx={{
            bgcolor: "#1a0b0b",
            border: "1px solid #2a1111",
            p: 2,
            borderRadius: 2,
          }}
        >
          <Typography variant="subtitle1" sx={{ color: "#ffb4b4" }}>
            Unable to load important information.
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            If you have admin access, open the Admin tab to add the first item.
          </Typography>
          <Button
            onClick={() => window.location.reload()}
            variant="outlined"
            size="small"
            sx={{
              borderColor: "#4cbb17",
              color: "#b7ffb7",
              width: "fit-content",
            }}
          >
            Refresh
          </Button>
        </Stack>
      </Box>
    );
  }

  if (showEmpty) {
    return (
      <Box sx={{ p: 2, color: "white" }}>
        <Stack
          spacing={1.5}
          sx={{
            bgcolor: "#0b0f0b",
            border: "1px solid #153015",
            p: 2,
            borderRadius: 2,
          }}
        >
          <Typography variant="subtitle1" sx={{ color: "#b7ffb7" }}>
            No important info yet.
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.85 }}>
            Once admins add partners or emergency contacts, they’ll show here
            with quick share buttons.
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 2 }}
    >
      <Stack spacing={1.5} sx={{ mb: 0.5 }}>
        <TextField
          size="small"
          placeholder="Search partners, promotions, or referral details…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          sx={{ maxWidth: { md: 640 }, bgcolor: "#101010" }}
          InputProps={{ sx: { color: "white" } }}
          inputProps={{ "aria-label": "Search important information" }}
        />
      </Stack>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        sx={{ flexWrap: "wrap", gap: { xs: 1, md: 1.5 } }}
      >
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel sx={{ color: "white" }}>Category</InputLabel>
          <Select
            label="Category"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            sx={{ color: "white", bgcolor: "#101010" }}
          >
            {categories.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel sx={{ color: "white" }}>Sort</InputLabel>
          <Select
            label="Sort"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            sx={{ color: "white", bgcolor: "#101010" }}
          >
            <MenuItem value="title">Title (A–Z)</MenuItem>
            <MenuItem value="category">Category (A–Z)</MenuItem>
            <MenuItem value="updated">Updated (newest)</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <Stack spacing={2.5}>
        {loading && !filteredRows.length ? (
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Loading important info…
          </Typography>
        ) : null}

        {safeSections(filteredRows, categoryFilter).map(
          ({ category, items }) => (
            <Box
              key={category}
              sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}
            >
              <Typography variant="h6" sx={{ color: "#b7ffb7" }}>
                {category}
              </Typography>
              <Stack spacing={1.25}>
                {items.map((row) => {
                  const updatedLabel = formatDateTime(row?.updatedAt);
                  const telHref = toTelHref(row?.phone);
                  const fallbackKey = `${row?._cat || "category"}-${ensureString(
                    row?.title,
                  )}-${getUpdatedAtValue(row?.updatedAt)}`;
                  const key = row?.id ?? fallbackKey;

                  return (
                    <Card
                      key={key}
                      variant="outlined"
                      sx={{
                        bgcolor: "#0b0b0b",
                        borderColor: "#1c1c1c",
                        borderRadius: 3,
                      }}
                    >
                      <CardContent sx={{ pb: 1.5 }}>
                        <Stack spacing={1.25}>
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", sm: "center" }}
                          >
                            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                              <Typography
                                variant="subtitle1"
                                sx={{ fontWeight: 700 }}
                                noWrap
                              >
                                {row?.title || "Untitled"}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ opacity: 0.7 }}
                              >
                                Updated {updatedLabel}
                              </Typography>
                            </Stack>
                            <Chip
                              size="small"
                              label={category}
                              sx={{
                                bgcolor: "#143d0a",
                                color: "#b7ffb7",
                                border: "1px solid #4cbb17",
                                fontWeight: 600,
                              }}
                            />
                          </Stack>

                          {row?.blurb ? (
                            <Typography variant="body2" sx={{ opacity: 0.85 }}>
                              {row.blurb}
                            </Typography>
                          ) : null}

                          {row?.details ? (
                            <Box>
                              <Divider sx={{ borderColor: "#222", mb: 1 }} />
                              <Typography
                                variant="body2"
                                sx={{ whiteSpace: "pre-wrap", opacity: 0.85 }}
                              >
                                {row.details}
                              </Typography>
                            </Box>
                          ) : null}

                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                            sx={{ opacity: 0.85 }}
                          >
                            {row?.phone ? (
                              <Typography variant="body2">
                                Phone:{" "}
                                {telHref ? (
                                  <MuiLink
                                    href={telHref}
                                    sx={{ color: "#4cbb17", fontWeight: 600 }}
                                  >
                                    {row.phone}
                                  </MuiLink>
                                ) : (
                                  row.phone
                                )}
                              </Typography>
                            ) : null}
                            {row?.url ? (
                              <Typography variant="body2">
                                Link:{" "}
                                <MuiLink
                                  href={row.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  sx={{ color: "#4cbb17", fontWeight: 600 }}
                                >
                                  View
                                </MuiLink>
                              </Typography>
                            ) : null}
                          </Stack>
                        </Stack>
                      </CardContent>
                      <CardActions
                        sx={{ px: 2, pb: 2, justifyContent: "flex-end" }}
                      >
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleSendClick(row)}
                          sx={{
                            bgcolor: "#4cbb17",
                            fontWeight: 600,
                            "&:hover": { bgcolor: "#3aa40f" },
                          }}
                          aria-label="Text this information to a customer"
                        >
                          Text to Customer
                        </Button>
                      </CardActions>
                    </Card>
                  );
                })}
              </Stack>
            </Box>
          ),
        )}

        {!filteredRows.length ? (
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid #1f1f1f",
              bgcolor: "#0b0b0b",
            }}
          >
            <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
              No matches for your filters.
            </Typography>
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}

function safeSections(rows, categoryFilter) {
  const safeCategory = IMPORTANT_INFO_CATEGORIES.includes(categoryFilter)
    ? categoryFilter
    : "All";
  return IMPORTANT_INFO_CATEGORIES.filter((category) =>
    safeCategory === "All" ? true : category === safeCategory,
  )
    .map((category) => ({
      category,
      items: rows.filter((row) => row._cat === category),
    }))
    .filter((section) => section.items.length > 0);
}

ImportantInfoList.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object),
  loading: PropTypes.bool,
  onSendSms: PropTypes.func,
  error: PropTypes.any,
};
