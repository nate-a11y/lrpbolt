/* Proprietary and confidential. See LICENSE. */
import * as React from "react";
import {
  Box,
  Divider,
  IconButton,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { useGridApiRef } from "@mui/x-data-grid-pro";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import SearchIcon from "@mui/icons-material/Search";

import useIsMobile from "@/hooks/useIsMobile.js";

import SmartAutoGrid from "./datagrid/SmartAutoGrid.jsx";
import PageContainer from "./PageContainer.jsx";

const LRP = {
  green: "#4cbb17",
  black: "#060606",
  card: "#0b0b0b",
  chipBg: "#1a1a1a",
  chipBorder: "rgba(255,255,255,0.12)",
  textDim: "rgba(255,255,255,0.72)",
};

function normalizePhone(phone = "") {
  const trimmed = String(phone).trim();
  const keepPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  return keepPlus ? `+${digits}` : digits;
}

function telHref(p = "") {
  return `tel:${normalizePhone(p)}`;
}

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

const contacts = [
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

export default function ContactEscalation() {
  const theme = useTheme();
  const apiRef = useGridApiRef();
  const { isMdDown } = useIsMobile();
  const [search, setSearch] = React.useState("");
  const debounceRef = React.useRef();

  const handleSearchChange = React.useCallback(
    (e) => {
      const value = e.target.value;
      setSearch(value);
      const terms = value.split(/\s+/).filter(Boolean);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        apiRef.current.setQuickFilterValues(terms);
      }, 300);
    },
    [apiRef],
  );

  React.useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const rows = React.useMemo(
    () =>
      contacts.map((c) => ({
        id: c.email || c.phone,
        ...c,
      })),
    [],
  );

  const columns = React.useMemo(
    () => [
      {
        field: "contact",
        headerName: "Contact",
        flex: 1,
        minWidth: isMdDown ? 160 : 200,
        sortable: false,
        disableColumnMenu: true,
        valueGetter: (params) => {
          const row = params?.row;
          if (!row) return "N/A";
          return (
            [row.name, row.phone, row.email].filter(Boolean).join(" ") || "N/A"
          );
        },
        renderCell: (params) => {
          const row = params?.row || {};
          const tel = row.phone ? telHref(row.phone) : null;
          const emailHref = row.email ? `mailto:${row.email}` : null;

          return (
            <Stack
              direction="row"
              spacing={2}
              sx={{ alignItems: "center", width: "100%", py: 1.25 }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={800} sx={{ color: "#fff" }} noWrap>
                  {row.name || "N/A"}
                </Typography>
                <Typography variant="body2" sx={{ color: LRP.textDim }}>
                  {row.phone || "N/A"}
                </Typography>
              </Box>
              {tel && (
                <Link href={tel} underline="none">
                  <IconButton size="small" sx={iconBtnSx()}>
                    <PhoneIcon fontSize="small" />
                  </IconButton>
                </Link>
              )}
              {emailHref && (
                <Link href={emailHref} underline="none">
                  <IconButton size="small" sx={iconBtnSx()}>
                    <EmailIcon fontSize="small" />
                  </IconButton>
                </Link>
              )}
            </Stack>
          );
        },
      },
      {
        field: "responsibilities",
        headerName: "Responsibilities",
        flex: isMdDown ? 1 : 2,
        minWidth: isMdDown ? 240 : 300,
        sortable: false,
        valueGetter: (params) => {
          const row = params?.row;
          if (!row || !Array.isArray(row.responsibilities)) return "N/A";
          return row.responsibilities.join(" ");
        },
        renderCell: (params) => {
          const list = params?.row?.responsibilities;
          if (!Array.isArray(list))
            return <Typography variant="body2">N/A</Typography>;
          return (
            <Box component="ul" sx={{ pl: 2, m: 0 }}>
              {list.map((task, i) => (
                <li key={i}>
                  <Typography variant="body2">{task}</Typography>
                </li>
              ))}
            </Box>
          );
        },
      },
    ],
    [isMdDown],
  );

  return (
    <PageContainer>
      <Box
        sx={{
          width: "100%",
          "& *": { fontFamily: theme.typography.fontFamily },
        }}
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
          📞 Who to Contact & When
        </Typography>

        <Typography variant="body1" sx={{ mb: 3 }}>
          Use this guide to contact the right person based on the issue you’re
          having. Tap to call or email!
        </Typography>

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
              placeholder="Search name, phone, email, responsibility…"
              InputProps={{
                disableUnderline: true,
                sx: { color: "#fff" },
              }}
              sx={{ flex: 1 }}
            />
          </Stack>
        </Box>

        <Paper
          sx={{
            width: "100%",
            ...(isMdDown ? {} : { height: 640 }),
            "& .MuiDataGrid-root": { border: "none" },
          }}
        >
          <SmartAutoGrid
            apiRef={apiRef}
            rows={rows}
            columnsCompat={columns}
            getRowId={(row) =>
              row?.id ?? row?.email ?? row?.phone ?? JSON.stringify(row)
            }
            getRowHeight={() => "auto"}
            disableColumnMenu
            disableColumnSelector
            hideFooterSelectedRowCount
            checkboxSelection
            disableRowSelectionOnClick
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

        <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.06)" }} />
        <Typography variant="caption" sx={{ color: LRP.textDim }}>
          Lake Ride Pros • Real Rides. Real Pros.
        </Typography>
      </Box>
    </PageContainer>
  );
}
