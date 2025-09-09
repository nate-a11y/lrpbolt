/* Proprietary and confidential. See LICENSE. */
import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  Box,
  Stack,
  Button,
  Typography,
  useMediaQuery,
  useTheme,
  Alert,
} from "@mui/material";
import {
  gridFilteredSortedRowIdsSelector,
  gridRowSelectionStateSelector,
  useGridApiRef,
} from "@mui/x-data-grid-pro";
import EmailIcon from "@mui/icons-material/Email";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PhoneIcon from "@mui/icons-material/Phone";

import CopyButton from "@/components/common/CopyButton.jsx";
import ContactCard from "@/components/contacts/ContactCard.jsx";
import { downloadVcards } from "@/utils/vcard";
import logError from "@/utils/logError";
import LrpGrid from "@/components/datagrid/LrpGrid.jsx";
import ResponsiveScrollBox from "@/components/datagrid/ResponsiveScrollBox.jsx";

/** ===== Local fallback data (matches your original list) ===== */
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

/** ===== Helpers ===== */
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
      ...r,
      id,
      name: r?.name || r?.displayName || "N/A",
      phone: r?.phone || r?.phoneNumber || "",
      email: r?.email || r?.emailAddress || "",
      responsibilities,
    };
  });
}

const getIdSafe = (r) =>
  r?.id ||
  (r?.email ? `email:${r.email}` : null) ||
  (r?.phone ? `phone:${String(r.phone).replace(/[^\d+]/g, "")}` : null) ||
  `row-${Math.random().toString(36).slice(2)}`;

/** ===== Component ===== */
export default function EscalationGuide(props) {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const apiRef = useGridApiRef();
  const [expandedMap, setExpandedMap] = useState({}); // {id: boolean}

  // Prefer prop rows if provided; else use local fallback
  const rowsSource =
    Array.isArray(props?.rows) && props.rows.length
      ? props.rows
      : fallbackContacts;

  const rows = useMemo(() => normalizeContacts(rowsSource), [rowsSource]);
  const loading = Boolean(props?.loading);
  const error = props?.error ?? null;

  const toggleExpanded = useCallback((id) => {
    setExpandedMap((m) => ({ ...m, [id]: !m[id] }));
  }, []);

  useEffect(() => {
    try {
      apiRef.current?.resetRowHeights();
    } catch (e) {
      logError(e, { action: "reset-row-heights" });
    }
  }, [expandedMap, apiRef]);

  const columns = useMemo(
    () => [
      {
        field: "contact",
        headerName: "Contact",
        flex: 1,
        minWidth: 260,
        sortable: true,
        filterable: true,
        renderCell: (params) => {
          const r = params?.row || {};
          const name = r.name || "N/A";
          const phone = r.phone || "";
          const email = r.email || "";
          return (
            <Stack spacing={0.5}>
              <Typography sx={{ fontWeight: 800, color: "primary.main" }}>
                {name}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                {phone ? (
                  <>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<PhoneIcon />}
                      component="a"
                      href={`tel:${phone}`}
                      aria-label={`Call ${name}`}
                    >
                      Call
                    </Button>
                    <CopyButton value={phone} label="Copy phone" />
                  </>
                ) : null}
                {email ? (
                  <>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<EmailIcon />}
                      component="a"
                      href={`mailto:${email}`}
                      aria-label={`Email ${name}`}
                    >
                      Email
                    </Button>
                    <CopyButton value={email} label="Copy email" />
                  </>
                ) : null}
              </Stack>
              {phone ? (
                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                  {phone}
                </Typography>
              ) : null}
              {email ? (
                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                  {email}
                </Typography>
              ) : null}
            </Stack>
          );
        },
      },
      {
        field: "responsibilities",
        headerName: "Responsibilities",
        flex: 1.2,
        minWidth: 380,
        sortable: false,
        filterable: true,
        renderCell: (params) => {
          const r = params?.row || {};
          const list = Array.isArray(r.responsibilities)
            ? r.responsibilities
            : [];
          const expanded = !!expandedMap[r.id];
          const shown = expanded ? list : list.slice(0, 5);
          return (
            <Stack spacing={0.5} sx={{ width: "100%" }}>
              <Box component="ul" sx={{ pl: 2, m: 0 }}>
                {shown.map((t, i) => (
                  <li key={i}>
                    <Typography variant="body2">{t}</Typography>
                  </li>
                ))}
              </Box>
              {list.length > 5 && (
                <Button
                  size="small"
                  variant="text"
                  color="primary"
                  onClick={() => toggleExpanded(r.id)}
                  startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  aria-label={expanded ? "Show less" : "Show more"}
                  sx={{ alignSelf: "flex-start" }}
                >
                  {expanded ? "Show less" : `Show ${list.length - 5} more`}
                </Button>
              )}
            </Stack>
          );
        },
      },
    ],
    [expandedMap, toggleExpanded],
  );

  // vCard export from toolbar (selected rows; else all filtered)
  const ExportVcardsButton = () => (
    <Button
      size="small"
      variant="contained"
      onClick={() => {
        try {
          const state = apiRef.current?.state;
          const selectedIds = gridRowSelectionStateSelector(state);
          let ids = Array.isArray(selectedIds)
            ? selectedIds
            : Object.keys(selectedIds || {});
          if (!ids?.length) ids = gridFilteredSortedRowIdsSelector(apiRef);
          const contacts = ids.map((id) => apiRef.current.getRow(id));
          downloadVcards("LRP-Contacts.vcf", contacts);
        } catch (e) {
          logError(e, { action: "export-vcards" });
        }
      }}
      sx={{ ml: 1 }}
    >
      Export vCard
    </Button>
  );

  if (error) return <Alert severity="error">{String(error)}</Alert>;

  // Mobile: card mode
  if (isXs) {
    return (
      <Box sx={{ px: 1, pb: 2 }}>
        <Typography
          variant="h5"
          sx={{ fontWeight: 900, mb: 1, color: "primary.main" }}
        >
          Who to Contact & When
        </Typography>
        <Stack spacing={1.25}>
          {rows?.length ? (
            rows.map((c) => <ContactCard key={getIdSafe(c)} contact={c} />)
          ) : (
            <Alert severity="info">No contacts found.</Alert>
          )}
        </Stack>
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
          <ExportVcardsButton />
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        px: { xs: 1, sm: 2 },
        pb: 2,
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Typography
        variant="h5"
        sx={{ fontWeight: 900, mb: 1, color: "primary.main" }}
      >
        Who to Contact & When
      </Typography>

      <ResponsiveScrollBox sx={{ flexGrow: 1, minHeight: 0 }}>
        <LrpGrid
          apiRef={apiRef}
          rows={rows}
          loading={loading}
          getRowId={getIdSafe}
          columns={columns}
          getRowHeight={() => "auto"}
          checkboxSelection
          disableRowSelectionOnClick
          initialState={{
            pagination: { paginationModel: { pageSize: 15, page: 0 } },
          }}
          autoHeight={false}
          sx={{
            "& .MuiDataGrid-cell:focus": { outline: "none" },
            "& .MuiDataGrid-row:hover .MuiTypography-root:first-of-type": {
              textDecoration: "underline",
            },
            height: "100%",
          }}
          localeText={{
            noRowsLabel: "No contacts found.",
            errorOverlayDefaultLabel: "Error loading contacts.",
          }}
        />
      </ResponsiveScrollBox>

      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
        <ExportVcardsButton />
      </Stack>
    </Box>
  );
}
