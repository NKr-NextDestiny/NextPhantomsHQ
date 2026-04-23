import sharp from "sharp";

export interface GeneratedNotificationImage {
  data: Buffer;
  fileName: string;
  mimetype: "image/png";
}

const WIDTH = 1200;
const HEIGHT = 675;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapText(value: string, max = 38): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.slice(0, 5);
}

function svgTemplate(options: {
  badge: string;
  title: string;
  subtitle?: string;
  footer?: string;
  accent: string;
  body?: string[];
}): string {
  const titleLines = wrapText(options.title, 26);
  const bodyLines = options.body?.length ? options.body : [];
  const subtitle = options.subtitle ? escapeHtml(options.subtitle) : "";
  const footer = options.footer ? escapeHtml(options.footer) : "";

  return `
  <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#12151c" />
        <stop offset="100%" stop-color="#1f2631" />
      </linearGradient>
      <linearGradient id="accent" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0%" stop-color="${options.accent}" />
        <stop offset="100%" stop-color="#ff8a3d" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)" />
    <rect x="56" y="56" width="1088" height="563" rx="18" fill="#0d1117" stroke="#293241" stroke-width="2" />
    <rect x="56" y="56" width="1088" height="16" rx="8" fill="url(#accent)" />
    <text x="88" y="126" fill="#ffb26b" font-size="28" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${escapeHtml(options.badge)}</text>
    ${titleLines.map((line, index) => `<text x="88" y="${208 + index * 72}" fill="#f5f7fb" font-size="62" font-family="Segoe UI, Arial, sans-serif" font-weight="800">${escapeHtml(line)}</text>`).join("")}
    ${subtitle ? `<text x="88" y="430" fill="#c3ccda" font-size="30" font-family="Segoe UI, Arial, sans-serif" font-weight="500">${subtitle}</text>` : ""}
    ${bodyLines.map((line, index) => `<text x="88" y="${492 + index * 40}" fill="#d9e0eb" font-size="28" font-family="Segoe UI, Arial, sans-serif">${escapeHtml(line)}</text>`).join("")}
    ${footer ? `<text x="88" y="590" fill="#7f8a9b" font-size="24" font-family="Segoe UI, Arial, sans-serif">${footer}</text>` : ""}
    <text x="1058" y="590" text-anchor="end" fill="#7f8a9b" font-size="24" font-family="Segoe UI, Arial, sans-serif">Next Phantoms HQ</text>
  </svg>`;
}

async function renderSvg(fileName: string, svg: string): Promise<GeneratedNotificationImage> {
  const data = await sharp(Buffer.from(svg)).png().toBuffer();
  return { data, fileName, mimetype: "image/png" };
}

export async function createAnnouncementImage(options: {
  title: string;
  content: string;
  createdBy: string;
}): Promise<GeneratedNotificationImage> {
  return renderSvg("announcement.png", svgTemplate({
    badge: "ANNOUNCEMENT",
    title: options.title,
    subtitle: `Von ${options.createdBy}`,
    footer: options.createdBy,
    accent: "#ff7a18",
    body: wrapText(options.content, 54).slice(0, 3),
  }));
}

export async function createMatchResultImage(options: {
  opponent: string;
  scoreUs: number;
  scoreThem: number;
  map?: string | null;
  competition?: string | null;
  result: "WIN" | "LOSS" | "DRAW";
}): Promise<GeneratedNotificationImage> {
  const resultLabel = options.result === "WIN" ? "SIEG" : options.result === "LOSS" ? "NIEDERLAGE" : "UNENTSCHIEDEN";
  const footerParts = [options.map, options.competition].filter(Boolean);

  return renderSvg("match-result.png", svgTemplate({
    badge: "MATCH RESULT",
    title: `Next Phantoms ${options.scoreUs}:${options.scoreThem} ${options.opponent}`,
    subtitle: resultLabel,
    footer: footerParts.join(" | "),
    accent: options.result === "WIN" ? "#39d98a" : options.result === "LOSS" ? "#ff5d73" : "#5fa8ff",
  }));
}

export async function createPollResultImage(options: {
  question: string;
  lines: string[];
}): Promise<GeneratedNotificationImage> {
  return renderSvg("poll-result.png", svgTemplate({
    badge: "POLL RESULT",
    title: options.question,
    subtitle: "Abstimmung beendet",
    accent: "#7c5cff",
    body: options.lines.slice(0, 6),
  }));
}
