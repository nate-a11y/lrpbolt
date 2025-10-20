import { useState, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import LrpDataGridPro from "@/components/datagrid/LrpDataGridPro.jsx";
import LoadingButtonLite from "@/components/inputs/LoadingButtonLite.jsx";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import {
  createImportantInfo,
  updateImportantInfo,
  deleteImportantInfo,
  restoreImportantInfo,
  seedImportantInfoDefaults,
} from "@/services/importantInfoService.js";
import logError from "@/utils/logError.js";
import { formatDateTime } from "@/utils/time.js";

function ensureString(value) {
  if (value == null) return "";
  return String(value);
}

function buildPayload(values) {
  return {
    title: ensureString(values.title),
    blurb: ensureString(values.blurb),
    details: ensureString(values.details),
    category: ensureString(values.category) || "General",
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
  category: "General",
  phone: "",
  url: "",
  smsTemplate: "",
  isActive: true,
};

export default function ImportantInfoAdmin({ items, loading }) {
  const { show } = useSnack();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState("create");
  const [formValues, setFormValues] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [pendingMap, setPendingMap] = useState({});
  const [seeding, setSeeding] = useState(false);

  const rows = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  const categories = useMemo(() => {
    const set = new Set(["General"]);
    rows.forEach((row) => {
      if (row?.category) set.add(String(row.category));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const openCreate = useCallback(() => {
    setDialogMode("create");
    setFormValues(DEFAULT_FORM);
    setActiveId(null);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((row) => {
    if (!row) return;
    setDialogMode("edit");
    setActiveId(row.id || null);
    setFormValues({
      title: ensureString(row.title),
      blurb: ensureString(row.blurb),
      details: ensureString(row.details),
      category: row.category ? String(row.category) : "General",
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

  const handleSeedDefaults = useCallback(async () => {
    try {
      setSeeding(true);
      const result = await seedImportantInfoDefaults();
      const count = Number.isFinite(result?.count) ? result.count : 0;
      show(`Seeded ${count} items.`, "success");
    } catch (error) {
      logError(error, { where: "ImportantInfoAdmin.seedDefaults" });
      const causeCode =
        typeof error?.cause?.code === "string" ? error.cause.code : "";
      const appCode = typeof error?.code === "string" ? error.code : "";
      const finalCode = causeCode || appCode;
      const alreadySeeded = finalCode.includes("failed-precondition");
      show(
        alreadySeeded
          ? "Seeder skipped — items already exist."
          : "Seeder failed. Please try again.",
        "error",
      );
    } finally {
      setSeeding(false);
    }
  }, [show]);

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
      } catch (error) {
        logError(error, { where: "ImportantInfoAdmin.handleSubmit", activeId });
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
        const payload = buildPayload({ ...row, isActive: nextActive });
        await updateImportantInfo(row.id, payload);
        show(
          nextActive ? "Marked as active." : "Marked as inactive.",
          "success",
        );
      } catch (error) {
        logError(error, {
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
                } catch (error) {
                  logError(error, {
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
      } catch (error) {
        logError(error, {
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

  const columns = useMemo(() => {
    return [
      {
        field: "title",
        headerName: "Title",
        minWidth: 240,
        flex: 1.4,
        valueGetter: (params) => ensureString(params?.row?.title) || "Untitled",
        renderCell: (params) => {
          const row = params?.row || {};
          return (
            <Stack spacing={0.5} sx={{ py: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {row.title || "Untitled"}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {row.blurb || "N/A"}
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
        valueGetter: (params) =>
          ensureString(params?.row?.category) || "General",
      },
      {
        field: "isActive",
        headerName: "Active",
        minWidth: 120,
        flex: 0.4,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const row = params?.row || {};
          const id = row.id;
          return (
            <Switch
              size="small"
              checked={row.isActive !== false}
              disabled={pendingMap[id]}
              onChange={(event) =>
                handleToggleActive(row, event.target.checked)
              }
            />
          );
        },
      },
      {
        field: "updatedAt",
        headerName: "Updated",
        minWidth: 180,
        flex: 0.7,
        valueGetter: (params) => formatDateTime(params?.row?.updatedAt),
      },
      {
        field: "actions",
        headerName: "Actions",
        minWidth: 200,
        flex: 0.8,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => {
          const row = params?.row || {};
          const id = row.id;
          const disabled = pendingMap[id];
          return (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => openEdit(row)}
                disabled={disabled}
              >
                Edit
              </Button>
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={() => handleDelete(row)}
                disabled={disabled}
              >
                Delete
              </Button>
            </Stack>
          );
        },
      },
    ];
  }, [handleDelete, handleToggleActive, openEdit, pendingMap]);

  return (
    <Box
      sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 2 }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="flex-end"
      >
        <Button
          onClick={handleSeedDefaults}
          size="small"
          variant="outlined"
          disabled={seeding}
          sx={{
            borderColor: "#4cbb17",
            color: "#b7ffb7",
            minWidth: 140,
            "&:hover": { borderColor: "#43a814" },
          }}
        >
          {seeding ? "Seeding…" : "Seed Defaults"}
        </Button>
        <Button
          variant="contained"
          onClick={openCreate}
          sx={{ bgcolor: "#4cbb17", "&:hover": { bgcolor: "#3aa40f" } }}
        >
          Add Important Info
        </Button>
      </Stack>
      <LrpDataGridPro
        id="important-info-admin"
        rows={rows}
        columns={columns}
        getRowId={(row) => row?.id ?? null}
        loading={loading}
        autoHeight
        disableRowSelectionOnClick
        hideFooterSelectedRowCount
        slotProps={{
          toolbar: {
            quickFilterPlaceholder: "Search admin info",
          },
        }}
      />

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
            <TextField
              label="Category"
              value={formValues.category}
              onChange={(event) =>
                handleFieldChange("category", event.target.value)
              }
              select={false}
              helperText={
                categories.length ? `Suggested: ${categories.join(", ")}` : ""
              }
              fullWidth
            />
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
    </Box>
  );
}

ImportantInfoAdmin.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object),
  loading: PropTypes.bool,
};
