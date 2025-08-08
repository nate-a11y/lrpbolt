/* Proprietary and confidential. See LICENSE. */
// src/components/DriverSelect.jsx
import React, { useEffect, useState } from "react";
import { Autocomplete, TextField, CircularProgress } from "@mui/material";
import { subscribeUserAccess } from "../hooks/api";

/**
 * Reusable driver selection component with async loading and search.
 * @param {object} props
 * @param {object|null} props.value - currently selected driver object
 * @param {(driver: object|null) => void} props.onChange - callback when selection changes
 */
export default function DriverSelect({ value, onChange, label = "Select Driver", disabled = false }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeUserAccess((rows) => {
      const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
      setOptions(sorted);
      setLoading(false);
    }, { activeOnly: true, roles: ["admin", "driver"] });
    return () => unsubscribe();
  }, []);

  return (
    <Autocomplete
      options={options}
      value={value}
      onChange={(_, newVal) => onChange(newVal)}
      getOptionLabel={(opt) => opt?.name || ""}
      isOptionEqualToValue={(opt, val) => opt.id === val.id}
      loading={loading}
      disabled={disabled}
      renderOption={(props, option) => (
        <li {...props}>
          {option.name} ({option.email})
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
