import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { config } from "../config/index.js";
import { AppError } from "./errorHandler.js";

export interface AuthUser {
  id: string;
  numericId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  isAdmin: boolean;
  isActive: boolean;
  language: string;
  emailNotifications: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      teamId?: string;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
    if (!token) return next(new AppError(401, "Authentication required"));

    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        numericId: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        email: true,
        isAdmin: true,
        isActive: true,
        language: true,
        emailNotifications: true,
      },
    });

    if (!user || !user.isActive) return next(new AppError(401, "User not found or inactive"));

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError(401, "Token expired"));
    }
    next(new AppError(401, "Invalid token"));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) return next(new AppError(403, "Admin access required"));
  next();
}
