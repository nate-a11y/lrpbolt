export function toDateSafe(input) {
  if (!input && input !== 0) return null;
  if (input instanceof Date) return Number.isNaN(+input) ? null : input;
  if (typeof input === 'number') return Number.isFinite(input) ? new Date(input) : null;
  const d = new Date(input);
  return Number.isNaN(+d) ? null : d;
}

export function fmtDateTime(value) {
  const d = toDateSafe(value);
  if (!d) return null;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function fmtMinutes(mins) {
  if (mins == null) return null;
  const m = Number(mins);
  if (!Number.isFinite(m)) return null;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h ? `${h}h ${mm}m` : `${mm}m`;
}
