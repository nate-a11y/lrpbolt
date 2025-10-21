import React, { useState, memo } from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Collapse,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import PhoneIcon from "@mui/icons-material/Phone";
import EmailIcon from "@mui/icons-material/Email";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

import useCopy from "./useCopy.js";
import { downloadVCard } from "./vcard.js";

const GREEN = "#4cbb17";

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
      sx={{
        minHeight: 40,
        borderColor: GREEN,
        color: GREEN,
        "&:hover": { bgcolor: GREEN, color: "#060606", borderColor: GREEN },
      }}
    />
  );
}

function ContactCardImpl({ contact }) {
  const [expanded, setExpanded] = useState(false);
  const { copy, copied } = useCopy();

  const name = contact?.name ?? "Unknown";
  const role = contact?.roleLabel ?? contact?.role ?? "";
  const phone = contact?.phone ?? "";
  const email = contact?.email ?? "";
  const responsibilities = Array.isArray(contact?.responsibilities)
    ? contact.responsibilities
    : [];

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
          <Avatar sx={{ bgcolor: "rgba(76,187,23,0.15)", color: GREEN }}>
            {initialsFrom(name)}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h6" sx={{ color: GREEN, lineHeight: 1.2 }}>
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

        {responsibilities.length ? (
          <>
            <Divider sx={{ my: 2 }} />
            <Button
              onClick={() => setExpanded((v) => !v)}
              endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{
                color: GREEN,
                px: 0,
                "&:hover": {
                  background: "transparent",
                  textDecoration: "underline",
                },
              }}
              aria-expanded={expanded}
              aria-controls={`resp-${contact?.id || name}`}
            >
              {expanded ? "Show less" : "Show more"}
            </Button>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <List dense disablePadding id={`resp-${contact?.id || name}`}>
                {responsibilities.map((item, idx) => (
                  <ListItem key={idx} sx={{ py: 0.5, pl: 2 }}>
                    <ListItemText
                      primaryTypographyProps={{ variant: "body2" }}
                      primary={`• ${item}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </>
        ) : null}
      </CardContent>

      <CardActions sx={{ display: "none" }} />
    </Card>
  );
}

const ContactCard = memo(ContactCardImpl);
export default ContactCard;
