import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(tz);

export const toJSDate = (raw) => {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw?.toDate === "function") return raw.toDate();
  if (typeof raw?.seconds === "number") return new Date(raw.seconds * 1000);
  if (typeof raw === "number") return new Date(raw);
  if (typeof raw === "string") {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

export const fmtPlain = (fallback = "—") => (params) => {
  if (!params) return fallback;
  if (Object.prototype.hasOwnProperty.call(params, "value")) {
    const v = params.value;
    return v === null || v === undefined ? fallback : String(v);
  }
  const v = params.row?.[params.field];
  return v === null || v === undefined ? fallback : String(v);
};

export const fmtDateTimeCell = (tzName = "America/Chicago", fallback = "—") => (params) => {
  const v = Object.prototype.hasOwnProperty.call(params ?? {}, "value")
    ? params?.value
    : params?.row?.[params?.field];
  const d = toJSDate(v);
  if (!d) return fallback;
  return dayjs(d).tz(tzName).format("MMM D, YYYY h:mm A");
};

export const getNested = (path, fallback = null) => (params) => {
  let obj = params?.row;
  for (const key of path.split(".")) {
    if (obj == null) return fallback;
    obj = obj[key];
  }
  return obj ?? fallback;
};

export const dateSort = (a, b) => {
  const ta = a instanceof Date ? a.getTime() : toJSDate(a)?.getTime() ?? 0;
  const tb = b instanceof Date ? b.getTime() : toJSDate(b)?.getTime() ?? 0;
  return ta - tb;
};

export const warnMissingFields = (columns, rows, sample = 10) => {
  if (!Array.isArray(columns) || !Array.isArray(rows) || !rows.length) return;
  const r = rows.slice(0, sample);
  columns.forEach((c) => {
    if (!c.field || c.type === "actions") return;
    const anyHas = r.some((row) => Object.prototype.hasOwnProperty.call(row, c.field));
    if (!anyHas && !c.valueGetter) {
      console.warn(`[DataGrid] Field "${c.field}" not found on rows and no valueGetter provided.`);
    }
  });
};
