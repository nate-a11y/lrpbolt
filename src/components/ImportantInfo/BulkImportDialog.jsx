import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import GetAppIcon from "@mui/icons-material/GetApp";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import * as XLSX from "@/vendor/sheetjs/xlsx.mjs";
import { bulkCreateImportantInfo } from "@/services/importantInfoService.js";
import { PROMO_PARTNER_CATEGORIES } from "@/constants/importantInfo.js";

const HEADER_MAP = {
  title: ["title", "name"],
  blurb: ["blurb", "summary", "short", "short description"],
  details: ["details", "description", "notes", "info"],
  category: ["category", "type"],
  phone: ["phone", "tel", "telephone"],
  url: ["url", "link", "website"],
  smsTemplate: ["sms template", "sms", "text template"],
  isActive: ["active", "enabled", "isactive"],
};

function normalizeHeader(label) {
  return String(label ?? "")
    .trim()
    .toLowerCase();
}

function guessColumnMap(headers) {
  const normalized = headers.map(normalizeHeader);
  const map = {};
  Object.entries(HEADER_MAP).forEach(([key, candidates]) => {
    const index = normalized.findIndex((value) => candidates.includes(value));
    map[key] = index >= 0 ? headers[index] : null;
  });
  return map;
}

function getCell(row, headerKey) {
  if (!headerKey) return "";
  const value = row?.[headerKey];
  if (value == null) return "";
  return String(value);
}

function parseActive(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) return true;
  return ["1", "true", "yes", "y", "active"].includes(normalized);
}

function downloadSampleWorkbook() {
  const rows = [
    [
      "Title",
      "Blurb",
      "Details",
      "Category",
      "Phone",
      "URL",
      "SMS Template",
      "Active",
    ],
    [
      "Fall Promotion: 10% Off",
      "Seasonal promo",
      "Valid through Nov 30.",
      "Promotions",
      "",
      "https://lakeridepros.com/fall",
      "Here is our fall promotion—10% off through Nov 30.",
      "TRUE",
    ],
    [
      "Cadillac Events",
      "Premier partner for VIP activations",
      "Use for VIP movements and brand events.",
      "Premier Partners",
      "",
      "https://www.cadillac.com/",
      "",
      "TRUE",
    ],
    [
      "Preferred Towing",
      "Roadside assistance partner",
      "Available 24/7.",
      "Referral Partners",
      "555-123-4567",
      "",
      "",
      "TRUE",
    ],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "ImportantInfo");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "lrp-important-info-template.xlsx";
  anchor.rel = "noopener";
  anchor.click();
  URL.revokeObjectURL(url);
}

function resolveCategory(label) {
  const normalized = String(label ?? "").trim();
  if (!normalized) {
    return { value: "Referral Partners", valid: true };
  }
  if (PROMO_PARTNER_CATEGORIES.includes(normalized)) {
    return { value: normalized, valid: true };
  }
  return { value: normalized, valid: false };
}

function validateRows(jsonRows) {
  const headers = Object.keys(jsonRows[0] ?? {});
  const colMap = guessColumnMap(headers);
  const errors = [];
  const items = [];

  jsonRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const title = getCell(row, colMap.title).trim();
    if (!title) {
      errors.push(`Row ${rowNumber}: Missing Title`);
      return;
    }

    const { value: categoryLabel, valid } = resolveCategory(
      getCell(row, colMap.category),
    );
    const blurb = getCell(row, colMap.blurb).trim();
    const details = getCell(row, colMap.details).trim();
    const phone = getCell(row, colMap.phone).trim();
    const url = getCell(row, colMap.url).trim();
    const smsTemplate = getCell(row, colMap.smsTemplate).trim();

    if (!valid) {
      errors.push(
        `Row ${rowNumber}: Invalid Category "${categoryLabel}" (allowed: ${PROMO_PARTNER_CATEGORIES.join(", ")})`,
      );
    }

    items.push({
      title,
      blurb: blurb || null,
      details: details || null,
      category: categoryLabel,
      phone: phone || null,
      url: url || null,
      smsTemplate: smsTemplate || null,
      isActive: parseActive(getCell(row, colMap.isActive)),
    });
  });

  return { items, errors };
}

