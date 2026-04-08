import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { teamConfigCache } from "../config/cache.js";

describe("TTL Cache", () => {
  beforeEach(() => {
    teamConfigCache.clear();
  });

  it("should store and retrieve values", () => {
    teamConfigCache.set("team1", { enabledFeatures: ["training"] });
    expect(teamConfigCache.get("team1")).toEqual({ enabledFeatures: ["training"] });
  });

  it("should return undefined for missing keys", () => {
    expect(teamConfigCache.get("nonexistent")).toBeUndefined();
  });

  it("should invalidate specific keys", () => {
    teamConfigCache.set("team1", { enabledFeatures: ["training"] });
    teamConfigCache.invalidate("team1");
    expect(teamConfigCache.get("team1")).toBeUndefined();
  });

  it("should expire entries after TTL", () => {
    vi.useFakeTimers();

    teamConfigCache.set("team1", { enabledFeatures: ["training"] });
    expect(teamConfigCache.get("team1")).toBeDefined();

    // Advance past 60s TTL
    vi.advanceTimersByTime(61_000);
    expect(teamConfigCache.get("team1")).toBeUndefined();

    vi.useRealTimers();
  });

  it("should clear all entries", () => {
    teamConfigCache.set("t1", { enabledFeatures: ["a"] });
    teamConfigCache.set("t2", { enabledFeatures: ["b"] });
    teamConfigCache.clear();
    expect(teamConfigCache.get("t1")).toBeUndefined();
    expect(teamConfigCache.get("t2")).toBeUndefined();
  });
});
