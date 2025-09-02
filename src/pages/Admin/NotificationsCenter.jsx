/* Proprietary and confidential. See LICENSE. */
import React from "react";
import Grid2 from "@mui/material/Grid";
import {
  Card,
  CardContent,
  Typography,
  Stack,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Chip,
  IconButton,
  Tooltip,
  Autocomplete,
  Divider,
  Alert,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import {
  fetchAllUsersAccess,
  filterAdmins,
  filterDriversCore,
  filterShootout,
  filterDriversCombined,
} from "src/services/users";
import { sendPortalNotification } from "src/utils/notify";
import { enqueueSms } from "src/services/messaging";
import logError from "src/utils/logError";
import { useToast } from "src/context/ToastProvider.jsx";
import ResponsiveContainer from "src/components/responsive/ResponsiveContainer.jsx";

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
  const [loading, setLoading] = React.useState(false);
  const [segment, setSegment] = React.useState("drivers_core");
  const [customTopic, setCustomTopic] = React.useState("");
  const [pickedUsers, setPickedUsers] = React.useState([]);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [iconUrl, setIconUrl] = React.useState("");
  const [dataJson, setDataJson] = React.useState("");
  const [dataError, setDataError] = React.useState("");

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
    if (mode === "push") return !!title && selectedCount > 0 && !dataError;
    if (mode === "sms") return !!body && selectedCount > 0;
    return false;
  }, [mode, title, body, selectedCount, dataError]);

  const handleSend = async () => {
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
    } catch (err) {
      enqueue("Send failed", { severity: "error" });
      logError(err, { where: "Notifications", action: "handleSend", mode });
    }
  };

  return (
    <ResponsiveContainer>
      <Grid2 container spacing={{ xs: 1.5, sm: 2, md: 3 }}>
        <Grid2 xs={12}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Notifications</Typography>
            <Tooltip title="Refresh">
              <IconButton
                aria-label="Refresh users"
                onClick={onRefresh}
                disabled={loading}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Grid2>

        <Grid2 xs={12} md={4}>
          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <InfoOutlinedIcon fontSize="small" />
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Choose a segment or pick specific recipients. Push requires
                    a title; SMS requires a body. Data must be JSON (key/value).
                  </Typography>
                </Stack>

                <Typography variant="subtitle2">Recipients</Typography>
                <ToggleButtonGroup
                  value={segment}
                  exclusive
                  onChange={(_, val) => val && setSegment(val)}
                  size="small"
                  sx={{ flexWrap: "wrap" }}
                >
                  {SEGMENTS.map((s) => (
                    <ToggleButton
                      key={s.id}
                      value={s.id}
                      sx={{
                        borderRadius: 2,
                        textTransform: "none",
                        "&.Mui-selected": {
                          bgcolor: "primary.main",
                          color: "#000",
                        },
                      }}
                    >
                      {s.label}
                      {typeof segmentCounts[s.id] === "number"
                        ? ` (${segmentCounts[s.id]})`
                        : ""}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>

                {segment === "custom" && (
                  <TextField
                    label="Custom Topic"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    fullWidth
                    placeholder="/topics/lrp-shootout"
                  />
                )}

                <Autocomplete
                  multiple
                  options={allUsers}
                  value={pickedUsers}
                  disableCloseOnSelect
                  loading={loading}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  onChange={(_, val) => setPickedUsers(val)}
                  getOptionLabel={(o) => o?.name || o?.email || ""}
                  renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                      <Stack>
                        <Typography>{option.name || option.email}</Typography>
                        {option.roles?.length ? (
                          <Typography variant="caption" sx={{ opacity: 0.7 }}>
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
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Pick users by name/email"
                      placeholder="Type to search..."
                    />
                  )}
                />

                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Selected: {selectedCount} user{selectedCount === 1 ? "" : "s"}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid2>

        <Grid2 xs={12} md={8}>
          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <ToggleButtonGroup
                  exclusive
                  value={mode}
                  onChange={(_, v) => v && setMode(v)}
                  size="small"
                >
                  <ToggleButton value="push">Push</ToggleButton>
                  <ToggleButton value="sms">SMS</ToggleButton>
                </ToggleButtonGroup>

                {mode === "push" ? (
                  <Stack spacing={1.5}>
                    <TextField
                      label="Title *"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      fullWidth
                    />
                    <TextField
                      label="Body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      fullWidth
                      multiline
                      minRows={2}
                    />
                    <TextField
                      label="Icon URL (optional)"
                      value={iconUrl}
                      onChange={(e) => setIconUrl(e.target.value)}
                      fullWidth
                    />
                    <TextField
                      label='Data (JSON, e.g. {"tripId":"123"})'
                      value={dataJson}
                      onChange={(e) => onChangeDataJson(e.target.value)}
                      error={!!dataError}
                      helperText={dataError || "Optional key/value payload"}
                      fullWidth
                      multiline
                      minRows={2}
                    />
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
                    />
                    {body && body.length > 160 && (
                      <Alert severity="info">
                        SMS body exceeds 160 characters (will be split).
                      </Alert>
                    )}
                  </Stack>
                )}

                <Divider />

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={{ xs: 1, sm: 1.5 }}
                  alignItems={{ xs: "stretch", sm: "center" }}
                >
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={!canSend || loading}
                    onClick={handleSend}
                    sx={{ width: { xs: "100%", sm: "auto" } }}
                  >
                    Send
                  </Button>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    {selectedCount} direct recipient
                    {selectedCount === 1 ? "" : "s"}
                  </Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid2>
      </Grid2>
    </ResponsiveContainer>
  );
}
