/* Proprietary and confidential. See LICENSE. */
import React from "react";
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Link,
  Divider,
  IconButton,
  useTheme,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";

const contacts = [
  {
    name: "Jim Brentlinger (LRP1)",
    phone: "573.353.2849",
    email: "Jim@lakeridepros.com",
    responsibilities: [
      "Trip issues (larger vehicles)",
      "Vehicle issues, schedule issues",
      "Incident reporting",
      "Payroll (including direct deposit or deductions)",
      "Commercial insurance questions",
      "Permit questions (Lake Ozark, Osage Beach, Camdenton, Eldon, Jeff City)",
      "Quote questions for larger vehicles",
    ],
  },
  {
    name: "Nate Bullock (LRP2)",
    phone: "417.380.8853",
    email: "Nate@lakeridepros.com",
    responsibilities: [
      "Moovs issues (driver or backend)",
      "Claim Portal / Tech support",
      "Website & logo support",
      "Schedule issues",
      "Passenger incident follow-ups",
      "Payment or closeout note issues",
      "Quote questions for larger vehicles",
    ],
  },
  {
    name: "Michael Brandt (LRP3)",
    phone: "573.286.9110",
    email: "Michael@lakeridepros.com",
    responsibilities: [
      "Social Media / Promotions",
      "Insider memberships",
      "Schedule issues",
      "Apparel, branding, and business cards",
      "Advertising partnerships or referrals",
      "Passenger experience issues",
      "Quote questions for larger vehicles",
    ],
  },
];

export default function ContactEscalation() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, pb: 4 }}>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        📞 Who to Contact & When
      </Typography>

      <Typography variant="body1" sx={{ mb: 3 }}>
        Use this guide to contact the right person based on the issue you’re
        having. Tap to call or email!
      </Typography>

      <Divider sx={{ mb: 2 }} />

      {contacts.map((person, idx) => (
        <Accordion key={idx}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight="bold">{person.name}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box display="flex" alignItems="center" gap={2} sx={{ mb: 2 }}>
              <Link href={`tel:${person.phone}`} underline="none">
                <IconButton color="primary" size="large">
                  <PhoneIcon />
                </IconButton>
              </Link>
              <Link href={`mailto:${person.email}`} underline="none">
                <IconButton color="secondary" size="large">
                  <EmailIcon />
                </IconButton>
              </Link>
              <Typography variant="body2" sx={{ ml: 1 }}>
                {person.phone}
              </Typography>
            </Box>

            <Box component="ul" sx={{ pl: 3, mb: 0 }}>
              {person.responsibilities.map((task, i) => (
                <li key={i}>
                  <Typography variant="body2">{task}</Typography>
                </li>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
