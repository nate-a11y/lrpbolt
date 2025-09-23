import ResponsiveContainer from "./responsive/ResponsiveContainer.jsx";

export default function PageContainer({
  children,
  maxWidth = 1400,
  pt = 2,
  pb = 4,
  sx,
  ...containerProps
}) {
  return (
    <ResponsiveContainer
      maxWidth={maxWidth}
      {...containerProps}
      sx={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
        // IMPORTANT: no left padding on mobile; add when drawer is visible
        pl: { xs: 0, md: 3 },
        pr: { xs: 2, md: 3 },
        pt,
        pb,
        ...sx,
      }}
    >
      {children}
    </ResponsiveContainer>
  );
}
