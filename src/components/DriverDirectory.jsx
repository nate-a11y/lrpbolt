/* Proprietary and confidential. See LICENSE. */
// src/components/DriverDirectoryProListView.jsx
import * as React from "react";
import {
  Box,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Avatar,
  ButtonGroup,
  Button,
} from "@mui/material";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import SmsIcon from "@mui/icons-material/Sms";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import SearchIcon from "@mui/icons-material/Search";
import { DataGridPro, GridToolbar } from "@mui/x-data-grid-pro";

import DRIVER_LIST from "../data/driverDirectory";
import VehicleChip from "./VehicleChip";

// ---- helpers -------------------------------------------------
function getInitials(name = "") {
  const parts = String(name).trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.at(-1)?.[0] ?? "")).toUpperCase();
}
function normalizePhone(phone = "") {
  const trimmed = String(phone).trim();
  const keepPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  return keepPlus ? `+${digits}` : digits;
}
function smsHref(phone = "") {
  const p = normalizePhone(phone);
  return `sms:${p}`;
}
function telHref(phone = "") {
  return `tel:${normalizePhone(phone)}`;
}
const Highlight = React.memo(function Highlight({ text, keyword }) {
  if (!keyword) return <>{text}</>;
  const parts = String(text).split(new RegExp(`(${keyword})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <Box
        key={i}
        component="span"
        sx={{
          bgcolor: "warning.light",
          color: "black",
          px: 0.5,
          borderRadius: 0.5,
          fontWeight: 700,
        }}
      >
        {part}
      </Box>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
});

// ---- component -----------------------------------------------
export default function DriverDirectoryProListView() {
  const [search, setSearch] = React.useState("");

  // Map your DRIVER_LIST to grid rows
  const rows = React.useMemo(
    () =>
      DRIVER_LIST.map((d) => ({
        id: d.lrp || d.email, // stable id
        ...d,
      })),
    [],
  );

  // One “list view” column renders the whole card-like row
  const columns = React.useMemo(
    () => [
      {
        field: "list",
        headerName: "Driver",
        flex: 1,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => {
          const d = params.row;
          const initials = getInitials(d.name);
          const tel = telHref(d.phone);
          const sms = smsHref(d.phone);
          const mailto = `mailto:${d.email}`;

          return (
            <Stack
              direction="row"
              spacing={2}
              sx={{ py: 1.25, alignItems: "center", width: "100%" }}
            >
              <Avatar sx={{ width: 40, height: 40, fontWeight: 700 }}>
                {initials}
              </Avatar>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  justifyContent="space-between"
                  spacing={0.5}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={700} noWrap>
                      <Highlight text={`${d.name} (${d.lrp})`} keyword={search} />
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      noWrap
                      sx={{ display: "flex", alignItems: "center", gap: 0.75 }}
                    >
                      <LocalShippingIcon fontSize="inherit" />
                      {Array.isArray(d.vehicles) && d.vehicles.length > 0 ? (
                        <Box sx={{ display: "inline-flex", gap: 0.5, flexWrap: "wrap" }}>
                          {d.vehicles.slice(0, 3).map((v, i) => (
                            <VehicleChip key={i} vehicle={v} />
                          ))}
                          {d.vehicles.length > 3 && (
                            <Chip
                              size="small"
                              label={`+${d.vehicles.length - 3}`}
                              variant="outlined"
                            />
                          )}
                        </Box>
                      ) : (
                        <span>—</span>
                      )}
                    </Typography>

                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      <Highlight text={d.phone} keyword={search} /> ·{" "}
                      <Highlight text={d.email} keyword={search} />
                    </Typography>
                  </Box>

                  {/* Actions: compact on mobile, labeled on md+ */}
                  <Box sx={{ flexShrink: 0 }}>
                    <Box sx={{ display: { xs: "none", md: "block" } }}>
                      <ButtonGroup size="small" variant="outlined">
                        <Button component="a" href={tel} startIcon={<PhoneIcon />} aria-label={`Call ${d.name}`}>
                          Call
                        </Button>
                        <Button component="a" href={sms} startIcon={<SmsIcon />} aria-label={`Text ${d.name}`}>
                          SMS
                        </Button>
                        <Button component="a" href={mailto} startIcon={<EmailIcon />} aria-label={`Email ${d.name}`}>
                          Email
                        </Button>
                      </ButtonGroup>
                    </Box>
                    <Stack direction="row" spacing={0.5} sx={{ display: { xs: "flex", md: "none" } }}>
                      <Tooltip title="Call">
                        <IconButton component="a" href={tel} size="small" aria-label={`Call ${d.name}`}>
                          <PhoneIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="SMS">
                        <IconButton component="a" href={sms} size="small" aria-label={`Text ${d.name}`}>
                          <SmsIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Email">
                        <IconButton component="a" href={mailto} size="small" aria-label={`Email ${d.name}`}>
                          <EmailIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Box>
                </Stack>
              </Box>
            </Stack>
          );
        },
      },
    ],
    [search],
  );

  return (
    <Box sx={{ height: 600, width: "100%" }}>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        📇 Driver Directory
      </Typography>

      <DataGridPro
        rows={rows}
        columns={columns}
        // “List view” essentials
        getRowHeight={() => "auto"} // allow multi-line / chips to expand the row
        disableColumnMenu
        disableColumnSelector
        density="comfortable"
        hideFooterSelectedRowCount
        // Quick filter in toolbar (wired to our search state for highlight)
        slots={{ toolbar: GridToolbar }}
        slotProps={{
          toolbar: {
            showQuickFilter: true,
            quickFilterProps: {
              debounceMs: 150,
              placeholder: "Search name, LRP #, email, vehicle…",
              InputProps: { startAdornment: <SearchIcon fontSize="small" />, size: "small" },
              onChange: (e) => setSearch(e.target.value),
              value: search,
            },
          },
        }}
        initialState={{
          pagination: { paginationModel: { pageSize: 25, page: 0 } },
        }}
        pageSizeOptions={[10, 25, 50, 100]}
        // Accessibility / focus polish
        sx={{
          "& .MuiDataGrid-row": { alignItems: "stretch" },
          "& .MuiDataGrid-cell": { py: 0, borderBottomStyle: "dashed" },
        }}
      />
    </Box>
  );
}
