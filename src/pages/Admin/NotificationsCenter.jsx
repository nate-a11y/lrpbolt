/* Proprietary and confidential. See LICENSE. */
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import RefreshIcon from "@mui/icons-material/Refresh";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";

import { db } from "src/utils/firebaseInit";

import { sendPortalNotification } from "../../utils/notify";
import { enqueueSms } from "../../services/messaging";
import { useAuth } from "../../context/AuthContext.jsx";

const SEGMENTS = [
  { id: "drivers", label: "All Drivers", where: ["driver"] },
  { id: "admins", label: "All Admins", where: ["admin"] },
];

export default function NotificationsCenter() {
  const { user } = useAuth();

  const [allUsers, setAllUsers] = useState([]); // {id,email,name,access,phone}
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [segment, setSegment] = useState(""); // "", "drivers", "admins", or "topic"
  const [topic, setTopic] = useState("");     // custom topic name
  const [emails, setEmails] = useState([]);   // [{email,name}] for direct send

  const [channel, setChannel] = useState("push"); // "push" | "sms"

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [icon, setIcon] = useState("");
  const [dataText, setDataText] = useState(""); // JSON string
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);

  // Load recipients from userAccess
  async function fetchUsers() {
    setLoadingUsers(true);
    try {
      const qs = await getDocs(collection(db, "userAccess"));
      const rows = qs.docs.map((d) => {
        const x = d.data() ?? {};
        const email = (x.email || d.id || "").trim();
        const name = (x.name || (email.split("@")[0] || "Unknown")).trim();
        const access = (x.access || "").toLowerCase();
        const phone = (x.phone || "").trim();
        return { id: email, email, name, access, phone };
      });
      // sort by name
      rows.sort((a, b) => a.name.localeCompare(b.name));
      setAllUsers(rows);
    } catch (e) {
      setToast({ kind: "error", msg: `Load users failed: ${e.message}` });
    } finally {
      setLoadingUsers(false);
    }
  }
  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    if (channel === "sms" && segment === "topic") setSegment("");
  }, [channel, segment]);

  const segmentCount = useMemo(() => {
    if (segment === "drivers") return allUsers.filter((u) => u.access === "driver").length;
    if (segment === "admins") return allUsers.filter((u) => u.access === "admin").length;
    return 0;
  }, [segment, allUsers]);

  const directCount = emails.length;
  const totalCount = segment ? segmentCount : directCount;

  function parseData() {
    if (!dataText.trim()) return undefined;
    try {
      const obj = JSON.parse(dataText);
      // Only string key/values are allowed by WebPush data
      const out = {};
      for (const [k, v] of Object.entries(obj)) out[k] = String(v);
      return out;
    } catch {
      throw new Error("Data must be valid JSON (object).");
    }
  }

  const canSend =
    channel === "push" ?
      !!title.trim() &&
      !sending &&
      ( (segment && (segment === "drivers" || segment === "admins" || (segment === "topic" && topic.trim()))) ||
        (!segment && emails.length > 0) )
    :
      !!body.trim() &&
      !sending &&
      ( (segment && (segment === "drivers" || segment === "admins")) ||
        (!segment && emails.length > 0) );

  async function logOutbox({ scope, recipients, result }) {
    try {
      await addDoc(collection(db, "notificationsOutbox"), {
        createdAt: serverTimestamp(),
        createdBy: user?.email || "unknown",
        scope,                 // e.g., {type:"segment", value:"drivers"} or {type:"emails", count:n}
        channel,
        title,
        body,
        icon: icon || null,
        data: dataText || null,
        recipients,
        result,
      });
    } catch (e) {
      // non-fatal
      console.warn("Failed to log notificationsOutbox:", e);
    }
  }

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    try {
      if (channel === "push") {
        const data = parseData();

        // SEGMENT: drivers/admins
        if (segment === "drivers" || segment === "admins") {
          const label = segment === "drivers" ? "driver" : "admin";
          // We’ll send by email batches using the callable (server finds tokens by email)
          const targets = allUsers.filter((u) => u.access === label).map((u) => u.email);
          let sent = 0;
          for (const email of targets) {
            const res = await sendPortalNotification({ email, title, body, icon, data });
            sent += (res?.count || 0);
          }
          await logOutbox({ scope: { type: "segment", value: segment }, recipients: targets, result: { sent } });
          setToast({ kind: "success", msg: `Sent to ${sent} device(s) across ${targets.length} user(s).` });
        }
        // SEGMENT: custom topic
        else if (segment === "topic") {
          const t = topic.trim();
          const res = await sendPortalNotification({ topic: t, title, body, icon, data });
          await logOutbox({ scope: { type: "topic", value: t }, recipients: [t], result: res });
          setToast({ kind: "success", msg: `Topic "${t}" send ok.` });
        }
        // DIRECT: explicit emails
        else {
          let sent = 0;
          for (const e of emails) {
            const res = await sendPortalNotification({ email: e.email, title, body, icon, data });
            sent += (res?.count || 0);
          }
          await logOutbox({ scope: { type: "emails", count: emails.length }, recipients: emails.map((x) => x.email), result: { sent } });
          setToast({ kind: "success", msg: `Sent to ${sent} device(s) across ${emails.length} user(s).` });
        }
      } else {
        // SMS
        const text = body.trim() || title.trim();

        if (segment === "drivers" || segment === "admins") {
          const label = segment === "drivers" ? "driver" : "admin";
          const targets = allUsers.filter((u) => u.access === label && u.phone).map((u) => ({ phone: u.phone, email: u.email }));
          for (const t of targets) {
            await enqueueSms({ to: t.phone, body: text, context: { email: t.email } });
          }
          await logOutbox({ scope: { type: "segment", value: segment }, recipients: targets.map((t) => t.phone), result: { queued: targets.length } });
          setToast({ kind: "success", msg: `Queued SMS for ${targets.length} user(s).` });
        } else {
          const targets = emails.map((e) => {
            const u = allUsers.find((x) => x.email === e.email);
            return u && u.phone ? { phone: u.phone, email: u.email } : null;
          }).filter(Boolean);
          for (const t of targets) {
            await enqueueSms({ to: t.phone, body: text, context: { email: t.email } });
          }
          await logOutbox({ scope: { type: "emails", count: targets.length }, recipients: targets.map((t) => t.phone), result: { queued: targets.length } });
          setToast({ kind: "success", msg: `Queued SMS for ${targets.length} user(s).` });
        }
      }

      // reset only non-structural fields
      if (channel === "push") {
        setTitle("");
        setBody("");
        setIcon("");
        setDataText("");
      } else {
        setBody("");
      }
    } catch (e) {
      setToast({ kind: "error", msg: e.message || "Send failed" });
    } finally {
      setSending(false);
    }
  }

  const userOptions = allUsers.map((u) => ({ label: `${u.name} (${u.email})`, email: u.email, name: u.name, phone: u.phone }));

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 960, mx: "auto" }}>
      <Paper
        elevation={3}
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 3,
          bgcolor: (t) => (t.palette.mode === "dark" ? "background.paper" : "background.default"),
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Typography variant="h5" fontWeight={800}>Notifications</Typography>
          <Tooltip title="Reload recipients">
            <span>
              <IconButton onClick={fetchUsers} disabled={loadingUsers}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        <Alert severity="info" icon={<InfoOutlinedIcon /> } sx={{ mb: 2 }}>
          Choose a segment or pick specific recipients. For push notifications a title is required; for SMS a body is required. Data must be JSON (key/value).
        </Alert>

        <Grid container spacing={2}>
          {/* Targeting */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Recipients</Typography>

              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 1 }}>
                {SEGMENTS.map((s) => (
                  <Chip
                    key={s.id}
                    clickable
                    color={segment === s.id ? "primary" : "default"}
                    label={`${s.label}${segment === s.id ? ` • ${segmentCount}` : ""}`}
                    onClick={() => { setSegment(s.id); setTopic(""); }}
                  />
                ))}
                {channel === "push" && (
                  <Chip
                    clickable
                    color={segment === "topic" ? "primary" : "default"}
                    label={segment === "topic" && topic ? `Topic: ${topic}` : "Custom Topic"}
                    onClick={() => setSegment("topic")}
                  />
                )}
                <Chip
                  clickable
                  color={!segment ? "primary" : "default"}
                  label="Pick Users"
                  onClick={() => setSegment("")}
                />
              </Stack>

              {segment === "topic" && (
                <TextField
                  fullWidth
                  label="Topic name"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  sx={{ mt: 1 }}
                />
              )}

              {!segment && (
                <Autocomplete
                  multiple
                  disableCloseOnSelect
                  options={userOptions}
                  loading={loadingUsers}
                  value={emails}
                  onChange={(_, val) => setEmails(val)}
                  renderInput={(params) => <TextField {...params} label="Select users by name/email" placeholder="Start typing…" />}
                  sx={{ mt: 1 }}
                />
              )}

              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Selected: <b>{totalCount}</b> {segment ? "users (via segment)" : "user(s)"}
              </Typography>
            </Paper>
          </Grid>

          {/* Message */}
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Message</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 1 }}>
                <Chip clickable color={channel === "push" ? "primary" : "default"} label="Push" onClick={() => setChannel("push")} />
                <Chip clickable color={channel === "sms" ? "primary" : "default"} label="SMS" onClick={() => setChannel("sms")} />
              </Stack>
              {channel === "push" && (
                <Stack spacing={1.5}>
                  <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                  <TextField label="Body" value={body} onChange={(e) => setBody(e.target.value)} multiline minRows={3} />
                  <TextField label="Icon URL (optional)" value={icon} onChange={(e) => setIcon(e.target.value)} />
                  <TextField
                    label='Data (JSON, e.g. {"tripId":"123"})'
                    value={dataText}
                    onChange={(e) => setDataText(e.target.value)}
                    multiline
                    minRows={2}
                  />
                </Stack>
              )}
              {channel === "sms" && (
                <Stack spacing={1.5}>
                  <TextField label="Body" value={body} onChange={(e) => setBody(e.target.value)} multiline minRows={3} required />
                </Stack>
              )}
            </Paper>
          </Grid>
        </Grid>

        <Stack direction="row" spacing={2} sx={{ mt: 3 }} alignItems="center">
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={handleSend}
            disabled={!canSend}
          >
            {sending ? "Sending…" : "Send"}
          </Button>
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            {segment ? `Segment: ${segment}${segment === "topic" && topic ? `/${topic}` : ""}` : `${emails.length} direct recipient(s)`}
          </Typography>
        </Stack>

        {toast && (
          <Box sx={{ mt: 2 }}>
            <Alert
              severity={toast.kind === "error" ? "error" : "success"}
              onClose={() => setToast(null)}
            >
              {toast.msg}
            </Alert>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
