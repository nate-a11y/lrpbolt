// allow-color-literal-file

import { useState, useMemo, useCallback, useEffect } from "react";
import PropTypes from "prop-types";
import dayjs from "dayjs";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Popover,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  Link as MuiLink,
  ImageList,
  ImageListItem,
  ImageListItemBar,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import CircularProgress from "@mui/material/CircularProgress";
import { DateTimePicker } from "@mui/x-date-pickers-pro";

import LoadingButtonLite from "@/components/inputs/LoadingButtonLite.jsx";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import {
  createImportantInfo,
  updateImportantInfo,
  deleteImportantInfo,
  restoreImportantInfo,
} from "@/services/importantInfoService.js";
import { getSmsHealth, getLastSmsError } from "@/services/smsService.js";
import {
  uploadMultipleImages,
  deleteImportantInfoImage,
} from "@/services/importantInfoImageService.js";
import logError from "@/utils/logError.js";
import { formatDateTime, toDayjs } from "@/utils/time.js";
import {
  PROMO_PARTNER_CATEGORIES,
  PROMO_PARTNER_FILTER_OPTIONS,
} from "@/constants/importantInfo.js";

import BulkImportDialog from "./BulkImportDialog.jsx";
import SmsSendDialog from "./SmsSendDialog.jsx";

const DEFAULT_CATEGORY = PROMO_PARTNER_CATEGORIES[0] || "Promotions";

// Draft persistence key for admin form
const ADMIN_DRAFT_KEY = "important_info_admin_draft";

// Search history key
const SEARCH_HISTORY_KEY = "important_info_search_history";
const MAX_SEARCH_HISTORY = 5;

// Templates library key
const TEMPLATES_KEY = "important_info_sms_templates";
const MAX_TEMPLATES = 10;

// Category colors for visual distinction
const CATEGORY_COLORS = {
  "Promotions": { bg: "#1a3d1a", border: "#4caf50", text: "#81c784" },
  "Partners": { bg: "#1a1a3d", border: "#3f51b5", text: "#9fa8da" },
  "Referrals": { bg: "#3d1a1a", border: "#f44336", text: "#e57373" },
  "General": { bg: "#2a2a2a", border: "#757575", text: "#bdbdbd" },
};

