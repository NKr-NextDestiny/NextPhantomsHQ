import { prisma } from "../config/prisma.js";

export async function notifyTeam(opts: { type: string; title: string; message: string; link?: string; teamId: string; actorId: string }) {
  const members = await prisma.teamMember.findMany({ where: { teamId: opts.teamId }, select: { userId: true } });
  const notifications = members
    .filter(m => m.userId !== opts.actorId)
    .map(m => ({
      type: opts.type,
      title: opts.title,
      message: opts.message,
      link: opts.link,
      userId: m.userId,
      teamId: opts.teamId,
      actorId: opts.actorId,
    }));
  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });
  }
}
