/* Proprietary and confidential. See LICENSE. */
import PropTypes from "prop-types";
import UniversalDataGrid from "./UniversalDataGrid.jsx";
import DataGridErrorBoundary from "./DataGridErrorBoundary.jsx";

/**
 * UniversalDataGrid wrapped in error boundary for React 19 safety
 *
 * This component wraps UniversalDataGrid with comprehensive error handling
 * to catch React 19 compatibility issues, rendering errors, and data problems
 *
 * Use this instead of UniversalDataGrid directly for maximum safety
 */
export default function SafeUniversalDataGrid({ id, rows, columns, ...rest }) {
  return (
    <DataGridErrorBoundary gridId={id} rows={rows} columns={columns}>
      <UniversalDataGrid id={id} rows={rows} columns={columns} {...rest} />
    </DataGridErrorBoundary>
  );
}

SafeUniversalDataGrid.propTypes = {
  id: PropTypes.string,
  rows: PropTypes.array,
  columns: PropTypes.array,
};
