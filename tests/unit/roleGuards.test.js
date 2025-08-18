import { describe, it, expect } from 'vitest';

import { canSeeNav, canAccessRoute } from '../../src/utils/roleGuards.js';

describe('roleGuards', () => {
  it('shootout can access limited items', () => {
    expect(canSeeNav('shootout', 'shootout')).toBe(true);
    expect(canSeeNav('directory', 'shootout')).toBe(true);
    expect(canSeeNav('escalation', 'shootout')).toBe(true);
    expect(canSeeNav('rides', 'shootout')).toBe(false);
    expect(canAccessRoute('/shootout', 'shootout')).toBe(true);
    expect(canAccessRoute('/directory', 'shootout')).toBe(true);
    expect(canAccessRoute('/escalation', 'shootout')).toBe(true);
    expect(canAccessRoute('/rides', 'shootout')).toBe(false);
  });

  it('driver and admin remain unrestricted', () => {
    expect(canSeeNav('rides', 'driver')).toBe(true);
    expect(canAccessRoute('/rides', 'driver')).toBe(true);
    expect(canSeeNav('rides', 'admin')).toBe(true);
    expect(canAccessRoute('/admin-time-log', 'admin')).toBe(true);
  });
});
