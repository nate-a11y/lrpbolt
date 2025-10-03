import { Component } from "react";
import PropTypes from "prop-types";
import { Box, Button, Stack, Typography } from "@mui/material";

import { captureError } from "@/services/observability";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    captureError(error, { area: "ErrorBoundary", info });
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, info);
    }
  }

  handleReload() {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      const message = this.props.fallbackMessage || "Something went wrong.";
      return (
        <Box
          role="alert"
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "background.default",
            color: "text.primary",
            px: 2,
            py: 6,
          }}
        >
          <Stack spacing={2} sx={{ maxWidth: 520, textAlign: "center" }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
              {message}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                bgcolor: (theme) => theme.palette.background.paper,
                borderRadius: 2,
                p: 2,
                border: (theme) => `1px solid ${theme.palette.divider}`,
                mx: "auto",
                width: "100%",
              }}
            >
              {String(
                this.state.error?.message ||
                  this.state.error ||
                  "Unknown error",
              )}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={this.handleReload}
              sx={{ alignSelf: "center", minWidth: 160 }}
            >
              Reload
            </Button>
          </Stack>
        </Box>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node,
  fallbackMessage: PropTypes.string,
};
