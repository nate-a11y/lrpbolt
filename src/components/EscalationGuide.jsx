/* Proprietary and confidential. See LICENSE. */
import React, { useMemo, useState } from "react";
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
  DataGridPro,
  GridToolbar,
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

export default function EscalationGuide({
  rows = [],
  loading = false,
  error = null,
}) {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const apiRef = useGridApiRef();
  const [expandedMap, setExpandedMap] = useState({}); // {id: boolean}

  const toggleExpanded = (id) =>
    setExpandedMap((m) => ({ ...m, [id]: !m[id] }));

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
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                {phone}
              </Typography>
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
    [expandedMap],
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
            rows.map((c) => <ContactCard key={c.id} contact={c} />)
          ) : (
            <Alert severity="info">No contacts found.</Alert>
          )}
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, pb: 2 }}>
      <Typography
        variant="h5"
        sx={{ fontWeight: 900, mb: 1, color: "primary.main" }}
      >
        Who to Contact & When
      </Typography>

      <DataGridPro
        apiRef={apiRef}
        rows={rows}
        loading={loading}
        getRowId={(r) => r?.id}
        columns={columns}
        autoHeight
        density="compact"
        slots={{ toolbar: GridToolbar }}
        slotProps={{
          toolbar: {
            showQuickFilter: true,
            quickFilterProps: { debounceMs: 300 },
          },
        }}
        checkboxSelection
        disableRowSelectionOnClick
        initialState={{
          pagination: { paginationModel: { pageSize: 15, page: 0 } },
        }}
        sx={{
          "& .MuiDataGrid-cell:focus": { outline: "none" },
          "& .MuiDataGrid-row:hover .MuiTypography-root:first-of-type": {
            textDecoration: "underline",
          },
        }}
        // Overlays
        localeText={{
          noRowsLabel: "No contacts found.",
          errorOverlayDefaultLabel: "Error loading contacts.",
        }}
      />

      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
        <ExportVcardsButton />
      </Stack>
    </Box>
  );
}
