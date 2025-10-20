import { useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Button,
  Chip,
  Link as MuiLink,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

import LrpDataGridPro from "@/components/datagrid/LrpDataGridPro.jsx";
import { formatDateTime } from "@/utils/time.js";

function normalizeRows(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => item && item.isActive !== false);
}

function safeText(value) {
  if (value == null || value === "") return "N/A";
  return String(value);
}

function toTelHref(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/[^\d+]/g, "");
  if (!digits) return null;
  return `tel:${digits}`;
}

export default function ImportantInfoList({ items, loading, onSendSms }) {
  const rows = useMemo(() => normalizeRows(items), [items]);

  const handleSendClick = useCallback(
    (row) => {
      if (!row) return;
      onSendSms?.(row);
    },
    [onSendSms],
  );

  const columns = useMemo(() => {
    return [
      {
        field: "title",
        headerName: "Title",
        minWidth: 260,
        flex: 1.6,
        sortable: true,
        valueGetter: (params) => safeText(params?.row?.title),
        renderCell: (params) => {
          const row = params?.row || {};
          return (
            <Stack spacing={0.5} sx={{ py: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {safeText(row.title)}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", maxWidth: 480 }}
              >
                {row.blurb ? row.blurb : "N/A"}
              </Typography>
            </Stack>
          );
        },
      },
      {
        field: "category",
        headerName: "Category",
        minWidth: 140,
        flex: 0.6,
        valueGetter: (params) => safeText(params?.row?.category),
        renderCell: (params) => {
          const label = params?.row?.category || "General";
          return (
            <Chip
              size="small"
              label={label}
              sx={{
                bgcolor: "rgba(76,187,23,0.18)",
                color: "#ffffff",
                fontWeight: 600,
                textTransform: "capitalize",
              }}
            />
          );
        },
      },
      {
        field: "phone",
        headerName: "Partner Phone",
        minWidth: 160,
        flex: 0.7,
        valueGetter: (params) => safeText(params?.row?.phone),
        renderCell: (params) => {
          const phone = params?.row?.phone;
          if (!phone) return "N/A";
          const href = toTelHref(phone);
          if (!href) return safeText(phone);
          return (
            <MuiLink
              href={href}
              underline="hover"
              sx={{ color: "#4cbb17", fontWeight: 600 }}
            >
              {phone}
            </MuiLink>
          );
        },
      },
      {
        field: "url",
        headerName: "Link",
        minWidth: 160,
        flex: 0.7,
        valueGetter: (params) => safeText(params?.row?.url),
        renderCell: (params) => {
          const url = params?.row?.url;
          if (!url) return "N/A";
          return (
            <MuiLink
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              sx={{ color: "#4cbb17", fontWeight: 600 }}
            >
              View
            </MuiLink>
          );
        },
      },
      {
        field: "updatedAt",
        headerName: "Updated",
        minWidth: 170,
        flex: 0.8,
        valueGetter: (params) => formatDateTime(params?.row?.updatedAt),
        renderCell: (params) => (
          <Typography variant="body2">
            {formatDateTime(params?.row?.updatedAt)}
          </Typography>
        ),
      },
      {
        field: "details",
        headerName: "Details",
        minWidth: 240,
        flex: 1.2,
        sortable: false,
        valueGetter: (params) => safeText(params?.row?.details),
        renderCell: (params) => {
          const details = params?.row?.details;
          if (!details) return "N/A";
          const truncated =
            details.length > 160 ? `${details.slice(0, 157)}…` : details;
          return (
            <Tooltip
              title={
                <Typography sx={{ whiteSpace: "pre-wrap" }}>
                  {details}
                </Typography>
              }
            >
              <Typography
                variant="body2"
                sx={{
                  whiteSpace: "pre-wrap",
                  maxHeight: 96,
                  overflow: "hidden",
                }}
              >
                {truncated}
              </Typography>
            </Tooltip>
          );
        },
      },
      {
        field: "actions",
        headerName: "",
        minWidth: 160,
        flex: 0.6,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <Button
            size="small"
            variant="contained"
            onClick={() => handleSendClick(params?.row)}
            sx={{
              bgcolor: "#4cbb17",
              fontWeight: 600,
              "&:hover": { bgcolor: "#3aa40f" },
            }}
          >
            Text Customer
          </Button>
        ),
      },
    ];
  }, [handleSendClick]);

  return (
    <Box sx={{ width: "100%", "& .MuiDataGrid-row": { alignItems: "center" } }}>
      <LrpDataGridPro
        id="important-info-list"
        rows={rows}
        columns={columns}
        getRowId={(row) => row?.id ?? null}
        loading={loading}
        disableRowSelectionOnClick
        autoHeight
        hideFooterSelectedRowCount
        slotProps={{
          toolbar: {
            quickFilterPlaceholder: "Search important info",
          },
        }}
      />
    </Box>
  );
}

ImportantInfoList.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object),
  loading: PropTypes.bool,
  onSendSms: PropTypes.func,
};
