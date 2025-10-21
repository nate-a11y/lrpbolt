/* Proprietary and confidential. See LICENSE. */
import { useEffect } from "react";
import {
  Container,
  Paper,
  Stack,
  Typography,
  Divider,
  Link,
  Button,
  List,
  ListItem,
} from "@mui/material";

export default function SmsConsent() {
  useEffect(() => {
    document.title = "SMS Consent | Lake Ride Pros";
    const desc =
      "Consent for transactional SMS regarding rides and vehicle status. Reply STOP to opt out, HELP for help. No marketing texts.";
    let meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", desc);
    } else {
      meta = document.createElement("meta");
      meta.name = "description";
      meta.content = desc;
      document.head.appendChild(meta);
    }
  }, []);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Lake Ride Pros",
    url: "https://lakeridepros.xyz/",
    sameAs: ["https://lakeridepros.xyz/"],
  };

  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Container component="main" maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
        <Paper sx={{ p: { xs: 2, md: 4 } }}>
          <Stack spacing={2}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography
                variant="h3"
                component="h1"
                sx={{ typography: { xs: "h4", sm: "h3", md: "h3" } }}
              >
                Lake Ride Pros — SMS Consent
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => window.print()}
                aria-label="Print page"
              >
                Print
              </Button>
            </Stack>
            <Typography variant="subtitle1">
              Transactional messaging for ride and vehicle status
            </Typography>
            <Divider />

            <Typography variant="h6" component="h2">
              What you’re agreeing to
            </Typography>
            <Typography variant="body1">
              By providing your mobile number to Lake Ride Pros verbally or in
              writing, you agree to receive <strong>transactional</strong> text
              messages related to rides, vehicle status, and schedule updates.
              Message frequency varies; message and data rates may apply.{" "}
              <strong>No marketing</strong> texts will be sent on this channel.
            </Typography>

            <Typography variant="h6" component="h2">
              Opt-in methods
            </Typography>
            <Typography variant="body1">
              Consent may be collected verbally during
              booking/dispatch/onboarding or in writing via forms or portal
              checkboxes.
            </Typography>

            <Typography variant="h6" component="h2">
              Opt-out / Help
            </Typography>
            <Typography variant="body1">
              Reply <strong>STOP</strong> to opt out at any time. Reply{" "}
              <strong>HELP</strong> for help. You can also email{" "}
              <Link href="mailto:support@lakeridepros.com">
                support@lakeridepros.com
              </Link>{" "}
              to revoke consent. Opt-out is honored immediately and logged in
              our system.
            </Typography>

            <Typography variant="h6" component="h2">
              Data handling
            </Typography>
            <Typography variant="body1">
              We log the time, method, and source of consent in our system of
              record. We do not sell personal data. See our Privacy Policy for
              more details.
            </Typography>

            <Typography variant="h6" component="h2">
              Contact
            </Typography>
            <Typography variant="body1">
              Lake Ride Pros —{" "}
              <Link
                href="https://lakeridepros.xyz/"
                target="_blank"
                rel="noopener"
              >
                https://lakeridepros.xyz/
              </Link>{" "}
              —{" "}
              <Link href="mailto:support@lakeridepros.com">
                support@lakeridepros.com
              </Link>
            </Typography>

            <Typography variant="h6" component="h2">
              Quick summary
            </Typography>
            <List component="ul" sx={{ pl: 4 }}>
              <ListItem component="li">
                Transactional only (status/confirmations/alerts)
              </ListItem>
              <ListItem component="li">STOP/HELP supported</ListItem>
              <ListItem component="li">US/CA only</ListItem>
              <ListItem component="li">
                Typical send hours: local business hours
              </ListItem>
            </List>

            <Divider />
            <Typography variant="caption" color="text.secondary" align="center">
              Last updated: {today}
            </Typography>
          </Stack>
        </Paper>
      </Container>
    </>
  );
}
