/* Proprietary and confidential. See LICENSE. */
import PropTypes from "prop-types";
import LrpDataGridPro from "./LrpDataGridPro.jsx";
import DataGridErrorBoundary from "./DataGridErrorBoundary.jsx";

/**
 * LrpDataGridPro wrapped in error boundary for React 19 safety
 *
 * This component wraps LrpDataGridPro with comprehensive error handling
 * to catch React 19 compatibility issues, rendering errors, and data problems
 *
 * Use this instead of LrpDataGridPro directly for maximum safety
 */
export default function SafeLrpDataGridPro({ id, rows, columns, ...rest }) {
  return (
    <DataGridErrorBoundary gridId={id} rows={rows} columns={columns}>
      <LrpDataGridPro id={id} rows={rows} columns={columns} {...rest} />
    </DataGridErrorBoundary>
  );
}

SafeLrpDataGridPro.propTypes = {
  id: PropTypes.string,
  rows: PropTypes.array,
  columns: PropTypes.array,
};
