import _extends from "@babel/runtime/helpers/esm/extends";
import { createSelector as reselectCreateSelector } from "reselect";
import { createSelectorMemoized } from "@mui/x-data-grid/utils/createSelector.js";
import { gridVisibleColumnDefinitionsSelector } from "@mui/x-data-grid/hooks/features/columns/gridColumnsSelector.js";
import { gridRenderContextSelector } from "@mui/x-data-grid/hooks/features/virtualization/gridVirtualizationSelectors.js";
import { gridFocusCellSelector } from "@mui/x-data-grid/hooks/features/focus/index.js";
import { gridVisibleRowsSelector } from "@mui/x-data-grid/hooks/features/pagination/index.js";
import { gridRowsLookupSelector } from "@mui/x-data-grid/hooks/features/rows/index.js";

const gridIsFocusedCellOutOfContext = reselectCreateSelector(
  gridFocusCellSelector,
  gridRenderContextSelector,
  gridVisibleRowsSelector,
  gridVisibleColumnDefinitionsSelector,
  gridRowsLookupSelector,
  (focusedCell, renderContext, currentPage, visibleColumns, rows) => {
    if (!focusedCell) {
      return false;
    }

    const row = rows[focusedCell.id];
    if (!row) {
      return false;
    }

    const rowIndex = currentPage.rowToIndexMap.get(row);
    const columnIndex = visibleColumns
      .slice(renderContext.firstColumnIndex, renderContext.lastColumnIndex)
      .findIndex((column) => column.field === focusedCell.field);

    const isInRenderContext =
      rowIndex !== undefined &&
      columnIndex !== -1 &&
      rowIndex >= renderContext.firstRowIndex &&
      rowIndex <= renderContext.lastRowIndex;

    return !isInRenderContext;
  },
);

export const gridFocusedVirtualCellSelector = createSelectorMemoized(
  gridIsFocusedCellOutOfContext,
  gridVisibleColumnDefinitionsSelector,
  gridVisibleRowsSelector,
  gridRowsLookupSelector,
  gridFocusCellSelector,
  (
    isFocusedCellOutOfRenderContext,
    visibleColumns,
    currentPage,
    rows,
    focusedCell,
  ) => {
    if (!isFocusedCellOutOfRenderContext) {
      return null;
    }

    const row = rows[focusedCell.id];
    if (!row) {
      return null;
    }

    const rowIndex = currentPage.rowToIndexMap.get(row);
    if (rowIndex === undefined) {
      return null;
    }

    const columnIndex = visibleColumns.findIndex(
      (column) => column.field === focusedCell.field,
    );
    if (columnIndex === -1) {
      return null;
    }

    return _extends({}, focusedCell, {
      rowIndex,
      columnIndex,
    });
  },
);
