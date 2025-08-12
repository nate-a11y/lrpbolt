import { Box } from "@mui/material";

export default function PageContainer({ children, maxWidth = 1400, pt = 2, pb = 4 }) {
  return (
    <Box
      component="main"
      sx={{
        px: { xs: 2, md: 3 },
        pt,
        pb,
        mx: "auto",
        maxWidth,
        width: "100%",
        backgroundColor: (t) => t.palette.background.default,
      }}
    >
      {children}
    </Box>
  );
}
