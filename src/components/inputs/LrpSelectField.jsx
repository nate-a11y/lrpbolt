import React, { useId } from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from "@mui/material";

/**
 * Consistent MUI Select with: stable ids, always-shrunk label,
 * placeholder via renderValue (no overlap), and mobile-friendly sizing.
 *
 * props:
 *  - label (string)
 *  - value (string|number|'')
 *  - onChange (fn)
 *  - options: [{ value, label, disabled? }]
 *  - placeholder (string) shown only when value === '' (renderValue)
 *  - helperText (string)
 *  - size (string) 'small' | 'medium' (default: 'medium')
 *  - name, id (optional)
 *  - SelectProps/FormControlProps/InputLabelProps (optional pass-through)
 */
export default function LrpSelectField({
  label,
  value = "",
  onChange,
  options = [],
  placeholder = "Select…",
  helperText = " ",
  size = "medium",
  name,
  id,
  SelectProps: selectProps = {},
  FormControlProps = {},
  InputLabelProps = {},
}) {
  const autoId = useId();
  const selectId = id || `sel-${autoId}`;
  const labelId = `${selectId}-label`;

  return (
    <FormControl fullWidth size={size} {...FormControlProps}>
      <InputLabel
        id={labelId}
        shrink // force float so label never overlaps renderValue
        {...InputLabelProps}
      >
        {label}
      </InputLabel>
      <Select
        labelId={labelId}
        id={selectId}
        name={name}
        label={label}
        value={value ?? ""}
        onChange={onChange}
        displayEmpty
        renderValue={(selected) => {
          if (selected === "" || selected == null) {
            return <span style={{ opacity: 0.7 }}>{placeholder}</span>;
          }
          // Find option label for accessibility (in case value is non-string)
          const found = options.find((o) => o.value === selected);
          return found ? found.label : String(selected);
        }}
        MenuProps={{ disableScrollLock: true }}
        {...selectProps}
      >
        {/* Keep an explicit empty option for keyboard users */}
        <MenuItem value="">
          <em>None</em>
        </MenuItem>
        {options.map((opt) => (
          <MenuItem
            key={String(opt.value)}
            value={opt.value}
            disabled={!!opt.disabled}
          >
            {opt.label}
          </MenuItem>
        ))}
      </Select>
      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
    </FormControl>
  );
}
