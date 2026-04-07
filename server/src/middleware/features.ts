import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { AppError } from "./errorHandler.js";

export function requireFeature(feature: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.teamId) return next(new AppError(400, "Team context required"));
      const team = await prisma.team.findUnique({ where: { id: req.teamId }, select: { enabledFeatures: true } });
      if (!team || !team.enabledFeatures.includes(feature)) {
        return next(new AppError(403, `Feature "${feature}" is disabled`));
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
