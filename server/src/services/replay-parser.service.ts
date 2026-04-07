import * as zlib from "zlib";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "../config/prisma.js";
import { config } from "../config/index.js";
import { readDecryptedFile } from "./file-encryption.service.js";

const inflateRawSync = zlib.inflateRawSync;
// Node 24 zstd support
const zstdDecompressSync: (buf: Buffer) => Buffer = (zlib as any).zstdDecompressSync;

// ─── ZIP EXTRACTOR ────────────────────────────────────────────────────────────

export interface ZipEntry {
  name: string;
  data: Buffer;
}

/** Pure Node.js ZIP extractor using Buffer (no external deps). */
export function extractZip(buffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  const LOCAL_SIG = 0x04034b50;
  let offset = 0;

  while (offset <= buffer.length - 30) {
    const sig = buffer.readUInt32LE(offset);
    if (sig !== LOCAL_SIG) { offset++; continue; }

    const compression    = buffer.readUInt16LE(offset + 8);
    const compressedSz   = buffer.readUInt32LE(offset + 18);
    const nameLen        = buffer.readUInt16LE(offset + 26);
    const extraLen       = buffer.readUInt16LE(offset + 28);
    const name           = buffer.slice(offset + 30, offset + 30 + nameLen).toString("utf8");
    const dataStart      = offset + 30 + nameLen + extraLen;
    const dataEnd        = dataStart + compressedSz;

    if (dataEnd > buffer.length) break;

    if (!name.endsWith("/")) {
      const raw = buffer.slice(dataStart, dataEnd);
      try {
        let data: Buffer;
        if (compression === 0) {
          data = raw;
        } else if (compression === 8) {
          data = inflateRawSync(raw);
        } else {
          offset = dataEnd; continue;
        }
        entries.push({ name, data });
      } catch { /* skip corrupt entries */ }
    }

    offset = dataEnd;
  }

  return entries;
}

// ─── R6S .REC PARSER ─────────────────────────────────────────────────────────

export interface ParsedKill {
  killer: string;
  victim: string;
  headshot: boolean;
}

export interface ParsedEvent {
  type: "kill" | "bomb_plant" | "bomb_defuse" | "round_end";
  time: number;
  killer?: string;
  victim?: string;
  headshot?: boolean;
  player?: string;
  site?: string;
  reason?: string;
  winnerTeam?: string;
}

export interface ParsedRound {
  roundNumber: number;
  map: string;
  datetime: string;
  matchType: string;
  teams: { "0": { name: string; startScore: number }; "1": { name: string; startScore: number } };
  players: { name: string; team: string; operator: string; profileId: string }[];
  kills: ParsedKill[];
  events: ParsedEvent[];
  recordingPlayer: string;
  roundEndReason: string;
  roundDuration: number;
}

// zstd magic: 0xFD2FB528 stored little-endian
const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

// Kill event field IDs (try both byte orders)
const FIELD_KILLER_BE  = Buffer.from([0xd9, 0x13, 0x3c, 0xba]);
const FIELD_KILLER_LE  = Buffer.from([0xba, 0x3c, 0x13, 0xd9]);
const FIELD_VICTIM_BE  = Buffer.from([0xac, 0x19, 0x0f, 0x70]);
const FIELD_VICTIM_LE  = Buffer.from([0x70, 0x0f, 0x19, 0xac]);
const FIELD_HS_BE      = Buffer.from([0x84, 0xbc, 0xc4, 0x5b]);
const FIELD_HS_LE      = Buffer.from([0x5b, 0xc4, 0xbc, 0x84]);

function findAllOccurrences(haystack: Buffer, needle: Buffer): number[] {
  const positions: number[] = [];
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) { match = false; break; }
    }
    if (match) positions.push(i);
  }
  return positions;
}

function readPrintableString(buf: Buffer, offset: number, maxLen = 64): string {
  let end = offset;
  while (end < buf.length && end - offset < maxLen) {
    const ch = buf[end];
    if (ch === 0 || ch < 0x20 || ch > 0x7e) break;
    end++;
  }
  const s = buf.slice(offset, end).toString("ascii");
  return s.length >= 2 ? s : "";
}

