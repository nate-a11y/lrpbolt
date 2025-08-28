import * as React from "react";
import { DateTimePicker } from "@mui/x-date-pickers-pro";
import { useMediaQuery, useTheme } from "@mui/material";

export default function DateTimeFieldPro({
  value,
  onChange,
  label,
  minDateTime,
  maxDateTime,
  minutesStep = 5,
  ...rest
}) {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  return (
    <DateTimePicker
      value={value || null}
      onChange={onChange}
      ampm
      minutesStep={minutesStep}
      label={label}
      views={["year", "month", "day", "hours", "minutes"]}
      disableMaskedInput
      minDateTime={minDateTime || null}
      maxDateTime={maxDateTime || null}
      slotProps={{
        textField: { fullWidth: true, size: isXs ? "small" : "medium" },
      }}
      {...rest}
    />
  );
}
