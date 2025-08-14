import { describe, it, expect } from 'vitest';

import { canSeeNav, canAccessRoute } from '../../src/utils/roleGuards.js';

describe('roleGuards', () => {
  it('shootout only sees shootout items', () => {
    expect(canSeeNav('shootout', 'shootout')).toBe(true);
    expect(canSeeNav('rides', 'shootout')).toBe(false);
    expect(canAccessRoute('/shootout', 'shootout')).toBe(true);
    expect(canAccessRoute('/rides', 'shootout')).toBe(false);
  });

  it('driver and admin remain unrestricted', () => {
    expect(canSeeNav('rides', 'driver')).toBe(true);
    expect(canAccessRoute('/rides', 'driver')).toBe(true);
    expect(canSeeNav('rides', 'admin')).toBe(true);
    expect(canAccessRoute('/admin-time-log', 'admin')).toBe(true);
  });
});
