import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AppError } from "./errorHandler.js";

export function validate(schema: z.ZodType, source: "body" | "query" | "params" = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const message = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      return next(new AppError(400, `Validation error: ${message}`));
    }
    req[source] = result.data;
    next();
  };
}
