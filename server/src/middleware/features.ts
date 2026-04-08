import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { AppError } from "./errorHandler.js";
import { teamConfigCache } from "../config/cache.js";

export function requireFeature(feature: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.teamId) return next(new AppError(400, "Team context required"));

      // Check cache first
      let teamConfig = teamConfigCache.get(req.teamId);
      if (!teamConfig) {
        const team = await prisma.team.findUnique({ where: { id: req.teamId }, select: { enabledFeatures: true } });
        if (!team) return next(new AppError(403, `Feature "${feature}" is disabled`));
        teamConfig = { enabledFeatures: team.enabledFeatures };
        teamConfigCache.set(req.teamId, teamConfig);
      }

      if (!teamConfig.enabledFeatures.includes(feature)) {
        return next(new AppError(403, `Feature "${feature}" is disabled`));
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
