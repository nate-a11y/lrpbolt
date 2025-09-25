import { DataGridPro, GridToolbar } from "@mui/x-data-grid-pro";
import PropTypes from "prop-types";

const defaultSlots = { toolbar: GridToolbar };
const defaultSlotProps = {
  toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 300 } },
};

const defaultGetRowId = (row) => {
  const id =
    row?.id ??
    row?.uid ??
    row?._id ??
    row?.docId ??
    row?.rideId ??
    row?.ticketId ??
    row?.slug ??
    row?.key ??
    row?.email ??
    row?.name;
  if (id == null) throw new Error("DataGrid row is missing a stable id");
  return typeof id === "string" || typeof id === "number" ? id : String(id);
};

const LrpGrid = ({
  rows,
  columns,
  getRowId = defaultGetRowId,
  slots,
  slotProps,
  ...props
}) => {
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
  getRowId: PropTypes.func,
  slots: PropTypes.object,
  slotProps: PropTypes.object,
};

export default LrpGrid;
