import { useState, useMemo, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  Link as MuiLink,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";

import LoadingButtonLite from "@/components/inputs/LoadingButtonLite.jsx";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import {
  createImportantInfo,
  updateImportantInfo,
  deleteImportantInfo,
  restoreImportantInfo,
} from "@/services/importantInfoService.js";
import { getSmsHealth, getLastSmsError } from "@/services/smsService.js";
import logError from "@/utils/logError.js";
import { formatDateTime, toDayjs } from "@/utils/time.js";
import {
  PROMO_PARTNER_CATEGORIES,
  PROMO_PARTNER_FILTER_OPTIONS,
} from "@/constants/importantInfo.js";

import BulkImportDialog from "./BulkImportDialog.jsx";

const DEFAULT_CATEGORY = PROMO_PARTNER_CATEGORIES[0] || "Promotions";

function ensureString(value) {
  if (value == null) return "";
  return String(value);
}

function normalizeCategory(value) {
  const label = ensureString(value).trim();
  return PROMO_PARTNER_CATEGORIES.includes(label) ? label : DEFAULT_CATEGORY;
}

function buildPayload(values) {
  return {
    title: ensureString(values.title),
    blurb: ensureString(values.blurb),
    details: ensureString(values.details),
    category: normalizeCategory(values.category),
    phone: ensureString(values.phone),
    url: ensureString(values.url),
    smsTemplate: ensureString(values.smsTemplate),
    isActive: values.isActive !== false,
  };
}

const DEFAULT_FORM = {
  title: "",
  blurb: "",
  details: "",
  category: DEFAULT_CATEGORY,
  phone: "",
  url: "",
  smsTemplate: "",
  isActive: true,
};

function toTelHref(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/[^\d+]/g, "");
  if (!digits) return null;
  return `tel:${digits}`;
}

function getUpdatedAtValue(input) {
  const d = toDayjs(input);
  return d ? d.valueOf() : 0;
}

