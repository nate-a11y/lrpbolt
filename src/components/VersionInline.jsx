import { Tooltip, Typography } from "@mui/material";

import dayjs from "../utils/dayjsSetup.js";

function parse(version) {
  if (typeof version !== "string") return { raw: version };
  const match = version.match(
    /^v(\d+\.\d+\.\d+)-([^.]+)\.(\d{8})\.(\d+)\+([a-f0-9]{7,})$/i,
  );
  if (!match) return { raw: version };
  const [, semver, channel, date, run, sha] = match;
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

export default function VersionInline({ value, sx }) {
  const parsed = parse(value);
  if (!parsed || (!parsed.semver && parsed.raw)) {
    return (
      <Typography variant="caption" sx={sx}>
        {parsed?.raw || value || ""}
      </Typography>
    );
  }

  const text = `v${parsed.semver} • ${parsed.channel} • ${parsed.dateISO} • #${parsed.run}`;

  return (
    <Tooltip title={parsed.raw}>
      <Typography variant="caption" sx={{ opacity: 0.75, ...(sx || {}) }}>
        {text}
      </Typography>
    </Tooltip>
  );
}
