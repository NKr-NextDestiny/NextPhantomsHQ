import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamContext, requireTeamRole } from "../middleware/team.js";
import { requireFeature } from "../middleware/features.js";

export const exportRouter = Router();

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

// Export match stats as CSV
exportRouter.get("/matches", authenticate, teamContext, requireFeature("matches"), requireTeamRole("ANALYST"), async (req, res, next) => {
  try {
    const format = req.query.format === "json" ? "json" : "csv";
    const matches = await prisma.match.findMany({
      where: { teamId: req.teamId },
      include: { playerStats: { include: { user: { select: { displayName: true } } } } },
      orderBy: { date: "desc" },
    });

    const rows = matches.map(m => ({
      date: m.date.toISOString().split("T")[0],
      opponent: m.opponent,
      map: m.map,
      result: m.result,
      scoreUs: m.scoreUs,
      scoreThem: m.scoreThem,
      competition: m.competition || "",
    }));

    if (format === "json") {
      res.json({ success: true, data: rows });
    } else {
      const csv = toCsv(["date", "opponent", "map", "result", "scoreUs", "scoreThem", "competition"], rows);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=matches.csv");
      res.send(csv);
    }
  } catch (error) { next(error); }
});

// Export training attendance as CSV
exportRouter.get("/training-attendance", authenticate, teamContext, requireFeature("training"), requireTeamRole("ANALYST"), async (req, res, next) => {
  try {
    const format = req.query.format === "json" ? "json" : "csv";
    const trainings = await prisma.training.findMany({
      where: { teamId: req.teamId },
      include: {
        votes: { include: { user: { select: { displayName: true } } } },
      },
      orderBy: { date: "desc" },
    });

    const rows = trainings.flatMap(t =>
      t.votes.map(v => ({
        training: t.title,
        date: t.date.toISOString().split("T")[0],
        player: v.user.displayName,
        status: v.status,
        comment: v.comment || "",
      }))
    );

    if (format === "json") {
      res.json({ success: true, data: rows });
    } else {
      const csv = toCsv(["training", "date", "player", "status", "comment"], rows);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=training-attendance.csv");
      res.send(csv);
    }
  } catch (error) { next(error); }
});

// Export availability as CSV
exportRouter.get("/availability", authenticate, teamContext, requireFeature("availability"), requireTeamRole("ANALYST"), async (req, res, next) => {
  try {
    const format = req.query.format === "json" ? "json" : "csv";
    const days = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
    const slots = await prisma.availability.findMany({
      where: { teamId: req.teamId! },
      include: { user: { select: { displayName: true } } },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    const rows = slots.map(s => ({
      player: s.user.displayName,
      day: days[s.dayOfWeek],
      startTime: s.startTime,
      endTime: s.endTime,
    }));

    if (format === "json") {
      res.json({ success: true, data: rows });
    } else {
      const csv = toCsv(["player", "day", "startTime", "endTime"], rows);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=availability.csv");
      res.send(csv);
    }
  } catch (error) { next(error); }
});
