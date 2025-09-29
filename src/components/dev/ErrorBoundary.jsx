/* Proprietary and confidential. See LICENSE. */
import { Component } from "react";
import { Box, Button, Typography } from "@mui/material";

import logError from "@/utils/logError.js";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReload = this.handleReload.bind(this);
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    logError(error, { area: "ErrorBoundary", info });
    if (typeof window !== "undefined" && window.console) {
      window.console.error("[ErrorBoundary]", error, info);
    }
  }

  handleReload() {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  handleRetry() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
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
            p: 3,
          }}
        >
          <Box sx={{ maxWidth: 480 }}>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
              Something went wrong.
            </Typography>
            <Typography
              component="pre"
              sx={{
                whiteSpace: "pre-wrap",
                fontFamily: "monospace",
                fontSize: 14,
                lineHeight: 1.5,
                mb: 2,
              }}
            >
              {String(this.state.error?.message || this.state.error)}
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={this.handleReload}
              >
                Reload
              </Button>
              <Button variant="outlined" onClick={this.handleRetry}>
                Try Again
              </Button>
            </Box>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}
