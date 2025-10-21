import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import { createInsider, updateInsider } from "@/services/insiders.js";
import logError from "@/utils/logError.js";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";

const TYPE_OPTIONS = [
  { label: "Business", value: "business" },
  { label: "Family", value: "family" },
  { label: "Individual", value: "individual" },
];

const LEVEL_OPTIONS = [
  { label: "Bronze", value: "bronze" },
  { label: "Silver", value: "silver" },
  { label: "Gold", value: "gold" },
  { label: "Diamond", value: "diamond" },
];

function createBlank() {
  return {
    name: "",
    membershipType: "business",
    level: "bronze",
    points: 0,
    members: [],
    notes: "",
    isActive: true,
  };
}

function normalizeInitial(initial) {
  if (!initial) return createBlank();
  return {
    ...createBlank(),
    ...initial,
    members: Array.isArray(initial.members)
      ? initial.members.map((member) => ({ ...member }))
      : [],
  };
}

export default function InsiderEditorDialog({ open, onClose, initial = null }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(normalizeInitial(initial));
  const [memberInput, setMemberInput] = useState("");
  const [saving, setSaving] = useState(false);
  const { show } = useSnack();

  useEffect(() => {
    setForm(normalizeInitial(initial));
    setMemberInput("");
  }, [initial]);

  const isGroup =
    form.membershipType === "business" || form.membershipType === "family";

  const canSave = useMemo(() => {
    if (!form.name || form.name.trim().length < 2) return false;
    if (!form.membershipType) return false;
    if (!form.level) return false;
    return true;
  }, [form.level, form.membershipType, form.name]);

  const handleFieldChange = useCallback(
    (key) => (event) => {
      const value =
        key === "isActive" ? event.target.checked : event.target.value;
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleAddMember = useCallback(() => {
    const trimmed = (memberInput || "").trim();
    if (!trimmed) return;
    setForm((prev) => ({
      ...prev,
      members: [...(prev.members || []), { name: trimmed }],
    }));
    setMemberInput("");
  }, [memberInput]);

  const handleRemoveMember = useCallback((index) => {
    setForm((prev) => {
      const nextMembers = Array.isArray(prev.members) ? [...prev.members] : [];
      nextMembers.splice(index, 1);
      return { ...prev, members: nextMembers };
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name?.trim() || "",
        membershipType: form.membershipType,
        level: form.level,
        points: Number(form.points) || 0,
        notes: form.notes?.trim() || "",
        isActive: !!form.isActive,
      };
      if (isGroup) {
        payload.members = Array.isArray(form.members)
          ? form.members.map((member) => ({ ...member }))
          : [];
      }
      if (isEdit) {
        await updateInsider(form.id, payload);
        show("Insider member updated.", "success");
      } else {
        await createInsider(payload);
        show("Insider member created.", "success");
      }
      onClose?.(true);
    } catch (error) {
      logError(error, {
        where: "InsiderEditorDialog.handleSubmit",
        payload: { id: form.id, name: form.name },
      });
      show("Failed to save insider member.", "error");
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    form.id,
    form.level,
    form.members,
    form.membershipType,
    form.name,
    form.notes,
    form.points,
    form.isActive,
    isEdit,
    isGroup,
    onClose,
    saving,
    show,
  ]);

  const handleClose = useCallback(() => {
    if (saving) return;
    onClose?.(false);
  }, [onClose, saving]);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>
        {isEdit ? "Edit Insider Member" : "Add Insider Member"}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Display Name"
            value={form.name}
            onChange={handleFieldChange("name")}
            fullWidth
            autoFocus
            placeholder={
              form.membershipType === "individual"
                ? "Person's name"
                : "Business / Family name"
            }
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select
              fullWidth
              label="Type"
              value={form.membershipType}
              onChange={handleFieldChange("membershipType")}
            >
              {TYPE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              label="Level"
              value={form.level}
              onChange={handleFieldChange("level")}
            >
              {LEVEL_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <TextField
            label="Points"
            type="number"
            value={form.points ?? 0}
            onChange={handleFieldChange("points")}
            inputProps={{ min: 0, step: 1 }}
            fullWidth
          />

          {isGroup ? (
            <Box>
              <Typography sx={{ mb: 1, fontWeight: 600 }}>Members</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  fullWidth
                  value={memberInput}
                  onChange={(event) => setMemberInput(event.target.value)}
                  placeholder="Add member name"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddMember();
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  onClick={handleAddMember}
                  disabled={!memberInput.trim()}
                >
                  Add
                </Button>
              </Stack>
              <Box sx={{ mt: 1, display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                {(form.members || []).map((member, index) => (
                  <Chip
                    key={`${member.name || "member"}-${index}`} // eslint-disable-line react/no-array-index-key
                    label={member?.name || "Member"}
                    onDelete={() => handleRemoveMember(index)}
                    sx={{ borderRadius: "16px" }}
                  />
                ))}
              </Box>
            </Box>
          ) : null}

          <TextField
            label="Notes"
            value={form.notes || ""}
            onChange={handleFieldChange("notes")}
            multiline
            minRows={3}
            fullWidth
          />

          <FormControlLabel
            control={
              <Switch
                checked={Boolean(form.isActive)}
                onChange={handleFieldChange("isActive")}
              />
            }
            label="Active"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!canSave || saving}
          variant="contained"
          sx={{ bgcolor: (t) => t.palette.primary.main, fontWeight: 600 }}
        >
          {isEdit ? "Save" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
