import { DataGridPro, GridToolbar } from "@mui/x-data-grid-pro";
import PropTypes from "prop-types";

const defaultSlots = { toolbar: GridToolbar };
const defaultSlotProps = {
  toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 300 } },
};

const LrpGrid = ({ rows, columns, getRowId, slots, slotProps, ...props }) => {
  return (
    <DataGridPro
      autoHeight
      density="compact"
      rows={rows}
      columns={columns}
      getRowId={getRowId}
      slots={{ ...defaultSlots, ...slots }}
      slotProps={{ ...defaultSlotProps, ...slotProps }}
      {...props}
    />
  );
};

LrpGrid.propTypes = {
  rows: PropTypes.array.isRequired,
  columns: PropTypes.array.isRequired,
  getRowId: PropTypes.func.isRequired,
  slots: PropTypes.object,
  slotProps: PropTypes.object,
};

export default LrpGrid;
