// Proprietary and confidential.
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

let defaultTz = 'UTC';
try {
  if (typeof window !== 'undefined' && dayjs.tz)
    defaultTz = dayjs.tz.guess() || 'UTC';
} catch {
  /* keep UTC */
}

export function toDayjs(input) {
  try {
    if (!input) return null;
    if (typeof input?.toDate === 'function') return dayjs(input.toDate()); // Firestore Timestamp
    if (typeof input?.seconds === 'number')
      return dayjs(new Date(input.seconds * 1000)); // raw TS object
    if (input instanceof Date || typeof input === 'number' || typeof input === 'string') {
      const d = dayjs(input);
      return d.isValid() ? d : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function formatDateTime(input, fmt = 'MMM D, YYYY h:mm A') {
  const d = toDayjs(input);
  if (!d) return 'N/A';
  try {
    return dayjs.tz ? d.tz(defaultTz).format(fmt) : d.format(fmt);
  } catch {
    return d.format(fmt);
  }
}

export { dayjs };

