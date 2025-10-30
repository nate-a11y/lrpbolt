/* Proprietary and confidential. See LICENSE. */

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Avatar,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CodeIcon from "@mui/icons-material/Code";
import LanguageIcon from "@mui/icons-material/Language";
import DescriptionIcon from "@mui/icons-material/Description";
import SettingsIcon from "@mui/icons-material/Settings";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import MessageIcon from "@mui/icons-material/Message";
import CheckIcon from "@mui/icons-material/Check";
import WarningIcon from "@mui/icons-material/Warning";

import ResponsiveContainer from "@/components/responsive/ResponsiveContainer.jsx";
import { useSnack } from "@/components/feedback/SnackbarProvider.jsx";
import {
  getChatbotSettings,
  saveChatbotSettings,
  getKnowledgeBase,
  addKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  subscribeToKnowledgeBase,
} from "@/services/chatbotService.js";
import { getAISettings } from "@/services/appSettingsService.js";
import ChatbotWidget from "@/components/ChatbotWidget.jsx";
import {
  getRecentAnalytics,
  calculateCostPerBooking,
  formatCurrency,
  formatPercentage,
} from "@/services/chatbotAnalyticsService.js";
import logError from "@/utils/logError.js";

export default function ChatBotSettings() {
  const theme = useTheme();
  const { show } = useSnack();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("general");
  const [aiConfigured, setAiConfigured] = useState(false);

  // Chatbot Settings
  const [enabled, setEnabled] = useState(false);
  const [name, setName] = useState("Johnny");
  const [welcomeMessage, setWelcomeMessage] = useState("Hey there! 👋 I'm Johnny, your Chief Chauffeur of Chat at Lake Ride Pros. How can I help you today?");
  const [placeholder, setPlaceholder] = useState("Ask about our rides, availability, pricing...");
  const [primaryColor, setPrimaryColor] = useState(null); // Will use theme default if null
  const [position, setPosition] = useState("bottom-right");
  const [facebookPageUrl, setFacebookPageUrl] = useState("https://m.me/lakeridepros");
  const [bookingUrl, setBookingUrl] = useState("https://customer.moovs.app/lake-ride-pros/new/info");
  const [instructions, setInstructions] = useState(
    `Respond on behalf of the business as an employee of Lake Ride Pros.

Your personality: Think of yourself as the Chief Chauffeur of Chat, with a fun, helpful, and occasionally snarky tone (but always professional).

✅ Keep answers informative, friendly, and concise.
✅ Provide information based solely on the data from the uploaded knowledge and brand guidelines.
✅ If you don't know the answer, clearly state that and recommend contacting Lake Ride Pros directly (Phone: 📞 573-206-9499).
✅ Use emojis where appropriate to keep the tone engaging and on-brand.

🚫 Do not invent details.
🚫 Do not oversell rides that are not possible or not in the system.

Booking & Availability Guidance:
When checking availability, DO NOT default to sending users to the booking site or to call us — FIRST check provided concert & event availability text blocks or notes (if provided in the chat data).
If the concert/show they asked about is not sold out, make sure to communicate that!
Always remind the user that we can still book other rides as our schedule allows, even when certain events are full.

Business Name: Lake Ride Pros
Business Industry: Transportation
Business Overview: Lake Ride Pros offers premier transportation at Lake of the Ozarks with a luxury fleet. We provide services for weddings, corporate travel, airport transfers, nightlife, concerts, parties, and more — from SUVs to party buses, sprinters, and shuttles.

Assistant's Name: Johnny
Assistant's Role: Chief Chauffeur of Chat

Contact Info:
📞 Phone: 573-206-9499
🌐 Website: www.lakeridepros.com
🚗 Booking Site: www.lakeridepros.com/book
🚗 Online Booking Portal: customer.moovs.app/lake-ride-pros/new/info

Chat Escalation:
If the user needs more personalized help or wants to speak with a human, direct them to:
💬 Facebook Messenger: Message us on Facebook for live chat support
📞 Call directly: 573-206-9499`
  );

  // Knowledge Base
  const [knowledgeBase, setKnowledgeBase] = useState([]);
  const [knowledgeDialog, setKnowledgeDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [entryType, setEntryType] = useState("website");
  const [entryUrl, setEntryUrl] = useState("");
  const [entryTitle, setEntryTitle] = useState("");
  const [entryContent, setEntryContent] = useState("");

  // Analytics
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsDateRange, setAnalyticsDateRange] = useState(7); // days

  // Load initial data
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [chatbotData, aiData, knowledge] = await Promise.all([
          getChatbotSettings(),
          getAISettings(),
          getKnowledgeBase(),
        ]);

        if (!mounted) return;

        // Set chatbot settings
        setEnabled(chatbotData.enabled || false);
        setName(chatbotData.name || "Johnny");
        setWelcomeMessage(
          chatbotData.welcomeMessage || "Hey there! 👋 I'm Johnny, your Chief Chauffeur of Chat at Lake Ride Pros. How can I help you today?"
        );
        setPlaceholder(chatbotData.placeholder || "Ask about our rides, availability, pricing...");
        // Only set primaryColor if it's a valid hex color (not a theme path)
        setPrimaryColor(chatbotData.primaryColor && chatbotData.primaryColor.startsWith('#') ? chatbotData.primaryColor : null);
        setPosition(chatbotData.position || "bottom-right");
        setFacebookPageUrl(chatbotData.facebookPageUrl || "https://m.me/lakeridepros");
        setBookingUrl(chatbotData.bookingUrl || "https://customer.moovs.app/lake-ride-pros/new/info");
        setInstructions(
          chatbotData.instructions ||
            "You are Johnny, the Chief Chauffeur of Chat at Lake Ride Pros. Be helpful, friendly, and professional."
        );

        // Check AI configuration
        setAiConfigured(aiData.enabled && !!aiData.apiKey);

        // Set knowledge base
        setKnowledgeBase(knowledge);
      } catch (err) {
        logError(err, { where: "ChatBotSettings.loadData" });
        show("Failed to load chatbot settings", "error");
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [show, theme]);

  // Subscribe to knowledge base updates
  useEffect(() => {
    const unsubscribe = subscribeToKnowledgeBase((entries) => {
      setKnowledgeBase(entries);
    });

    return unsubscribe;
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveChatbotSettings({
        enabled,
        name,
        welcomeMessage,
        placeholder,
        primaryColor,
        position,
        facebookPageUrl,
        bookingUrl,
        instructions,
      });
      show("Chatbot settings saved successfully", "success");
    } catch (err) {
      logError(err, { where: "ChatBotSettings.handleSave" });
      show("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  }, [
    enabled,
    name,
    welcomeMessage,
    placeholder,
    primaryColor,
    position,
    facebookPageUrl,
    bookingUrl,
    instructions,
    show,
  ]);

  const handleAddKnowledge = useCallback(() => {
    setEditingEntry(null);
    setEntryType("website");
    setEntryUrl("");
    setEntryTitle("");
    setEntryContent("");
    setKnowledgeDialog(true);
  }, []);

  const handleEditKnowledge = useCallback((entry) => {
    setEditingEntry(entry);
    setEntryType(entry.type || "website");
    setEntryUrl(entry.url || "");
    setEntryTitle(entry.title || "");
    setEntryContent(entry.content || "");
    setKnowledgeDialog(true);
  }, []);

  const handleSaveKnowledge = useCallback(async () => {
    try {
      const entry = {
        type: entryType,
        ...(entryType === "website" ? { url: entryUrl } : {}),
        ...(entryType === "document" ? { title: entryTitle } : {}),
        content: entryContent,
      };

      if (editingEntry) {
        await updateKnowledgeEntry(editingEntry.id, entry);
        show("Knowledge entry updated", "success");
      } else {
        await addKnowledgeEntry(entry);
        show("Knowledge entry added", "success");
      }

      setKnowledgeDialog(false);
    } catch (err) {
      logError(err, { where: "ChatBotSettings.handleSaveKnowledge" });
      show("Failed to save knowledge entry", "error");
    }
  }, [
    entryType,
    entryUrl,
    entryTitle,
    entryContent,
    editingEntry,
    show,
  ]);

  const handleDeleteKnowledge = useCallback(
    async (id) => {
      if (!confirm("Are you sure you want to delete this entry?")) return;

      try {
        await deleteKnowledgeEntry(id);
        show("Knowledge entry deleted", "success");
      } catch (err) {
        logError(err, { where: "ChatBotSettings.handleDeleteKnowledge" });
        show("Failed to delete entry", "error");
      }
    },
    [show]
  );

  const handleCopyEmbedCode = useCallback(() => {
    // Get the base URL for the embed (use production URL if available)
    const embedUrl = window.location.origin;

    const embedCode = `<!-- Lake Ride Pros Chatbot Widget -->
<script>
  (function() {
    window.lrpChatbotConfig = {
      apiUrl: '${embedUrl}'
    };
    var script = document.createElement('script');
    script.src = '${embedUrl}/chatbot-embed.js';
    script.async = true;
    document.head.appendChild(script);
  })();
</script>`;

    navigator.clipboard.writeText(embedCode);
    show("Embed code copied to clipboard", "success");
  }, [show]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const data = await getRecentAnalytics(analyticsDateRange);
      setAnalytics(data);
    } catch (err) {
      logError(err, { where: "ChatBotSettings.loadAnalytics" });
      show("Failed to load analytics data", "error");
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsDateRange, show]);

  // Load analytics when tab changes to analytics
  useEffect(() => {
    if (tab === "analytics" && !analytics) {
      loadAnalytics();
    }
  }, [tab, analytics, loadAnalytics]);

  const getCurrentSettings = () => ({
    enabled,
    name,
    welcomeMessage,
    placeholder,
    primaryColor,
    position,
    facebookPageUrl,
    bookingUrl,
    instructions,
  });

  if (loading) {
    return (
      <ResponsiveContainer>
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Typography>Loading...</Typography>
        </Box>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer>
      <Stack spacing={3}>
        {/* Header */}
        <Card
          sx={{
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            background: (theme) =>
              `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(
                theme.palette.background.paper,
                0.6
              )} 100%)`,
          }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar
                sx={{
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.18),
                  color: "primary.main",
                  width: 48,
                  height: 48,
                }}
              >
                <SmartToyIcon />
              </Avatar>
              <Box>
                <Typography variant="h5" fontWeight={700}>
                  Chat Bot Settings
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.75 }}>
                  Configure AI chatbot for your external websites
                </Typography>
              </Box>
            </Stack>

            {!aiConfigured && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                AI is not configured. Please set up your OpenAI API key in{" "}
                <strong>Important Info → Admin → AI Settings</strong> first.
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Paper sx={{ borderRadius: 2 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              px: 2,
            }}
          >
            <Tab
              icon={<SettingsIcon />}
              iconPosition="start"
              label="General"
              value="general"
            />
            <Tab
              icon={<DescriptionIcon />}
              iconPosition="start"
              label="Knowledge Base"
              value="knowledge"
            />
            <Tab
              icon={<AnalyticsIcon />}
              iconPosition="start"
              label="Analytics"
              value="analytics"
            />
            <Tab
              icon={<CodeIcon />}
              iconPosition="start"
              label="Embed Code"
              value="embed"
            />
            <Tab
              icon={<VisibilityIcon />}
              iconPosition="start"
              label="Preview"
              value="preview"
            />
          </Tabs>

          <Box sx={{ p: 3 }}>
            {/* General Settings Tab */}
            {tab === "general" && (
              <Stack spacing={3}>
                <FormControlLabel
                  control={
                    <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                  }
                  label="Enable Chatbot"
                />

                <TextField
                  label="Bot Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  fullWidth
                  helperText="The name displayed in the chat header"
                />

                <TextField
                  label="Welcome Message"
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                  helperText="First message users see when opening the chat"
                />

                <TextField
                  label="Input Placeholder"
                  value={placeholder}
                  onChange={(e) => setPlaceholder(e.target.value)}
                  fullWidth
                  helperText="Placeholder text in the message input field"
                />

                <Stack direction="row" spacing={2} alignItems="center">
                  <TextField
                    label="Primary Color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    type="color"
                    sx={{ width: 120 }}
                  />
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1,
                      bgcolor: primaryColor,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Color used for the chat interface
                  </Typography>
                </Stack>

                <FormControl fullWidth>
                  <InputLabel>Widget Position</InputLabel>
                  <Select
                    value={position}
                    label="Widget Position"
                    onChange={(e) => setPosition(e.target.value)}
                  >
                    <MenuItem value="bottom-right">Bottom Right</MenuItem>
                    <MenuItem value="bottom-left">Bottom Left</MenuItem>
                    <MenuItem value="top-right">Top Right</MenuItem>
                    <MenuItem value="top-left">Top Left</MenuItem>
                  </Select>
                </FormControl>

                <Divider />

                <Typography variant="subtitle2" sx={{ mt: 1 }}>
                  Integration Links
                </Typography>

                <TextField
                  label="Facebook Messenger URL"
                  value={facebookPageUrl}
                  onChange={(e) => setFacebookPageUrl(e.target.value)}
                  fullWidth
                  helperText="Facebook Messenger link (e.g., https://m.me/yourpage)"
                  placeholder="https://m.me/lakeridepros"
                />

                <TextField
                  label="Booking Portal URL"
                  value={bookingUrl}
                  onChange={(e) => setBookingUrl(e.target.value)}
                  fullWidth
                  helperText="Online booking system URL"
                  placeholder="https://customer.moovs.app/lake-ride-pros/new/info"
                />

                <Divider />

                <TextField
                  label="System Instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  fullWidth
                  multiline
                  rows={12}
                  helperText="Instructions that guide the AI's behavior and responses"
                />

                <Box sx={{ display: "flex", gap: 2 }}>
                  <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving || !aiConfigured}
                    startIcon={<CheckCircleIcon />}
                  >
                    {saving ? "Saving..." : "Save Settings"}
                  </Button>
                </Box>
              </Stack>
            )}

            {/* Knowledge Base Tab */}
            {tab === "knowledge" && (
              <Stack spacing={3}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="h6">Knowledge Base</Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddKnowledge}
                  >
                    Add Entry
                  </Button>
                </Box>

                {knowledgeBase.length === 0 ? (
                  <Alert severity="info">
                    No knowledge base entries yet. Add websites or documents to teach your chatbot.
                  </Alert>
                ) : (
                  <List>
                    {knowledgeBase.map((entry) => (
                      <ListItem
                        key={entry.id}
                        sx={{
                          border: 1,
                          borderColor: "divider",
                          borderRadius: 2,
                          mb: 1,
                        }}
                      >
                        <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1 }}>
                          {entry.type === "website" ? (
                            <LanguageIcon color="primary" />
                          ) : (
                            <DescriptionIcon color="primary" />
                          )}
                          <ListItemText
                            primary={entry.type === "website" ? entry.url : entry.title}
                            secondary={
                              entry.content
                                ? `${entry.content.substring(0, 100)}...`
                                : "No content"
                            }
                          />
                          <Chip
                            label={entry.type}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Stack>
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            onClick={() => handleEditKnowledge(entry)}
                            sx={{ mr: 1 }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            edge="end"
                            onClick={() => handleDeleteKnowledge(entry.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Stack>
            )}

            {/* Analytics Tab */}
            {tab === "analytics" && (
              <Stack spacing={3}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="h6">Chatbot Analytics</Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant={analyticsDateRange === 7 ? "contained" : "outlined"}
                      onClick={() => setAnalyticsDateRange(7)}
                    >
                      7 Days
                    </Button>
                    <Button
                      size="small"
                      variant={analyticsDateRange === 30 ? "contained" : "outlined"}
                      onClick={() => setAnalyticsDateRange(30)}
                    >
                      30 Days
                    </Button>
                    <Button
                      size="small"
                      onClick={loadAnalytics}
                      disabled={analyticsLoading}
                    >
                      Refresh
                    </Button>
                  </Stack>
                </Box>

                {analyticsLoading && (
                  <Box sx={{ textAlign: "center", py: 4 }}>
                    <CircularProgress />
                    <Typography variant="body2" sx={{ mt: 2 }}>
                      Loading analytics...
                    </Typography>
                  </Box>
                )}

                {!analyticsLoading && analytics && analytics.metrics && (
                  <>
                    {/* Key Metrics Cards */}
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
                        gap: 2,
                      }}
                    >
                      {/* Total Conversations */}
                      <Card sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05) }}>
                        <CardContent>
                          <Stack spacing={1}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <Typography variant="caption" color="text.secondary">
                                Total Conversations
                              </Typography>
                              <MessageIcon fontSize="small" color="primary" />
                            </Box>
                            <Typography variant="h4" fontWeight={700}>
                              {analytics.metrics.totalConversations}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Avg {analytics.metrics.avgMessagesPerConversation.toFixed(1)} messages/conversation
                            </Typography>
                          </Stack>
                        </CardContent>
                      </Card>

                      {/* Booking Rate */}
                      <Card sx={{ bgcolor: (theme) => alpha(theme.palette.success.main, 0.05) }}>
                        <CardContent>
                          <Stack spacing={1}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <Typography variant="caption" color="text.secondary">
                                Booking Rate
                              </Typography>
                              <CheckIcon fontSize="small" color="success" />
                            </Box>
                            <Typography variant="h4" fontWeight={700}>
                              {formatPercentage(analytics.metrics.bookingRate)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {analytics.metrics.bookingCount} bookings submitted
                            </Typography>
                          </Stack>
                        </CardContent>
                      </Card>

                      {/* Escalation Rate */}
                      <Card sx={{ bgcolor: (theme) => alpha(theme.palette.warning.main, 0.05) }}>
                        <CardContent>
                          <Stack spacing={1}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <Typography variant="caption" color="text.secondary">
                                Escalation Rate
                              </Typography>
                              <WarningIcon fontSize="small" color="warning" />
                            </Box>
                            <Typography variant="h4" fontWeight={700}>
                              {formatPercentage(analytics.metrics.escalationRate)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {analytics.metrics.escalatedCount} escalations
                            </Typography>
                          </Stack>
                        </CardContent>
                      </Card>

                      {/* Total Cost */}
                      <Card sx={{ bgcolor: (theme) => alpha(theme.palette.info.main, 0.05) }}>
                        <CardContent>
                          <Stack spacing={1}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <Typography variant="caption" color="text.secondary">
                                Total Cost
                              </Typography>
                              <AttachMoneyIcon fontSize="small" color="info" />
                            </Box>
                            <Typography variant="h4" fontWeight={700}>
                              {formatCurrency(analytics.metrics.totalCost)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatCurrency(analytics.metrics.avgCostPerConversation)}/conversation
                            </Typography>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Box>

                    {/* Additional Metrics */}
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                        gap: 2,
                      }}
                    >
                      {/* Performance Metrics */}
                      <Card>
                        <CardContent>
                          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                            Performance Metrics
                          </Typography>
                          <Stack spacing={2} sx={{ mt: 2 }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                              <Typography variant="body2">Completion Rate</Typography>
                              <Typography variant="body2" fontWeight={600}>
                                {formatPercentage(analytics.metrics.completionRate)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                              <Typography variant="body2">Hallucinations Caught</Typography>
                              <Typography variant="body2" fontWeight={600}>
                                {analytics.metrics.hallucinationsCaught}
                              </Typography>
                            </Box>
                            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                              <Typography variant="body2">Avg Conversation Duration</Typography>
                              <Typography variant="body2" fontWeight={600}>
                                {analytics.metrics.avgConversationDuration}s
                              </Typography>
                            </Box>
                            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                              <Typography variant="body2">Total Tokens Used</Typography>
                              <Typography variant="body2" fontWeight={600}>
                                {analytics.metrics.totalTokensUsed.toLocaleString()}
                              </Typography>
                            </Box>
                            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                              <Typography variant="body2">Cost per Booking</Typography>
                              <Typography variant="body2" fontWeight={600}>
                                {formatCurrency(calculateCostPerBooking(analytics.metrics))}
                              </Typography>
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>

                      {/* Top Escalation Reasons */}
                      <Card>
                        <CardContent>
                          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                            Top Escalation Reasons
                          </Typography>
                          {analytics.metrics.topEscalationReasons.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                              No escalations recorded
                            </Typography>
                          ) : (
                            <Stack spacing={1.5} sx={{ mt: 2 }}>
                              {analytics.metrics.topEscalationReasons.map((item) => (
                                <Box key={item.reason}>
                                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                                    <Typography variant="body2" sx={{ textTransform: "capitalize" }}>
                                      {item.reason.replace(/_/g, " ")}
                                    </Typography>
                                    <Typography variant="body2" fontWeight={600}>
                                      {item.count}
                                    </Typography>
                                  </Box>
                                  <Box
                                    sx={{
                                      height: 4,
                                      bgcolor: "divider",
                                      borderRadius: 1,
                                      overflow: "hidden",
                                    }}
                                  >
                                    <Box
                                      sx={{
                                        height: "100%",
                                        width: `${(item.count / analytics.metrics.escalatedCount) * 100}%`,
                                        bgcolor: "warning.main",
                                      }}
                                    />
                                  </Box>
                                </Box>
                              ))}
                            </Stack>
                          )}
                        </CardContent>
                      </Card>
                    </Box>

                    {/* Daily Breakdown Chart */}
                    {analytics.dailyBreakdown && analytics.dailyBreakdown.length > 0 && (
                      <Card>
                        <CardContent>
                          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                            Daily Breakdown
                          </Typography>
                          <TableContainer sx={{ mt: 2 }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>
                                    <Typography variant="caption" fontWeight={600}>Date</Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="caption" fontWeight={600}>Conversations</Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="caption" fontWeight={600}>Bookings</Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="caption" fontWeight={600}>Escalations</Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="caption" fontWeight={600}>Cost</Typography>
                                  </TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {analytics.dailyBreakdown.map((day) => (
                                  <TableRow key={day.date}>
                                    <TableCell>
                                      <Typography variant="body2">{day.date}</Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                      <Typography variant="body2">{day.conversations}</Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                      <Typography variant="body2">{day.bookings}</Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                      <Typography variant="body2">{day.escalations}</Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                      <Typography variant="body2">{formatCurrency(day.cost)}</Typography>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {!analyticsLoading && !analytics && (
                  <Alert severity="info">
                    No analytics data available. Start using the chatbot to see metrics here.
                  </Alert>
                )}
              </Stack>
            )}

            {/* Embed Code Tab */}
            {tab === "embed" && (
              <Stack spacing={3}>
                <Typography variant="h6">Embed on External Sites</Typography>
                <Alert severity="info">
                  Copy the code below and paste it in the{" "}
                  <code>&lt;head&gt;</code> section of your website.
                </Alert>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    bgcolor: (theme) => alpha(theme.palette.background.default, 0.5),
                    fontFamily: "monospace",
                    fontSize: "0.875rem",
                    overflow: "auto",
                  }}
                >
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {`<!-- Lake Ride Pros Chatbot Widget -->
<script>
  (function() {
    window.lrpChatbotConfig = {
      apiUrl: '${window.location.origin}'
    };
    var script = document.createElement('script');
    script.src = '${window.location.origin}/chatbot-embed.js';
    script.async = true;
    document.head.appendChild(script);
  })();
</script>`}
                  </pre>
                </Paper>

                <Button
                  variant="contained"
                  startIcon={<ContentCopyIcon />}
                  onClick={handleCopyEmbedCode}
                >
                  Copy Embed Code
                </Button>

                <Divider />

                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>How it works:</strong>
                  </Typography>
                  <Typography variant="body2" component="div">
                    1. The script loads from <code>/chatbot-embed.js</code> (already deployed)<br />
                    2. It fetches chatbot settings from the public API (no authentication required)<br />
                    3. Creates the chat widget on the external website<br />
                    4. All conversations are handled through Firebase Functions
                  </Typography>
                </Alert>

                <Alert severity="success" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    ✅ <strong>Ready to use!</strong> The chatbot will work on any website with this code.
                  </Typography>
                </Alert>
              </Stack>
            )}

            {/* Preview Tab */}
            {tab === "preview" && (
              <Stack spacing={3}>
                <Typography variant="h6">Live Preview</Typography>
                <Alert severity="info">
                  This is how the chatbot will appear on your website. Try interacting with it!
                </Alert>

                <Box
                  sx={{
                    position: "relative",
                    height: 600,
                    border: 2,
                    borderColor: "divider",
                    borderRadius: 2,
                    bgcolor: (theme) => alpha(theme.palette.background.default, 0.3),
                  }}
                >
                  <ChatbotWidget settings={getCurrentSettings()} isPreview />
                </Box>
              </Stack>
            )}
          </Box>
        </Paper>
      </Stack>

      {/* Knowledge Entry Dialog */}
      <Dialog
        open={knowledgeDialog}
        onClose={() => setKnowledgeDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingEntry ? "Edit Knowledge Entry" : "Add Knowledge Entry"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Entry Type</InputLabel>
              <Select
                value={entryType}
                label="Entry Type"
                onChange={(e) => setEntryType(e.target.value)}
              >
                <MenuItem value="website">Website</MenuItem>
                <MenuItem value="document">Document</MenuItem>
              </Select>
            </FormControl>

            {entryType === "website" ? (
              <TextField
                label="Website URL"
                value={entryUrl}
                onChange={(e) => setEntryUrl(e.target.value)}
                fullWidth
                placeholder="https://example.com"
              />
            ) : (
              <TextField
                label="Document Title"
                value={entryTitle}
                onChange={(e) => setEntryTitle(e.target.value)}
                fullWidth
                placeholder="User Guide"
              />
            )}

            <TextField
              label={entryType === "website" ? "Content (Optional)" : "Content"}
              value={entryContent}
              onChange={(e) => setEntryContent(e.target.value)}
              fullWidth
              multiline
              rows={8}
              helperText={
                entryType === "website"
                  ? "Optional: Paste key information or leave blank to just reference the URL"
                  : "Required: Paste the text content or key information from this document"
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKnowledgeDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveKnowledge}
            disabled={
              (entryType === "website" && !entryUrl) ||
              (entryType === "document" && (!entryTitle || !entryContent))
            }
          >
            {editingEntry ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
    </ResponsiveContainer>
  );
}
