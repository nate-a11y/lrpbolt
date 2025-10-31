/* Proprietary and confidential. See LICENSE. */
import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  Box,
  Stack,
  TextField,
  Typography,
  Alert,
  Pagination,
  Chip,
  Button,
  Menu,
  MenuItem,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

import { exportToCSV, exportAllAsVCard } from "../utils/exportContacts";

import ContactCard from "@/components/escalation/ContactCard.jsx";
import EmptyState from "@/components/escalation/EmptyState.jsx";

const fallbackContacts = [
  {
    name: "Jim Brentlinger (LRP1)",
    phone: "573.353.2849",
    email: "Jim@lakeridepros.com",
    responsibilities: [
      "Trip issues (larger vehicles)",
      "Vehicle issues, schedule issues",
      "Incident reporting",
      "Payroll (including direct deposit or deductions)",
      "Commercial insurance questions",
      "Permit questions (Lake Ozark, Osage Beach, Camdenton, Eldon, Jeff City)",
      "Quote questions for larger vehicles",
    ],
  },
  {
    name: "Nate Bullock (LRP2)",
    phone: "417.380.8853",
    email: "Nate@lakeridepros.com",
    responsibilities: [
      "Moovs issues (driver or backend)",
      "Claim Portal / Tech support",
      "Website & logo support",
      "Schedule issues",
      "Passenger incident follow-ups",
      "Payment or closeout note issues",
      "Quote questions for larger vehicles",
    ],
  },
  {
    name: "Michael Brandt (LRP3)",
    phone: "573.286.9110",
    email: "Michael@lakeridepros.com",
    responsibilities: [
      "Social Media / Promotions",
      "Insider memberships",
      "Schedule issues",
      "Apparel, branding, and business cards",
      "Advertising partnerships or referrals",
      "Passenger experience issues",
      "Quote questions for larger vehicles",
    ],
  },
];

