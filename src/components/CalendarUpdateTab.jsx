/* Proprietary and confidential. See LICENSE. */
import React from "react";
import {
  Box,
  Stack,
  Typography,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import BlockIcon from "@mui/icons-material/Block";
import StarIcon from "@mui/icons-material/Star";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { alpha, useTheme } from "@mui/material/styles";

function CalendarUpdateTab({ compact = false }) {
  const theme = useTheme();
  const surface =
    theme.palette.mode === "dark"
      ? theme.palette.background.paper
      : theme.palette.grey[50];
  const accent = theme.palette.success.main;

  const Card = ({ icon, title, children, defaultExpanded = false }) => (
    <Accordion
      defaultExpanded={defaultExpanded}
      sx={{
        mb: 2,
        bgcolor: surface,
        borderLeft: `5px solid ${accent}`,
        "& .MuiAccordionSummary-content": { my: 0.5 },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography
          fontWeight={700}
          sx={{ display: "flex", alignItems: "center", gap: 1 }}
        >
          {icon} {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0.5 }}>{children}</AccordionDetails>
    </Accordion>
  );

  return (
    <Box
      sx={{
        px: compact ? 0 : { xs: 1, sm: 2 },
        py: compact ? 0 : 2,
        maxWidth: compact ? "100%" : 720,
        mx: "auto",
      }}
    >
      {!compact && (
        <>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <MenuBookIcon sx={{ color: accent }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              How to Mark Yourself Unavailable
            </Typography>
          </Stack>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Keeping your availability current prevents overbooking. Please
            complete both steps in Google Calendar and Moovs.
          </Typography>
          <Divider
            sx={{
              mb: 2,
              borderColor: (t) => alpha(t.palette.common.white, 0.08),
            }}
          />
        </>
      )}

      <Stack spacing={2}>
        <Alert severity="info" icon={<InfoOutlinedIcon />}>
          <strong>Quick tip:</strong> Update <em>both</em> Google Calendar and
          Moovs so dispatch knows when you’re out.
        </Alert>

        <Card
          defaultExpanded
          icon={<CalendarMonthIcon fontSize="small" color="success" />}
          title="Step 1: Google Calendar"
        >
          <Typography variant="body2" gutterBottom>
            Use Google Calendar to show you’re unavailable to dispatch and
            managers:
          </Typography>
          <List dense sx={{ pl: 1 }}>
            <ListItem disableGutters>
              <ListItemText primary="🖊️ Create event" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText primary="Title: Your Name — Not Available" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText primary="Select date(s) & time or mark All Day" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText primary="Use Repeat if this is recurring" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText primary="Save" />
            </ListItem>
          </List>
        </Card>

        <Card
          icon={<BlockIcon fontSize="small" color="success" />}
          title="Step 2: Block Time in Moovs"
        >
          <Typography variant="body2" gutterBottom>
            Block your vehicle inside Moovs to avoid customer bookings:
          </Typography>
          <List dense sx={{ pl: 1 }}>
            <ListItem disableGutters>
              <ListItemText primary="Go to Reservations → Create" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText primary="Booking Contact: HOUSE ACCOUNT" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText primary="Order Type: Corporate" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText primary="Trip Type: Hourly" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText primary="Pickup/Dropoff: Lake Ozark, MO" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText primary="Add your vehicle → click Add Vehicle" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText primary="Leave Base Rate blank" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText primary="Delete the 3 service fee lines" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText primary="Save Reservation, then set status to DONE" />
            </ListItem>
          </List>
        </Card>

        <Card
          icon={<StarIcon fontSize="small" color="success" />}
          title="Bonus: Duplicate Days Off"
        >
          <Typography variant="body2" gutterBottom>
            Going on vacation? Duplicate your reservation for multiple dates at
            once:
          </Typography>
          <List dense sx={{ pl: 1 }}>
            <ListItem disableGutters>
              <ListItemText primary="Open reservation → 3‑dot menu" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText primary="Choose Duplicate" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText primary="Select up to 10 dates" />
            </ListItem>
            <ListItem disableGutters>
              <ListItemText primary="Confirm to finish" />
            </ListItem>
          </List>
        </Card>
      </Stack>
    </Box>
  );
}

export default CalendarUpdateTab;
