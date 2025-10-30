// allow-color-literal-file

import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Grow,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import SmsIcon from "@mui/icons-material/Sms";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";

import VehicleChip from "@/components/VehicleChip";

// Helper functions
function getInitials(name = "") {
  const parts = String(name).trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.at(-1)?.[0] ?? "")).toUpperCase();
}

function normalizePhone(phone = "") {
  const trimmed = String(phone).trim();
  const keepPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  return keepPlus ? `+${digits}` : digits;
}

function telHref(p = "") {
  return `tel:${normalizePhone(p)}`;
}

function isMobileUA() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function smsHrefOrNull(p = "") {
  return isMobileUA() ? `sms:${normalizePhone(p)}` : null;
}

/**
 * DriverCard - Beautiful card component for displaying driver information
 * Matches the ImportantInfo card styling
 */
export default function DriverCard({ driver, highlight = false }) {
  const [copied, setCopied] = useState(false);

  const initials = useMemo(() => getInitials(driver?.name), [driver?.name]);
  const tel = useMemo(() => telHref(driver?.phone), [driver?.phone]);
  const sms = useMemo(() => smsHrefOrNull(driver?.phone), [driver?.phone]);
  const email = useMemo(() => `mailto:${driver?.email}`, [driver?.email]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(driver?.phone || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Clipboard copy failed:", err);
    }
  };

  const vehicles = useMemo(
    () =>
      Array.isArray(driver?.vehicles) ? driver.vehicles.filter(Boolean) : [],
    [driver?.vehicles],
  );

  const roles = useMemo(
    () => (Array.isArray(driver?.roles) ? driver.roles.filter(Boolean) : []),
    [driver?.roles],
  );

  return (
    <Grow in timeout={220}>
      <Card
        sx={{
          position: "relative",
          borderRadius: 3,
          bgcolor: (t) => t.palette.background.paper,
          borderColor: (t) =>
            highlight ? t.palette.primary.light : t.palette.divider,
          border: 1,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          transition:
            "transform 180ms ease, box-shadow 220ms ease, border-color 180ms ease",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          },
        }}
      >
        <CardContent sx={{ pb: 1.5 }}>
          <Stack spacing={2}>
            {/* Header with avatar and driver info */}
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  position: "relative",
                  borderRadius: "50%",
                  p: 0.5,
                  background: (t) =>
                    `radial-gradient(120% 120% at 50% 60%, ${alpha(
                      t.palette.primary.main,
                      0.25,
                    )} 0%, ${alpha(t.palette.primary.main, 0)} 70%)`,
                }}
              >
                <Avatar
                  sx={{
                    width: 48,
                    height: 48,
                    bgcolor: (t) => t.palette.background.paper,
                    border: (t) => `2px solid ${t.palette.primary.main}`,
                    fontWeight: 800,
                    color: (t) => t.palette.text.primary,
                  }}
                >
                  {initials}
                </Avatar>
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 800,
                    color: (t) => t.palette.text.primary,
                    textShadow: `0 0 6px rgba(76,187,23,0.45)`,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {driver?.name || "Unknown"}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: (t) => t.palette.primary.main,
                    fontWeight: 700,
                  }}
                >
                  {driver?.lrp || "N/A"}
                </Typography>
              </Box>
            </Stack>

            {/* Contact info */}
            <Stack
              spacing={0.5}
              sx={{
                bgcolor: (t) => alpha(t.palette.common.white, 0.04),
                border: (t) => `1px solid ${t.palette.divider}`,
                borderRadius: 2,
                px: 2,
                py: 1,
              }}
            >
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {driver?.phone || "No phone"}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {driver?.email || "No email"}
              </Typography>
            </Stack>

            {/* Roles and Vehicles */}
            <Stack spacing={1}>
              {roles.length > 0 && (
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                  sx={{ rowGap: 0.5 }}
                >
                  <Typography
                    variant="caption"
                    sx={{ opacity: 0.7, fontWeight: 600 }}
                  >
                    ROLES:
                  </Typography>
                  {roles.map((role) => (
                    <Chip
                      key={role}
                      size="small"
                      label={role}
                      sx={{
                        bgcolor: (t) => alpha(t.palette.info.main, 0.12),
                        color: (t) => t.palette.info.main,
                        border: (t) => `1px solid ${t.palette.info.main}`,
                        fontWeight: 600,
                      }}
                    />
                  ))}
                </Stack>
              )}

              {vehicles.length > 0 && (
                <Stack spacing={0.5}>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <LocalShippingIcon fontSize="small" sx={{ opacity: 0.7 }} />
                    <Typography
                      variant="caption"
                      sx={{ opacity: 0.7, fontWeight: 600 }}
                    >
                      VEHICLES:
                    </Typography>
                  </Stack>
                  <Stack
                    direction="row"
                    spacing={0.5}
                    flexWrap="wrap"
                    useFlexGap
                    sx={{ rowGap: 0.5 }}
                  >
                    {vehicles.slice(0, 4).map((vehicle) => (
                      <VehicleChip
                        key={
                          typeof vehicle === "string"
                            ? vehicle
                            : JSON.stringify(vehicle)
                        }
                        vehicle={vehicle}
                        sx={{
                          "& .MuiChip-root, &": {
                            bgcolor: (t) => alpha(t.palette.common.white, 0.06),
                            color: (t) => t.palette.text.primary,
                            border: (t) => `1px solid ${t.palette.divider}`,
                            fontWeight: 600,
                          },
                        }}
                      />
                    ))}
                    {vehicles.length > 4 && (
                      <Chip
                        size="small"
                        label={`+${vehicles.length - 4}`}
                        sx={{
                          bgcolor: (t) => alpha(t.palette.common.white, 0.06),
                          color: (t) => t.palette.text.primary,
                          border: (t) => `1px solid ${t.palette.divider}`,
                          fontWeight: 600,
                        }}
                      />
                    )}
                  </Stack>
                </Stack>
              )}
            </Stack>
          </Stack>
        </CardContent>

        {/* Actions */}
        <CardActions
          sx={{
            px: 2,
            pb: 2,
            pt: 0,
            borderTop: (t) => `1px solid ${t.palette.divider}`,
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          {/* Desktop buttons */}
          <Stack
            direction="row"
            spacing={1}
            sx={{ display: { xs: "none", sm: "flex" } }}
          >
            <Button
              variant="outlined"
              size="small"
              component="a"
              href={tel}
              startIcon={<PhoneIcon fontSize="small" />}
              sx={{
                borderColor: (t) => t.palette.primary.main,
                color: (t) => t.palette.primary.main,
                fontWeight: 600,
                "&:hover": {
                  borderColor: (t) => t.palette.primary.main,
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                },
              }}
            >
              Call
            </Button>
            {sms ? (
              <Button
                variant="outlined"
                size="small"
                component="a"
                href={sms}
                startIcon={<SmsIcon fontSize="small" />}
                sx={{
                  borderColor: (t) => t.palette.primary.main,
                  color: (t) => t.palette.primary.main,
                  fontWeight: 600,
                  "&:hover": {
                    borderColor: (t) => t.palette.primary.main,
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                  },
                }}
              >
                SMS
              </Button>
            ) : (
              <Button
                variant="outlined"
                size="small"
                onClick={onCopy}
                startIcon={<ContentCopyIcon fontSize="small" />}
                sx={{
                  borderColor: (t) => t.palette.primary.main,
                  color: (t) => t.palette.primary.main,
                  fontWeight: 600,
                  "&:hover": {
                    borderColor: (t) => t.palette.primary.main,
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                  },
                }}
              >
                {copied ? "Copied!" : "Copy #"}
              </Button>
            )}
            <Button
              variant="outlined"
              size="small"
              component="a"
              href={email}
              startIcon={<EmailIcon fontSize="small" />}
              sx={{
                borderColor: (t) => t.palette.primary.main,
                color: (t) => t.palette.primary.main,
                fontWeight: 600,
                "&:hover": {
                  borderColor: (t) => t.palette.primary.main,
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                },
              }}
            >
              Email
            </Button>
          </Stack>

          {/* Mobile icon buttons */}
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ display: { xs: "flex", sm: "none" } }}
          >
            <Tooltip title="Call">
              <IconButton
                component="a"
                href={tel}
                size="small"
                sx={{
                  color: (t) => t.palette.text.primary,
                  border: (t) =>
                    `1px solid ${alpha(t.palette.primary.main, 0.35)}`,
                  borderRadius: 2,
                  "&:hover": {
                    borderColor: (t) => t.palette.primary.main,
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
                  },
                }}
              >
                <PhoneIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="SMS">
              <IconButton
                component={sms ? "a" : "button"}
                href={sms || undefined}
                onClick={!sms ? onCopy : undefined}
                size="small"
                sx={{
                  color: (t) => t.palette.text.primary,
                  border: (t) =>
                    `1px solid ${alpha(t.palette.primary.main, 0.35)}`,
                  borderRadius: 2,
                  "&:hover": {
                    borderColor: (t) => t.palette.primary.main,
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
                  },
                }}
              >
                <SmsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Email">
              <IconButton
                component="a"
                href={email}
                size="small"
                sx={{
                  color: (t) => t.palette.text.primary,
                  border: (t) =>
                    `1px solid ${alpha(t.palette.primary.main, 0.35)}`,
                  borderRadius: 2,
                  "&:hover": {
                    borderColor: (t) => t.palette.primary.main,
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
                  },
                }}
              >
                <EmailIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Copy Number">
              <IconButton
                onClick={onCopy}
                size="small"
                sx={{
                  color: (t) => t.palette.text.primary,
                  border: (t) =>
                    `1px solid ${alpha(t.palette.primary.main, 0.35)}`,
                  borderRadius: 2,
                  "&:hover": {
                    borderColor: (t) => t.palette.primary.main,
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
                  },
                }}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </CardActions>
      </Card>
    </Grow>
  );
}

DriverCard.propTypes = {
  driver: PropTypes.object.isRequired,
  highlight: PropTypes.bool,
};