export default function BulkImportDialog({ open, onClose }) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);

  const parsedCount = rows.length;
  const hasErrors = errors.length > 0;
  const canImport = parsedCount > 0 && !hasErrors && !importing;

  const handleClose = useCallback(
    (result) => {
      if (importing) return;
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      setFileName("");
      setRows([]);
      setErrors([]);
      onClose?.(result ?? { ok: false });
    },
    [importing, onClose],
  );

  const handleDownloadSample = useCallback(() => {
    downloadSampleWorkbook();
  }, []);

  const handlePick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const parseFile = useCallback(async (file) => {
    if (!file) return;
    try {
      setErrors([]);
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      if (!json.length) {
        setErrors(["The worksheet is empty."]);
        setRows([]);
        setFileName(file.name);
        return;
      }
      const { items, errors: issues } = validateRows(json);
      setRows(items);
      setErrors(issues);
      setFileName(file.name);
    } catch (error) {
      setErrors([error?.message || "Failed to read Excel file."]);
      setRows([]);
      setFileName(file?.name || "");
    }
  }, []);

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      const file = event.dataTransfer?.files?.[0];
      if (file) {
        parseFile(file);
      }
    },
    [parseFile],
  );

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
  }, []);

  const handleFileChange = useCallback(
    (event) => {
      const file = event.target?.files?.[0];
      if (file) {
        parseFile(file);
      }
      if (event?.target) {
        event.target.value = "";
      }
    },
    [parseFile],
  );

  const previewRows = useMemo(() => rows.slice(0, 20), [rows]);

  const handleImport = useCallback(async () => {
    if (!canImport) return;
    try {
      setImporting(true);
      const count = await bulkCreateImportantInfo(rows);
      setImporting(false);
      handleClose({ ok: true, count });
    } catch (error) {
      setImporting(false);
      setErrors([error?.message || "Import failed."]);
    }
  }, [canImport, handleClose, rows]);

  return (
    <Dialog
      open={open}
      onClose={() => handleClose({ ok: false })}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Import Important Info (Excel)</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2">
            Upload an Excel file with the columns:{" "}
            <strong>
              Title, Blurb, Details, Category, Phone, URL, SMS Template, Active
            </strong>
            .
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button
              onClick={handleDownloadSample}
              startIcon={<GetAppIcon />}
              variant="outlined"
              sx={{
                borderColor: (t) => t.palette.primary.main,
                color: "#b7ffb7",
              }}
            >
              Download sample file
            </Button>
            <Button
              onClick={handlePick}
              startIcon={<UploadFileIcon />}
              variant="contained"
              sx={{
                bgcolor: (t) => t.palette.primary.main,
                "&:hover": { bgcolor: "#43a814" },
              }}
            >
              Choose Excel file
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              hidden
              onChange={handleFileChange}
            />
          </Stack>
          <Box
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            sx={(t) => ({
              mt: 1,
              p: 2,
              border: "1px dashed #2a2a2a",
              borderRadius: 2,
              bgcolor: t.palette.background.paper,
              textAlign: "center",
              color: "white",
            })}
          >
            {fileName ? (
              <Typography variant="body2">
                Selected file: <strong>{fileName}</strong>
              </Typography>
            ) : (
              <Typography variant="body2">
                Drag & drop an Excel file here, or click &ldquo;Choose Excel
                file&rdquo; above.
              </Typography>
            )}
          </Box>
          {hasErrors && (
            <Alert severity="warning">
              <Stack spacing={0.5}>
                <Typography variant="subtitle2">
                  Please fix the following before importing:
                </Typography>
                {errors.map((message, index) => (
                  <Typography key={message || index} variant="body2">
                    • {message}
                  </Typography>
                ))}
              </Stack>
            </Alert>
          )}
          <Divider sx={{ borderColor: "#222" }} />
          <Typography variant="subtitle2">Preview (first 20 rows)</Typography>
          <Table
            size="small"
            sx={{ bgcolor: (t) => t.palette.background.paper, borderRadius: 1 }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: "white" }}>Title</TableCell>
                <TableCell sx={{ color: "white" }}>Category</TableCell>
                <TableCell sx={{ color: "white" }}>Active</TableCell>
                <TableCell sx={{ color: "white" }}>Phone</TableCell>
                <TableCell sx={{ color: "white" }}>URL</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {previewRows.map((row, index) => (
                <TableRow key={`${row.title}-${index}`}>
                  <TableCell sx={{ color: "white" }}>
                    <Tooltip title={row.details || ""} placement="top-start">
                      <span>{row.title}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ color: "white" }}>{row.category}</TableCell>
                  <TableCell sx={{ color: "white" }}>
                    {row.isActive ? "TRUE" : "FALSE"}
                  </TableCell>
                  <TableCell sx={{ color: "white" }}>
                    {row.phone || ""}
                  </TableCell>
                  <TableCell sx={{ color: "white" }}>{row.url || ""}</TableCell>
                </TableRow>
              ))}
              {previewRows.length === 0 && (
                <TableRow>
                  <TableCell sx={{ color: "white" }} colSpan={5}>
                    No rows parsed yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {importing && <LinearProgress sx={{ mt: 1 }} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => handleClose({ ok: false })} disabled={importing}>
          Close
        </Button>
        <Button
          onClick={handleImport}
          disabled={!canImport}
          variant="contained"
          sx={{
            bgcolor: (t) => t.palette.primary.main,
            "&:hover": { bgcolor: "#43a814" },
          }}
        >
          Import{parsedCount ? ` (${parsedCount})` : ""}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
