import { Box } from "@mui/material";
export default function PageContainer({ children, maxWidth = 1400, pt = 2, pb = 4 }) {
  return (
    <Box
      sx={{
        // IMPORTANT: no left padding, only right
        pl: { xs: 2, md: 0 },
        pr: { xs: 2, md: 3 },
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
