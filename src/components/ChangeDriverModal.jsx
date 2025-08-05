/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Box,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useDriver } from "../context/DriverContext.jsx";

const ChangeDriverModal = ({ open, onClose, drivers }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { driver, setDriver } = useDriver();
  const [selected, setSelected] = useState(driver?.id || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setSelected(driver?.id || "");
    setIsSubmitting(false); // reset when reopened
  }, [driver, open]);

  const safeDriverList = useMemo(
    () =>
      Array.isArray(drivers)
        ? [...drivers].sort((a, b) => a.name.localeCompare(b.name))
        : [],
    [drivers],
  );

  const handleChange = (e) => setSelected(e.target.value);

  const handleApply = async () => {
    if (!selected) return;
    setIsSubmitting(true);
    try {
      const newDriver = safeDriverList.find((d) => d.id === selected);
      if (newDriver) setDriver(newDriver);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          backgroundColor: isDark ? "grey.900" : "background.paper",
          color: isDark ? "grey.100" : "text.primary",
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: "bold" }}>🔁 Change Driver</DialogTitle>
      <DialogContent dividers>
        <FormControl fullWidth sx={{ mt: 1 }}>
          <InputLabel>Select Driver</InputLabel>
          <Select
            value={selected}
            onChange={handleChange}
            label="Select Driver"
            onKeyDown={(e) => {
              if (e.key === "Enter" && selected && !isSubmitting) handleApply();
            }}
            sx={{
              bgcolor: isDark ? "grey.800" : "grey.100",
              borderRadius: 1,
            }}
            disabled={isSubmitting}
          >
            {safeDriverList.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          disabled={!selected || isSubmitting}
        >
          {isSubmitting ? "Applying..." : "Apply"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default React.memo(ChangeDriverModal);
