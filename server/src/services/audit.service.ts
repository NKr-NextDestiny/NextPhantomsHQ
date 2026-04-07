import { prisma } from "../config/prisma.js";

export async function logAudit(userId: string, action: string, entity: string, entityId?: string, details?: any, teamId?: string) {
  await prisma.auditLog.create({
    data: { userId, action, entity, entityId, details: details ?? undefined, teamId },
  });
}
