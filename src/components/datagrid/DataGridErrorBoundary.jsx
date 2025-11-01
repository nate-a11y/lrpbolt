/* Proprietary and confidential. See LICENSE. */
import { Component } from "react";
import PropTypes from "prop-types";

import { Box, Typography, Button, Alert, Paper } from "@mui/material";

import logError from "@/utils/logError.js";

/**
 * Error Boundary specifically for MUI DataGrid components
 *
 * Catches React 19 compatibility issues, rendering errors, and data problems
 * Provides detailed diagnostics for debugging grid issues
 */
export default class DataGridErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const { gridId, rows, columns } = this.props;

    // Detailed diagnostic information
    const diagnostics = {
      gridId,
      errorMessage: error?.message,
      errorStack: error?.stack,
      componentStack: errorInfo?.componentStack,
      rowCount: Array.isArray(rows) ? rows.length : 0,
      columnCount: Array.isArray(columns) ? columns.length : 0,
      sampleRow: Array.isArray(rows) && rows.length > 0 ? rows[0] : null,
      timestamp: new Date().toISOString(),
      userAgent: navigator?.userAgent,
      reactVersion: "19.2.0",
      muiVersion: "8.16.0",
    };

    // Log to console for immediate visibility
    console.error("=== DataGrid Error Boundary Caught Error ===");
    console.error("Grid ID:", gridId);
    console.error("Error:", error);
    console.error("Error Info:", errorInfo);
    console.error("Diagnostics:", diagnostics);
    console.error("===========================================");

    // Log to error tracking service
    logError(error, {
      where: "DataGridErrorBoundary",
      gridId,
      diagnostics,
      componentStack: errorInfo?.componentStack,
    });

    // Update state with error details
    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleRetry = () => {
    const { onRetry } = this.props;
    this.handleReset();
    if (typeof onRetry === "function") {
      onRetry();
    }
  };

  render() {
    const { hasError, error, errorInfo, errorCount } = this.state;
    const { children, gridId, fallback } = this.props;

    if (hasError) {
      // Custom fallback UI if provided
      if (fallback) {
        return typeof fallback === "function"
          ? fallback({ error, errorInfo, onReset: this.handleReset })
          : fallback;
      }

      // Default error UI with diagnostics
      return (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            border: (theme) => `2px solid ${theme.palette.error.main}`,
            borderRadius: 2,
            backgroundColor: (theme) => theme.palette.background.paper,
          }}
        >
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              DataGrid Error {gridId ? `(${gridId})` : ""}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              The data grid encountered an error and cannot be displayed.
            </Typography>
          </Alert>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="error" gutterBottom>
              Error Details:
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: "monospace",
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark" ? "grey.900" : "grey.100",
                p: 1,
                borderRadius: 1,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: "0.75rem",
              }}
            >
              {error?.message || "Unknown error"}
            </Typography>
          </Box>

          {errorInfo?.componentStack && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Component Stack:
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: "monospace",
                  backgroundColor: (theme) =>
                    theme.palette.mode === "dark" ? "grey.900" : "grey.100",
                  p: 1,
                  borderRadius: 1,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: "0.65rem",
                  maxHeight: 200,
                  overflow: "auto",
                }}
              >
                {errorInfo.componentStack}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button variant="contained" color="primary" onClick={this.handleRetry}>
              Retry
            </Button>
            <Button variant="outlined" onClick={this.handleReset}>
              Reset
            </Button>
            <Button
              variant="text"
              onClick={() => {
                console.error("Full error object:", error);
                console.error("Full errorInfo object:", errorInfo);
              }}
            >
              Log to Console
            </Button>
          </Box>

          {errorCount > 1 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This error has occurred {errorCount} times. Consider checking the browser
              console for more details.
            </Alert>
          )}
        </Paper>
      );
    }

    return children;
  }
}

DataGridErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  gridId: PropTypes.string,
  rows: PropTypes.array,
  columns: PropTypes.array,
  fallback: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
  onRetry: PropTypes.func,
};
