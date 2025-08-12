/**
 * Utility helpers for safely coercing values.
 * @module utils/safe
 */

/**
 * Safely coerce a value to a number.
 * @param {*} v - Incoming value.
 * @param {number} [d=0] - Default if coercion fails.
 * @returns {number}
 */
export const toNumber = (v, d = 0) =>
  typeof v === 'number' && !Number.isNaN(v) ? v : d;

/**
 * Safely coerce a value to a string.
 * @param {*} v - Incoming value.
 * @param {string} [d=""] - Default if coercion fails.
 * @returns {string}
 */
export const toString = (v, d = '') => (typeof v === 'string' ? v : d);

/**
 * Safely coerce a value to a boolean.
 * @param {*} v - Incoming value.
 * @param {boolean} [d=false] - Default if coercion fails.
 * @returns {boolean}
 */
export const toBool = (v, d = false) => (typeof v === 'boolean' ? v : d);

/**
 * Ensure a Firestore Timestamp-like object.
 * @param {*} v - Candidate timestamp.
 * @returns {object|null} Firestore Timestamp-like or null.
 */
export const toTs = (v) => (v && typeof v.toDate === 'function' ? v : null);

/**
 * Convert a Firestore Timestamp-like object to a Date.
 * @param {*} v - Candidate timestamp.
 * @returns {Date|null}
 */
export const tsToDate = (v) => toTs(v)?.toDate?.() ?? null;

