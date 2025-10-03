import { forwardRef } from "react";
import PropTypes from "prop-types";
import { Box, Button, CircularProgress, Stack } from "@mui/material";

const LoadingButtonLite = forwardRef(function LoadingButtonLite(
  { loading = false, loadingText, children, disabled, sx, ...rest },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <Button
      ref={ref}
      disabled={isDisabled}
      aria-busy={loading ? "true" : undefined}
      sx={{
        position: "relative",
        minWidth: 120,
        ...sx,
      }}
      {...rest}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        {loading ? (
          <CircularProgress color="inherit" size={18} thickness={5} />
        ) : null}
        <Box component="span" sx={{ fontWeight: 600 }}>
          {loading ? loadingText || children : children}
        </Box>
      </Stack>
    </Button>
  );
});

LoadingButtonLite.propTypes = {
  children: PropTypes.node,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  loadingText: PropTypes.node,
  sx: PropTypes.object,
};

export default LoadingButtonLite;
