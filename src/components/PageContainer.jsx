import ResponsiveContainer from "./responsive/ResponsiveContainer.jsx";

export default function PageContainer({
  children,
  maxWidth = 1400,
  pt = 2,
  pb = 4,
}) {
  return (
    <ResponsiveContainer
      sx={{
        // IMPORTANT: no left padding on mobile; add when drawer is visible
        pl: { xs: 0, md: 3 },
        pr: { xs: 2, md: 3 },
        pt,
        pb,
        maxWidth,
      }}
    >
      {children}
    </ResponsiveContainer>
  );
}
