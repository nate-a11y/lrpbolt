import React from "react";
import { Box } from "@mui/material";

/**
 * Ensures horizontal scroll/swipe on narrow screens, without breaking desktop.
 * Wrap DataGrid containers with this to allow pan-x and native momentum scrolling.
 */
const ResponsiveScrollBox = React.forwardRef(function ResponsiveScrollBox({ children, sx }, ref) {
  return (
    <Box
      ref={ref}
      className="lrp-scroll-x"
      sx={{
        width: "100%",
        maxWidth: "100%",
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
        overscrollBehaviorX: "contain",
        touchAction: "pan-x",
        // Prevent parent flex containers from shrinking the scroller
        minWidth: 0,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
});

export default ResponsiveScrollBox;
