import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { csrfProtection } from "../middleware/csrf.js";

function mockReq(method: string, cookies: Record<string, string> = {}, headers: Record<string, string> = {}): Partial<Request> {
  return {
    method,
    cookies: { ...cookies },
    headers: { ...headers },
  };
}

function mockRes(): Partial<Response> {
  const res: any = {};
  res.cookie = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
}

describe("CSRF Middleware", () => {
  it("should set csrf cookie if none exists on GET", () => {
    const req = mockReq("GET") as Request;
    const res = mockRes() as Response;
    const next = vi.fn() as NextFunction;

    csrfProtection(req, res, next);

    expect(res.cookie).toHaveBeenCalledWith("csrf-token", expect.any(String), expect.objectContaining({
      httpOnly: false,
      sameSite: "lax",
    }));
    expect(next).toHaveBeenCalled();
  });

  it("should pass GET requests without CSRF header", () => {
    const req = mockReq("GET", { "csrf-token": "abc123" }) as Request;
    const res = mockRes() as Response;
    const next = vi.fn() as NextFunction;

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should reject POST without CSRF header", () => {
    const req = mockReq("POST", { "csrf-token": "abc123" }) as Request;
    const res = mockRes() as Response;
    const next = vi.fn() as NextFunction;

    csrfProtection(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("should reject POST with mismatched CSRF tokens", () => {
    const req = mockReq("POST", { "csrf-token": "abc123" }, { "x-csrf-token": "different" }) as Request;
    const res = mockRes() as Response;
    const next = vi.fn() as NextFunction;

    csrfProtection(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("should pass POST with matching CSRF tokens", () => {
    const req = mockReq("POST", { "csrf-token": "abc123" }, { "x-csrf-token": "abc123" }) as Request;
    const res = mockRes() as Response;
    const next = vi.fn() as NextFunction;

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