/** Scan a decompressed frame for kill events. */
function extractKillsFromFrame(frame: Buffer): ParsedKill[] {
  const raw: { killer: string; victim: string; headshot: boolean }[] = [];

  const killerMarkers = [
    ...findAllOccurrences(frame, FIELD_KILLER_BE),
    ...findAllOccurrences(frame, FIELD_KILLER_LE),
  ].sort((a, b) => a - b);

  for (const kpos of killerMarkers) {
    let killer = "";
    for (const delta of [5, 6, 8, 9, 10]) {
      if (kpos + 4 + delta >= frame.length) continue;
      const s = readPrintableString(frame, kpos + 4 + delta);
      if (s.length >= 2 && s.length <= 48) { killer = s; break; }
    }
    if (!killer) continue;

    const searchStart = Math.max(0, kpos - 120);
    const searchEnd   = Math.min(frame.length, kpos + 300);
    const region      = frame.slice(searchStart, searchEnd);
    const victimPositions = [
      ...findAllOccurrences(region, FIELD_VICTIM_BE),
      ...findAllOccurrences(region, FIELD_VICTIM_LE),
    ];

    let victim = "";
    for (const vp of victimPositions) {
      for (const delta of [5, 6, 8, 9, 10]) {
        if (searchStart + vp + 4 + delta >= frame.length) continue;
        const s = readPrintableString(frame, searchStart + vp + 4 + delta);
        if (s.length >= 2 && s.length <= 48 && s !== killer) { victim = s; break; }
      }
      if (victim) break;
    }
    if (!victim) continue;

    const hsPositions = [
      ...findAllOccurrences(region, FIELD_HS_BE),
      ...findAllOccurrences(region, FIELD_HS_LE),
    ];
    let headshot = false;
    if (hsPositions.length > 0) {
      const hp = searchStart + hsPositions[0] + 4;
      headshot = hp < frame.length && (frame[hp] === 2 || (hp + 1 < frame.length && frame[hp + 1] === 2));
    }

    raw.push({ killer, victim, headshot });
  }

  const seen = new Set<string>();
  return raw.filter(k => {
    const key = `${k.killer}::${k.victim}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Extract player names and profile IDs from the uncompressed header. */
function parseHeaderPlayers(header: Buffer): { name: string; team: string; operator: string; profileId: string }[] {
  const players: { name: string; team: string; operator: string; profileId: string }[] = [];
  const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const headerStr = header.toString("latin1");
  let match: RegExpExecArray | null;
  while ((match = uuidRe.exec(headerStr)) !== null) {
    const profileId = match[0];
    const lookback = Math.max(0, match.index - 80);
    const chunk = headerStr.slice(lookback, match.index);
    const nameMatch = chunk.match(/([A-Za-z0-9_.\-]{2,32})(?:\x00|$)/g);
    if (nameMatch && nameMatch.length > 0) {
      const name = nameMatch[nameMatch.length - 1].replace(/\x00/g, "").trim();
      if (name.length >= 2) {
        players.push({ name, team: "0", operator: "", profileId });
      }
    }
  }
  return players;
}

/** Parse a single .rec file buffer. Returns best-effort parsed round data. */
export function parseRecBuffer(data: Buffer, fallbackRoundNumber = 0): ParsedRound {
  const result: ParsedRound = {
    roundNumber: fallbackRoundNumber,
    map: "",
    datetime: new Date().toISOString(),
    matchType: "",
    teams: { "0": { name: "Team 0", startScore: 0 }, "1": { name: "Team 1", startScore: 0 } },
    players: [],
    kills: [],
    events: [],
    recordingPlayer: "",
    roundEndReason: "unknown",
    roundDuration: 0,
  };

  try {
    if (!zstdDecompressSync) return result;

    const frameStarts = findAllOccurrences(data, ZSTD_MAGIC);
    if (frameStarts.length === 0) return result;

    const headerEnd = frameStarts[0];
    if (headerEnd > 0) {
      result.players = parseHeaderPlayers(data.slice(0, headerEnd));
    }

    const decompressedFrames: Buffer[] = [];
    for (let i = 0; i < frameStarts.length; i++) {
      const start = frameStarts[i];
      const end   = i + 1 < frameStarts.length ? frameStarts[i + 1] : data.length;
      try {
        const decompressed = zstdDecompressSync(data.slice(start, end));
        decompressedFrames.push(decompressed);
      } catch { /* skip */ }
    }

    if (decompressedFrames.length > 0) {
      const lastFrame = decompressedFrames[decompressedFrames.length - 1];
      result.kills = extractKillsFromFrame(lastFrame);
    }

    result.events = result.kills.map((k, i) => ({
      type: "kill" as const,
      time: i * 5,
      killer: k.killer,
      victim: k.victim,
      headshot: k.headshot,
    }));

  } catch {
    result.roundEndReason = "parse_error";
  }

  return result;
}

// ─── STATS AGGREGATION ───────────────────────────────────────────────────────

/** After parsing all rounds of a replay, aggregate to MatchPlayerStat records. */
export async function aggregateMatchStats(replayId: string, matchId: string, teamId: string): Promise<void> {
  const rounds = await prisma.replayRound.findMany({
    where: { replayId },
    include: { playerStats: { where: { userId: { not: null } } } },
  });

  const userAgg = new Map<string, {
    kills: number; deaths: number; headshots: number; assists: number;
    score: number; rounds: number; operators: Set<string>;
  }>();

  for (const round of rounds) {
    for (const ps of round.playerStats) {
      if (!ps.userId) continue;
      const agg = userAgg.get(ps.userId) ?? {
        kills: 0, deaths: 0, headshots: 0, assists: 0, score: 0, rounds: 0, operators: new Set(),
      };
      agg.kills     += ps.kills;
      agg.deaths    += ps.deaths;
      agg.headshots += ps.headshots;
      agg.assists   += ps.assists;
      agg.score     += ps.score;
      agg.rounds    += 1;
      if (ps.operator) agg.operators.add(ps.operator);
      userAgg.set(ps.userId, agg);
    }
  }

  for (const [userId, agg] of userAgg) {
    const kd           = agg.deaths > 0 ? agg.kills / agg.deaths : agg.kills || null;
    const headshotRate = agg.kills  > 0 ? agg.headshots / agg.kills : null;
    const avgScore     = agg.rounds > 0 ? agg.score / agg.rounds : null;

    await prisma.matchPlayerStat.upsert({
      where:  { userId_matchId: { userId, matchId } },
      create: {
        userId, matchId, teamId,
        kills: agg.kills, deaths: agg.deaths, headshots: agg.headshots,
        assists: agg.assists, score: agg.score,
        kd, headshotRate, avgScore,
        operators: Array.from(agg.operators),
      },
      update: {
        kills: agg.kills, deaths: agg.deaths, headshots: agg.headshots,
        assists: agg.assists, score: agg.score,
        kd, headshotRate, avgScore,
        operators: Array.from(agg.operators),
      },
    });
  }
}

/** Map r6Username → userId for team members. */
export async function mapPlayersToUsers(roundId: string, teamId: string): Promise<void> {
  const stats = await prisma.replayPlayerStat.findMany({ where: { roundId, userId: null } });
  if (!stats.length) return;

  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: { user: { select: { id: true, r6Username: true } } },
  });
  const r6Map = new Map<string, string>();
  for (const m of members) {
    if (m.user?.r6Username) r6Map.set(m.user.r6Username.toLowerCase(), m.user.id);
  }

  for (const stat of stats) {
    const userId = r6Map.get(stat.r6Username.toLowerCase());
    if (userId) {
      await prisma.replayPlayerStat.update({ where: { id: stat.id }, data: { userId } });
    }
  }
}

/** Parse all .rec files in a replay (fire-and-forget background job). */
export async function parseReplayInBackground(replayId: string, teamId: string, matchId: string | null): Promise<void> {
  try {
    const rounds = await prisma.replayRound.findMany({ where: { replayId } });
    if (!rounds.length) return;

    for (const round of rounds) {
      try {
        const filePath = path.resolve(config.uploadDir, path.basename(round.fileUrl));
        if (!fs.existsSync(filePath)) continue;

        // Read and decrypt if necessary
        const data = readDecryptedFile(filePath);
        const parsed = parseRecBuffer(data, round.roundNumber);

        await prisma.replayRound.update({
          where: { id: round.id },
          data: {
            attackTeam:     parsed.teams["0"].name,
            defenseTeam:    parsed.teams["1"].name,
            roundEndReason: parsed.roundEndReason,
            roundDuration:  parsed.roundDuration || null,
            events:         parsed.events as any,
          },
        });

        // Create ReplayPlayerStat records from kills
        for (const kill of parsed.kills) {
          await prisma.replayPlayerStat.upsert({
            where:  { roundId_r6Username: { roundId: round.id, r6Username: kill.killer } },
            create: { roundId: round.id, r6Username: kill.killer, team: "0", kills: 1, headshots: kill.headshot ? 1 : 0 },
            update: { kills: { increment: 1 }, headshots: { increment: kill.headshot ? 1 : 0 } },
          });
          await prisma.replayPlayerStat.upsert({
            where:  { roundId_r6Username: { roundId: round.id, r6Username: kill.victim } },
            create: { roundId: round.id, r6Username: kill.victim, team: "1", deaths: 1 },
            update: { deaths: { increment: 1 } },
          });
        }

        await mapPlayersToUsers(round.id, teamId);
      } catch { /* skip failed round */ }
    }

    await prisma.replay.update({ where: { id: replayId }, data: { parsed: true, parseError: null } });

    if (matchId) {
      await aggregateMatchStats(replayId, matchId, teamId);
    }
  } catch (err: any) {
    await prisma.replay.update({
      where: { id: replayId },
      data: { parseError: err?.message ?? "Unknown parse error" },
    }).catch(() => {});
  }
}
