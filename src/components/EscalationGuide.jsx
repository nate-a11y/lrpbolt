/* Proprietary and confidential. See LICENSE. */
import React, { useMemo, useState, useEffect } from "react";
import { Box, Stack, TextField, Typography, Alert } from "@mui/material";

import ContactCard from "@/components/escalation/ContactCard.jsx";
import EmptyState from "@/components/escalation/EmptyState.jsx";

const fallbackContacts = [
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

function normalizeContacts(input = []) {
  return input.map((r, idx) => {
    const id =
      r?.id ||
      r?.contactId ||
      r?.uid ||
      (r?.email ? `email:${r.email}` : null) ||
      (r?.phone ? `phone:${String(r.phone).replace(/[^\d+]/g, "")}` : null) ||
      `row-${idx}`;

    let responsibilities = r?.responsibilities;
    if (typeof responsibilities === "string") {
      responsibilities = responsibilities
        .split(/\r?\n|,/g)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (!Array.isArray(responsibilities)) responsibilities = [];

    return {
      id,
      name: r?.name || r?.displayName || "N/A",
      roleLabel: r?.roleLabel || r?.role || "",
      phone: r?.phone || r?.phoneNumber || "",
      email: r?.email || r?.emailAddress || "",
      responsibilities,
    };
  });
}

export default function EscalationGuide(props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(handle);
  }, [query]);

  const rowsSource =
    Array.isArray(props?.rows) && props.rows.length
      ? props.rows
      : fallbackContacts;

  const contacts = useMemo(() => normalizeContacts(rowsSource), [rowsSource]);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => {
      const hay = [
        c?.name,
        c?.email,
        c?.phone,
        ...(Array.isArray(c?.responsibilities) ? c.responsibilities : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [contacts, debounced]);

  const loading = Boolean(props?.loading);
  const error = props?.error ?? null;

  return (
    <Box
      sx={{
        px: { xs: 1.5, sm: 2, md: 3 },
        py: { xs: 2, md: 3 },
        maxWidth: 960,
        mx: "auto",
      }}
    >
      <Typography variant="h5" sx={{ mb: 2, color: "#4cbb17" }}>
        Who to Contact & When
      </Typography>

      <TextField
        fullWidth
        placeholder="Search by name, phone, email, or responsibility…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        size="small"
        sx={{ mb: 2 }}
        inputProps={{ "aria-label": "Search contacts" }}
      />

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {String(error)}
        </Alert>
      ) : null}

      {loading ? (
        <Typography sx={{ opacity: 0.8 }}>Loading…</Typography>
      ) : filtered.length ? (
        <Stack spacing={2}>
          {filtered.map((c) => (
            <ContactCard
              key={c.id || c.email || c.phone || c.name}
              contact={c}
            />
          ))}
        </Stack>
      ) : (
        <EmptyState onClear={() => setQuery("")} />
      )}
    </Box>
  );
}
