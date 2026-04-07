import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { AppError } from "./errorHandler.js";
import { TeamRole } from "../generated/prisma/client.js";

const ROLE_HIERARCHY: Record<string, number> = {
  TRYOUT: -1,
  PLAYER: 0,
  ANALYST: 1,
  COACH: 2,
  CAPTAIN: 3,
  ADMIN: 4,
};

export async function teamContext(req: Request, _res: Response, next: NextFunction) {
  try {
    const teamId = req.headers["x-team-id"] as string | undefined;
    if (teamId) {
      req.teamId = teamId;
    } else {
      // Single-team mode: auto-detect
      const team = await prisma.team.findFirst();
      if (team) req.teamId = team.id;
    }

    if (!req.teamId) return next(new AppError(400, "Team context required"));
    next();
  } catch (error) {
    next(error);
  }
}

export function requireTeamRole(minRole: keyof typeof ROLE_HIERARCHY) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(new AppError(401, "Authentication required"));
      if (!req.teamId) return next(new AppError(400, "Team context required"));

      // Admins bypass role checks
      if (req.user.isAdmin) return next();

      const membership = await prisma.teamMember.findUnique({
        where: { userId_teamId: { userId: req.user.id, teamId: req.teamId } },
      });

      if (!membership) return next(new AppError(403, "Not a team member"));

      const userLevel = ROLE_HIERARCHY[membership.role] ?? -1;
      const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;

      if (userLevel < requiredLevel) {
        return next(new AppError(403, `Requires ${minRole} role or higher`));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) return next(new AppError(403, "Admin access required"));
  next();
}
