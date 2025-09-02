import React from "react";
import { Box } from "@mui/material";

/**
 * Enables touch-friendly scrolling in both directions on narrow screens
 * without impacting desktop behavior. Wrap DataGrid containers with this
 * to allow natural momentum scrolling.
 */
const ResponsiveScrollBox = React.forwardRef(function ResponsiveScrollBox(
  { children, sx },
  ref,
) {
  return (
    <Box
      ref={ref}
      className="lrp-scroll"
      sx={{
        width: "100%",
        maxWidth: "100vw",
        overflowX: "auto",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        overscrollBehaviorX: "contain",
        overscrollBehaviorY: "contain",
        touchAction: "pan-x pan-y",
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
