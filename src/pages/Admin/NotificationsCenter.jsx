/* Proprietary and confidential. See LICENSE. */
import React from "react";
import Grid from "@mui/material/Grid";
import AvatarGroup from "@mui/material/AvatarGroup";
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
import { alpha } from "@mui/material/styles";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DataObjectIcon from "@mui/icons-material/DataObject";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import DirectionsCarFilledOutlinedIcon from "@mui/icons-material/DirectionsCarFilledOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LinkIcon from "@mui/icons-material/Link";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import RefreshIcon from "@mui/icons-material/Refresh";
import Groups3OutlinedIcon from "@mui/icons-material/Groups3Outlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
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

const getInitial = (user) => {
  const source = user?.name || user?.email || "";
  return source ? source.charAt(0).toUpperCase() : "?";
};

const SEGMENTS = [
  {
    id: "admins",
    label: "All Admins",
    description: "Operations and dispatch team.",
    filter: filterAdmins,
    icon: AdminPanelSettingsOutlinedIcon,
  },
  {
    id: "drivers_core",
    label: "All Drivers",
    description: "Core driver roster.",
    filter: filterDriversCore,
    icon: DirectionsCarFilledOutlinedIcon,
  },
  {
    id: "shootout",
    label: "All Shootout (Tracker Only)",
    description: "Shootout tracker roster only.",
    filter: filterShootout,
    icon: EmojiEventsOutlinedIcon,
  },
  {
    id: "drivers_combined",
    label: "Drivers + Shootout",
    description: "Combined driver audiences.",
    filter: filterDriversCombined,
    icon: Groups3OutlinedIcon,
  },
  {
    id: "custom",
    label: "Custom Topic",
    description: "Send to a manual FCM topic.",
    filter: null,
    icon: HubOutlinedIcon,
  },
];

