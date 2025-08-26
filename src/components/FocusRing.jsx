import { Box } from "@mui/material";
export default function FocusRing({ children }) {
  return (
    <Box
      sx={(t) => ({
        "&:focus-visible": { outline: "none", boxShadow: `0 0 0 3px ${t.palette.primary.main}55`, borderRadius: t.shape.borderRadius },
      })}
    >
      {children}
    </Box>
  );
}
