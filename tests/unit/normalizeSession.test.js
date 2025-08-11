/* Proprietary and confidential. See LICENSE. */
import { describe, it, expect } from 'vitest';
import { normalizeSession } from '../../src/utils/firestore.js';

const ts = (s) => ({ seconds: s });

describe('normalizeSession', () => {
  it('maps doc data to normalized session', () => {
    const doc = { id: 'a', data: () => ({ startTime: ts(1), endTime: ts(2), trips: 1, passengers: 2 }) };
    const n = normalizeSession(doc);
    expect(n.trips).toBe(1);
    expect(n.startTime.isValid()).toBe(true);
  });

  it('returns null for invalid data', () => {
    expect(normalizeSession(null)).toBeNull();
  });
});
