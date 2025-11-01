/**
 * Generate a deterministic fallback ID from stable row properties.
 * This prevents ID changes between renders that break optimistic overlays,
 * selections, and memoization.
 *
 * @param {object} row - The row object
 * @returns {string} A stable, deterministic ID
 */
export function generateDeterministicId(row) {
  if (!row || typeof row !== 'object') {
    return `fallback-empty-${hashString('')}`;
  }

  // Collect stable properties in priority order
  const parts = [];

  // IDs (should have been caught earlier, but include as fallback)
  const id = row.id || row.docId || row._id || row.uid || row.ticketId || row.rideId;
  if (id) parts.push(String(id));

  // Trip/Ride identifiers
  if (row.tripId) parts.push(`trip:${row.tripId}`);
  if (row.tripID) parts.push(`tripID:${row.tripID}`);

  // Timestamps (use seconds to avoid millisecond drift)
  const timestamp = extractTimestamp(row.pickupTime || row.createdAt || row.startTime || row.clockIn || row.loggedAt);
  if (timestamp) parts.push(`ts:${timestamp}`);

  // User identifiers
  if (row.driverId) parts.push(`driver:${row.driverId}`);
  if (row.driverEmail) parts.push(`email:${row.driverEmail}`);
  if (row.userEmail) parts.push(`email:${row.userEmail}`);
  if (row.passenger) parts.push(`pass:${row.passenger}`);

  // Location data
  if (row.pickup) parts.push(`from:${row.pickup}`);
  if (row.dropoff) parts.push(`to:${row.dropoff}`);

  // If we have enough parts, hash them
  if (parts.length > 0) {
    const combined = parts.join('|');
    return `fallback-${hashString(combined)}`;
  }

  // Last resort: stringify the entire object (expensive but deterministic)
  try {
    const json = JSON.stringify(row);
    return `fallback-obj-${hashString(json)}`;
  } catch (err) {
    // If stringify fails, use object keys as fingerprint
    const keys = Object.keys(row).sort().join(',');
    return `fallback-keys-${hashString(keys)}`;
  }
}

/**
 * Extract timestamp in seconds from various formats
 * @param {*} value - Timestamp value (Date, Firestore Timestamp, number, string)
 * @returns {number|null} Unix timestamp in seconds, or null
 */
function extractTimestamp(value) {
  if (!value) return null;

  // Firestore Timestamp object
  if (value && typeof value === 'object' && 'seconds' in value) {
    return value.seconds;
  }

  // Date object
  if (value instanceof Date) {
    return Math.floor(value.getTime() / 1000);
  }

  // Unix timestamp (assume milliseconds if > 10 digits)
  if (typeof value === 'number') {
    return value > 9999999999 ? Math.floor(value / 1000) : value;
  }

  // ISO string
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!isNaN(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }

  return null;
}

/**
 * Simple string hash function (Java's String.hashCode algorithm)
 * Returns a positive integer hash
 * @param {string} str - String to hash
 * @returns {string} Hash as string
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to positive and return as base-36 string
  return Math.abs(hash).toString(36);
}
