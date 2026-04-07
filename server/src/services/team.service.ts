import { prisma } from "../config/prisma.js";
import { GAME_PRESETS, DEFAULT_GAME } from "shared";

export async function ensureTeamExists(): Promise<string> {
  const existing = await prisma.team.findFirst();
  if (existing) return existing.id;

  const preset = GAME_PRESETS[DEFAULT_GAME as keyof typeof GAME_PRESETS];
  const team = await prisma.team.create({
    data: {
      name: "NextPhantoms",
      tag: "NP",
      game: DEFAULT_GAME,
      logoUrl: "/images/logo_nde.png",
    },
  });

  await prisma.gameConfig.create({
    data: {
      teamId: team.id,
      maps: [...preset.maps],
      characters: [...preset.characters],
      characterLabel: preset.characterLabel,
      playerRoles: [...preset.playerRoles],
    },
  });

  console.log("🏠 Team created:", team.name);
  return team.id;
}
