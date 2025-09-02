/* Proprietary and confidential. See LICENSE. */
// React & vendor
import * as React from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Avatar,
  ButtonGroup,
  Button,
  Divider,
  useTheme,
  TextField,
} from "@mui/material";
import { useGridApiRef } from "@mui/x-data-grid-pro";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import SmsIcon from "@mui/icons-material/Sms";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import SearchIcon from "@mui/icons-material/Search";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import DRIVER_LIST from "../data/driverDirectory";

import SmartAutoGrid from "./datagrid/SmartAutoGrid.jsx";
import ResponsiveScrollBox from "./datagrid/ResponsiveScrollBox.jsx";
import VehicleChip from "./VehicleChip";

// LRP brand tokens
const LRP = {
  green: "#4cbb17",
  black: "#060606",
  card: "#0b0b0b",
  chipBg: "#1a1a1a",
  chipBorder: "rgba(255,255,255,0.12)",
  textDim: "rgba(255,255,255,0.72)",
};

// helpers
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
function telHref(p = "") {
  return `tel:${normalizePhone(p)}`;
}
function isMobileUA() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
function smsHrefOrNull(p = "") {
  return isMobileUA() ? `sms:${normalizePhone(p)}` : null;
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
          bgcolor: "rgba(76,187,23,0.28)",
          color: "#fff",
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

// shared icon button style
function iconBtnSx() {
  return {
    color: "#fff",
    border: `1px solid rgba(76,187,23,0.35)`,
    borderRadius: 2,
    "&:hover": {
      borderColor: LRP.green,
      boxShadow: `0 0 10px rgba(76,187,23,0.45) inset`,
      backgroundColor: "rgba(76,187,23,0.06)",
    },
  };
}

export default function DriverDirectory() {
  const theme = useTheme();
  const apiRef = useGridApiRef();
  const [search, setSearch] = React.useState("");

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    const terms = value.split(/\s+/).filter(Boolean);
    apiRef.current.setQuickFilterValues(terms);
  };

  const rows = React.useMemo(
    () =>
      DRIVER_LIST.map((d) => ({
        id: d.lrp || d.email,
        ...d,
      })),
    [],
  );

  const columns = React.useMemo(
    () => [
      {
        field: "list",
        headerName: "Driver",
        flex: 1,
        minWidth: 140,
        sortable: false,
        disableColumnMenu: true,
        // Enable quick filter by providing searchable text
        valueGetter: (params) => {
          const row = params?.row;
          if (!row) return "N/A";
          const vehicles = Array.isArray(row.vehicles)
            ? row.vehicles.join(" ")
            : "";
          const parts = [
            row.name,
            row.lrp,
            row.email,
            row.phone,
            vehicles,
          ].filter(Boolean);
          return parts.length ? parts.join(" ") : "N/A";
        },
        renderCell: (params) => {
          const d = params.row;
          const initials = getInitials(d.name);
          const tel = telHref(d.phone);
          const sms = smsHrefOrNull(d.phone);
          const email = `mailto:${d.email}`;

          const onCopy = async () => {
            try {
              await navigator.clipboard.writeText(d.phone);
            } catch (err) {
              console.warn("Clipboard copy failed:", err);
            }
          };

          return (
            <Stack
              direction="row"
              spacing={2}
              sx={{ alignItems: "center", width: "100%", py: 1.25 }}
            >
              <Box
                sx={{
                  position: "relative",
                  borderRadius: "50%",
                  p: 0.5,
                  background: `radial-gradient(120% 120% at 50% 60%, rgba(76,187,23,0.25) 0%, rgba(76,187,23,0) 70%)`,
                }}
              >
                <Avatar
                  sx={{
                    width: 44,
                    height: 44,
                    bgcolor: LRP.black,
                    border: `2px solid ${LRP.green}`,
                    fontWeight: 800,
                    color: "#fff",
                  }}
                >
                  {initials}
                </Avatar>
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={{ xs: 1, md: 0.5 }}
                  alignItems={{ xs: "flex-start", md: "center" }}
                  justifyContent="space-between"
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      fontWeight={800}
                      sx={{
                        color: "#fff",
                        textShadow: `0 0 6px rgba(76,187,23,0.45)`,
                      }}
                      noWrap
                    >
                      <Highlight
                        text={`${d.name} (${d.lrp})`}
                        keyword={search}
                      />
                    </Typography>

                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={0.75}
                      sx={{ color: LRP.textDim, mt: 0.25, flexWrap: "wrap" }}
                    >
                      <LocalShippingIcon fontSize="inherit" />
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ flexWrap: "wrap" }}
                      >
                        {Array.isArray(d.vehicles) &&
                          d.vehicles.slice(0, 4).map((v, i) => (
                            <VehicleChip
                              key={i}
                              vehicle={v}
                              sx={{
                                "& .MuiChip-root, &": {
                                  bgcolor: LRP.chipBg,
                                  color: "#fff",
                                  border: `1px solid ${LRP.chipBorder}`,
                                  borderRadius: "999px",
                                  fontWeight: 700,
                                  px: 0.75,
                                  height: 24,
                                },
                              }}
                            />
                          ))}
                        {Array.isArray(d.vehicles) && d.vehicles.length > 4 && (
                          <Chip
                            size="small"
                            label={`+${d.vehicles.length - 4}`}
                            sx={{
                              bgcolor: LRP.chipBg,
                              color: "#fff",
                              border: `1px solid ${LRP.chipBorder}`,
                              borderRadius: "999px",
                              fontWeight: 700,
                              height: 24,
                            }}
                          />
                        )}
                      </Stack>
                    </Stack>

                    <Typography
                      variant="caption"
                      sx={{ color: LRP.textDim, display: "block", mt: 0.25 }}
                    >
                      <Highlight text={d.phone} keyword={search} /> ·{" "}
                      <Highlight text={d.email} keyword={search} />
                    </Typography>
                  </Box>

                  {/* Actions */}
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ flexShrink: 0, alignItems: "center" }}
                  >
                    <ButtonGroup
                      size="small"
                      variant="outlined"
                      sx={{
                        display: { xs: "none", md: "inline-flex" },
                        "& .MuiButton-root": {
                          borderColor: "rgba(76,187,23,0.45)",
                          color: "#fff",
                          textTransform: "none",
                          "&:hover": {
                            borderColor: LRP.green,
                            boxShadow: `0 0 12px rgba(76,187,23,0.45) inset`,
                          },
                        },
                      }}
                    >
                      <Button
                        component="a"
                        href={tel}
                        startIcon={<PhoneIcon />}
                      >
                        Call
                      </Button>
                      {sms ? (
                        <Button
                          component="a"
                          href={sms}
                          startIcon={<SmsIcon />}
                        >
                          SMS
                        </Button>
                      ) : (
                        <Button startIcon={<SmsIcon />} onClick={onCopy}>
                          SMS
                        </Button>
                      )}
                      <Button
                        component="a"
                        href={email}
                        startIcon={<EmailIcon />}
                      >
                        Email
                      </Button>
                    </ButtonGroup>

                    {/* Compact icons on mobile */}
                    <Stack
                      direction="row"
                      spacing={0.25}
                      sx={{ display: { xs: "flex", md: "none" } }}
                    >
                      <Tooltip title="Call">
                        <IconButton
                          component="a"
                          href={tel}
                          size="small"
                          sx={iconBtnSx()}
                        >
                          <PhoneIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="SMS">
                        <IconButton
                          component={sms ? "a" : "button"}
                          href={sms || undefined}
                          onClick={!sms ? onCopy : undefined}
                          size="small"
                          sx={iconBtnSx()}
                        >
                          <SmsIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Email">
                        <IconButton
                          component="a"
                          href={email}
                          size="small"
                          sx={iconBtnSx()}
                        >
                          <EmailIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Copy #">
                        <IconButton
                          onClick={onCopy}
                          size="small"
                          sx={iconBtnSx()}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Messages Web">
                        <IconButton
                          component="a"
                          href="https://messages.google.com/web"
                          target="_blank"
                          rel="noopener noreferrer"
                          size="small"
                          sx={iconBtnSx()}
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
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
    <Box
      sx={{ width: "100%", "& *": { fontFamily: theme.typography.fontFamily } }}
    >
      <Typography
        variant="h5"
        gutterBottom
        sx={{
          fontWeight: 900,
          color: "#fff",
          textShadow: `0 0 12px rgba(76,187,23,0.6)`,
        }}
      >
        📇 Driver Directory
      </Typography>

      {/* Quick filter bar */}
      <Box
        sx={{
          mb: 1,
          borderRadius: 2,
          p: 1,
          background:
            "linear-gradient(180deg, rgba(76,187,23,0.15) 0%, rgba(76,187,23,0.06) 100%)",
          border: `1px solid rgba(76,187,23,0.35)`,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <SearchIcon sx={{ color: LRP.green }} />
          <TextField
            variant="standard"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search name, LRP #, email, vehicle…"
            InputProps={{
              disableUnderline: true,
              sx: { color: "#fff" },
            }}
          />
        </Stack>
      </Box>

      <ResponsiveScrollBox>
        <Paper
          sx={{
            height: 640,
            width: "100%",
            overflow: "auto",
            "& .MuiDataGrid-root": { border: "none" },
          }}
        >
          <SmartAutoGrid
            apiRef={apiRef}
            rows={rows}
            columnsCompat={columns}
            getRowId={(row) =>
              row?.id ??
              row?.uid ??
              row?._id ??
              row?.docId ??
              JSON.stringify(row)
            }
            getRowHeight={() => "auto"}
            disableColumnMenu
            disableColumnSelector
            hideFooterSelectedRowCount
            initialState={{
              pagination: { paginationModel: { pageSize: 25, page: 0 } },
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            sx={{
              bgcolor: LRP.black,
              color: "#fff",
              borderRadius: 2,
              border: `1px solid rgba(255,255,255,0.06)`,
              boxShadow: `0 0 0 1px rgba(255,255,255,0.03) inset`,
              "--DataGrid-containerBackground": LRP.card,
              "& .MuiDataGrid-columnHeaders": {
                bgcolor: "transparent",
                borderBottom: `1px dashed rgba(255,255,255,0.12)`,
                "& .MuiDataGrid-columnHeaderTitle": {
                  fontWeight: 800,
                  letterSpacing: 0.4,
                },
              },
              "& .MuiDataGrid-row": {
                position: "relative",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  background: "transparent",
                },
                "&:hover": {
                  background:
                    "linear-gradient(180deg, rgba(76,187,23,0.10) 0%, rgba(76,187,23,0.06) 100%)",
                  boxShadow: "0 0 0 1px rgba(76,187,23,0.25) inset",
                  "&::before": { background: LRP.green },
                },
              },
              "& .MuiDataGrid-cell": {
                borderBottom: `1px dashed rgba(255,255,255,0.10)`,
                py: 0,
              },
              "& .MuiCheckbox-root.Mui-checked": { color: LRP.green },
              "& .MuiDataGrid-selectedRowCount": { color: LRP.textDim },
              "& .MuiButtonBase-root.MuiIconButton-root": { color: "#fff" },
            }}
            showToolbar
          />
        </Paper>
      </ResponsiveScrollBox>

      <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.06)" }} />
      <Typography variant="caption" sx={{ color: LRP.textDim }}>
        Lake Ride Pros • Real Rides. Real Pros.
      </Typography>
    </Box>
  );
}
