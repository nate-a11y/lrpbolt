import PropTypes from "prop-types";
import { Box } from "@mui/material";

export default function LiveRegion({ message }) {
  return (
    <Box
      aria-live="polite"
      aria-atomic="true"
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        border: 0,
        overflow: "hidden",
        clip: "rect(0 0 0 0)",
        whiteSpace: "nowrap",
      }}
    >
      {message || ""}
    </Box>
  );
}

LiveRegion.propTypes = {
  message: PropTypes.string,
};
