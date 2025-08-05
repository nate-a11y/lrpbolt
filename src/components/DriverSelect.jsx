/* Proprietary and confidential. See LICENSE. */
// src/components/DriverSelect.jsx
import React, { useEffect, useState } from "react";
import { Autocomplete, TextField, CircularProgress } from "@mui/material";
import { getDrivers } from "../utils/firestoreService";

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
    let active = true;
    setLoading(true);
    getDrivers()
      .then((list) => {
        if (active) setOptions(list);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
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
