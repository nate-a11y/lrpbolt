/* Proprietary and confidential. See LICENSE. */
import { Box, Typography, Paper } from "@mui/material";

export default function VehicleDropTipCard({ title, tips, icon }) {
  return (
    <Paper
      elevation={1}
      sx={{
        p: 2,
        mb: 2,
        borderRadius: 2,
        backgroundColor: (theme) =>
          theme.palette.mode === "dark"
            ? theme.palette.background.paper
            : theme.palette.grey[50],
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
        <Box component="span" sx={{ mr: 1 }}>
          {icon}
        </Box>
        <Typography variant="subtitle1" fontWeight="bold">
          {title}
        </Typography>
      </Box>

      <Box
        component="ul"
        sx={{
          pl: 3,
          m: 0,
          listStyleType: "disc",
          "& li": {
            mt: 0.5,
            fontSize: "0.9rem",
            color: "text.secondary",
          },
        }}
      >
        {tips.map((tip, idx) => (
          // eslint-disable-next-line react/no-array-index-key
          <li key={idx}>
            <Typography variant="body2" component="span">
              {tip}
            </Typography>
          </li>
        ))}
      </Box>
    </Paper>
  );
}
