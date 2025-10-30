/* Proprietary and confidential. See LICENSE. */

import { useState, useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Fab,
  Paper,
  TextField,
  Typography,
  IconButton,
  Stack,
  Avatar,
  CircularProgress,
  Zoom,
  Tooltip,
  Button,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ChatIcon from "@mui/icons-material/Chat";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import FacebookIcon from "@mui/icons-material/Facebook";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";

import { queryChatbot } from "@/services/chatbotService.js";
import logError from "@/utils/logError.js";

export default function ChatbotWidget({ settings, isPreview = false }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const {
    enabled = true,
    name = "Johnny",
    welcomeMessage = "Hey there! 👋 I'm Johnny, your Chief Chauffeur of Chat at Lake Ride Pros. How can I help you today?",
    placeholder = "Ask about our rides, availability, pricing...",
    primaryColor = "#4CAF50",
    position = "bottom-right",
    facebookPageUrl = "https://m.me/lakeridepros",
    bookingUrl = "https://customer.moovs.app/lake-ride-pros/new/info",
  } = settings || {};

  // Add welcome message when chat opens
  useEffect(() => {
    if (open && messages.length === 0 && welcomeMessage) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: welcomeMessage,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [open, messages.length, welcomeMessage]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
    setError(null);
  }, []);

  const handleMessengerClick = useCallback(() => {
    // Open Facebook Messenger to Lake Ride Pros
    window.open(facebookPageUrl, "_blank");
  }, [facebookPageUrl]);

  const handleBookingClick = useCallback(() => {
    // Open booking portal in new tab
    window.open(bookingUrl, "_blank");
  }, [bookingUrl]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);
    setShowQuickActions(false); // Hide quick actions after first message

    try {
      // Build conversation history for context
      const conversationHistory = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const response = await queryChatbot(userMessage.content, conversationHistory);

      const botMessage = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        content: response,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      logError(err, { where: "ChatbotWidget.handleSend" });
      setError(err.message || "Sorry, something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Position styles
  const getPositionStyles = () => {
    const base = {
      position: "fixed",
      zIndex: 9999,
    };

    switch (position) {
      case "bottom-left":
        return { ...base, bottom: 24, left: 24 };
      case "bottom-right":
        return { ...base, bottom: 24, right: 24 };
      case "top-left":
        return { ...base, top: 24, left: 24 };
      case "top-right":
        return { ...base, top: 24, right: 24 };
      default:
        return { ...base, bottom: 24, right: 24 };
    }
  };

  if (!enabled && !isPreview) return null;

  return (
    <Box sx={getPositionStyles()}>
      {/* Chat Window */}
      <Zoom in={open} unmountOnExit>
        <Paper
          elevation={8}
          sx={{
            width: { xs: "calc(100vw - 32px)", sm: 380 },
            height: { xs: "calc(100vh - 100px)", sm: 600 },
            maxHeight: "calc(100vh - 100px)",
            display: "flex",
            flexDirection: "column",
            borderRadius: 3,
            overflow: "hidden",
            mb: 2,
          }}
        >
          {/* Header */}
          <Box
            sx={{
              bgcolor: primaryColor,
              color: "common.white",
              p: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar
                sx={{
                  bgcolor: (theme) => alpha(theme.palette.common.white, 0.2),
                  width: 36,
                  height: 36,
                }}
              >
                <SmartToyIcon fontSize="small" />
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  {name}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  {loading ? "Typing..." : "Online"}
                </Typography>
              </Box>
            </Stack>
            <IconButton onClick={handleToggle} size="small" sx={{ color: "common.white" }}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Messages */}
          <Box
            sx={{
              flex: 1,
              overflow: "auto",
              p: 2,
              bgcolor: (theme) => alpha(theme.palette.background.default, 0.5),
            }}
          >
            <Stack spacing={2}>
              {/* Quick Actions - Show before conversation starts */}
              {showQuickActions && messages.length <= 1 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ opacity: 0.7, mb: 1, display: "block" }}>
                    Quick Actions
                  </Typography>
                  <Stack spacing={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<EventAvailableIcon />}
                      onClick={handleBookingClick}
                      sx={{
                        justifyContent: "flex-start",
                        textTransform: "none",
                        borderColor: alpha(primaryColor, 0.3),
                        color: primaryColor,
                        "&:hover": {
                          borderColor: primaryColor,
                          bgcolor: alpha(primaryColor, 0.05),
                        },
                      }}
                    >
                      Book a Ride
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<FacebookIcon />}
                      onClick={handleMessengerClick}
                      sx={{
                        justifyContent: "flex-start",
                        textTransform: "none",
                        borderColor: alpha(primaryColor, 0.3),
                        color: primaryColor,
                        "&:hover": {
                          borderColor: primaryColor,
                          bgcolor: alpha(primaryColor, 0.05),
                        },
                      }}
                    >
                      Chat on Messenger
                    </Button>
                  </Stack>
                </Box>
              )}
              {messages.map((msg) => (
                <Box
                  key={msg.id}
                  sx={{
                    display: "flex",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <Stack
                    direction={msg.role === "user" ? "row-reverse" : "row"}
                    spacing={1}
                    sx={{ maxWidth: "80%" }}
                  >
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: msg.role === "user" ? "primary.main" : alpha(primaryColor, 0.15),
                      }}
                    >
                      {msg.role === "user" ? (
                        <PersonIcon fontSize="small" />
                      ) : (
                        <SmartToyIcon fontSize="small" sx={{ color: primaryColor }} />
                      )}
                    </Avatar>
                    <Paper
                      elevation={1}
                      sx={{
                        p: 1.5,
                        bgcolor:
                          msg.role === "user"
                            ? primaryColor
                            : (theme) => theme.palette.background.paper,
                        color: msg.role === "user" ? "common.white" : "text.primary",
                        borderRadius: 2,
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                        {msg.content}
                      </Typography>
                    </Paper>
                  </Stack>
                </Box>
              ))}

              {loading && (
                <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
                  <Stack direction="row" spacing={1}>
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: alpha(primaryColor, 0.15),
                      }}
                    >
                      <SmartToyIcon fontSize="small" sx={{ color: primaryColor }} />
                    </Avatar>
                    <Paper
                      elevation={1}
                      sx={{
                        p: 1.5,
                        bgcolor: (theme) => theme.palette.background.paper,
                        borderRadius: 2,
                      }}
                    >
                      <CircularProgress size={20} sx={{ color: primaryColor }} />
                    </Paper>
                  </Stack>
                </Box>
              )}

              {error && (
                <Box sx={{ display: "flex", justifyContent: "center" }}>
                  <Typography variant="caption" color="error" sx={{ textAlign: "center" }}>
                    {error}
                  </Typography>
                </Box>
              )}

              <div ref={messagesEndRef} />
            </Stack>
          </Box>

          {/* Input */}
          <Box
            sx={{
              p: 2,
              bgcolor: (theme) => theme.palette.background.paper,
              borderTop: 1,
              borderColor: "divider",
            }}
          >
            {/* Action Buttons - Always visible */}
            <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
              <Tooltip title="Book a ride online">
                <IconButton
                  size="small"
                  onClick={handleBookingClick}
                  sx={{
                    color: primaryColor,
                    "&:hover": {
                      bgcolor: alpha(primaryColor, 0.1),
                    },
                  }}
                >
                  <EventAvailableIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Chat with us on Facebook Messenger">
                <IconButton
                  size="small"
                  onClick={handleMessengerClick}
                  sx={{
                    color: primaryColor,
                    "&:hover": {
                      bgcolor: alpha(primaryColor, 0.1),
                    },
                  }}
                >
                  <FacebookIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>

            <Stack direction="row" spacing={1}>
              <TextField
                inputRef={inputRef}
                fullWidth
                size="small"
                placeholder={placeholder}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
                multiline
                maxRows={3}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                  },
                }}
              />
              <IconButton
                onClick={handleSend}
                disabled={!input.trim() || loading}
                sx={{
                  bgcolor: primaryColor,
                  color: "common.white",
                  "&:hover": {
                    bgcolor: alpha(primaryColor, 0.8),
                  },
                  "&:disabled": {
                    bgcolor: "action.disabledBackground",
                  },
                }}
              >
                <SendIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Box>
        </Paper>
      </Zoom>

      {/* FAB Button */}
      <Zoom in={!open}>
        <Tooltip title={`Chat with ${name}`} placement="left">
          <Fab
            onClick={handleToggle}
            sx={{
              bgcolor: primaryColor,
              color: "common.white",
              "&:hover": {
                bgcolor: alpha(primaryColor, 0.8),
                transform: "scale(1.1)",
              },
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: `0 4px 20px ${alpha(primaryColor, 0.4)}`,
            }}
            aria-label="Open chat"
          >
            <ChatIcon />
          </Fab>
        </Tooltip>
      </Zoom>
    </Box>
  );
}

ChatbotWidget.propTypes = {
  settings: PropTypes.shape({
    enabled: PropTypes.bool,
    name: PropTypes.string,
    welcomeMessage: PropTypes.string,
    placeholder: PropTypes.string,
    primaryColor: PropTypes.string,
    position: PropTypes.oneOf(["bottom-left", "bottom-right", "top-left", "top-right"]),
  }),
  isPreview: PropTypes.bool,
};
