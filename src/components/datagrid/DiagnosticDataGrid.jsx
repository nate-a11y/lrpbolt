/* Proprietary and confidential. See LICENSE. */
import { useMemo, useEffect } from "react";
import PropTypes from "prop-types";
import { Alert, Box } from "@mui/material";

import logError from "@/utils/logError.js";

import DataGridErrorBoundary from "./DataGridErrorBoundary.jsx";
import UniversalDataGrid from "./UniversalDataGrid.jsx";

/**
 * Validates DataGrid row data structure
 */
function validateRows(rows) {
  const issues = [];

  if (!Array.isArray(rows)) {
    issues.push(`Rows is not an array: ${typeof rows}`);
    return { valid: false, issues, rows: [] };
  }

  if (rows.length === 0) {
    return { valid: true, issues: [], rows };
  }

  // Check first 3 rows for common issues
  const sampleSize = Math.min(3, rows.length);
  for (let i = 0; i < sampleSize; i++) {
    const row = rows[i];

    if (!row || typeof row !== "object") {
      issues.push(`Row ${i} is not an object: ${typeof row}`);
      continue;
    }

    // Check for any ID field
    const hasId =
      row.id !== undefined ||
      row.docId !== undefined ||
      row._id !== undefined ||
      row.ticketId !== undefined ||
      row.rideId !== undefined ||
      row.uid !== undefined;

    if (!hasId) {
      issues.push(
        `Row ${i} has no ID field (checked: id, docId, _id, ticketId, rideId, uid)`,
      );
    }

    // Check for circular references (will cause JSON.stringify to fail)
    try {
      JSON.stringify(row);
    } catch {
      issues.push(`Row ${i} has circular references or non-serializable data`);
    }
  }

  return { valid: issues.length === 0, issues, rows };
}

/**
 * Validates DataGrid column definitions
 */
function validateColumns(columns) {
  const issues = [];

  if (!Array.isArray(columns)) {
    issues.push(`Columns is not an array: ${typeof columns}`);
    return { valid: false, issues, columns: [] };
  }

  if (columns.length === 0) {
    issues.push("Columns array is empty");
    return { valid: false, issues, columns };
  }

  columns.forEach((col, index) => {
    if (!col || typeof col !== "object") {
      issues.push(`Column ${index} is not an object: ${typeof col}`);
      return;
    }

    if (!col.field) {
      issues.push(`Column ${index} is missing required 'field' property`);
    }

    if (!col.headerName && !col.field) {
      issues.push(`Column ${index} has no headerName or field`);
    }

    // Check for renderCell issues
    if (col.renderCell && typeof col.renderCell !== "function") {
      issues.push(`Column ${index} (${col.field}) renderCell is not a function`);
    }
  });

  return { valid: issues.length === 0, issues, columns };
}

/**
 * Diagnostic wrapper for DataGrid that validates props and catches errors
 *
 * Use this during development or when debugging grid issues
 * It adds validation, error boundaries, and detailed logging
 */
export default function DiagnosticDataGrid({
  id,
  rows = [],
  columns = [],
  enableValidation = true,
  showWarnings = true,
  onValidationError,
  ...rest
}) {
  // Validate rows
  const rowValidation = useMemo(() => {
    if (!enableValidation) return { valid: true, issues: [], rows };
    return validateRows(rows);
  }, [rows, enableValidation]);

  // Validate columns
  const columnValidation = useMemo(() => {
    if (!enableValidation) return { valid: true, issues: [], columns };
    return validateColumns(columns);
  }, [columns, enableValidation]);

  // Log validation errors
  useEffect(() => {
    const allIssues = [...rowValidation.issues, ...columnValidation.issues];

    if (allIssues.length > 0) {
      const errorData = {
        gridId: id,
        rowIssues: rowValidation.issues,
        columnIssues: columnValidation.issues,
        rowCount: Array.isArray(rows) ? rows.length : 0,
        columnCount: Array.isArray(columns) ? columns.length : 0,
        sampleRow: Array.isArray(rows) && rows.length > 0 ? rows[0] : null,
      };

      console.error("=== DataGrid Validation Errors ===");
      console.error("Grid ID:", id);
      console.error("Issues:", allIssues);
      console.error("Details:", errorData);
      console.error("==================================");

      logError(new Error("DataGrid validation failed"), {
        where: "DiagnosticDataGrid",
        gridId: id,
        ...errorData,
      });

      if (typeof onValidationError === "function") {
        onValidationError(errorData);
      }
    }
  }, [
    id,
    rows,
    columns,
    rowValidation.issues,
    columnValidation.issues,
    onValidationError,
  ]);

  // Show validation warnings if enabled
  const hasValidationIssues =
    !rowValidation.valid || !columnValidation.valid;

  if (hasValidationIssues && showWarnings) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          <strong>DataGrid Validation Failed {id ? `(${id})` : ""}</strong>
          <ul style={{ margin: "8px 0 0 0", paddingLeft: 20 }}>
            {rowValidation.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
            {columnValidation.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </Alert>
      </Box>
    );
  }

  // Wrap grid in error boundary
  return (
    <DataGridErrorBoundary gridId={id} rows={rows} columns={columns}>
      <UniversalDataGrid
        id={id}
        rows={rowValidation.rows}
        columns={columnValidation.columns}
        {...rest}
      />
    </DataGridErrorBoundary>
  );
}

DiagnosticDataGrid.propTypes = {
  id: PropTypes.string,
  rows: PropTypes.array,
  columns: PropTypes.array,
  enableValidation: PropTypes.bool,
  showWarnings: PropTypes.bool,
  onValidationError: PropTypes.func,
};
