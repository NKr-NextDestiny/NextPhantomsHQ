import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext, requireTeamRole } from "../middleware/team.js";
import { requireFeature } from "../middleware/features.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";

export const wikiRouter = Router();

const pageSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  content: z.string().min(1),
});

// List pages
wikiRouter.get("/", authenticate, teamContext, requireFeature("wiki"), async (req, res, next) => {
  try {
    const pages = await prisma.wikiPage.findMany({
      where: { teamId: req.teamId! },
      select: { id: true, title: true, slug: true, createdAt: true, updatedAt: true, createdBy: { select: { id: true, displayName: true } } },
      orderBy: { title: "asc" },
    });
    res.json({ success: true, data: pages });
  } catch (error) { next(error); }
});

// Get page by slug
wikiRouter.get("/:slug", authenticate, teamContext, requireFeature("wiki"), async (req, res, next) => {
  try {
    const page = await prisma.wikiPage.findUnique({
      where: { teamId_slug: { teamId: req.teamId!, slug: String(req.params.slug) } },
      include: {
        createdBy: { select: { id: true, displayName: true } },
        updatedBy: { select: { id: true, displayName: true } },
      },
    });
    if (!page) throw new AppError(404, "Page not found");
    res.json({ success: true, data: page });
  } catch (error) { next(error); }
});

// Create page (ANALYST+)
wikiRouter.post("/", authenticate, teamContext, requireFeature("wiki"), requireTeamRole("ANALYST"), validate(pageSchema), async (req, res, next) => {
  try {
    const { title, slug, content } = req.body;
    const exists = await prisma.wikiPage.findUnique({ where: { teamId_slug: { teamId: req.teamId!, slug } } });
    if (exists) throw new AppError(409, "Slug already exists");

    const page = await prisma.wikiPage.create({
      data: { title, slug, content, teamId: req.teamId!, createdById: req.user!.id },
      include: { createdBy: { select: { id: true, displayName: true } } },
    });
    res.status(201).json({ success: true, data: page });
  } catch (error) { next(error); }
});

// Update page (ANALYST+)
wikiRouter.put("/:slug", authenticate, teamContext, requireFeature("wiki"), requireTeamRole("ANALYST"), validate(pageSchema), async (req, res, next) => {
  try {
    const existing = await prisma.wikiPage.findUnique({ where: { teamId_slug: { teamId: req.teamId!, slug: String(req.params.slug) } } });
    if (!existing) throw new AppError(404, "Page not found");

    const { title, slug, content } = req.body;
    const page = await prisma.wikiPage.update({
      where: { id: existing.id },
      data: { title, slug, content, updatedById: req.user!.id },
      include: {
        createdBy: { select: { id: true, displayName: true } },
        updatedBy: { select: { id: true, displayName: true } },
      },
    });
    res.json({ success: true, data: page });
  } catch (error) { next(error); }
});

// Delete page (ADMIN only)
wikiRouter.delete("/:slug", authenticate, teamContext, requireFeature("wiki"), requireTeamRole("ADMIN"), async (req, res, next) => {
  try {
    const existing = await prisma.wikiPage.findUnique({ where: { teamId_slug: { teamId: req.teamId!, slug: String(req.params.slug) } } });
    if (!existing) throw new AppError(404, "Page not found");
    await prisma.wikiPage.delete({ where: { id: existing.id } });
    res.json({ success: true, message: "Page deleted" });
  } catch (error) { next(error); }
});
