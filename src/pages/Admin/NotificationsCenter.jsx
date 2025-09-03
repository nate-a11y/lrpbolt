/* Proprietary and confidential. See LICENSE. */
import React from "react";
import Grid from "@mui/material/Grid";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DataObjectIcon from "@mui/icons-material/DataObject";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LinkIcon from "@mui/icons-material/Link";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import RefreshIcon from "@mui/icons-material/Refresh";
import SmartphoneIcon from "@mui/icons-material/Smartphone";

import ResponsiveContainer from "src/components/responsive/ResponsiveContainer.jsx";
import { useToast } from "src/context/ToastProvider.jsx";
import { enqueueSms } from "src/services/messaging";
import {
  fetchAllUsersAccess,
  filterAdmins,
  filterDriversCombined,
  filterDriversCore,
  filterShootout,
} from "src/services/users";
import logError from "src/utils/logError";
import { sendPortalNotification } from "src/utils/notify";

const count = (s) => (s ? String(s).length : 0);
const prettyJson = (s) => {
  try {
    return JSON.stringify(JSON.parse(s || "{}"), null, 2);
  } catch {
    return s;
  }
};

const SEGMENTS = [
  { id: "admins", label: "All Admins", filter: filterAdmins },
  { id: "drivers_core", label: "All Drivers", filter: filterDriversCore },
  {
    id: "shootout",
    label: "All Shootout (Tracker Only)",
    filter: filterShootout,
  },
  {
    id: "drivers_combined",
    label: "Drivers + Shootout",
    filter: filterDriversCombined,
  },
  { id: "custom", label: "Custom Topic", filter: null },
];

