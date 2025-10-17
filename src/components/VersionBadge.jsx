import { useMemo, useState, useCallback } from "react";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Box, Chip, IconButton, Stack, Tooltip } from "@mui/material";
import dayjs from "dayjs";

import logError from "../utils/logError.js";

const BRAND_GREEN = "#4cbb17";
const DARK_BG = "#060606";

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

function channelColor(channel) {
  switch ((channel || "").toLowerCase()) {
    case "prod":
      return BRAND_GREEN;
    case "release":
      return "#a3ff78";
    case "beta":
      return "#ffb300";
    case "canary":
      return "#29b6f6";
    default:
      return "#9e9e9e";
  }
}

export default function VersionBadge({
  value,
  size = "small",
  dense = false,
  sx,
}) {
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
          icon={<InfoOutlinedIcon sx={{ color: BRAND_GREEN }} />}
          label={data.raw}
          sx={{
            bgcolor: "rgba(76,187,23,0.12)",
            color: "#e6ffe0",
            borderColor: BRAND_GREEN,
            borderWidth: 1,
            borderStyle: "solid",
            ...(sx || {}),
          }}
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
          bgcolor: DARK_BG,
          color: "#cfd8dc",
          borderColor: "#263238",
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
          color: channelColor(data.channel),
          borderColor: channelColor(data.channel),
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
            bgcolor: "rgba(255,255,255,0.06)",
            color: "#eceff1",
            borderColor: "#37474f",
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
          bgcolor: "rgba(255,255,255,0.06)",
          color: "#b0bec5",
          borderColor: "#37474f",
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
            sx={{
              ml: dense ? 0 : 0.5,
              bgcolor: "rgba(255,255,255,0.04)",
              border: "1px solid #2e7d32",
              "&:hover": { bgcolor: "rgba(255,255,255,0.08)" },
            }}
          >
            <ContentCopyIcon fontSize="inherit" />
          </IconButton>
        </Box>
      </Tooltip>
      {copied ? (
        <Chip
          size="small"
          label="Copied"
          sx={{
            ml: 0.5,
            bgcolor: "rgba(76,187,23,0.18)",
            color: "#e6ffe0",
            borderColor: BRAND_GREEN,
            borderWidth: 1,
            borderStyle: "solid",
          }}
          variant="outlined"
        />
      ) : null}
    </Stack>
  );
}
