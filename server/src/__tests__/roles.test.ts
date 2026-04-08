import { describe, it, expect } from "vitest";

// Test the role hierarchy logic directly
const ROLE_HIERARCHY: Record<string, number> = {
  TRYOUT: -1,
  PLAYER: 0,
  ANALYST: 1,
  COACH: 2,
  CAPTAIN: 3,
  ADMIN: 4,
};

function hasMinRole(userRole: string, minRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] ?? -1;
  const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;
  return userLevel >= requiredLevel;
}

describe("Role Hierarchy", () => {
  it("should correctly order roles", () => {
    expect(ROLE_HIERARCHY.TRYOUT).toBeLessThan(ROLE_HIERARCHY.PLAYER);
    expect(ROLE_HIERARCHY.PLAYER).toBeLessThan(ROLE_HIERARCHY.ANALYST);
    expect(ROLE_HIERARCHY.ANALYST).toBeLessThan(ROLE_HIERARCHY.COACH);
    expect(ROLE_HIERARCHY.COACH).toBeLessThan(ROLE_HIERARCHY.CAPTAIN);
    expect(ROLE_HIERARCHY.CAPTAIN).toBeLessThan(ROLE_HIERARCHY.ADMIN);
  });

  it("ADMIN should have access to all roles", () => {
    for (const role of Object.keys(ROLE_HIERARCHY)) {
      expect(hasMinRole("ADMIN", role)).toBe(true);
    }
  });

  it("TRYOUT should not have PLAYER access", () => {
    expect(hasMinRole("TRYOUT", "PLAYER")).toBe(false);
  });

  it("PLAYER should have PLAYER access but not ANALYST", () => {
    expect(hasMinRole("PLAYER", "PLAYER")).toBe(true);
    expect(hasMinRole("PLAYER", "ANALYST")).toBe(false);
  });

  it("COACH should have access to COACH, ANALYST, and PLAYER", () => {
    expect(hasMinRole("COACH", "COACH")).toBe(true);
    expect(hasMinRole("COACH", "ANALYST")).toBe(true);
    expect(hasMinRole("COACH", "PLAYER")).toBe(true);
    expect(hasMinRole("COACH", "CAPTAIN")).toBe(false);
  });

  it("same role should pass check", () => {
    for (const role of Object.keys(ROLE_HIERARCHY)) {
      expect(hasMinRole(role, role)).toBe(true);
    }
  });
});