export default function Notifications() {
  const { enqueue } = useToast();
  const [mode, setMode] = React.useState("push");
  const [allUsers, setAllUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(false); // fetching users
  const [sending, setSending] = React.useState(false); // sending messages
  const [showPreview, setShowPreview] = React.useState(true);
  const [segment, setSegment] = React.useState("drivers_core");
  const [customTopic, setCustomTopic] = React.useState("");
  const [pickedUsers, setPickedUsers] = React.useState([]);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [iconUrl, setIconUrl] = React.useState("");
  const [dataJson, setDataJson] = React.useState("");
  const [dataError, setDataError] = React.useState("");

  const resetComposer = React.useCallback((clearRecipients = false) => {
    setTitle("");
    setBody("");
    setIconUrl("");
    setDataJson("");
    setDataError("");
    if (clearRecipients) setPickedUsers([]);
  }, []);

  const segmentCounts = React.useMemo(() => {
    const map = {
      admins: 0,
      drivers_core: 0,
      shootout: 0,
      drivers_combined: 0,
    };
    map.admins = filterAdmins(allUsers).length;
    map.drivers_core = filterDriversCore(allUsers).length;
    map.shootout = filterShootout(allUsers).length;
    map.drivers_combined = filterDriversCombined(allUsers).length;
    return map;
  }, [allUsers]);

  const segmentUsers = React.useMemo(() => {
    const def = SEGMENTS.find((s) => s.id === segment);
    if (!def || !def.filter) return [];
    return def.filter(allUsers);
  }, [segment, allUsers]);

  const directRecipients = React.useMemo(() => {
    const seen = new Set();
    const out = [];
    [...segmentUsers, ...pickedUsers].forEach((u) => {
      const id = u?.id || u?.email;
      if (id && !seen.has(id)) {
        seen.add(id);
        out.push(u);
      }
    });
    return out;
  }, [segmentUsers, pickedUsers]);

  const selectedCount = directRecipients.length;

  React.useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      try {
        const list = await fetchAllUsersAccess();
        if (isMounted) setAllUsers(list);
      } catch (err) {
        logError(err, { where: "Notifications", action: "loadUsers" });
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const onRefresh = async () => {
    setLoading(true);
    try {
      const list = await fetchAllUsersAccess();
      setAllUsers(list);
    } catch (err) {
      logError(err, { where: "Notifications", action: "refreshUsers" });
      enqueue("Failed to refresh users", { severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  const onChangeDataJson = (val) => {
    setDataJson(val);
    if (!val) {
      setDataError("");
      return;
    }
    try {
      JSON.parse(val);
      setDataError("");
    } catch {
      setDataError("Invalid JSON");
    }
  };

  const canSend = React.useMemo(() => {
    if (sending) return false;
    if (mode === "push") return !!title && selectedCount > 0 && !dataError;
    if (mode === "sms") return !!body && selectedCount > 0;
    return false;
  }, [mode, title, body, selectedCount, dataError, sending]);

  const handleSend = async () => {
    setSending(true);
    try {
      const payloadData =
        dataJson && !dataError ? JSON.parse(dataJson) : undefined;
      const recipients = directRecipients;
      if (!recipients.length && !(segment === "custom" && customTopic)) return;

      if (mode === "push") {
        const base = {
          title,
          body,
          iconUrl: iconUrl || undefined,
          data: payloadData,
        };
        if (segment === "custom" && customTopic) {
          await sendPortalNotification({ topic: customTopic, ...base });
        } else {
          await Promise.all(
            recipients
              .filter((u) => u?.email)
              .map((u) => sendPortalNotification({ email: u.email, ...base })),
          );
        }
      } else {
        await Promise.all(
          recipients
            .filter((u) => u?.phone)
            .map((u) =>
              enqueueSms({
                to: u.phone,
                body,
                context: { email: u.email },
              }),
            ),
        );
      }
      enqueue("Notification sent", { severity: "success" });
      resetComposer(false);
    } catch (err) {
      enqueue("Send failed", { severity: "error" });
      logError(err, { where: "Notifications", action: "handleSend", mode });
    } finally {
      setSending(false);
    }
  };

  return (
    <ResponsiveContainer>
      <Grid container spacing={{ xs: 1.5, sm: 2, md: 3 }}>
        {/* Header */}
        <Grid item xs={12}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={700}>
              Notifications
            </Typography>
            <Tooltip title="Refresh users">
              <span>
                <IconButton aria-label="Refresh users" onClick={onRefresh} disabled={loading || sending}>
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Grid>

        {/* Left: Recipients */}
        <Grid item xs={12} md={5}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Stack spacing={1.5}>
                <Stack direction="row" alignItems="flex-start" spacing={1}>
                  <InfoOutlinedIcon fontSize="small" sx={{ mt: "2px" }} />
                  <Typography variant="body2" sx={{ opacity: 0.85 }}>
                    Choose a segment or pick users. <strong>Push</strong> requires a title; <strong>SMS</strong> requires a body.
                    Optional <em>Data</em> must be valid JSON.
                  </Typography>
                </Stack>

                <Typography variant="subtitle2" sx={{ mt: 0.5, letterSpacing: 0.2 }}>
                  Recipients
                </Typography>

                {/* Segment pills */}
                <ToggleButtonGroup
                  value={segment}
                  exclusive
                  onChange={(_, val) => val && setSegment(val)}
                  size="small"
                  sx={{ flexWrap: "wrap", "& .MuiToggleButton-root": { py: 0.5, px: 1.25 } }}
                  disabled={sending}
                >
                  {SEGMENTS.map((s) => (
                    <ToggleButton
                      key={s.id}
                      value={s.id}
                      sx={{
                        borderRadius: 2,
                        textTransform: "none",
                        px: 1.25,
                        "&.Mui-selected": { bgcolor: "#4cbb17", color: "#000" },
                      }}
                    >
                      {s.label}
                      {typeof segmentCounts[s.id] === "number" ? ` (${segmentCounts[s.id]})` : ""}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>

                {/* Custom topic when needed */}
                {segment === "custom" && (
                  <TextField
                    label="Custom Topic"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    fullWidth
                    placeholder="/topics/lrp-shootout"
                    size="small"
                    disabled={sending}
                  />
                )}

                {/* People picker */}
                <Autocomplete
                  multiple
                  options={allUsers}
                  value={pickedUsers}
                  disableCloseOnSelect
                  loading={loading}
                  disablePortal
                  filterSelectedOptions
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  onChange={(_, val) => setPickedUsers(val)}
                  getOptionLabel={(o) => o?.name || o?.email || ""}
                  renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                      <Stack>
                        <Typography>{option.name || option.email}</Typography>
                        {option.roles?.length ? (
                          <Typography variant="caption" sx={{ opacity: 0.72 }}>
                            {option.roles.join(", ")}
                          </Typography>
                        ) : null}
                      </Stack>
                    </li>
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        {...getTagProps({ index })}
                        key={option.id}
                        label={option.name || option.email}
                        size="small"
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Pick users by name/email"
                      placeholder="Type to search…"
                      size="small"
                    />
                  )}
                  disabled={sending}
                />

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Selected: {selectedCount} user{selectedCount === 1 ? "" : "s"}
                  </Typography>
                  {!!pickedUsers.length && (
                    <Button
                      size="small"
                      variant="text"
                      color="inherit"
                      onClick={() => setPickedUsers([])}
                      startIcon={<HighlightOffIcon fontSize="small" />}
                      disabled={sending}
                    >
                      Clear picks
                    </Button>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Right: Composer */}
        <Grid item xs={12} md={7}>
          <Card sx={{ borderRadius: 3, position: "relative" }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 }, pb: { xs: 10, sm: 3 } /* leave room for sticky bar on mobile */ }}>
              <Stack spacing={1.5}>
                {/* Mode switch */}
                <ToggleButtonGroup
                  exclusive
                  value={mode}
                  onChange={(_, v) => v && setMode(v)}
                  size="small"
                  sx={{ "& .MuiToggleButton-root": { py: 0.5, px: 1.25 } }}
                  disabled={sending}
                >
                  <ToggleButton value="push">Push</ToggleButton>
                  <ToggleButton value="sms">SMS</ToggleButton>
                </ToggleButtonGroup>

                <FormControlLabel
                  control={<Switch size="small" checked={showPreview} onChange={(_, v) => setShowPreview(v)} />}
                  label="Preview"
                  sx={{ alignSelf: "flex-start" }}
                />

                {/* Fields */}
                {mode === "push" ? (
                  <Stack spacing={1.5}>
                    <TextField
                      label={`Title * (${count(title)}/80)`}
                      value={title}
                      inputProps={{ maxLength: 80 }}
                      onChange={(e) => setTitle(e.target.value)}
                      fullWidth
                      disabled={sending}
                    />
                    <TextField
                      label={`Body (${count(body)}/240)`}
                      value={body}
                      inputProps={{ maxLength: 240 }}
                      onChange={(e) => setBody(e.target.value)}
                      fullWidth
                      multiline
                      minRows={2}
                      disabled={sending}
                    />
                    <TextField
                      label="Icon URL (optional)"
                      value={iconUrl}
                      onChange={(e) => setIconUrl(e.target.value)}
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LinkIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                      disabled={sending}
                    />
                    <Stack spacing={0.75}>
                      <TextField
                        label='Data (JSON, e.g. {"tripId":"123"})'
                        value={dataJson}
                        onChange={(e) => onChangeDataJson(e.target.value)}
                        error={!!dataError}
                        helperText={dataError || "Optional key/value payload"}
                        fullWidth
                        multiline
                        minRows={3}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <DataObjectIcon fontSize="small" />
                            </InputAdornment>
                          ),
                        }}
                        disabled={sending}
                      />
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setDataJson(prettyJson(dataJson))}
                          disabled={!dataJson || sending}
                        >
                          Pretty-print JSON
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          color="inherit"
                          onClick={() => { setDataJson(""); setDataError(""); }}
                          disabled={!dataJson || sending}
                        >
                          Clear
                        </Button>
                      </Stack>
                    </Stack>
                  </Stack>
                ) : (
                  <Stack spacing={1.5}>
                    <TextField
                      label={`Body * (${count(body)}/320)`}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      fullWidth
                      multiline
                      minRows={3}
                      inputProps={{ maxLength: 320 }}
                      disabled={sending}
                    />
                    {body && body.length > 160 && (
                      <Alert severity="info">SMS body exceeds 160 characters (will be split).</Alert>
                    )}
                  </Stack>
                )}

                {showPreview && (
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    {mode === "push" ? (
                      <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        <Avatar src={iconUrl || undefined} sx={{ width: 36, height: 36 }}>
                          <NotificationsActiveIcon fontSize="small" />
                        </Avatar>
                        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2" noWrap title={title || "(no title)"} sx={{ fontWeight: 700 }}>
                            {title || "(no title)"}
                          </Typography>
                          <Typography variant="body2" sx={{ opacity: 0.9 }} noWrap title={body}>
                            {body || "—"}
                          </Typography>
                          {!!dataJson && !dataError && (
                            <Typography variant="caption" sx={{ opacity: 0.7 }}>
                              {(() => { try { return Object.keys(JSON.parse(dataJson)).join(", "); } catch { return "data"; } })()}
                            </Typography>
                          )}
                        </Stack>
                      </Stack>
                    ) : (
                      <Stack direction="row" spacing={1.25} alignItems="flex-start">
                        <SmartphoneIcon sx={{ opacity: 0.7 }} />
                        <Box sx={{ bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: 2, px: 1.25, py: 1, maxWidth: 420 }}>
                          <Typography variant="body2">{body || "…"}</Typography>
                        </Box>
                      </Stack>
                    )}
                  </Paper>
                )}

                <Divider sx={{ my: 1 }} />

                {/* Sticky Send bar on mobile */}
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={{ xs: 1, sm: 1.5 }}
                  alignItems={{ xs: "stretch", sm: "center" }}
                  sx={{
                    position: { xs: "fixed", sm: "static" },
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 2,
                    px: { xs: 2, sm: 0 },
                    pb: { xs: 1.25, sm: 0 },
                    pt: { xs: 1.25, sm: 0 },
                    bgcolor: { xs: "background.paper", sm: "transparent" },
                    borderTop: { xs: "1px solid", sm: "none" },
                    borderColor: "divider",
                  }}
                >
                  <Button
                    variant="contained"
                    disabled={!canSend || loading || sending}
                    onClick={handleSend}
                    startIcon={!sending ? <CheckCircleIcon /> : null}
                    sx={{
                      width: { xs: "100%", sm: "auto" },
                      bgcolor: "#4cbb17",
                      "&:hover": { bgcolor: "#3ea212" },
                      fontWeight: 700,
                    }}
                  >
                    {sending ? <CircularProgress size={20} color="inherit" sx={{ mr: 0.5 }} /> : null}
                    {sending ? "Sending…" : "Send"}
                  </Button>
                  <Typography variant="caption" sx={{ opacity: sending ? 1 : 0.8 }}>
                    {selectedCount} direct recipient{selectedCount === 1 ? "" : "s"}
                    {sending ? " • working…" : ""}
                  </Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </ResponsiveContainer>
  );
}
