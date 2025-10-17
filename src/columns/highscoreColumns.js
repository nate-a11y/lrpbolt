import { formatDateTime } from "@/utils/timeUtils.js";
import { toNumberOrNull } from "@/services/gamesService.js";

const formatScore = (value) => {
  const numeric = toNumberOrNull(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
};

const getDriverName = (row) => {
  if (!row) return "N/A";
  if (typeof row.driver === "string" && row.driver.trim()) {
    return row.driver.trim();
  }
  if (typeof row.displayName === "string" && row.displayName.trim()) {
    return row.displayName.trim();
  }
  return "N/A";
};

export const highscoreColumns = [
  {
    field: "idx",
    headerName: "#",
    width: 64,
    sortable: false,
    align: "center",
    headerAlign: "center",
    valueGetter: (params) => {
      if (!params || !params.api) return "";
      const index = params.api.getRowIndex(params.id);
      return typeof index === "number" && index >= 0 ? index + 1 : "";
    },
  },
  {
    field: "driver",
    headerName: "Driver",
    flex: 1,
    minWidth: 180,
    valueGetter: (params) => getDriverName(params?.row),
  },
  {
    field: "score",
    headerName: "Score",
    type: "number",
    width: 140,
    align: "right",
    headerAlign: "right",
    valueGetter: (params) => formatScore(params?.row?.score),
    valueFormatter: (params) => {
      const numeric = formatScore(params?.value);
      return Number.isFinite(numeric) ? numeric.toLocaleString() : "N/A";
    },
    sortComparator: (a, b) => {
      const aNum = formatScore(a);
      const bNum = formatScore(b);
      if (aNum === null && bNum === null) return 0;
      if (aNum === null) return -1;
      if (bNum === null) return 1;
      return aNum - bNum;
    },
  },
  {
    field: "createdAt",
    headerName: "Recorded",
    flex: 1,
    minWidth: 200,
    valueGetter: (params) => params?.row?.createdAt ?? null,
    valueFormatter: (params) => formatDateTime(params?.value),
  },
];