// Load draft from localStorage
function loadAdminDraft() {
  try {
    const saved = localStorage.getItem(ADMIN_DRAFT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Don't restore if it's old (more than 7 days)
      if (parsed.savedAt && Date.now() - parsed.savedAt < 7 * 24 * 60 * 60 * 1000) {
        return parsed.formValues || null;
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

// Save draft to localStorage
function saveAdminDraft(formValues, mode, itemId = null) {
  try {
    // Save for both create and edit modes
    const key = mode === "edit" && itemId
      ? `${ADMIN_DRAFT_KEY}_edit_${itemId}`
      : ADMIN_DRAFT_KEY;

    localStorage.setItem(
      key,
      JSON.stringify({
        formValues: {
          title: formValues.title,
          blurb: formValues.blurb,
          details: formValues.details,
          category: formValues.category,
          phone: formValues.phone,
          url: formValues.url,
          smsTemplate: formValues.smsTemplate,
          isActive: formValues.isActive,
          // Don't save images in draft
        },
        savedAt: Date.now(),
        mode,
        itemId,
      })
    );
    return true;
  } catch {
    // Ignore localStorage errors
    return false;
  }
}

// Clear draft from localStorage
function clearAdminDraft(mode = "create", itemId = null) {
  try {
    if (mode === "edit" && itemId) {
      localStorage.removeItem(`${ADMIN_DRAFT_KEY}_edit_${itemId}`);
    } else {
      localStorage.removeItem(ADMIN_DRAFT_KEY);
    }
  } catch {
    // Ignore errors
  }
}

// Search history helpers (currently unused, reserved for future feature)
function loadSearchHistory() {
  try {
    const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function _saveSearchHistory(query) {
  if (!query || !query.trim()) return;
  try {
    const history = loadSearchHistory();
    const trimmed = query.trim();
    // Remove if already exists
    const filtered = history.filter(h => h !== trimmed);
    // Add to front
    const updated = [trimmed, ...filtered].slice(0, MAX_SEARCH_HISTORY);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Ignore errors
  }
}

// Templates library helpers
function loadTemplates() {
  try {
    const saved = localStorage.getItem(TEMPLATES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveTemplate(name, content) {
  if (!name || !name.trim() || !content || !content.trim()) return false;
  try {
    const templates = loadTemplates();
    const trimmedName = name.trim();
    const trimmedContent = content.trim();

    // Remove if template with same name exists
    const filtered = templates.filter(t => t.name !== trimmedName);

    // Add new template
    const updated = [
      { name: trimmedName, content: trimmedContent, savedAt: Date.now() },
      ...filtered
    ].slice(0, MAX_TEMPLATES);

    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

function deleteTemplate(name) {
  if (!name) return false;
  try {
    const templates = loadTemplates();
    const filtered = templates.filter(t => t.name !== name);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
}

// CSV export helper
function exportToCSV(rows, filename = "important-info.csv") {
  if (!rows || rows.length === 0) return;

  const headers = ["Title", "Category", "Blurb", "Details", "Phone", "URL", "SMS Template", "Active", "Updated"];
  const csvRows = [
    headers.join(","),
    ...rows.map(row => [
      `"${(row.title || "").replace(/"/g, '""')}"`,
      `"${(row.category || "").replace(/"/g, '""')}"`,
      `"${(row.blurb || "").replace(/"/g, '""')}"`,
      `"${(row.details || "").replace(/"/g, '""')}"`,
      `"${(row.phone || "").replace(/"/g, '""')}"`,
      `"${(row.url || "").replace(/"/g, '""')}"`,
      `"${(row.smsTemplate || "").replace(/"/g, '""')}"`,
      row.isActive !== false ? "Yes" : "No",
      row.updatedAt ? new Date(row.updatedAt.toMillis ? row.updatedAt.toMillis() : row.updatedAt).toLocaleString() : "",
    ].join(","))
  ];

  const csvContent = csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Get category color
function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS["General"];
}

// Generate SMS preview for an item
function generateSmsPreview(item) {
  if (!item) return "";

  // Use custom template if available
  if (item.smsTemplate && item.smsTemplate.trim()) {
    return item.smsTemplate.trim();
  }

  // Auto-generate preview
  const parts = [];

  if (item.title) {
    parts.push(`📢 ${item.title}`);
  }

  if (item.blurb) {
    parts.push(`\n\n${item.blurb}`);
  }

  if (item.details) {
    const truncated = item.details.length > 100
      ? item.details.substring(0, 100) + "..."
      : item.details;
    parts.push(`\n\n${truncated}`);
  }

  if (item.phone) {
    parts.push(`\n\n📞 ${item.phone}`);
  }

  if (item.url) {
    parts.push(`\n\n🔗 ${item.url}`);
  }

  if (item.images && item.images.length > 0) {
    parts.push(`\n\n📷 ${item.images.length} image${item.images.length > 1 ? "s" : ""} attached`);
  }

  return parts.join("");
}

function ensureString(value) {
  if (value == null) return "";
  return String(value);
}

// Sortable Item Component for drag-and-drop
function SortableItem({ id, children, disabled }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}

SortableItem.propTypes = {
  id: PropTypes.string.isRequired,
  children: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

function normalizeCategory(value) {
  const label = ensureString(value).trim();
  return PROMO_PARTNER_CATEGORIES.includes(label) ? label : DEFAULT_CATEGORY;
}

function buildPayload(values) {
  const payload = {
    title: ensureString(values.title),
    blurb: ensureString(values.blurb),
    details: ensureString(values.details),
    category: normalizeCategory(values.category),
    phone: ensureString(values.phone),
    url: ensureString(values.url),
    smsTemplate: ensureString(values.smsTemplate),
    isActive: values.isActive !== false,
  };

  // Add publishDate if provided (scheduled publishing)
  if (values.publishDate) {
    const date = dayjs(values.publishDate);
    if (date.isValid()) {
      payload.publishDate = date.toISOString();
    }
  }

  return payload;
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
  images: [],
  publishDate: null,
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
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [selectedItemForSms, setSelectedItemForSms] = useState(null);
  const [draftStatus, setDraftStatus] = useState("idle"); // idle, saving, saved
  const [draftSaveTimeout, setDraftSaveTimeout] = useState(null);
  const [frozenOrder, setFrozenOrder] = useState(null); // Freeze list order during edit
  const [selectedIds, setSelectedIds] = useState([]); // Bulk selection
  const [previewAnchor, setPreviewAnchor] = useState(null); // Quick preview popover
  const [previewItem, setPreviewItem] = useState(null); // Item being previewed
  const [templatesAnchor, setTemplatesAnchor] = useState(null); // Templates menu anchor
  const [templates, setTemplates] = useState([]); // Saved templates
  const [isDragging, setIsDragging] = useState(false); // Track if currently dragging

  const rows = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const hasRows = rows.length > 0;
  const showError = Boolean(error) && !loading;

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load templates when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      setTemplates(loadTemplates());
    }
  }, [dialogOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) {
        // Allow "/" to focus search even in inputs
        if (e.key === "/" && e.target.tagName !== "INPUT") {
          e.preventDefault();
          document.querySelector('input[aria-label="Search important info admin list"]')?.focus();
        }
        return;
      }

      // N = New Item
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        openCreate();
      }

      // / = Focus Search
      if (e.key === "/") {
        e.preventDefault();
        document.querySelector('input[aria-label="Search important info admin list"]')?.focus();
      }

      // Escape = Clear selection or close dialog
      if (e.key === "Escape") {
        if (selectedIds.length > 0) {
          setSelectedIds([]);
        } else if (dialogOpen) {
          closeDialog();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openCreate, selectedIds.length, dialogOpen, closeDialog]);
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

    // If we have a frozen order (during edit), maintain that order
    if (frozenOrder && frozenOrder.length > 0) {
      // Sort by frozen order, putting new items at the end
      filtered.sort((a, b) => {
        const aIndex = frozenOrder.indexOf(a.id);
        const bIndex = frozenOrder.indexOf(b.id);
        // If both in frozen order, maintain that order
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        // If only a is in frozen order, a comes first
        if (aIndex !== -1) return -1;
        // If only b is in frozen order, b comes first
        if (bIndex !== -1) return 1;
        // Neither in frozen order, use normal sorting
        return 0;
      });
    } else {
      // Normal sorting
      filtered.sort((a, b) => {
        // If both have order field, sort by order (for manual reordering within category)
        if (typeof a?.order === "number" && typeof b?.order === "number") {
          return a.order - b.order;
        }
        // Fall back to other sorting methods
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
    }

    return filtered;
  }, [rows, debouncedQuery, categoryFilter, sortBy, frozenOrder]);

  const openCreate = useCallback(() => {
    setDialogMode("create");
    // Try to load draft
    const draft = loadAdminDraft();
    if (draft) {
      setFormValues({ ...DEFAULT_FORM, ...draft });
    } else {
      setFormValues(DEFAULT_FORM);
    }
    setActiveId(null);
    setPendingFiles([]);
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

  const handleOpenSmsDialog = useCallback((item) => {
    if (!item) return;
    setSelectedItemForSms(item);
    setSmsDialogOpen(true);
  }, []);

  const handleCloseSmsDialog = useCallback(() => {
    setSmsDialogOpen(false);
    setSelectedItemForSms(null);
  }, []);

  const handleSmsSent = useCallback(async (itemId) => {
    if (!itemId) return;
    try {
      // Increment sendCount
      const item = rows.find(r => r.id === itemId);
      const currentCount = typeof item?.sendCount === "number" ? item.sendCount : 0;
      await updateImportantInfo(itemId, { sendCount: currentCount + 1 });
    } catch (err) {
      logError(err, { where: "ImportantInfoAdmin.handleSmsSent", itemId });
      // Don't show error to user - this is a background operation
    }
  }, [rows]);

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
      images: Array.isArray(row.images) ? row.images : [],
      isActive: row.isActive !== false,
      publishDate: row.publishDate ? dayjs(row.publishDate) : null,
    });
    setPendingFiles([]);
    // Freeze the current list order to prevent jumping during auto-save
    setFrozenOrder(filteredRows.map(r => r.id));
    setDialogOpen(true);
  }, [filteredRows]);

  const closeDialog = useCallback(() => {
    if (saving || uploading) return;
    // Save draft before closing
    saveAdminDraft(formValues, dialogMode, activeId);
    setDialogOpen(false);
    setActiveId(null);
    setDraftStatus("idle");
    // Clear any pending save timeout
    if (draftSaveTimeout) {
      clearTimeout(draftSaveTimeout);
      setDraftSaveTimeout(null);
    }
    // Unfreeze list order to resume normal sorting
    setFrozenOrder(null);
  }, [saving, uploading, dialogMode, formValues, activeId, draftSaveTimeout]);

  const handleFieldChange = useCallback((field, value) => {
    setFormValues((prev) => {
      const updated = { ...prev, [field]: value };

      // Clear any existing timeout
      if (draftSaveTimeout) {
        clearTimeout(draftSaveTimeout);
      }

      // Show "saving" status immediately
      setDraftStatus("saving");

      // Debounce the save
      const timeout = setTimeout(async () => {
        if (dialogMode === "edit" && activeId) {
          // EDIT MODE: Actually save to Firestore (updates timestamp but list stays frozen)
          try {
            const payload = buildPayload(updated);
            // Preserve existing images
            if (formValues.images) {
              payload.images = formValues.images;
            }
            await updateImportantInfo(activeId, payload);
            setDraftStatus("saved");
            // Reset to idle after 2 seconds
            setTimeout(() => setDraftStatus("idle"), 2000);
          } catch (err) {
            logError(err, { where: "ImportantInfoAdmin.handleFieldChange.autoSave", activeId });
            setDraftStatus("idle");
            show("Auto-save failed. Changes not saved.", "error");
          }
        } else {
          // CREATE MODE: Save to localStorage as draft
          const success = saveAdminDraft(updated, dialogMode, activeId);
          if (success) {
            setDraftStatus("saved");
            // Reset to idle after 2 seconds
            setTimeout(() => setDraftStatus("idle"), 2000);
          } else {
            setDraftStatus("idle");
          }
        }
      }, 800); // 800ms debounce

      setDraftSaveTimeout(timeout);

      return updated;
    });
  }, [dialogMode, activeId, draftSaveTimeout, formValues.images, show]);

  const handleResetDraft = useCallback(() => {
    // eslint-disable-next-line no-alert
    const confirmed = window.confirm(
      "Clear this draft? All unsaved changes will be lost."
    );
    if (!confirmed) return;

    clearAdminDraft(dialogMode, activeId);
    setFormValues(DEFAULT_FORM);
    setPendingFiles([]);
    setDraftStatus("idle");
    show("Draft cleared.", "info");
  }, [dialogMode, activeId, show]);

  const handleFileSelect = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Reset the input so the same file can be selected again
    event.target.value = "";

    // EDIT MODE: Upload and save immediately
    if (dialogMode === "edit" && activeId) {
      setUploading(true);
      setDraftStatus("saving");
      try {
        const uploadedImages = await uploadMultipleImages(activeId, files);
        const updatedImages = [...(formValues.images || []), ...uploadedImages];

        // Update Firestore immediately (updates timestamp but list stays frozen)
        await updateImportantInfo(activeId, { images: updatedImages });

        // Update form state
        setFormValues((prev) => ({
          ...prev,
          images: updatedImages,
        }));

        setDraftStatus("saved");
        setTimeout(() => setDraftStatus("idle"), 2000);
        show(`${files.length} image${files.length > 1 ? "s" : ""} uploaded.`, "success");
      } catch (err) {
        logError(err, {
          where: "ImportantInfoAdmin.handleFileSelect.autoUpload",
          itemId: activeId,
        });
        setDraftStatus("idle");
        show("Failed to upload images.", "error");
      } finally {
        setUploading(false);
      }
    } else {
      // CREATE MODE: Add to pending files
      setPendingFiles((prev) => [...prev, ...files]);
    }
  }, [dialogMode, activeId, formValues.images, show]);

  const handleRemovePendingFile = useCallback((index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleRemoveExistingImage = useCallback(
    async (image) => {
      if (!image) return;
      // eslint-disable-next-line no-alert
      const confirmed = window.confirm(
        "Remove this image? This cannot be undone.",
      );
      if (!confirmed) return;

      setDraftStatus("saving");
      try {
        const updatedImages = (formValues.images || []).filter((img) => img.id !== image.id);

        // Update form state
        setFormValues((prev) => ({
          ...prev,
          images: updatedImages,
        }));

        // If editing an existing item, delete from storage and update Firestore
        if (dialogMode === "edit" && activeId) {
          if (image.storagePath) {
            await deleteImportantInfoImage(image.storagePath);
          }
          // Update Firestore with new images array (updates timestamp but list stays frozen)
          await updateImportantInfo(activeId, { images: updatedImages });
          setDraftStatus("saved");
          setTimeout(() => setDraftStatus("idle"), 2000);
          show("Image removed.", "success");
        } else {
          setDraftStatus("idle");
        }
      } catch (err) {
        logError(err, {
          where: "ImportantInfoAdmin.handleRemoveExistingImage",
          imageId: image.id,
        });
        setDraftStatus("idle");
        show("Failed to remove image.", "error");
      }
    },
    [activeId, dialogMode, formValues.images, show],
  );

  const handleSubmit = useCallback(
    async (event) => {
      event?.preventDefault();
      try {
        setSaving(true);

        let itemId = activeId;
        let updatedImages = [...(formValues.images || [])];

        // If creating a new item, create it first to get an ID
        if (dialogMode === "create" && !itemId) {
          const payload = buildPayload(formValues);
          itemId = await createImportantInfo(payload);
        }

        // Upload pending files if we have any
        if (pendingFiles.length > 0 && itemId) {
          setUploading(true);
          try {
            const uploadedImages = await uploadMultipleImages(
              itemId,
              pendingFiles,
            );
            updatedImages = [...updatedImages, ...uploadedImages];
          } catch (uploadErr) {
            logError(uploadErr, {
              where: "ImportantInfoAdmin.handleSubmit.upload",
              itemId,
            });
            show("Some images failed to upload.", "warning");
          } finally {
            setUploading(false);
          }
        }

        // Update with final payload including images
        const finalPayload = {
          ...buildPayload(formValues),
          images: updatedImages,
        };

        if (dialogMode === "edit" && activeId) {
          await updateImportantInfo(activeId, finalPayload);
          show("Important info updated.", "success");
          // Clear draft on successful edit
          clearAdminDraft("edit", activeId);
        } else if (dialogMode === "create" && itemId) {
          // Update the newly created item with full payload including images
          await updateImportantInfo(itemId, finalPayload);
          show("Important info created.", "success");
          // Clear draft on successful creation
          clearAdminDraft("create");
        }

        setDialogOpen(false);
        setActiveId(null);
        setPendingFiles([]);
        setDraftStatus("idle");
        // Unfreeze list order to allow item to move to top
        setFrozenOrder(null);
      } catch (err) {
        logError(err, { where: "ImportantInfoAdmin.handleSubmit", activeId });
        show("Failed to save. Please try again.", "error");
      } finally {
        setSaving(false);
        setUploading(false);
      }
    },
    [activeId, dialogMode, formValues, pendingFiles, show],
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
      // eslint-disable-next-line no-alert
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

  const handleDuplicate = useCallback(
    async (row) => {
      if (!row) return;
      setRowPending(row.id, true);
      try {
        const duplicateData = {
          title: `${row.title} (Copy)`,
          blurb: row.blurb,
          details: row.details,
          category: row.category,
          phone: row.phone,
          url: row.url,
          smsTemplate: row.smsTemplate,
          isActive: false, // Start as inactive
          images: row.images || [], // Copy images array
        };
        await createImportantInfo(duplicateData);
        show(`Duplicated "${row.title}".`, "success");
      } catch (err) {
        logError(err, {
          where: "ImportantInfoAdmin.handleDuplicate",
          id: row.id,
        });
        show("Failed to duplicate item.", "error");
      } finally {
        setRowPending(row.id, false);
      }
    },
    [setRowPending, show],
  );

  const handleExportCSV = useCallback(() => {
    exportToCSV(filteredRows);
    show(`Exported ${filteredRows.length} item${filteredRows.length !== 1 ? "s" : ""} to CSV.`, "success");
  }, [filteredRows, show]);

  const handleSelectAll = useCallback((event) => {
    if (event.target.checked) {
      setSelectedIds(filteredRows.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  }, [filteredRows]);

  const handleSelectOne = useCallback((id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  const handleBulkActivate = useCallback(async () => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(selectedIds.map(id =>
        updateImportantInfo(id, { isActive: true })
      ));
      show(`Activated ${selectedIds.length} item${selectedIds.length !== 1 ? "s" : ""}.`, "success");
      setSelectedIds([]);
    } catch (err) {
      logError(err, { where: "ImportantInfoAdmin.handleBulkActivate" });
      show("Failed to activate items.", "error");
    }
  }, [selectedIds, show]);

  const handleBulkDeactivate = useCallback(async () => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(selectedIds.map(id =>
        updateImportantInfo(id, { isActive: false })
      ));
      show(`Deactivated ${selectedIds.length} item${selectedIds.length !== 1 ? "s" : ""}.`, "success");
      setSelectedIds([]);
    } catch (err) {
      logError(err, { where: "ImportantInfoAdmin.handleBulkDeactivate" });
      show("Failed to deactivate items.", "error");
    }
  }, [selectedIds, show]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return;
    // eslint-disable-next-line no-alert
    const confirmed = window.confirm(`Delete ${selectedIds.length} item${selectedIds.length !== 1 ? "s" : ""}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await Promise.all(selectedIds.map(id => deleteImportantInfo(id)));
      show(`Deleted ${selectedIds.length} item${selectedIds.length !== 1 ? "s" : ""}.`, "info");
      setSelectedIds([]);
    } catch (err) {
      logError(err, { where: "ImportantInfoAdmin.handleBulkDelete" });
      show("Failed to delete items.", "error");
    }
  }, [selectedIds, show]);

  const handlePreviewOpen = useCallback((event, item) => {
    setPreviewAnchor(event.currentTarget);
    setPreviewItem(item);
  }, []);

  const handlePreviewClose = useCallback(() => {
    setPreviewAnchor(null);
    setPreviewItem(null);
  }, []);

  const handleOpenTemplatesMenu = useCallback((event) => {
    setTemplatesAnchor(event.currentTarget);
    setTemplates(loadTemplates());
  }, []);

  const handleCloseTemplatesMenu = useCallback(() => {
    setTemplatesAnchor(null);
  }, []);

  const handleLoadTemplate = useCallback((template) => {
    handleFieldChange("smsTemplate", template.content);
    handleCloseTemplatesMenu();
    show(`Template "${template.name}" loaded.`, "success");
  }, [handleFieldChange, handleCloseTemplatesMenu, show]);

  const handleSaveTemplate = useCallback(() => {
    const content = formValues.smsTemplate?.trim();
    if (!content) {
      show("Enter an SMS template first.", "warning");
      return;
    }

    // eslint-disable-next-line no-alert
    const name = window.prompt("Enter a name for this template:");
    if (!name || !name.trim()) return;

    const success = saveTemplate(name.trim(), content);
    if (success) {
      setTemplates(loadTemplates());
      show(`Template "${name.trim()}" saved.`, "success");
    } else {
      show("Failed to save template.", "error");
    }
  }, [formValues.smsTemplate, show]);

  const handleDeleteTemplate = useCallback((event, templateName) => {
    event.stopPropagation();
    // eslint-disable-next-line no-alert
    const confirmed = window.confirm(`Delete template "${templateName}"?`);
    if (!confirmed) return;

    const success = deleteTemplate(templateName);
    if (success) {
      setTemplates(loadTemplates());
      show(`Template "${templateName}" deleted.`, "info");
    } else {
      show("Failed to delete template.", "error");
    }
  }, [show]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    // Close preview popover during drag
    setPreviewAnchor(null);
    setPreviewItem(null);
  }, []);

  const handleDragEnd = useCallback(async (event) => {
    setIsDragging(false);
    const { active, over } = event;

    if (!active || !over || active.id === over.id) {
      return;
    }

    const oldIndex = filteredRows.findIndex((item) => item.id === active.id);
    const newIndex = filteredRows.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder the items
    const reordered = arrayMove(filteredRows, oldIndex, newIndex);

    // Update the order field for all affected items
    try {
      // Update each item with its new order
      await Promise.all(
        reordered.map((item, index) =>
          updateImportantInfo(item.id, { order: index })
        )
      );
      show("Order updated successfully.", "success");
    } catch (err) {
      logError(err, { where: "ImportantInfoAdmin.handleDragEnd" });
      show("Failed to update order.", "error");
    }
  }, [filteredRows, show]);

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
            sx={{
              bgcolor: (t) => t.palette.primary.main,
              "&:hover": { bgcolor: "#3aa40f" },
            }}
          >
            New Item
          </Button>
          <Button
            variant="outlined"
            onClick={() => setImportDialogOpen(true)}
            sx={{
              borderColor: (t) => t.palette.primary.main,
              color: "#b7ffb7",
            }}
          >
            Import Excel
          </Button>
          <LoadingButtonLite
            variant="outlined"
            onClick={openHealthDialog}
            loading={healthLoading && healthDialogOpen}
            sx={{
              borderColor: (t) => t.palette.primary.main,
              color: "#b7ffb7",
              minWidth: 140,
            }}
          >
            SMS Health
          </LoadingButtonLite>
          <Button
            variant="outlined"
            onClick={handleExportCSV}
            startIcon={<FileDownloadIcon />}
            disabled={!filteredRows.length}
            sx={{
              borderColor: (t) => t.palette.primary.main,
              color: "#b7ffb7",
            }}
          >
            Export CSV
          </Button>
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
          sx={{
            maxWidth: { md: 360 },
            bgcolor: (t) => t.palette.background.paper,
          }}
          InputProps={{ sx: { color: (t) => t.palette.text.primary } }}
          inputProps={{ "aria-label": "Search important info admin list" }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel sx={{ color: (t) => t.palette.text.primary }}>
            Category
          </InputLabel>
          <Select
            label="Category"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            sx={{
              color: (t) => t.palette.text.primary,
              bgcolor: (t) => t.palette.background.paper,
            }}
          >
            {categories.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel sx={{ color: (t) => t.palette.text.primary }}>
            Sort
          </InputLabel>
          <Select
            label="Sort"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            sx={{
              color: (t) => t.palette.text.primary,
              bgcolor: (t) => t.palette.background.paper,
            }}
          >
            <MenuItem value="updated">Updated (newest)</MenuItem>
            <MenuItem value="title">Title (A–Z)</MenuItem>
            <MenuItem value="category">Category (A–Z)</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {selectedIds.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            p: 1.5,
            bgcolor: (t) => t.palette.background.paper,
            border: 1,
            borderColor: (t) => t.palette.primary.main,
            borderRadius: 1,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {selectedIds.length} selected
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={handleBulkActivate}
            sx={{ textTransform: "none" }}
          >
            Activate
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={handleBulkDeactivate}
            sx={{ textTransform: "none" }}
          >
            Deactivate
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={handleBulkDelete}
            sx={{ textTransform: "none" }}
          >
            Delete
          </Button>
          <Button
            size="small"
            onClick={() => setSelectedIds([])}
            sx={{ textTransform: "none", ml: "auto" }}
          >
            Clear Selection
          </Button>
        </Stack>
      )}

      {showError ? (
        <Box sx={{ p: 2 }}>
          <Stack
            spacing={1.5}
            sx={{
              bgcolor: "#1a0b0b",
              border: 1,
              borderColor: "divider",
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
                borderColor: (t) => t.palette.primary.main,
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
              bgcolor: (t) => t.palette.background.paper,
              border: 1,
              borderColor: "divider",
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
              sx={{
                bgcolor: (t) => t.palette.primary.main,
                "&:hover": { bgcolor: "#3aa40f" },
              }}
            >
              Add first item
            </Button>
          </Stack>
        </Box>
      ) : null}

      {!showError && !showEmpty ? (
        <Stack spacing={1.25} sx={{ width: "100%" }}>
          {filteredRows.length > 0 && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={selectedIds.length === filteredRows.length && filteredRows.length > 0}
                  indeterminate={selectedIds.length > 0 && selectedIds.length < filteredRows.length}
                  onChange={handleSelectAll}
                />
              }
              label={`Select All (${filteredRows.length})`}
              sx={{ ml: 0.5 }}
            />
          )}

          {loading && !filteredRows.length ? (
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              Loading important info…
            </Typography>
          ) : null}

          {!loading && hasRows && !filteredRows.length ? (
            <Box
              sx={(t) => ({
                p: 2,
                borderRadius: 2,
                border: `1px solid ${t.palette.divider}`,
                bgcolor: t.palette.background.paper,
              })}
            >
              <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                No matches for your filters.
              </Typography>
            </Box>
          ) : null}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredRows.map(r => r.id)}
              strategy={verticalListSortingStrategy}
            >
              {filteredRows.map((row) => {
            const id = row?.id;
            const disabled = !!pendingMap[id];
            const updatedLabel = formatDateTime(row?.updatedAt);
            const categoryLabel = row?.category
              ? String(row.category)
              : DEFAULT_CATEGORY;
            const telHref = toTelHref(row?.phone);

            return (
              <SortableItem key={id} id={id} disabled={disabled || isDragging}>
                {({ attributes, listeners, isDragging: itemIsDragging }) => (
                  <Card
                    variant="outlined"
                    onMouseEnter={(e) => !itemIsDragging && handlePreviewOpen(e, row)}
                    onMouseLeave={handlePreviewClose}
                    sx={(t) => ({
                      bgcolor: t.palette.background.paper,
                      borderColor: t.palette.divider,
                      borderRadius: 3,
                      cursor: itemIsDragging ? "grabbing" : "default",
                    })}
                  >
                    <CardContent sx={{ pb: 1.5 }}>
                      <Stack spacing={1.25}>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="flex-start"
                        >
                          <IconButton
                            size="small"
                            sx={{
                              mt: -0.5,
                              cursor: disabled ? "not-allowed" : "grab",
                              "&:active": { cursor: "grabbing" },
                              color: (t) => t.palette.text.secondary
                            }}
                            disabled={disabled}
                            {...attributes}
                            {...listeners}
                          >
                            <DragIndicatorIcon fontSize="small" />
                          </IconButton>
                          <Checkbox
                            checked={selectedIds.includes(id)}
                            onChange={() => handleSelectOne(id)}
                            disabled={disabled}
                            sx={{ mt: -0.5 }}
                          />
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                        sx={{ flex: 1 }}
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
                        <Stack direction="column" spacing={0.5} alignItems="flex-end">
                          <Chip
                            size="small"
                            label={categoryLabel}
                            sx={{
                              fontWeight: 600,
                              bgcolor: getCategoryColor(categoryLabel).bg,
                              color: getCategoryColor(categoryLabel).text,
                              border: `1px solid ${getCategoryColor(categoryLabel).border}`,
                            }}
                          />
                          {row?.publishDate && dayjs(row.publishDate).isAfter(dayjs()) && (
                            <Chip
                              size="small"
                              label={`📅 Scheduled: ${dayjs(row.publishDate).format("MMM D, YYYY h:mm A")}`}
                              sx={{
                                fontWeight: 600,
                                fontSize: "0.7rem",
                                bgcolor: "#2a1f11",
                                color: "#ffdca8",
                                border: "1px solid #ff9800",
                              }}
                            />
                          )}
                          {typeof row?.sendCount === "number" && row.sendCount > 0 && (
                            <Chip
                              size="small"
                              label={`📊 ${row.sendCount} SMS sent`}
                              sx={{
                                fontWeight: 600,
                                fontSize: "0.7rem",
                                bgcolor: "#1a1a3d",
                                color: "#9fa8da",
                                border: "1px solid #3f51b5",
                              }}
                            />
                          )}
                        </Stack>
                      </Stack>
                    </Stack>

                    {row?.blurb ? (
                      <Typography variant="body2" sx={{ opacity: 0.85 }}>
                        {row.blurb}
                      </Typography>
                    ) : null}

                    {row?.images && row.images.length > 0 ? (
                      <Box>
                        <ImageList
                          sx={{ width: "100%", maxHeight: 200 }}
                          cols={3}
                          rowHeight={120}
                        >
                          {row.images.slice(0, 6).map((image) => (
                            <ImageListItem key={image.id}>
                              <img
                                src={image.url}
                                alt={image.name || "Image"}
                                loading="lazy"
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  borderRadius: 4,
                                }}
                              />
                            </ImageListItem>
                          ))}
                        </ImageList>
                        {row.images.length > 6 ? (
                          <Typography
                            variant="caption"
                            sx={{ opacity: 0.7, display: "block", mt: 0.5 }}
                          >
                            +{row.images.length - 6} more image
                            {row.images.length - 6 > 1 ? "s" : ""}
                          </Typography>
                        ) : null}
                      </Box>
                    ) : null}

                    {row?.details ? (
                      <Box>
                        <Divider
                          sx={{ borderColor: (t) => t.palette.divider, mb: 1 }}
                        />
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
                              sx={{
                                color: (t) => t.palette.primary.main,
                                fontWeight: 600,
                              }}
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
                            sx={{
                              color: (t) => t.palette.primary.main,
                              fontWeight: 600,
                            }}
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
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleOpenSmsDialog(row)}
                      disabled={disabled}
                      sx={{
                        borderColor: (t) => t.palette.primary.main,
                        color: "#b7ffb7",
                        fontWeight: 600,
                        textTransform: "none",
                      }}
                      aria-label={`Test SMS for ${row?.title || "item"}`}
                    >
                      Test SMS
                    </Button>
                    <Tooltip title="Edit">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => openEdit(row)}
                          disabled={disabled}
                          sx={{ color: (t) => t.palette.primary.main }}
                          aria-label={`Edit ${row?.title || "important info"}`}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Duplicate">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => handleDuplicate(row)}
                          disabled={disabled}
                          sx={{ color: (t) => t.palette.info.main }}
                          aria-label={`Duplicate ${row?.title || "important info"}`}
                        >
                          <ContentCopyIcon fontSize="small" />
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
                )}
              </SortableItem>
            );
          })}
            </SortableContext>
          </DndContext>
        </Stack>
      ) : null}

      <BulkImportDialog open={importDialogOpen} onClose={handleImportClose} />

      <Dialog
        open={dialogOpen}
        onClose={null}
        fullWidth
        maxWidth="md"
        component="form"
        onSubmit={handleSubmit}
        disableEscapeKeyDown={saving || uploading}
        sx={{ "& .MuiPaper-root": { bgcolor: "background.paper" } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {dialogMode === "edit"
                ? "Edit Important Info"
                : "Create Important Info"}
            </Typography>
            {draftStatus !== "idle" && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                {draftStatus === "saving" ? (
                  <>
                    <CircularProgress size={16} sx={{ color: (t) => t.palette.text.secondary }} />
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                      {dialogMode === "edit" ? "Auto-saving..." : "Saving draft..."}
                    </Typography>
                  </>
                ) : draftStatus === "saved" ? (
                  <>
                    <CheckCircleIcon sx={{ fontSize: 16, color: (t) => t.palette.primary.main }} />
                    <Typography variant="caption" sx={{ color: (t) => t.palette.primary.main }}>
                      {dialogMode === "edit" ? "Auto-saved" : "Draft saved"}
                    </Typography>
                  </>
                ) : null}
              </Stack>
            )}
          </Stack>
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
            <Box>
              <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1 }}>
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
                <Stack direction="column" spacing={0.5} sx={{ mt: 0.5 }}>
                  <Tooltip title="Load saved template">
                    <IconButton
                      size="small"
                      onClick={handleOpenTemplatesMenu}
                      sx={{ color: (t) => t.palette.primary.main }}
                    >
                      <BookmarkBorderIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Save as template">
                    <IconButton
                      size="small"
                      onClick={handleSaveTemplate}
                      disabled={!formValues.smsTemplate?.trim()}
                      sx={{ color: (t) => t.palette.primary.main }}
                    >
                      <BookmarkIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </Box>
            <Divider sx={{ borderColor: (t) => t.palette.divider, my: 1 }} />
            <Box>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mb: 1.5 }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Images
                </Typography>
                <Chip
                  size="small"
                  label={`${(formValues.images || []).length + pendingFiles.length}`}
                  sx={{ fontWeight: 600, fontSize: "0.75rem" }}
                />
              </Stack>
              <Button
                variant="outlined"
                component="label"
                startIcon={<AddPhotoAlternateIcon />}
                disabled={saving || uploading}
                sx={{
                  borderColor: (t) => t.palette.primary.main,
                  color: "#b7ffb7",
                  mb: 2,
                }}
              >
                Add Images
                <input
                  type="file"
                  hidden
                  multiple
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleFileSelect}
                />
              </Button>
              <Typography variant="caption" sx={{ display: "block", mb: 2 }}>
                Upload images to include in SMS (MMS). Max 5MB per image.
              </Typography>
              {((formValues.images || []).length > 0 ||
                pendingFiles.length > 0) && (
                <ImageList
                  sx={{ width: "100%", maxHeight: 300 }}
                  cols={3}
                  rowHeight={164}
                >
                  {(formValues.images || []).map((image) => (
                    <ImageListItem key={image.id}>
                      <img
                        src={image.url}
                        alt={image.name || "Uploaded"}
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                      <ImageListItemBar
                        sx={{
                          background:
                            "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0) 100%)",
                        }}
                        position="top"
                        actionIcon={
                          <IconButton
                            sx={{ color: "rgba(255, 255, 255, 0.85)" }}
                            aria-label={`Delete ${image.name || "image"}`}
                            onClick={() => handleRemoveExistingImage(image)}
                            disabled={saving || uploading}
                          >
                            <CloseIcon />
                          </IconButton>
                        }
                        actionPosition="right"
                      />
                    </ImageListItem>
                  ))}
                  {pendingFiles.map((file, index) => (
                    <ImageListItem
                      key={`pending-${file.name}-${file.size}-${file.lastModified || index}`}
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                      <ImageListItemBar
                        sx={{
                          background:
                            "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0) 100%)",
                        }}
                        position="top"
                        title={
                          <Chip
                            size="small"
                            label="Pending"
                            sx={{
                              bgcolor: "warning.main",
                              color: "warning.contrastText",
                              fontWeight: 600,
                            }}
                          />
                        }
                        actionIcon={
                          <IconButton
                            sx={{ color: "rgba(255, 255, 255, 0.85)" }}
                            aria-label={`Remove ${file.name}`}
                            onClick={() => handleRemovePendingFile(index)}
                            disabled={saving || uploading}
                          >
                            <CloseIcon />
                          </IconButton>
                        }
                        actionPosition="right"
                      />
                    </ImageListItem>
                  ))}
                </ImageList>
              )}
            </Box>
            <Divider sx={{ borderColor: (t) => t.palette.divider, my: 1 }} />
            <Stack direction="row" spacing={1} alignItems="center">
              <Switch
                checked={formValues.isActive}
                onChange={(event) =>
                  handleFieldChange("isActive", event.target.checked)
                }
              />
              <Typography variant="body2">Active</Typography>
            </Stack>
            <Divider sx={{ borderColor: (t) => t.palette.divider, my: 1 }} />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Scheduled Publishing (Optional)
              </Typography>
              <DateTimePicker
                label="Publish Date"
                value={formValues.publishDate}
                onChange={(newValue) => handleFieldChange("publishDate", newValue)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: "small",
                    helperText: "Set a future date to auto-activate this item. Leave empty for immediate activation.",
                  },
                }}
                minDateTime={dayjs()}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
          <Box>
            {dialogMode === "create" && (
              <Button
                onClick={handleResetDraft}
                disabled={saving || uploading}
                startIcon={<RestartAltIcon />}
                sx={{ color: (t) => t.palette.text.secondary }}
              >
                Clear Draft
              </Button>
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            <Button onClick={closeDialog} disabled={saving || uploading}>
              Cancel
            </Button>
            <LoadingButtonLite
              type="submit"
              loading={saving}
              loadingText="Saving…"
              variant="contained"
              sx={{
                bgcolor: (t) => t.palette.primary.main,
                "&:hover": { bgcolor: "#3aa40f" },
              }}
            >
              {dialogMode === "edit" ? "Save Changes" : "Create"}
            </LoadingButtonLite>
          </Stack>
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
                <Stack
                  spacing={0.5}
                  sx={{ color: (t) => t.palette.text.primary }}
                >
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
                <Divider sx={{ borderColor: (t) => t.palette.divider }} />
                <Stack
                  spacing={0.75}
                  sx={{ color: (t) => t.palette.text.primary }}
                >
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
                <Divider sx={{ borderColor: (t) => t.palette.divider }} />
                <Stack
                  spacing={0.75}
                  sx={{ color: (t) => t.palette.text.primary }}
                >
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
                    <Divider sx={{ borderColor: (t) => t.palette.divider }} />
                    <Stack
                      spacing={0.75}
                      sx={{ color: (t) => t.palette.text.primary }}
                    >
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
            sx={{
              bgcolor: (t) => t.palette.primary.main,
              "&:hover": { bgcolor: "#3aa40f" },
            }}
          >
            Refresh
          </LoadingButtonLite>
        </DialogActions>
      </Dialog>

      <SmsSendDialog
        open={smsDialogOpen}
        onClose={handleCloseSmsDialog}
        onSuccess={handleSmsSent}
        item={selectedItemForSms}
      />

      <Popover
        open={Boolean(previewAnchor)}
        anchorEl={previewAnchor}
        onClose={handlePreviewClose}
        anchorOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        sx={{
          pointerEvents: "none",
        }}
        PaperProps={{
          sx: {
            pointerEvents: "auto",
            maxWidth: 400,
            p: 2,
            bgcolor: "background.paper",
            border: 1,
            borderColor: "primary.main",
          },
        }}
        disableRestoreFocus
      >
        <Stack spacing={1.5}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "primary.main" }}>
            📱 SMS Preview
          </Typography>
          <Divider sx={{ borderColor: (t) => t.palette.divider }} />
          <Typography
            variant="body2"
            sx={{
              whiteSpace: "pre-wrap",
              fontFamily: "monospace",
              fontSize: "0.875rem",
              p: 1.5,
              bgcolor: (t) => t.palette.mode === "dark" ? "#1a1a1a" : "#f5f5f5",
              borderRadius: 1,
              border: 1,
              borderColor: "divider",
            }}
          >
            {generateSmsPreview(previewItem)}
          </Typography>
          {previewItem?.images && previewItem.images.length > 0 && (
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              + {previewItem.images.length} image{previewItem.images.length > 1 ? "s" : ""} (MMS)
            </Typography>
          )}
        </Stack>
      </Popover>

      <Menu
        anchorEl={templatesAnchor}
        open={Boolean(templatesAnchor)}
        onClose={handleCloseTemplatesMenu}
        PaperProps={{
          sx: {
            maxWidth: 400,
            maxHeight: 400,
          },
        }}
      >
        {templates.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" sx={{ fontStyle: "italic", opacity: 0.7 }}>
              No saved templates
            </Typography>
          </MenuItem>
        ) : (
          templates.map((template) => (
            <MenuItem
              key={template.name}
              onClick={() => handleLoadTemplate(template)}
              sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {template.name}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {template.content.substring(0, 60)}{template.content.length > 60 ? "..." : ""}
                </Typography>
              </Stack>
              <IconButton
                size="small"
                onClick={(e) => handleDeleteTemplate(e, template.name)}
                sx={{ ml: 1, color: (t) => t.palette.error.main }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </MenuItem>
          ))
        )}
      </Menu>
    </Box>
  );
}

ImportantInfoAdmin.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object),
  loading: PropTypes.bool,
  error: PropTypes.any,
};
