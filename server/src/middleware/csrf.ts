import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const CSRF_COOKIE = "csrf-token";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Ensure a CSRF token cookie exists
  if (!req.cookies[CSRF_COOKIE]) {
    const token = crypto.randomBytes(32).toString("hex");
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    // For the current request, treat this as the cookie value
    req.cookies[CSRF_COOKIE] = token;
  }

  // Always expose CSRF token in response header so cross-origin clients can read it
  res.setHeader(CSRF_HEADER, req.cookies[CSRF_COOKIE]);

  // Safe methods don't need CSRF validation
  if (SAFE_METHODS.has(req.method)) return next();

  // Validate CSRF token on state-changing requests
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;
  const cookieToken = req.cookies[CSRF_COOKIE] as string | undefined;

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    res.status(403).json({ success: false, error: "Invalid CSRF token" });
    return;
  }

  next();
}
