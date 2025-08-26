/* Proprietary and confidential. See LICENSE. */
import { Box, Typography, Paper, Link } from "@mui/material";

export default function DriverContactCard({
  name,
  phone,
  email,
  vehicles,
  lrpId,
}) {
  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        mb: 2,
        borderRadius: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <Typography variant="h6" fontWeight="bold">
        {name} ({lrpId})
      </Typography>

      <Typography variant="body2" color="text.secondary">
        Vehicles: {vehicles || "N/A"}
      </Typography>

      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body2">📞</Typography>
        <Link href={`tel:${phone}`} underline="hover">
          {phone}
        </Link>
      </Box>

      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body2">✉️</Typography>
        <Link href={`mailto:${email}`} underline="hover">
          {email}
        </Link>
      </Box>
    </Paper>
  );
}
