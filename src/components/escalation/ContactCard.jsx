import React, { useMemo, memo } from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";

import useCopy from "./useCopy.js";
import { downloadVCard } from "./vcard.js";
import ExpandableDetails from "@/components/ExpandableDetails.jsx";

function initialsFrom(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((s) => s[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "LRP"
  );
}

function ActionButton(props) {
  return (
    <Button
      {...props}
      variant="outlined"
      size="small"
      sx={(t) => ({
        minHeight: 40,
        borderColor: t.palette.primary.main,
        color: t.palette.primary.main,
        "&:hover": {
          bgcolor: t.palette.primary.main,
          color: t.palette.getContrastText(t.palette.primary.main),
          borderColor: t.palette.primary.main,
        },
      })}
    />
  );
}

function ContactCardImpl({ contact }) {
  const { copy, copied } = useCopy();

  const name = contact?.name ?? "Unknown";
  const role = contact?.roleLabel ?? contact?.role ?? "";
  const phone = contact?.phone ?? "";
  const email = contact?.email ?? "";
  const responsibilities = Array.isArray(contact?.responsibilities)
    ? contact.responsibilities
    : [];

  // Build blurb and details for ExpandableDetails
  const { blurb, details } = useMemo(() => {
    if (responsibilities.length === 0) {
      return { blurb: "", details: "" };
    }

    const allText = responsibilities.map((r) => `• ${r}`).join("\n");
    if (allText.length <= 150) {
      return { blurb: allText, details: "" };
    }

    // Show first 2-3 responsibilities as blurb
    const firstFew = responsibilities.slice(0, 2).map((r) => `• ${r}`).join("\n");
    const rest = responsibilities.slice(2).map((r) => `• ${r}`).join("\n");

    return {
      blurb: firstFew,
      details: rest,
    };
  }, [responsibilities]);

  return (
    <Card
      sx={(t) => ({
        backgroundColor: t.palette.background.paper,
        border: `1px solid ${t.palette.divider}`,
        borderRadius: 3,
      })}
      elevation={0}
    >
      <CardContent sx={{ pb: 1.5 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar
            sx={(t) => ({
              bgcolor: alpha(t.palette.primary.main, 0.15),
              color: t.palette.primary.main,
            })}
          >
            {initialsFrom(name)}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="h6"
              sx={{ color: (t) => t.palette.primary.main, lineHeight: 1.2 }}
            >
              {name}
            </Typography>
            {role ? (
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                {role}
              </Typography>
            ) : null}
          </Box>
        </Stack>

        <Stack spacing={0.5} sx={{ mt: 2, wordBreak: "break-word" }}>
          {phone ? <Typography variant="body2">{phone}</Typography> : null}
          {email ? <Typography variant="body2">{email}</Typography> : null}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
          {phone ? (
            <ActionButton
              startIcon={<PhoneIcon />}
              aria-label={`Call ${name}`}
              component="a"
              href={`tel:${phone}`}
            >
              Call
            </ActionButton>
          ) : null}

          {email ? (
            <ActionButton
              startIcon={<EmailIcon />}
              aria-label={`Email ${name}`}
              component="a"
              href={`mailto:${email}`}
              rel="noopener"
            >
              Email
            </ActionButton>
          ) : null}

          {phone ? (
            <ActionButton
              startIcon={<ContentCopyIcon />}
              aria-label={`Copy phone for ${name}`}
              onClick={() => copy(phone)}
            >
              {copied ? "Copied" : "Copy Phone"}
            </ActionButton>
          ) : null}

          {email ? (
            <ActionButton
              startIcon={<ContentCopyIcon />}
              aria-label={`Copy email for ${name}`}
              onClick={() => copy(email)}
            >
              {copied ? "Copied" : "Copy Email"}
            </ActionButton>
          ) : null}

          <ActionButton
            startIcon={<DownloadIcon />}
            aria-label={`Download vCard for ${name}`}
            onClick={() =>
              downloadVCard({ name, roleLabel: role, phone, email })
            }
          >
            vCard
          </ActionButton>
        </Stack>

        {(blurb || details) && (
          <Box
            sx={{
              mt: 2,
              bgcolor: (t) => alpha(t.palette.common.white, 0.04),
              border: (t) => `1px solid ${t.palette.divider}`,
              borderRadius: 2,
              px: 2,
              py: 1.5,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                opacity: 0.7,
                fontWeight: 700,
                textTransform: "uppercase",
                display: "block",
                mb: 1,
              }}
            >
              Responsibilities:
            </Typography>
            <ExpandableDetails
              id={contact?.id || name}
              blurb={blurb}
              details={details}
              remember={false}
            />
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ display: "none" }} />
    </Card>
  );
}

const ContactCard = memo(ContactCardImpl);
export default ContactCard;
