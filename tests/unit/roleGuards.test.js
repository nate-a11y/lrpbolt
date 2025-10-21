import { describe, it, expect, vi } from "vitest";

import { canSeeNav, canAccessRoute } from "../../src/utils/roleGuards.js";

// Mock the NAV_ITEMS config
vi.mock("../../src/config/nav", () => ({
  NAV_ITEMS: [
    { id: "rides", rolesVisible: ["driver", "admin"] },
    { id: "admin-panel", rolesVisible: ["admin"] },
    { id: "directory", rolesVisible: ["driver", "admin", "shootout"] },
    { id: "games", rolesVisible: ["driver", "admin", "shootout"] },
    { id: "clock", rolesVisible: ["driver", "admin"] },
    { id: "profile", rolesVisible: ["driver", "admin"] },
  ],
}));

describe("canSeeNav", () => {
  it("should return true if user role can see the nav item", () => {
    expect(canSeeNav("rides", "driver")).toBe(true);
    expect(canSeeNav("rides", "admin")).toBe(true);
    expect(canSeeNav("admin-panel", "admin")).toBe(true);
    expect(canSeeNav("directory", "shootout")).toBe(true);
  });

  it("should return false if user role cannot see the nav item", () => {
    expect(canSeeNav("admin-panel", "driver")).toBe(false);
    expect(canSeeNav("admin-panel", "shootout")).toBe(false);
  });

  it("should return false for non-existent nav items", () => {
    expect(canSeeNav("non-existent", "driver")).toBe(false);
    expect(canSeeNav("fake-item", "admin")).toBe(false);
  });

  it("should default to driver role if not specified", () => {
    expect(canSeeNav("rides")).toBe(true);
    expect(canSeeNav("admin-panel")).toBe(false);
  });

  it("should handle null/undefined role", () => {
    expect(canSeeNav("rides", null)).toBe(true);
    expect(canSeeNav("rides", undefined)).toBe(true);
    expect(canSeeNav("admin-panel", null)).toBe(false);
  });

  it("should handle aliases (escalation -> directory)", () => {
    expect(canSeeNav("escalation", "driver")).toBe(true);
    expect(canSeeNav("escalation", "shootout")).toBe(true);
  });

  it("should return false for null/undefined nav id", () => {
    expect(canSeeNav(null, "driver")).toBe(false);
    expect(canSeeNav(undefined, "admin")).toBe(false);
  });

  it("should be case-sensitive for roles", () => {
    expect(canSeeNav("rides", "Driver")).toBe(false);
    expect(canSeeNav("admin-panel", "Admin")).toBe(false);
  });

  it("should handle multiple roles for same nav item", () => {
    expect(canSeeNav("directory", "driver")).toBe(true);
    expect(canSeeNav("directory", "admin")).toBe(true);
    expect(canSeeNav("directory", "shootout")).toBe(true);
  });
});

describe("canAccessRoute", () => {
  it("should return true for all paths when role is driver", () => {
    expect(canAccessRoute("/rides", "driver")).toBe(true);
    expect(canAccessRoute("/admin", "driver")).toBe(true);
    expect(canAccessRoute("/any-path", "driver")).toBe(true);
  });

  it("should return true for all paths when role is admin", () => {
    expect(canAccessRoute("/rides", "admin")).toBe(true);
    expect(canAccessRoute("/admin", "admin")).toBe(true);
    expect(canAccessRoute("/any-path", "admin")).toBe(true);
  });

  it("should restrict shootout role to specific paths", () => {
    expect(canAccessRoute("/shootout", "shootout")).toBe(true);
    expect(canAccessRoute("/directory", "shootout")).toBe(true);
    expect(canAccessRoute("/escalation", "shootout")).toBe(true);
    expect(canAccessRoute("/games", "shootout")).toBe(true);
  });

  it("should deny shootout role access to other paths", () => {
    expect(canAccessRoute("/rides", "shootout")).toBe(false);
    expect(canAccessRoute("/admin", "shootout")).toBe(false);
    expect(canAccessRoute("/profile", "shootout")).toBe(false);
    expect(canAccessRoute("/clock", "shootout")).toBe(false);
  });

  it("should default to driver role if not specified", () => {
    expect(canAccessRoute("/rides")).toBe(true);
    expect(canAccessRoute("/admin")).toBe(true);
  });

  it("should handle null/undefined role as driver", () => {
    expect(canAccessRoute("/rides", null)).toBe(true);
    expect(canAccessRoute("/admin", undefined)).toBe(true);
  });

  it("should be exact match for shootout paths", () => {
    expect(canAccessRoute("/shootout/extra", "shootout")).toBe(false);
    expect(canAccessRoute("/games/sub-path", "shootout")).toBe(false);
  });

  it("should handle empty path", () => {
    expect(canAccessRoute("", "driver")).toBe(true);
    expect(canAccessRoute("", "shootout")).toBe(false);
  });

  it("should handle root path", () => {
    expect(canAccessRoute("/", "driver")).toBe(true);
    expect(canAccessRoute("/", "shootout")).toBe(false);
  });
});
