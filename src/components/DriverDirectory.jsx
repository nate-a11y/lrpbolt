/* Proprietary and confidential. See LICENSE. */
import React, { useState, useCallback, useMemo } from "react";
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Link,
  Divider,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";

import VehicleChip from "./VehicleChip";

import DRIVER_LIST from "../data/driverDirectory";

export default function DriverDirectory() {
  const [search, setSearch] = useState("");

  const highlight = useCallback((text, keyword) => {
    if (!keyword) return text;
    const parts = text.split(new RegExp(`(${keyword})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === keyword.toLowerCase() ? (
        <Box
          key={i}
          component="span"
          sx={{ bgcolor: "yellow", fontWeight: 600 }}
        >
          {part}
        </Box>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  }, []);

  const filteredDrivers = useMemo(() => {
    const s = search.toLowerCase();
    return DRIVER_LIST.filter(
      (driver) =>
        driver.name.toLowerCase().includes(s) ||
        driver.lrp.toLowerCase().includes(s) ||
        driver.email.toLowerCase().includes(s) ||
        driver.phone.toLowerCase().includes(s) ||
        driver.vehicles.join(", ").toLowerCase().includes(s),
    );
  }, [search]);

  return (
    <Box sx={{ pb: 4 }}>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        📇 Driver Directory
      </Typography>

      <TextField
        fullWidth
        placeholder="Search by name, LRP #, email, or vehicle"
        variant="outlined"
        size="small"
        sx={{ mb: 3 }}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filteredDrivers.length > 0 && <Divider sx={{ mb: 2 }} />}

      {filteredDrivers.map((driver, idx) => (
        <Accordion key={idx} disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight="bold">
              {highlight(`${driver.name} (${driver.lrp})`, search)}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ mb: 1 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Phone:</strong>{" "}
                <Link href={`tel:${driver.phone}`} underline="hover">
                  <PhoneIcon fontSize="small" sx={{ mr: 0.5 }} />
                  {highlight(driver.phone, search)}
                </Link>
              </Typography>

              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Email:</strong>{" "}
                <Link href={`mailto:${driver.email}`} underline="hover">
                  <EmailIcon fontSize="small" sx={{ mr: 0.5 }} />
                  {highlight(driver.email, search)}
                </Link>
              </Typography>

              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Vehicles:</strong>
              </Typography>

              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {driver.vehicles.map((v, i) => (
                  <VehicleChip vehicle={v} key={i} />
                ))}
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}

      {filteredDrivers.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No matching drivers found.
        </Typography>
      )}
    </Box>
  );
}