function normalizeContacts(input = []) {
  return input.map((r, idx) => {
    const id =
      r?.id ||
      r?.contactId ||
      r?.uid ||
      (r?.email ? `email:${r.email}` : null) ||
      (r?.phone ? `phone:${String(r.phone).replace(/[^\d+]/g, "")}` : null) ||
      `row-${idx}`;

    let responsibilities = r?.responsibilities;
    if (typeof responsibilities === "string") {
      responsibilities = responsibilities
        .split(/\r?\n|,/g)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (!Array.isArray(responsibilities)) responsibilities = [];

    return {
      id,
      name: r?.name || r?.displayName || "N/A",
      roleLabel: r?.roleLabel || r?.role || "",
      phone: r?.phone || r?.phoneNumber || "",
      email: r?.email || r?.emailAddress || "",
      responsibilities,
    };
  });
}

export default function EscalationGuide(props = {}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const searchInputRef = useRef(null);
  const pageSize = 6; // Show 6 contacts per page

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(handle);
  }, [query]);

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

  const rowsSource =
    Array.isArray(props?.rows) && props.rows.length
      ? props.rows
      : fallbackContacts;

  const contacts = useMemo(() => normalizeContacts(rowsSource), [rowsSource]);

  // Extract common responsibility categories
  const responsibilityCategories = useMemo(() => {
    const categories = new Set();
    const keywords = [
      "Trip issues",
      "Vehicle issues",
      "Schedule issues",
      "Payroll",
      "Insurance",
      "Permits",
      "Tech support",
      "Website",
      "Moovs",
      "Social Media",
      "Apparel",
      "Passenger",
      "Incident",
    ];

    contacts.forEach((contact) => {
      if (Array.isArray(contact?.responsibilities)) {
        contact.responsibilities.forEach((resp) => {
          keywords.forEach((keyword) => {
            if (resp.toLowerCase().includes(keyword.toLowerCase())) {
              categories.add(keyword);
            }
          });
        });
      }
    });

    return Array.from(categories).sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    let result = contacts;

    // Apply search filter
    const q = debounced.trim().toLowerCase();
    if (q) {
      result = result.filter((c) => {
        const hay = [
          c?.name,
          c?.email,
          c?.phone,
          ...(Array.isArray(c?.responsibilities) ? c.responsibilities : []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    // Apply category filter
    if (selectedCategory) {
      result = result.filter((c) => {
        if (!Array.isArray(c?.responsibilities)) return false;
        return c.responsibilities.some((resp) =>
          resp.toLowerCase().includes(selectedCategory.toLowerCase()),
        );
      });
    }

    return result;
  }, [contacts, debounced, selectedCategory]);

  // Paginate contacts
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedContacts = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, page, pageSize]);

  // Reset page when search or filters change
  useEffect(() => {
    setPage(1);
  }, [debounced, selectedCategory]);

  const handleCategoryFilter = (category) => {
    setSelectedCategory((prev) => (prev === category ? null : category));
  };

  const clearAllFilters = () => {
    setQuery("");
    setSelectedCategory(null);
    setPage(1);
  };

  const hasActiveFilters = Boolean(query.trim() || selectedCategory);

  // Export handlers
  const handleExportClick = useCallback((event) => {
    setExportMenuAnchor(event.currentTarget);
  }, []);

  const handleExportClose = useCallback(() => {
    setExportMenuAnchor(null);
  }, []);

  const handleExportCSV = useCallback(() => {
    exportToCSV(filtered, "escalation-contacts.csv");
    handleExportClose();
  }, [filtered, handleExportClose]);

  const handleExportVCard = useCallback(() => {
    exportAllAsVCard(filtered, "escalation-contacts.vcf");
    handleExportClose();
  }, [filtered, handleExportClose]);

  const loading = Boolean(props?.loading);
  const error = props?.error ?? null;
  const showHeading = props?.showHeading !== false;
  const sxProp = props?.sx ?? null;

  const baseSx = useMemo(
    () => ({
      px: { xs: 1.5, sm: 2, md: 3 },
      py: { xs: 2, md: 3 },
      maxWidth: 960,
      mx: "auto",
    }),
    [],
  );

  const mergedSx = useMemo(() => {
    if (Array.isArray(sxProp)) {
      return [baseSx, ...sxProp];
    }
    if (sxProp) {
      return [baseSx, sxProp];
    }
    return [baseSx];
  }, [baseSx, sxProp]);

  return (
    <Box sx={mergedSx}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}
      >
        {showHeading ? (
          <Typography
            variant="h5"
            sx={{ color: (t) => t.palette.primary.main }}
          >
            Who to Contact & When
          </Typography>
        ) : null}

        {/* Export button */}
        <Button
          variant="outlined"
          size="small"
          startIcon={<FileDownloadIcon />}
          onClick={handleExportClick}
          disabled={filtered.length === 0}
          sx={{
            textTransform: "none",
            fontWeight: 600,
          }}
        >
          Export ({filtered.length})
        </Button>
      </Stack>

      <TextField
        fullWidth
        placeholder="Search by name, phone, email, or responsibility… (Ctrl/Cmd+K)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        size="small"
        sx={{ mb: 2 }}
        inputRef={searchInputRef}
        inputProps={{ "aria-label": "Search contacts" }}
      />

      {/* Filter chips */}
      {responsibilityCategories.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <FilterListIcon
              sx={{ fontSize: 18, color: (t) => t.palette.text.secondary }}
            />
            <Typography
              variant="caption"
              sx={{ opacity: 0.7, fontWeight: 700 }}
            >
              FILTER BY RESPONSIBILITY:
            </Typography>
          </Stack>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ flexWrap: "wrap", gap: 0.75 }}
          >
            {responsibilityCategories.map((category) => (
              <Chip
                key={category}
                label={category}
                size="small"
                onClick={() => handleCategoryFilter(category)}
                color={selectedCategory === category ? "success" : "default"}
                variant={selectedCategory === category ? "filled" : "outlined"}
                sx={{
                  fontSize: "0.75rem",
                  height: 26,
                  "& .MuiChip-label": { px: 1.5 },
                }}
              />
            ))}
          </Stack>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <Box sx={{ mt: 1 }}>
              <Chip
                label="Clear All Filters"
                size="small"
                onDelete={clearAllFilters}
                color="error"
                variant="outlined"
                sx={{
                  fontSize: "0.75rem",
                  height: 26,
                  "& .MuiChip-label": { px: 1.5 },
                }}
              />
            </Box>
          )}
        </Box>
      )}

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {String(error)}
        </Alert>
      ) : null}

      {loading ? (
        <Typography sx={{ opacity: 0.8 }}>Loading…</Typography>
      ) : filtered.length ? (
        <>
          <Typography variant="body2" sx={{ opacity: 0.7, mb: 2 }}>
            Showing {paginatedContacts.length} of {filtered.length} contact
            {filtered.length === 1 ? "" : "s"}
            {query &&
              ` matching "${query.length > 30 ? query.substring(0, 30) + "…" : query}"`}
          </Typography>
          <Stack spacing={2}>
            {paginatedContacts.map((c) => (
              <ContactCard
                key={c.id || c.email || c.phone || c.name}
                contact={c}
              />
            ))}
          </Stack>

          {/* Pagination */}
          {totalPages > 1 && (
            <Stack
              direction="row"
              justifyContent="center"
              sx={{ mt: 3, mb: 1 }}
            >
              <Pagination
                count={totalPages}
                page={page}
                onChange={(event, value) => {
                  setPage(value);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                color="primary"
                size="large"
                showFirstButton
                showLastButton
              />
            </Stack>
          )}
        </>
      ) : (
        <EmptyState onClear={() => setQuery("")} />
      )}

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
