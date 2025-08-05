/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useDriver } from "../context/DriverContext.jsx";
import DriverSelect from "./DriverSelect";
import useAuthGuard from "../hooks/useAuthGuard";

const ChangeDriverModal = ({ open, onClose }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { driver, setDriver } = useDriver();
  const [selected, setSelected] = useState(driver || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useAuthGuard("admin");

  useEffect(() => {
    setSelected(driver || null);
    setIsSubmitting(false); // reset when reopened
  }, [driver, open]);

  const handleApply = async () => {
    if (!selected) return;
    setIsSubmitting(true);
    try {
      await setDriver(selected);
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
        <DriverSelect
          value={selected}
          onChange={setSelected}
          disabled={isSubmitting}
          label="Select Driver"
        />
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
