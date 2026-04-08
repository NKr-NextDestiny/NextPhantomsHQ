import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext } from "../middleware/team.js";
import { requireFeature } from "../middleware/features.js";
import { validate } from "../middleware/validate.js";

export const availabilityRouter = Router();

const slotSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const updateSchema = z.object({
  body: z.object({
    slots: z.array(slotSchema),
  }),
});

// Get my availability
availabilityRouter.get("/me", authenticate, teamContext, requireFeature("availability"), async (req, res, next) => {
  try {
    const slots = await prisma.availability.findMany({
      where: { userId: req.user!.id, teamId: req.teamId! },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
    res.json({ success: true, data: slots });
  } catch (error) { next(error); }
});

// Update my availability (atomic replace)
availabilityRouter.put("/me", authenticate, teamContext, requireFeature("availability"), validate(updateSchema), async (req, res, next) => {
  try {
    const { slots } = req.body;
    await prisma.$transaction([
      prisma.availability.deleteMany({ where: { userId: req.user!.id, teamId: req.teamId! } }),
      ...slots.map((slot: { dayOfWeek: number; startTime: string; endTime: string }) =>
        prisma.availability.create({
          data: { userId: req.user!.id, teamId: req.teamId!, ...slot },
        }),
      ),
    ]);
    const updated = await prisma.availability.findMany({
      where: { userId: req.user!.id, teamId: req.teamId! },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

// Get team heatmap (all members' availability)
availabilityRouter.get("/heatmap", authenticate, teamContext, requireFeature("availability"), async (req, res, next) => {
  try {
    const slots = await prisma.availability.findMany({
      where: { teamId: req.teamId! },
      include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    // Group by day and time slot
    const heatmap: Record<string, { count: number; users: { id: string; displayName: string }[] }> = {};
    for (const slot of slots) {
      const key = `${slot.dayOfWeek}-${slot.startTime}`;
      if (!heatmap[key]) heatmap[key] = { count: 0, users: [] };
      heatmap[key].count++;
      heatmap[key].users.push({ id: slot.user.id, displayName: slot.user.displayName });
    }

    res.json({ success: true, data: { slots, heatmap } });
  } catch (error) { next(error); }
});
