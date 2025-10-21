/* Proprietary and confidential. See LICENSE. */
import { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DirectionsBusIcon from "@mui/icons-material/DirectionsBus";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import AirportShuttleIcon from "@mui/icons-material/AirportShuttle";

const VEHICLE_TIPS = [
  {
    label: "Limo Bus",
    icon: <DirectionsBusIcon color="primary" />,
    tips: [
      "Use flashers at every stop",
      "Will fit in regular size parking space",
      "Use mirrors and camera to back up",
      "Ensure you have tablet after customers depart",
    ],
  },
  {
    label: "Rescue Squad",
    icon: <LocalHospitalIcon color="error" />,
    tips: [
      "Use emergency flashers at all stops",
      "Give room for lowering steps and find level ground",
      "Avoid crowded lots if possible",
      "Watch resort clearance heights",
      "Watch for pedestrians",
      "Ensure you have tablet after customers depart",
    ],
  },
  {
    label: "Sprinter Van",
    icon: <DirectionsCarIcon color="success" />,
    tips: [
      "Fits standard lots",
      "Watch resort clearance heights",
      "Will take 1.5 parking spaces in length",
      "Use emergency flashers",
      "ALWAYS open the sliding doors for customers",
      "Ensure you have tablet after customers depart",
    ],
  },
  {
    label: "Shuttle Bus",
    icon: <AirportShuttleIcon color="secondary" />,
    tips: [
      "Use hotel loops or wide lanes",
      "Communicate with valet/front desk",
      "Allow extra time to unload",
      "Use emergency flashers",
      "Avoid tight and crowded lots",
      "May need to unload away from drop-off location",
      "Watch resort clearance heights",
      "Ensure you have tablet after customers depart",
    ],
  },
];

export default function DropoffTipsModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outlined"
        color="primary"
        onClick={() => setOpen(true)}
        sx={{ mb: 3 }}
      >
        🚐 View Vehicle Drop-Off Tips
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: "bold" }}>
          🚗 Drop-Off Tips by Vehicle
        </DialogTitle>

        <DialogContent dividers>
          {VEHICLE_TIPS.map((v, i) => (
            <Accordion key={v.label} defaultExpanded={i === 0}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={1}>
                  {v.icon}
                  <Typography fontWeight="bold">{v.label}</Typography>
                </Box>
              </AccordionSummary>

              <AccordionDetails>
                <Box component="ul" sx={{ pl: 3, mb: 0 }}>
                  {v.tips.map((tip, j) => (
                    /* eslint-disable-next-line react/no-array-index-key */
                    <li key={j}>
                      <Typography variant="body2">{tip}</Typography>
                    </li>
                  ))}
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
