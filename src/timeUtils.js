// Updated timeUtils.js
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { TIMEZONE } from './constants';

dayjs.extend(utc);
dayjs.extend(timezone);

const CST = TIMEZONE;

export const normalizeDate = (date) => {
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.tz(CST).format('MM/DD/YYYY') : date;
};

export const normalizeTime = (timeStr) => {
  console.log('⏱ normalizeTime called with:', timeStr);

  if (!timeStr || typeof timeStr !== 'string') return '';

  const trimmed = timeStr.trim().toUpperCase();

  // Explicitly enforce AM/PM format
  const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})\s?(AM|PM)/i);
  if (timeMatch) {
    const normalized = `${timeMatch[1]}:${timeMatch[2]} ${timeMatch[3].toUpperCase()}`;
    console.log('✅ Normalized time string:', normalized);
    return normalized;
  }

  console.warn('⚠️ Failed to normalize time string:', timeStr);
  return timeStr;
};

export const formatDate = (val) => {
  const parsed = dayjs(val, ["YYYY-MM-DD", dayjs.ISO_8601]).tz(TIMEZONE);
  return parsed.isValid() ? parsed.format('MMM D, YYYY') : val;
};

export const formatTime = (val) => {
  const parsed = dayjs(val, ["HH:mm", "h:mm A", dayjs.ISO_8601]).tz(TIMEZONE);
  return parsed.isValid() ? parsed.format('h:mm A') : val;
};


export const calculateDropOff = (pickup, duration) => {
  try {
    if (!pickup || !duration) return 'N/A';

    const timeMatch = pickup.match(/(\d{1,2}):(\d{2})\s?(AM|PM)/i);
    if (!timeMatch) return 'Invalid time';

    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    const isPM = timeMatch[3].toUpperCase() === 'PM';
    const hour24 = (hour % 12) + (isPM ? 12 : 0);

    let pickupDT = dayjs.tz('2000-01-01', CST).hour(hour24).minute(minute);

    const hr = parseInt(duration.match(/\b(\d+)\s*hr\b/i)?.[1] || 0);
    const min = parseInt(duration.match(/\b(\d+)\s*min\b/i)?.[1] || 0);

    const dropoff = pickupDT.add(hr, 'hour').add(min, 'minute');
    return dropoff.format('h:mm A');
  } catch (e) {
    console.warn('Dropoff calc error:', e);
    return 'N/A';
  }
};




export const formatDuration = (h, m) => {
  const hh = parseInt(h || 0, 10);
  const mm = parseInt(m || 0, 10);
  return `${hh ? `${hh} hr` : ''}${hh && mm ? ' ' : ''}${mm ? `${mm} min` : ''}`.trim();
};

export const parseDuration = (str) => {
  const hrMatch = /(?:(\d+)\s*hr)/.exec(str);
  const minMatch = /(?:(\d+)\s*min)/.exec(str);
  return {
    hours: hrMatch ? parseInt(hrMatch[1]) : 0,
    minutes: minMatch ? parseInt(minMatch[1]) : 0
  };
};

export const toTimeString12Hr = (t) => {
  if (!t) return '';
  const parsed = dayjs(`2000-01-01 ${t}`, ['h:mm A', 'H:mm', 'HH:mm']);
  return parsed.isValid() ? parsed.tz(TIMEZONE).format('h:mm A') : t;
};

