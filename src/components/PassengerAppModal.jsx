/* Proprietary and confidential. See LICENSE. */
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Divider,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

export default function PassengerAppModal({ open, onClose }) {
  const [expanded, setExpanded] = React.useState(false);

  const handleChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : false);
  };

  const STEPS = [
    {
      id: "step1",
      title: "Step 1: Sign In or Create an Account",
      content: `Download the Passenger App. First-time users tap "Sign Up". Log in via SMS code verification.`,
    },
    {
      id: "step2",
      title: "Step 2: Start a Trip or Request a Quote",
      content: (
        <>
          <Typography variant="body2" gutterBottom>
            Tap <strong>Create a Trip</strong> and enter:
          </Typography>
          <Box component="ul" sx={{ pl: 3, mb: 1 }}>
            <li>
              <Typography variant="body2">Trip type</Typography>
            </li>
            <li>
              <Typography variant="body2">Order type</Typography>
            </li>
            <li>
              <Typography variant="body2">Date and time</Typography>
            </li>
            <li>
              <Typography variant="body2">Pickup & drop-off</Typography>
            </li>
            <li>
              <Typography variant="body2">Passenger count</Typography>
            </li>
          </Box>
          <Typography variant="body2">
            Then tap <strong>Next Step</strong>.
          </Typography>
        </>
      ),
    },
    {
      id: "step3",
      title: "Step 3: Select Vehicle and Confirm",
      content: `Pick your ride, check price (if shown), confirm your booking or quote request.`,
    },
    {
      id: "extras",
      title: "Manage Your Trips",
      content: `After booking, manage all trips inside the app. It's seamless and mobile-friendly.`,
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: "bold" }}>
        📱 How the Passenger App Works
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Booking a ride with the Passenger App is easy, quick, and personalized
          to your needs. Here’s how to make the most of it:
        </Typography>

        <Divider sx={{ mb: 2 }} />

        {STEPS.map((section) => (
          <Accordion
            key={section.id}
            expanded={expanded === section.id}
            onChange={handleChange(section.id)}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight="bold">{section.title}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {typeof section.content === "string" ? (
                <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
                  {section.content}
                </Typography>
              ) : (
                section.content
              )}
            </AccordionDetails>
          </Accordion>
        ))}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained" color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
