/* Proprietary and confidential. See LICENSE. */
// allow-color-literal-file

import { useMemo, useCallback, memo } from "react";
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  useTheme,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";

/**
 * Props:
 *  - driver: string | { id?: string; name: string; email?: string } | null
 *  - setDriver: (driver: string | { id?: string; name: string; email?: string } | null) => void
 *  - drivers: Array<string | { id?: string; name: string; email?: string }>
 *  - isTracking: boolean
 *  - role: "admin" | "driver" | string
 */
const DriverSelector = ({
  driver,
  setDriver,
  drivers = [],
  isTracking,
  role,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isAdmin = role === "admin";

  // Normalize incoming drivers to { id, name, email }
  const options = useMemo(() => {
    const norm = (d) =>
      typeof d === "string"
        ? { id: d, name: d, email: undefined }
        : {
            id: d?.id ?? d?.email ?? d?.name ?? JSON.stringify(d),
            name: d?.name ?? "",
            email: d?.email,
          };

    const mapped = (drivers || [])
      .filter(Boolean)
      .map(norm)
      .filter((d) => d.name?.trim().length > 0);

    const byId = new Map();
    for (const d of mapped) if (d.id) byId.set(d.id, d);

    return Array.from(byId.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [drivers]);

  // Controlled Select value = option id
  const valueId = useMemo(() => {
    if (!driver) return "";
    return typeof driver === "string"
      ? (options.find((o) => o.id === driver || o.name === driver)?.id ?? "")
      : (options.find((o) => o.id === driver.id || o.name === driver.name)
          ?.id ?? "");
  }, [driver, options]);

  const disabled = !isAdmin || isTracking;

  const handleChange = useCallback(
    (e) => {
      const nextId = e.target.value;
      const selected = options.find((o) => o.id === nextId) || null;
      if (selected) {
        setDriver(typeof driver === "string" ? selected.name : selected);
      } else {
        setDriver(null);
      }
    },
    [driver, options, setDriver],
  );

  const handleClear = useCallback(() => {
    setDriver(typeof driver === "string" ? "" : null);
  }, [driver, setDriver]);

  const labelId = "driver-select-label";
  const selectId = "driver-select";

  return (
    <Box
      display="flex"
      flexDirection={{ xs: "column", sm: "row" }}
      alignItems="center"
      justifyContent="flex-start"
      gap={2}
      flexWrap="wrap"
      sx={{
        p: 2,
        backgroundColor: isDark ? "grey.900" : "grey.100",
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Typography variant="body1" fontWeight="bold">
        Driver:{" "}
        <span style={{ fontWeight: 600 }}>
          {options.find((o) => o.id === valueId)?.name || "—"}
        </span>
      </Typography>

      {isAdmin ? (
        <>
          <Button
            onClick={handleClear}
            disabled={disabled}
            variant="outlined"
            size="small"
          >
            🔁 Clear
          </Button>

          <FormControl fullWidth sx={{ minWidth: 260, maxWidth: 420 }}>
            <InputLabel id={labelId}>Select Driver</InputLabel>
            <Select
              labelId={labelId}
              id={selectId}
              value={valueId}
              label="Select Driver"
              onChange={handleChange}
              disabled={disabled}
              displayEmpty
              renderValue={(selectedId) => {
                if (!selectedId)
                  return <span style={{ opacity: 0.7 }}>Select a driver…</span>;
                const opt = options.find((o) => o.id === selectedId);
                return opt ? opt.name : "";
              }}
              MenuProps={{ PaperProps: { sx: { maxHeight: 360, width: 360 } } }}
              sx={{
                bgcolor: isDark ? "grey.800" : "background.paper",
                borderRadius: 1,
              }}
            >
              <MenuItem value="">
                <em>— Select a driver —</em>
              </MenuItem>
              {options.length === 0 ? (
                <MenuItem value="__none" disabled>
                  No drivers available
                </MenuItem>
              ) : (
                options.map((o) => (
                  <MenuItem key={o.id} value={o.id}>
                    {o.name} {o.email ? `(${o.email})` : ""}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        </>
      ) : (
        <Chip
          icon={<LockIcon fontSize="small" />}
          label="Locked"
          size="small"
          sx={{
            backgroundColor: isDark ? "#555" : "#888",
            color: "common.white",
          }}
        />
      )}
    </Box>
  );
};

export default memo(DriverSelector);
