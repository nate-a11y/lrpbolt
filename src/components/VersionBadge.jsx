import { useMemo, useState, useCallback } from "react";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Box, Chip, IconButton, Stack, Tooltip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import dayjs from "../utils/dayjsSetup.js";
import logError from "../utils/logError.js";

function parseBuild(version) {
  if (!version || typeof version !== "string") return null;
  const m = version.match(
    /^v(?<semver>\d+\.\d+\.\d+)-(?<channel>[^.]+)\.(?<date>\d{8})\.(?<run>\d+)\+(?<sha>[a-f0-9]{7,})$/i,
  );
  if (!m || !m.groups) return { raw: version };
  const { semver, channel, date, run, sha } = m.groups;
  const parsedDate = dayjs(date, "YYYYMMDD", true);
  return {
    semver,
    channel,
    dateISO: parsedDate.isValid() ? parsedDate.format("YYYY-MM-DD") : date,
    run,
    sha,
    raw: version,
  };
}

function channelColor(theme, channel) {
  switch ((channel || "").toLowerCase()) {
    case "prod":
      return theme.palette.primary.main;
    case "release":
      return "#a3ff78"; // allow-color-literal
    case "beta":
      return "#ffb300"; // allow-color-literal
    case "canary":
      return "#29b6f6"; // allow-color-literal
    default:
      return "#9e9e9e"; // allow-color-literal
  }
}

export default function VersionBadge({
  value,
  size = "small",
  dense = false,
  sx,
}) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const data = useMemo(() => parseBuild(value), [value]);
  const repo = import.meta.env.VITE_GITHUB_REPO_SLUG;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      logError(error, { where: "VersionBadge.copy" });
    }
  }, [value]);

  if (!data) return null;

  if (!data.semver && data.raw) {
    return (
      <Tooltip title={data.raw}>
        <Chip
          size={size}
          icon={
            <InfoOutlinedIcon sx={{ color: (t) => t.palette.primary.main }} />
          }
          label={data.raw}
          sx={(t) => ({
            bgcolor: alpha(t.palette.primary.main, 0.12),
            color: t.palette.getContrastText(t.palette.primary.main),
            borderColor: t.palette.primary.main,
            borderWidth: 1,
            borderStyle: "solid",
            ...(sx || {}),
          })}
          variant="outlined"
        />
      </Tooltip>
    );
  }

  const tooltipContent = [
    `Full: ${data.raw}`,
    `Commit: ${data.sha}${
      repo ? ` (https://github.com/${repo}/commit/${data.sha})` : ""
    }`,
  ].join("\n");

  return (
    <Stack
      direction="row"
      spacing={dense ? 0.5 : 1}
      alignItems="center"
      sx={{
        px: dense ? 0 : 0.5,
        py: dense ? 0 : 0.25,
        borderRadius: 2,
        ...(sx || {}),
      }}
    >
      <Chip
        size={size}
        label={`v${data.semver}`}
        sx={{
          bgcolor: (t) => t.palette.background.default,
          color: (t) => alpha(t.palette.common.white, 0.85),
          borderColor: "divider",
          borderWidth: 1,
          borderStyle: "solid",
        }}
        variant="outlined"
      />
      <Chip
        size={size}
        label={data.channel}
        sx={{
          bgcolor: "transparent",
          color: channelColor(theme, data.channel),
          borderColor: channelColor(theme, data.channel),
          borderWidth: 1,
          borderStyle: "solid",
          fontWeight: 600,
        }}
        variant="outlined"
      />
      <Tooltip title={`UTC: ${data.dateISO}`}>
        <Chip
          size={size}
          label={data.dateISO}
          sx={{
            bgcolor: (t) => alpha(t.palette.common.white, 0.06),
            color: (t) => alpha(t.palette.common.white, 0.92),
            borderColor: "divider",
            borderWidth: 1,
            borderStyle: "solid",
          }}
          variant="outlined"
        />
      </Tooltip>
      <Chip
        size={size}
        label={`#${data.run}`}
        sx={{
          bgcolor: (t) => alpha(t.palette.common.white, 0.06),
          color: (t) => alpha(t.palette.common.white, 0.8),
          borderColor: "divider",
          borderWidth: 1,
          borderStyle: "solid",
        }}
        variant="outlined"
      />
      <Tooltip title={tooltipContent}>
        <Box>
          <IconButton
            aria-label="Copy full version"
            size="small"
            onClick={handleCopy}
            sx={(t) => ({
              ml: dense ? 0 : 0.5,
              bgcolor: alpha(t.palette.common.white, 0.04),
              border: `1px solid ${t.palette.primary.main}`,
              "&:hover": {
                bgcolor: alpha(t.palette.common.white, 0.08),
              },
            })}
          >
            <ContentCopyIcon fontSize="inherit" />
          </IconButton>
        </Box>
      </Tooltip>
      {copied ? (
        <Chip
          size="small"
          label="Copied"
          sx={(t) => ({
            ml: 0.5,
            bgcolor: alpha(t.palette.primary.main, 0.18),
            color: t.palette.getContrastText(t.palette.primary.main),
            borderColor: t.palette.primary.main,
            borderWidth: 1,
            borderStyle: "solid",
          })}
          variant="outlined"
        />
      ) : null}
    </Stack>
  );
}