export default function Notifications() {
  const { enqueue } = useToast();
  const [mode, setMode] = React.useState("push");
  const [allUsers, setAllUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(false); // fetching users
  const [loadError, setLoadError] = React.useState("");
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

  const segmentStats = React.useMemo(() => {
    return SEGMENTS.reduce((acc, def) => {
      if (def.filter) {
        const list = def.filter(allUsers) || [];
        acc[def.id] = { users: list, count: list.length };
      } else {
        acc[def.id] = { users: [], count: 0 };
      }
      return acc;
    }, {});
  }, [allUsers]);

  const segmentUsers = React.useMemo(
    () => segmentStats[segment]?.users ?? [],
    [segmentStats, segment],
  );

  const segmentOptions = React.useMemo(
    () =>
      SEGMENTS.map((option) => ({
        ...option,
        count: segmentStats[option.id]?.count ?? 0,
      })),
    [segmentStats],
  );

  const activeSegment = React.useMemo(
    () => segmentOptions.find((option) => option.id === segment),
    [segmentOptions, segment],
  );

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
  const selectedPreview = React.useMemo(
    () => directRecipients.slice(0, 4),
    [directRecipients],
  );
  const extraSelected = Math.max(0, selectedCount - selectedPreview.length);
  const segmentIsCustom = activeSegment?.id === "custom";
  const showSegmentEmpty =
    !loading &&
    !segmentIsCustom &&
    !!activeSegment?.filter &&
    segmentUsers.length === 0;
  const rosterEmpty = !loading && allUsers.length === 0;
  const recipientsSummary = React.useMemo(() => {
    const parts = [
      `${selectedCount} direct recipient${selectedCount === 1 ? "" : "s"}`,
    ];
    if (segmentIsCustom && customTopic) {
      parts.push(`Topic ${customTopic}`);
    }
    if (extraSelected > 0) {
      parts.push(`+${extraSelected} more`);
    }
    return parts.join(" • ");
  }, [selectedCount, extraSelected, segmentIsCustom, customTopic]);

  React.useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      if (isMounted) {
        setLoadError("");
      }
      try {
        const list = await fetchAllUsersAccess();
        if (isMounted) {
          setAllUsers(list);
          setLoadError("");
        }
      } catch (err) {
        if (isMounted) {
          setLoadError("We couldn't load the roster. Retry to refresh.");
        }
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
    setLoadError("");
    try {
      const list = await fetchAllUsersAccess();
      setAllUsers(list);
      setLoadError("");
    } catch (err) {
      setLoadError("Failed to refresh users. Try again.");
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
    const hasPushAudience = segmentIsCustom ? !!customTopic : selectedCount > 0;
    if (mode === "push") return !!title && hasPushAudience && !dataError;
    if (mode === "sms") return !!body && selectedCount > 0;
    return false;
  }, [
    mode,
    title,
    body,
    selectedCount,
    dataError,
    sending,
    segmentIsCustom,
    customTopic,
  ]);

  const handleSend = async () => {
    setSending(true);
    try {
      const payloadData =
        dataJson && !dataError ? JSON.parse(dataJson) : undefined;
      const recipients = directRecipients;
      if (!recipients.length && !(segmentIsCustom && customTopic)) return;

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
      <Stack spacing={{ xs: 2.5, md: 3 }}>
        <Card
          sx={{
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            background: (theme) =>
              `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(
                theme.palette.background.paper,
                0.6,
              )} 100%)`,
          }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={{ xs: 2, sm: 2.5 }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={{ xs: 2, md: 3 }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    sx={{
                      bgcolor: (theme) =>
                        alpha(theme.palette.primary.main, 0.18),
                      color: "primary.main",
                      width: 48,
                      height: 48,
                    }}
                  >
                    <NotificationsActiveIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h5" fontWeight={700}>
                      Notifications
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.75 }}>
                      Target push or SMS updates with a polished composer.
                    </Typography>
                  </Box>
                </Stack>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  sx={{ width: "100%", maxWidth: 360 }}
                >
                  <Chip
                    variant="outlined"
                    icon={
                      loading ? (
                        <CircularProgress size={14} sx={{ color: "inherit" }} />
                      ) : (
                        <CheckCircleIcon fontSize="small" />
                      )
                    }
                    label={
                      loading
                        ? "Syncing roster…"
                        : `${allUsers.length} user${allUsers.length === 1 ? "" : "s"} loaded`
                    }
                    sx={{
                      "& .MuiChip-icon": { mr: 0.75 },
                      borderColor: (theme) =>
                        alpha(theme.palette.primary.main, 0.3),
                      color: "primary.main",
                    }}
                  />
                  <Chip
                    variant="outlined"
                    label={`${selectedCount} ready to send`}
                    sx={{
                      borderColor: (theme) =>
                        alpha(theme.palette.primary.main, 0.3),
                      color: "primary.main",
                    }}
                  />
                  <Tooltip title="Refresh users">
                    <span>
                      <IconButton
                        aria-label="Refresh users"
                        onClick={onRefresh}
                        disabled={loading || sending}
                        size="small"
                        sx={{
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 2,
                        }}
                      >
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>
              {loadError ? (
                <Alert
                  severity="error"
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      onClick={onRefresh}
                      disabled={loading || sending}
                    >
                      Retry
                    </Button>
                  }
                >
                  {loadError}
                </Alert>
              ) : (
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  Choose a segment to broadcast quickly or hand-pick individual
                  recipients for direct follow ups.
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
        <Grid container spacing={{ xs: 2, md: 3 }}>
          <Grid item xs={12} md={5}>
            <Card sx={{ borderRadius: 3, height: "100%" }}>
              <CardContent
                sx={{
                  p: { xs: 2, sm: 3 },
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <Alert
                  severity="info"
                  variant="outlined"
                  icon={<InfoOutlinedIcon fontSize="small" />}
                  sx={{ alignItems: "flex-start" }}
                >
                  Push requires a title, SMS needs a body. Optional data must be
                  valid JSON.
                </Alert>
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 1, letterSpacing: 0.2 }}
                  >
                    Audience
                  </Typography>
                  <ToggleButtonGroup
                    value={segment}
                    exclusive
                    onChange={(_, val) => val && setSegment(val)}
                    size="small"
                    disabled={sending}
                    sx={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 1,
                      "& .MuiToggleButton-root": {
                        flex: "1 1 calc(50% - 8px)",
                        minWidth: "45%",
                        borderRadius: 2,
                        textTransform: "none",
                        justifyContent: "flex-start",
                        alignItems: "flex-start",
                        px: 1.75,
                        py: 1.25,
                        borderColor: "divider",
                        gap: 0.75,
                        bgcolor: "background.default",
                        "&.Mui-selected": {
                          bgcolor: (theme) =>
                            alpha(theme.palette.primary.main, 0.12),
                          borderColor: "primary.main",
                        },
                      },
                    }}
                  >
                    {segmentOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <ToggleButton key={option.id} value={option.id}>
                          <Stack spacing={0.75} alignItems="flex-start">
                            <Stack
                              direction="row"
                              spacing={0.75}
                              alignItems="center"
                            >
                              <Icon fontSize="small" />
                              <Typography
                                variant="subtitle2"
                                sx={{ fontWeight: 600 }}
                              >
                                {option.label}
                              </Typography>
                            </Stack>
                            <Typography
                              variant="caption"
                              sx={{ opacity: 0.72 }}
                            >
                              {option.description}
                            </Typography>
                            <Chip
                              size="small"
                              label={
                                option.id === "custom"
                                  ? "Topic broadcast"
                                  : `${option.count} user${option.count === 1 ? "" : "s"}`
                              }
                              sx={{
                                bgcolor: (theme) =>
                                  alpha(theme.palette.primary.main, 0.12),
                                color: "primary.main",
                              }}
                            />
                          </Stack>
                        </ToggleButton>
                      );
                    })}
                  </ToggleButtonGroup>
                </Box>
                {segmentIsCustom ? (
                  <TextField
                    label="Custom Topic"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder="/topics/lrp-shootout"
                    helperText="FCM topic name for push broadcasts."
                    fullWidth
                    size="small"
                    disabled={sending}
                  />
                ) : null}
                <Paper
                  variant="outlined"
                  sx={{
                    borderStyle: "dashed",
                    borderRadius: 2,
                    p: 1.5,
                    bgcolor: "background.default",
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <InfoOutlinedIcon fontSize="small" sx={{ mt: 0.25 }} />
                    <Box>
                      <Typography variant="body2" sx={{ opacity: 0.88 }}>
                        {activeSegment?.description ||
                          "Hand-pick individuals for direct sends."}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.65 }}>
                        {segmentIsCustom
                          ? customTopic
                            ? `Broadcasting to ${customTopic}`
                            : "Add a topic to reach subscribers."
                          : `${segmentUsers.length} user${segmentUsers.length === 1 ? "" : "s"} matched`}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
                {showSegmentEmpty ? (
                  <Alert severity="warning" variant="outlined">
                    No users currently match this segment.
                  </Alert>
                ) : null}
                <Divider />
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2" sx={{ letterSpacing: 0.2 }}>
                    Direct picks
                  </Typography>
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
                    noOptionsText={loading ? "Syncing roster…" : "No matches"}
                    renderOption={(props, option) => (
                      <li {...props} key={option.id}>
                        <Stack>
                          <Typography>{option.name || option.email}</Typography>
                          {option.roles?.length ? (
                            <Typography
                              variant="caption"
                              sx={{ opacity: 0.72 }}
                            >
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
                  {rosterEmpty ? (
                    <Alert severity="info" variant="outlined">
                      No eligible users loaded yet. Refresh to try again.
                    </Alert>
                  ) : null}
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    flexWrap="wrap"
                    spacing={1}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AvatarGroup
                        max={4}
                        sx={{
                          "& .MuiAvatar-root": {
                            width: 28,
                            height: 28,
                            fontSize: 13,
                          },
                        }}
                      >
                        {selectedPreview.map((user) => (
                          <Avatar
                            key={user?.id || user?.email}
                            src={user?.photoURL || undefined}
                          >
                            {getInitial(user)}
                          </Avatar>
                        ))}
                      </AvatarGroup>
                      <Typography variant="caption" sx={{ opacity: 0.75 }}>
                        {recipientsSummary}
                      </Typography>
                    </Stack>
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
          <Grid item xs={12} md={7}>
            <Card
              sx={{ borderRadius: 3, height: "100%", position: "relative" }}
            >
              <CardContent
                sx={{
                  p: { xs: 2, sm: 3 },
                  pb: { xs: 12, sm: 3 },
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  justifyContent="space-between"
                  spacing={{ xs: 1.5, sm: 2 }}
                >
                  <ToggleButtonGroup
                    exclusive
                    value={mode}
                    onChange={(_, v) => v && setMode(v)}
                    size="small"
                    disabled={sending}
                    sx={{
                      "& .MuiToggleButton-root": {
                        textTransform: "none",
                        px: 1.75,
                        py: 0.75,
                        borderRadius: 2,
                        minWidth: 96,
                        fontWeight: 600,
                        borderColor: "divider",
                        "&.Mui-selected": {
                          bgcolor: (theme) =>
                            alpha(theme.palette.primary.main, 0.12),
                          borderColor: "primary.main",
                        },
                      },
                    }}
                  >
                    <ToggleButton value="push">Push</ToggleButton>
                    <ToggleButton value="sms" disabled={segmentIsCustom}>
                      SMS
                    </ToggleButton>
                  </ToggleButtonGroup>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={showPreview}
                        onChange={(_, v) => setShowPreview(v)}
                      />
                    }
                    label="Preview"
                    sx={{ m: 0 }}
                  />
                </Stack>
                {mode === "push" ? (
                  <Stack spacing={1.5}>
                    <TextField
                      label="Title *"
                      value={title}
                      inputProps={{ maxLength: 80 }}
                      onChange={(e) => setTitle(e.target.value)}
                      fullWidth
                      disabled={sending}
                      helperText={`${count(title)}/80 characters`}
                      FormHelperTextProps={{
                        sx: { textAlign: "right", opacity: 0.65 },
                      }}
                    />
                    <TextField
                      label="Body"
                      value={body}
                      inputProps={{ maxLength: 240 }}
                      onChange={(e) => setBody(e.target.value)}
                      fullWidth
                      multiline
                      minRows={2}
                      disabled={sending}
                      helperText={`${count(body)}/240 characters`}
                      FormHelperTextProps={{
                        sx: { textAlign: "right", opacity: 0.65 },
                      }}
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
                      <Stack direction="row" spacing={1} flexWrap="wrap">
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
                          onClick={() => {
                            setDataJson("");
                            setDataError("");
                          }}
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
                      label="Body *"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      fullWidth
                      multiline
                      minRows={3}
                      inputProps={{ maxLength: 320 }}
                      disabled={sending}
                      helperText={`${count(body)}/320 characters`}
                      FormHelperTextProps={{
                        sx: { textAlign: "right", opacity: 0.65 },
                      }}
                    />
                    {body && body.length > 160 && (
                      <Alert severity="info">
                        SMS body exceeds 160 characters (will be split).
                      </Alert>
                    )}
                  </Stack>
                )}
                {showPreview && (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: (theme) =>
                        alpha(theme.palette.background.paper, 0.4),
                    }}
                  >
                    {mode === "push" ? (
                      <Stack
                        direction="row"
                        spacing={1.5}
                        alignItems="flex-start"
                      >
                        <Avatar
                          src={iconUrl || undefined}
                          sx={{ width: 40, height: 40 }}
                        >
                          <NotificationsActiveIcon fontSize="small" />
                        </Avatar>
                        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                          <Typography
                            variant="subtitle2"
                            noWrap
                            title={title || "(no title)"}
                            sx={{ fontWeight: 700 }}
                          >
                            {title || "(no title)"}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ opacity: 0.9 }}
                            noWrap
                            title={body}
                          >
                            {body || "—"}
                          </Typography>
                          {!!dataJson && !dataError && (
                            <Typography variant="caption" sx={{ opacity: 0.7 }}>
                              {(() => {
                                try {
                                  return Object.keys(JSON.parse(dataJson)).join(
                                    ", ",
                                  );
                                } catch {
                                  return "data";
                                }
                              })()}
                            </Typography>
                          )}
                        </Stack>
                      </Stack>
                    ) : (
                      <Stack
                        direction="row"
                        spacing={1.25}
                        alignItems="flex-start"
                      >
                        <SmartphoneIcon sx={{ opacity: 0.7 }} />
                        <Box
                          sx={{
                            bgcolor: "background.default",
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 2,
                            px: 1.25,
                            py: 1,
                            maxWidth: 420,
                          }}
                        >
                          <Typography variant="body2">{body || "…"}</Typography>
                        </Box>
                      </Stack>
                    )}
                  </Paper>
                )}
                <Divider sx={{ mt: 1 }} />
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
                    pb: { xs: 1.5, sm: 0 },
                    pt: { xs: 1.5, sm: 0 },
                    bgcolor: { xs: "background.paper", sm: "transparent" },
                    borderTop: { xs: "1px solid", sm: "none" },
                    borderColor: "divider",
                  }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={{ xs: 1, sm: 1.25 }}
                    alignItems={{ xs: "stretch", sm: "center" }}
                    sx={{ width: { xs: "100%", sm: "auto" } }}
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
                      {sending ? (
                        <CircularProgress
                          size={20}
                          color="inherit"
                          sx={{ mr: 0.5 }}
                        />
                      ) : null}
                      {sending ? "Sending…" : "Send"}
                    </Button>
                    <Button
                      variant="outlined"
                      color="inherit"
                      onClick={() => resetComposer(false)}
                      disabled={sending}
                      sx={{ width: { xs: "100%", sm: "auto" } }}
                    >
                      Reset message
                    </Button>
                  </Stack>
                  <Typography
                    variant="caption"
                    sx={{ opacity: sending ? 1 : 0.8 }}
                  >
                    {recipientsSummary}
                    {sending ? " • working…" : ""}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Stack>
    </ResponsiveContainer>
  );
}
