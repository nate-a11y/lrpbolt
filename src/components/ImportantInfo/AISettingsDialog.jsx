import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";

import { getAISettings, saveAISettings } from "@/services/aiContentGenerator.js";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";

export default function AISettingsDialog({ open, onClose }) {
  const { show } = useSnack();
  const [settings, setSettings] = useState({
    provider: "openai",
    apiKey: "",
    model: "gpt-4o-mini",
    enabled: false,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (open) {
      const stored = getAISettings();
      setSettings(stored);
      setHasChanges(false);
      setShowApiKey(false);
    }
  }, [open]);

  const handleChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const success = saveAISettings(settings);
    if (success) {
      show("AI settings saved successfully.", "success");
      setHasChanges(false);
      onClose();
    } else {
      show("Failed to save AI settings.", "error");
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      // eslint-disable-next-line no-alert
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to close?"
      );
      if (!confirmed) return;
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      sx={{ "& .MuiPaper-root": { bgcolor: "background.paper" } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AutoFixHighIcon sx={{ color: (t) => t.palette.primary.main }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            AI Content Generator Settings
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <Alert
            severity="info"
            sx={{
              bgcolor: (t) => alpha(t.palette.info.dark, 0.5),
              color: (t) => t.palette.info.light,
            }}
          >
            Configure your AI API credentials to automatically generate SMS messages
            and blurbs from your important info details. Your API key is stored
            securely in your browser and never sent to our servers.
          </Alert>

          <FormControlLabel
            control={
              <Switch
                checked={settings.enabled}
                onChange={(e) => handleChange("enabled", e.target.checked)}
              />
            }
            label={
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Enable AI Content Generation
              </Typography>
            }
          />

          <FormControl fullWidth size="small">
            <InputLabel>AI Provider</InputLabel>
            <Select
              label="AI Provider"
              value={settings.provider}
              onChange={(e) => handleChange("provider", e.target.value)}
              disabled={!settings.enabled}
            >
              <MenuItem value="openai">OpenAI (ChatGPT)</MenuItem>
            </Select>
          </FormControl>

          {settings.provider === "openai" && (
            <FormControl fullWidth size="small">
              <InputLabel>Model</InputLabel>
              <Select
                label="Model"
                value={settings.model}
                onChange={(e) => handleChange("model", e.target.value)}
                disabled={!settings.enabled}
              >
                <MenuItem value="gpt-4o">GPT-4o (Most Capable)</MenuItem>
                <MenuItem value="gpt-4o-mini">GPT-4o Mini (Faster, Cheaper)</MenuItem>
                <MenuItem value="gpt-4-turbo">GPT-4 Turbo</MenuItem>
                <MenuItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Budget)</MenuItem>
              </Select>
            </FormControl>
          )}

          <TextField
            label="API Key"
            value={settings.apiKey}
            onChange={(e) => handleChange("apiKey", e.target.value)}
            disabled={!settings.enabled}
            type={showApiKey ? "text" : "password"}
            fullWidth
            placeholder="sk-..."
            helperText={
              settings.provider === "openai"
                ? "Get your API key from platform.openai.com/api-keys"
                : "Enter your API key"
            }
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowApiKey(!showApiKey)}
                    edge="end"
                    size="small"
                  >
                    {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {settings.enabled && !settings.apiKey && (
            <Alert
              severity="warning"
              sx={{
                bgcolor: (t) => alpha(t.palette.warning.dark, 0.5),
                color: (t) => alpha(t.palette.warning.main, 0.4),
              }}
            >
              Please enter your API key to use AI content generation.
            </Alert>
          )}

          <Alert
            severity="warning"
            sx={{
              bgcolor: (t) => alpha(t.palette.warning.dark, 0.5),
              color: (t) => alpha(t.palette.warning.main, 0.4),
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Important:
            </Typography>
            <Typography variant="caption" sx={{ display: "block" }}>
              Using AI content generation will make API calls to your configured
              provider. Standard API usage charges will apply to your account. The
              generated content should be reviewed before sending to guests.
            </Typography>
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!hasChanges}
          sx={{
            bgcolor: (t) => t.palette.primary.main,
            "&:hover": { bgcolor: (t) => t.palette.primary.dark },
          }}
        >
          Save Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
}

AISettingsDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
