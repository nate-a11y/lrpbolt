/* Proprietary and confidential. See LICENSE. */
import { useEffect, useState } from "react";
import { Autocomplete, TextField, CircularProgress } from "@mui/material";

import { subscribeUserAccess } from "../hooks/api";
import { useAuth } from "../context/AuthContext.jsx";

export default function DriverSelect({
  value,
  onChange,
  label = "Select Driver",
  disabled = false,
}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user, authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user?.email) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Setting loading state for subscription is intentional
    setLoading(true);
    const unsubscribe = subscribeUserAccess(
      (rows) => {
        // eslint-disable-next-line no-console
        console.debug("[DriverSelect] subscribeUserAccess returned:", rows);
        const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
        setOptions(sorted);
        setLoading(false);
      },
      { roles: ["admin", "driver"] },
      (err) => {
        console.error("[DriverSelect] Error in subscription:", err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [authLoading, user?.email]);

  return (
    <Autocomplete
      options={options}
      value={value}
      onChange={(_, newVal) => onChange(newVal)}
      getOptionLabel={(opt) => opt?.name || ""}
      isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
      loading={loading}
      disabled={disabled}
      noOptionsText={loading ? "Loading drivers..." : "No drivers found"}
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
                {loading && <CircularProgress color="inherit" size={20} />}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
