/* Proprietary and confidential. See LICENSE. */
import React from "react";
import {
  Card,
  CardContent,
  Stack,
  Typography,
  Chip,
  IconButton,
  Divider,
  Box,
} from "@mui/material";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";

import CopyButton from "@/components/common/CopyButton.jsx";

export default function ContactCard({ contact }) {
  const name = contact?.name || "N/A";
  const phone = contact?.phone || "";
  const email = contact?.email || "";
  const responsibilities = Array.isArray(contact?.responsibilities)
    ? contact.responsibilities
    : [];

  return (
    <Card sx={{ borderRadius: 18 }}>
      <CardContent>
        <Typography
          variant="h6"
          sx={{ color: "primary.main", fontWeight: 900 }}
        >
          {name}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
          {phone ? (
            <>
              <IconButton
                size="small"
                component="a"
                href={`tel:${phone}`}
                aria-label="Call"
              >
                <PhoneIcon fontSize="small" />
              </IconButton>
              <CopyButton value={phone} label="Copy phone" />
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {phone}
              </Typography>
            </>
          ) : null}
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
          {email ? (
            <>
              <IconButton
                size="small"
                component="a"
                href={`mailto:${email}`}
                aria-label="Email"
              >
                <EmailIcon fontSize="small" />
              </IconButton>
              <CopyButton value={email} label="Copy email" />
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {email}
              </Typography>
            </>
          ) : null}
        </Stack>

        <Divider sx={{ my: 1.25 }} />
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>
          Responsibilities
        </Typography>
        <Box component="ul" sx={{ pl: 2, m: 0 }}>
          {responsibilities.slice(0, 6).map((r, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={i}>
              <Typography variant="body2">{r}</Typography>
            </li>
          ))}
          {responsibilities.length > 6 && (
            <Chip
              size="small"
              variant="outlined"
              label={`+${responsibilities.length - 6} more`}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
