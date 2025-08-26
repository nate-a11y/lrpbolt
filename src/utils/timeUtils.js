// src/utils/timeUtils.js
import dayjs from 'dayjs';

export const EM_DASH = '—';

export function toDayjs(any) {
  if (any == null) return null;

  // Firestore Timestamp
  if (typeof any?.toDate === 'function') return dayjs(any.toDate());

  // { seconds, nanoseconds }
  if (typeof any === 'object' && any && 'seconds' in any) {
    return dayjs(any.seconds * 1000);
  }

  // JS Date
  if (any instanceof Date) return dayjs(any);

  // number (ms or sec)
  if (typeof any === 'number') return dayjs(any > 1e12 ? any : any * 1000);

  // string (ISO or friendly)
  if (typeof any === 'string') {
    const d = dayjs(any);
    return d.isValid() ? d : null;
  }

  return null;
}

export function fmtDateTime(value, fmt = 'MMM D, h:mm A') {
  const d = toDayjs(value);
  return d && d.isValid() ? d.format(fmt) : EM_DASH;
}

export function fmtText(value) {
  return value == null || value === '' ? EM_DASH : String(value);
}

export function fmtMinutes(value) {
  if (value == null) return EM_DASH;
  const n = Number(value);
  if (!Number.isFinite(n)) return EM_DASH;
  return `${n}`;
}