function matchesQuery(row, query) {
  if (!query) return true;
  const haystack = [
    row?.title,
    row?.blurb,
    row?.details,
    row?.category,
    row?.phone,
    row?.url,
    row?.smsTemplate,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export default function ImportantInfoAdmin({ items, loading, error }) {
  const { show } = useSnack();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState("create");
  const [formValues, setFormValues] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [pendingMap, setPendingMap] = useState({});
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState("updated");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [healthDialogOpen, setHealthDialogOpen] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [healthError, setHealthError] = useState("");
  const [localLastSmsError, setLocalLastSmsError] = useState(null);

  const rows = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const hasRows = rows.length > 0;
  const showError = Boolean(error) && !loading;
  const showEmpty = !showError && !loading && !hasRows;

  const categories = useMemo(() => {
    const extras = new Set();
    rows.forEach((row) => {
      if (!row?.category) return;
      const label = String(row.category);
      if (PROMO_PARTNER_CATEGORIES.includes(label)) return;
      if (label === "Insider Members") return;
      extras.add(label);
    });
    const sortedExtras = Array.from(extras).sort((a, b) => a.localeCompare(b));
    return [...PROMO_PARTNER_FILTER_OPTIONS, ...sortedExtras];
  }, [rows]);

  useEffect(() => {
    if (!categories.includes(categoryFilter)) {
      setCategoryFilter("All");
    }
  }, [categories, categoryFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const filteredRows = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const list = rows.slice();

    const filtered = list.filter((row) => {
      if (!row) return false;
      if (categoryFilter !== "All") {
        const label = row?.category ? String(row.category) : "General";
        if (label !== categoryFilter) return false;
      }
      return matchesQuery(row, q);
    });

    filtered.sort((a, b) => {
      if (sortBy === "title") {
        return ensureString(a?.title).localeCompare(ensureString(b?.title));
      }
      if (sortBy === "category") {
        const aLabel = ensureString(a?.category) || "General";
        const bLabel = ensureString(b?.category) || "General";
        return aLabel.localeCompare(bLabel);
      }
      const aTs = getUpdatedAtValue(a?.updatedAt);
      const bTs = getUpdatedAtValue(b?.updatedAt);
      return bTs - aTs;
    });

    return filtered;
  }, [rows, debouncedQuery, categoryFilter, sortBy]);

  const openCreate = useCallback(() => {
    setDialogMode("create");
    setFormValues(DEFAULT_FORM);
    setActiveId(null);
    setDialogOpen(true);
  }, []);

  const fetchSmsHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError("");
    setHealthData(null);
    try {
      const payload = await getSmsHealth();
      setHealthData(payload || null);
    } catch (err) {
      const message = err?.message || "Unable to fetch SMS health.";
      setHealthError(message);
      logError(err, { where: "ImportantInfoAdmin.fetchSmsHealth" });
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const openHealthDialog = useCallback(() => {
    if (healthLoading) return;
    setLocalLastSmsError(getLastSmsError());
    setHealthDialogOpen(true);
    fetchSmsHealth();
  }, [fetchSmsHealth, healthLoading]);

  const closeHealthDialog = useCallback(() => {
    if (healthLoading) return;
    setHealthDialogOpen(false);
  }, [healthLoading]);

  const handleImportClose = useCallback(
    (result) => {
      setImportDialogOpen(false);
      if (result?.ok) {
        const count = typeof result.count === "number" ? result.count : 0;
        show(`Imported ${count} item${count === 1 ? "" : "s"}.`, "success");
      }
    },
    [show],
  );

  const openEdit = useCallback((row) => {
    if (!row) return;
    setDialogMode("edit");
    setActiveId(row.id || null);
    setFormValues({
      title: ensureString(row.title),
      blurb: ensureString(row.blurb),
      details: ensureString(row.details),
      category: normalizeCategory(row.category),
      phone: ensureString(row.phone),
      url: ensureString(row.url),
      smsTemplate: ensureString(row.smsTemplate),
      isActive: row.isActive !== false,
    });
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    if (saving) return;
    setDialogOpen(false);
    setActiveId(null);
  }, [saving]);

  const handleFieldChange = useCallback((field, value) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event?.preventDefault();
      const payload = buildPayload(formValues);
      try {
        setSaving(true);
        if (dialogMode === "edit" && activeId) {
          await updateImportantInfo(activeId, payload);
          show("Important info updated.", "success");
        } else {
          await createImportantInfo(payload);
          show("Important info created.", "success");
        }
        setDialogOpen(false);
        setActiveId(null);
      } catch (err) {
        logError(err, { where: "ImportantInfoAdmin.handleSubmit", activeId });
        show("Failed to save. Please try again.", "error");
      } finally {
        setSaving(false);
      }
    },
    [activeId, dialogMode, formValues, show],
  );

  const setRowPending = useCallback((id, value) => {
    setPendingMap((prev) => {
      const next = { ...prev };
      if (!id) return next;
      if (value) {
        next[id] = true;
      } else {
        delete next[id];
      }
      return next;
    });
  }, []);

  const handleToggleActive = useCallback(
    async (row, nextActive) => {
      if (!row?.id) return;
      setRowPending(row.id, true);
      try {
        await updateImportantInfo(row.id, { isActive: nextActive });
        show(
          nextActive ? "Marked as active." : "Marked as inactive.",
          "success",
        );
      } catch (err) {
        logError(err, {
          where: "ImportantInfoAdmin.handleToggleActive",
          id: row?.id,
        });
        show("Failed to update status.", "error");
      } finally {
        setRowPending(row.id, false);
      }
    },
    [setRowPending, show],
  );

  const handleDelete = useCallback(
    async (row) => {
      if (!row?.id) return;
      const confirmed = window.confirm(
        "Delete this item? This cannot be undone.",
      );
      if (!confirmed) return;
      setRowPending(row.id, true);
      const snapshot = { ...row };
      try {
        await deleteImportantInfo(row.id);
        show(`Deleted “${row.title || "item"}”.`, "info", {
          autoHideDuration: 6000,
          action: (
            <Button
              color="inherit"
              size="small"
              sx={{ fontWeight: 600 }}
              onClick={async () => {
                try {
                  await restoreImportantInfo(snapshot);
                  show("Undo complete.", "success");
                } catch (undoErr) {
                  logError(undoErr, {
                    where: "ImportantInfoAdmin.undoDelete",
                    id: snapshot.id,
                  });
                  show("Failed to undo delete.", "error");
                }
              }}
            >
              Undo
            </Button>
          ),
        });
      } catch (err) {
        logError(err, {
          where: "ImportantInfoAdmin.handleDelete",
          id: row.id,
        });
        show("Failed to delete item.", "error");
      } finally {
        setRowPending(row.id, false);
      }
    },
    [setRowPending, show],
  );

  return (
    <Box
      sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 2 }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Important Info — Admin
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            variant="contained"
            onClick={openCreate}
            sx={{ bgcolor: "#4cbb17", "&:hover": { bgcolor: "#3aa40f" } }}
          >
            New Item
          </Button>
          <Button
            variant="outlined"
            onClick={() => setImportDialogOpen(true)}
            sx={{ borderColor: "#4cbb17", color: "#b7ffb7" }}
          >
            Import Excel
          </Button>
          <LoadingButtonLite
            variant="outlined"
            onClick={openHealthDialog}
            loading={healthLoading && healthDialogOpen}
            sx={{
              borderColor: "#4cbb17",
              color: "#b7ffb7",
              minWidth: 140,
            }}
          >
            SMS Health
          </LoadingButtonLite>
        </Stack>
      </Stack>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        sx={{ flexWrap: "wrap", gap: { xs: 1, md: 1.5 } }}
      >
        <TextField
          size="small"
          placeholder="Search partners, promotions, or referral details…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          fullWidth
          sx={{ maxWidth: { md: 360 }, bgcolor: "#101010" }}
          InputProps={{ sx: { color: "white" } }}
          inputProps={{ "aria-label": "Search important info admin list" }}
        />
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
            <MenuItem value="updated">Updated (newest)</MenuItem>
            <MenuItem value="title">Title (A–Z)</MenuItem>
            <MenuItem value="category">Category (A–Z)</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {showError ? (
        <Box sx={{ p: 2 }}>
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
              Try refreshing the page. If the issue persists, recreate entries
              once Firestore access is restored.
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
      ) : null}

      {showEmpty ? (
        <Box sx={{ p: 2 }}>
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
              No items yet.
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              Add partner contacts, perks, or emergency resources so drivers can
              act fast.
            </Typography>
            <Button
              onClick={openCreate}
              variant="contained"
              sx={{ bgcolor: "#4cbb17", "&:hover": { bgcolor: "#3aa40f" } }}
            >
              Add first item
            </Button>
          </Stack>
        </Box>
      ) : null}

      {!showError && !showEmpty ? (
        <Stack spacing={1.25} sx={{ width: "100%" }}>
          {loading && !filteredRows.length ? (
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              Loading important info…
            </Typography>
          ) : null}

          {!loading && hasRows && !filteredRows.length ? (
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

          {filteredRows.map((row) => {
            const id = row?.id;
            const disabled = !!pendingMap[id];
            const updatedLabel = formatDateTime(row?.updatedAt);
            const categoryLabel = row?.category
              ? String(row.category)
              : DEFAULT_CATEGORY;
            const telHref = toTelHref(row?.phone);

            return (
              <Card
                key={id}
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
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                          Updated {updatedLabel}
                        </Typography>
                      </Stack>
                      <Chip
                        size="small"
                        label={categoryLabel}
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
                  sx={{
                    px: 2,
                    pb: 2,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Switch
                      size="small"
                      checked={row?.isActive !== false}
                      onChange={(event) =>
                        handleToggleActive(row, event.target.checked)
                      }
                      disabled={disabled}
                    />
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      {row?.isActive !== false ? "Active" : "Inactive"}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Edit">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => openEdit(row)}
                          disabled={disabled}
                          sx={{ color: "#4cbb17" }}
                          aria-label={`Edit ${row?.title || "important info"}`}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(row)}
                          disabled={disabled}
                          sx={{ color: "#ff6b6b" }}
                          aria-label={`Delete ${row?.title || "important info"}`}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </CardActions>
              </Card>
            );
          })}
        </Stack>
      ) : null}

      <BulkImportDialog open={importDialogOpen} onClose={handleImportClose} />

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        fullWidth
        maxWidth="md"
        component="form"
        onSubmit={handleSubmit}
        sx={{ "& .MuiPaper-root": { bgcolor: "background.paper" } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {dialogMode === "edit"
            ? "Edit Important Info"
            : "Create Important Info"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              value={formValues.title}
              onChange={(event) =>
                handleFieldChange("title", event.target.value)
              }
              required
              fullWidth
            />
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select
                label="Category"
                value={formValues.category}
                onChange={(event) =>
                  handleFieldChange("category", event.target.value)
                }
              >
                {PROMO_PARTNER_CATEGORIES.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Blurb"
              value={formValues.blurb}
              onChange={(event) =>
                handleFieldChange("blurb", event.target.value)
              }
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Details"
              value={formValues.details}
              onChange={(event) =>
                handleFieldChange("details", event.target.value)
              }
              fullWidth
              multiline
              minRows={4}
            />
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Partner phone"
                value={formValues.phone}
                onChange={(event) =>
                  handleFieldChange("phone", event.target.value)
                }
                fullWidth
              />
              <TextField
                label="Reference URL"
                value={formValues.url}
                onChange={(event) =>
                  handleFieldChange("url", event.target.value)
                }
                fullWidth
              />
            </Stack>
            <TextField
              label="SMS template (optional)"
              value={formValues.smsTemplate}
              onChange={(event) =>
                handleFieldChange("smsTemplate", event.target.value)
              }
              fullWidth
              multiline
              minRows={3}
              helperText="Leave blank to auto-generate a message."
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Switch
                checked={formValues.isActive}
                onChange={(event) =>
                  handleFieldChange("isActive", event.target.checked)
                }
              />
              <Typography variant="body2">Active</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeDialog} disabled={saving}>
            Cancel
          </Button>
          <LoadingButtonLite
            type="submit"
            loading={saving}
            loadingText="Saving…"
            variant="contained"
            sx={{ bgcolor: "#4cbb17", "&:hover": { bgcolor: "#3aa40f" } }}
          >
            {dialogMode === "edit" ? "Save Changes" : "Create"}
          </LoadingButtonLite>
        </DialogActions>
      </Dialog>
      <Dialog
        open={healthDialogOpen}
        onClose={closeHealthDialog}
        fullWidth
        maxWidth="sm"
        sx={{ "& .MuiPaper-root": { bgcolor: "background.paper" } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>SMS Health</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {healthLoading ? (
              <Typography variant="body2" sx={{ opacity: 0.75 }}>
                Checking Twilio configuration…
              </Typography>
            ) : null}
            {healthError ? (
              <Alert
                severity="error"
                sx={{ bgcolor: "#2a1111", color: "#ffb4b4" }}
              >
                {healthError}
              </Alert>
            ) : null}
            {healthData ? (
              <Stack spacing={1.5}>
                <Stack spacing={0.5} sx={{ color: "white" }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Environment
                  </Typography>
                  <Typography variant="body2">
                    Status: {healthData.ok ? "OK" : "Needs attention"}
                  </Typography>
                  <Typography variant="body2">
                    Project: {healthData.projectId || "Unknown"}
                  </Typography>
                  <Typography variant="body2">
                    Region:{" "}
                    {healthData.region?.runtime ||
                      healthData.region?.configured ||
                      "us-central1"}
                  </Typography>
                  <Typography variant="body2">
                    Region match: {healthData.region?.matches ? "Yes" : "No"}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    Last checked {formatDateTime(healthData.checkedAt)}
                  </Typography>
                </Stack>
                <Divider sx={{ borderColor: "#222" }} />
                <Stack spacing={0.75} sx={{ color: "white" }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Twilio Secrets
                  </Typography>
                  <Typography variant="body2">
                    TWILIO_ACCOUNT_SID:{" "}
                    {healthData.secrets?.TWILIO_ACCOUNT_SID ? "OK" : "MISSING"}
                  </Typography>
                  <Typography variant="body2">
                    TWILIO_AUTH_TOKEN:{" "}
                    {healthData.secrets?.TWILIO_AUTH_TOKEN ? "OK" : "MISSING"}
                  </Typography>
                  <Typography variant="body2">
                    TWILIO_FROM:{" "}
                    {healthData.secrets?.TWILIO_FROM?.present
                      ? "OK"
                      : "MISSING"}
                  </Typography>
                  <Typography variant="body2">
                    TWILIO_FROM E.164:{" "}
                    {healthData.secrets?.TWILIO_FROM?.e164 ? "OK" : "INVALID"}
                  </Typography>
                </Stack>
                <Divider sx={{ borderColor: "#222" }} />
                <Stack spacing={0.75} sx={{ color: "white" }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Last Twilio Error
                  </Typography>
                  {healthData.lastError ? (
                    <>
                      <Typography variant="body2">
                        {healthData.lastError.errorMessage}
                      </Typography>
                      <Typography variant="body2">
                        Code: {healthData.lastError.errorCode || "N/A"}
                      </Typography>
                      <Typography variant="body2">
                        To: {healthData.lastError.to || "N/A"}
                      </Typography>
                      <Typography variant="body2">
                        Logged: {formatDateTime(healthData.lastError.createdAt)}
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="body2">
                      No Twilio errors recorded in the latest 10 logs.
                    </Typography>
                  )}
                </Stack>
                {localLastSmsError ? (
                  <>
                    <Divider sx={{ borderColor: "#222" }} />
                    <Stack spacing={0.75} sx={{ color: "white" }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Last error this session
                      </Typography>
                      <Typography variant="body2">
                        {localLastSmsError.message}
                      </Typography>
                      <Typography variant="body2">
                        Logged: {formatDateTime(localLastSmsError.at)} (code:{" "}
                        {localLastSmsError.code})
                      </Typography>
                    </Stack>
                  </>
                ) : null}
                {!healthData.ok && !healthError ? (
                  <Alert
                    severity="warning"
                    sx={{ bgcolor: "#2a1f11", color: "#ffdca8" }}
                  >
                    Missing Twilio secrets. Set <code>TWILIO_ACCOUNT_SID</code>,{" "}
                    <code>TWILIO_AUTH_TOKEN</code>, and
                    <code>TWILIO_FROM</code> in Functions secrets, then redeploy
                    functions.
                  </Alert>
                ) : null}
              </Stack>
            ) : null}
            {!healthLoading && !healthError && !healthData ? (
              <Typography variant="body2" sx={{ opacity: 0.75 }}>
                Click Refresh to check SMS health.
              </Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeHealthDialog} disabled={healthLoading}>
            Close
          </Button>
          <LoadingButtonLite
            onClick={fetchSmsHealth}
            loading={healthLoading}
            loadingText="Refreshing…"
            variant="contained"
            sx={{ bgcolor: "#4cbb17", "&:hover": { bgcolor: "#3aa40f" } }}
          >
            Refresh
          </LoadingButtonLite>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

ImportantInfoAdmin.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object),
  loading: PropTypes.bool,
  error: PropTypes.any,
};
