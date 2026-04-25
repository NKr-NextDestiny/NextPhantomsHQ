import nodemailer from "nodemailer";
import { config } from "../config/index.js";

type SupportedLocale = "de" | "en" | "pirate";

interface EmailAction {
  label: string;
  href: string;
}

interface TemplateOptions {
  locale?: string | null;
  preheader: string;
  title: string;
  intro: string;
  sections?: { label?: string; value: string }[];
  actions?: EmailAction[];
  outro?: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!config.smtpHost) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPass },
    });
  }
  return transporter;
}

function normalizeLocale(locale?: string | null): SupportedLocale {
  if (locale === "en" || locale === "pirate") return locale;
  return "de";
}

function copy(locale?: string | null) {
  const normalized = normalizeLocale(locale);
  if (normalized === "en") {
    return {
      notice: "This is an automated message from Next Phantoms HQ.",
      open: "Open in HQ",
      footer: "Next Destiny eSports",
      createdBy: "Created by",
      updatedBy: "Updated by",
      deletedBy: "Removed by",
      title: "Title",
      time: "Time",
      details: "Details",
      type: "Type",
      answer: "Answer",
      reason: "Reason",
      overview: "Overview",
      eventNeeded: "Response needed",
      eventUpdated: "Event updated",
      eventCancelled: "Event cancelled",
      announcement: "New announcement",
      pollClosed: "Poll closed",
      pollCreated: "New poll",
      alreadyResponded: "Already responded",
      attendanceOutro: "The buttons take you straight to the matching attendance page.",
      infoOnlyOutro: "The email link is informational only and does not change your previous answer.",
    };
  }
  if (normalized === "pirate") {
    return {
      notice: "Dies ist eine automatisierte Flaschenpost von Next Phantoms HQ.",
      open: "Im HQ öffnen",
      footer: "Next Destiny eSports",
      createdBy: "Aufgesetzt von",
      updatedBy: "Geändert von",
      deletedBy: "Entfernt von",
      title: "Titel",
      time: "Zeit",
      details: "Details",
      type: "Typ",
      answer: "Antwort",
      reason: "Grund",
      overview: "Überblick",
      eventNeeded: "Antwort benötigt",
      eventUpdated: "Termin aktualisiert",
      eventCancelled: "Termin abgesagt",
      announcement: "Neue Ankündigung",
      pollClosed: "Umfrage beendet",
      pollCreated: "Neue Umfrage",
      alreadyResponded: "Bereits abgestimmt",
      attendanceOutro: "Über die Buttons kommst du direkt zur passenden Abstimmungsseite.",
      infoOnlyOutro: "Der E-Mail-Link dient hier nur noch zur Information und ändert deine Antwort nicht mehr.",
    };
  }
  return {
    notice: "Dies ist eine automatisierte Nachricht von Next Phantoms HQ.",
    open: "Im HQ öffnen",
    footer: "Next Destiny eSports",
    createdBy: "Von",
    updatedBy: "Geändert von",
    deletedBy: "Entfernt von",
    title: "Titel",
    time: "Zeit",
    details: "Details",
    type: "Typ",
    answer: "Antwort",
    reason: "Grund",
    overview: "Überblick",
    eventNeeded: "Antwort benötigt",
    eventUpdated: "Termin aktualisiert",
    eventCancelled: "Termin abgesagt",
    announcement: "Neue Ankündigung",
    pollClosed: "Umfrage beendet",
    pollCreated: "Neue Umfrage",
    alreadyResponded: "Bereits abgestimmt",
    attendanceOutro: "Über die Buttons kommst du direkt zur passenden Abstimmungsseite.",
    infoOnlyOutro: "Der E-Mail-Link dient hier nur noch zur Information und ändert deine Antwort nicht mehr.",
  };
}

function renderTemplate(options: TemplateOptions) {
  const text = copy(options.locale);
  const sections = options.sections ?? [];
  const actions = options.actions ?? [];

  return `
  <div style="margin:0;padding:0;background:#0a0f1e;font-family:Inter,Segoe UI,Arial,sans-serif;color:#e8edf8;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${options.preheader}</div>
    <div style="max-width:680px;margin:0 auto;padding:32px 16px;">
      <div style="border:1px solid #1f2b49;border-radius:24px;overflow:hidden;background:#10192d;box-shadow:0 28px 80px rgba(0,0,0,0.35);">
        <div style="padding:28px;background:linear-gradient(135deg,#0f1730 0%,#1d2d58 45%,#ff7a18 130%);">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="vertical-align:middle;padding-right:14px;">
                <img src="${config.appUrl}/images/logo_icon.png" alt="Next Phantoms HQ" width="52" height="52" style="display:block;border-radius:14px;background:#0d1530;padding:6px;" />
              </td>
              <td style="vertical-align:middle;">
                <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#9cb1e8;">Next Destiny eSports</div>
                <div style="font-size:28px;font-weight:800;color:#ffffff;margin-top:4px;">${options.title}</div>
              </td>
            </tr>
          </table>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#d6def8;">${options.intro}</p>
          ${sections.map((section) => `
            <div style="margin:0 0 12px;padding:14px 16px;border-radius:16px;background:#0c1428;border:1px solid #1d2948;">
              ${section.label ? `<div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#88a0d9;margin-bottom:6px;">${section.label}</div>` : ""}
              <div style="font-size:15px;line-height:1.6;color:#ffffff;">${section.value}</div>
            </div>
          `).join("")}
          ${actions.length > 0 ? `
            <div style="display:flex;flex-wrap:wrap;gap:12px;margin:24px 0 8px;">
              ${actions.map((action) => `
                <a href="${action.href}" style="display:inline-block;padding:12px 18px;border-radius:14px;background:#ff7a18;color:#ffffff;text-decoration:none;font-weight:700;">${action.label}</a>
              `).join("")}
            </div>
          ` : ""}
          ${options.outro ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#9fb0dd;">${options.outro}</p>` : ""}
        </div>
        <div style="padding:20px 28px;border-top:1px solid #1c2744;background:#0b1224;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#91a4d6;">${text.notice}</p>
          <p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#6477ab;">${text.footer}</p>
        </div>
      </div>
    </div>
  </div>`;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const t = getTransporter();
  if (!t) return;
  await t.sendMail({ from: config.smtpFrom, to, subject, html });
}

function eventLabel(locale: string | null | undefined, eventType: string) {
  const normalized = normalizeLocale(locale);
  if (normalized === "en") {
    if (eventType === "Training") return "Practice";
    if (eventType === "Scrim") return "Scrim";
    if (eventType === "Match") return "Match";
  }
  return eventType;
}

function absoluteLink(link?: string) {
  return link ? `${config.appUrl}${link}` : undefined;
}

export async function sendNewEventNotification(
  to: string,
  locale: string | null | undefined,
  eventType: string,
  title: string,
  date: string,
  createdBy: string,
  link?: string,
) {
  const text = copy(locale);
  await sendEmail(to, `[Next Phantoms HQ] Neues ${eventType}: ${title}`, renderTemplate({
    locale,
    preheader: `${eventType}: ${title}`,
    title: `Neues ${eventLabel(locale, eventType)}`,
    intro: `<strong>${createdBy}</strong> hat einen neuen Termin angelegt.`,
    sections: [
      { label: text.title, value: title },
      { label: text.time, value: date },
      { label: text.createdBy, value: createdBy },
    ],
    actions: absoluteLink(link) ? [{ label: text.open, href: absoluteLink(link)! }] : [],
  }));
}

export async function sendEventUpdatedNotification(
  to: string,
  locale: string | null | undefined,
  eventType: string,
  title: string,
  date: string,
  updatedBy: string,
  link?: string,
) {
  const text = copy(locale);
  await sendEmail(to, `[Next Phantoms HQ] ${eventType} aktualisiert: ${title}`, renderTemplate({
    locale,
    preheader: `${eventType} aktualisiert`,
    title: `${eventLabel(locale, eventType)} aktualisiert`,
    intro: `<strong>${updatedBy}</strong> hat den Termin aktualisiert.`,
    sections: [
      { label: text.title, value: title },
      { label: text.time, value: date },
      { label: text.updatedBy, value: updatedBy },
    ],
    actions: absoluteLink(link) ? [{ label: text.open, href: absoluteLink(link)! }] : [],
  }));
}

export async function sendEventDeletedNotification(
  to: string,
  locale: string | null | undefined,
  eventType: string,
  title: string,
  deletedBy: string,
  link?: string,
) {
  const text = copy(locale);
  await sendEmail(to, `[Next Phantoms HQ] ${eventType} abgesagt: ${title}`, renderTemplate({
    locale,
    preheader: `${eventType} abgesagt`,
    title: `${eventLabel(locale, eventType)} abgesagt`,
    intro: `<strong>${deletedBy}</strong> hat den Termin entfernt.`,
    sections: [
      { label: text.title, value: title },
      { label: text.deletedBy, value: deletedBy },
    ],
    actions: absoluteLink(link) ? [{ label: text.open, href: absoluteLink(link)! }] : [],
  }));
}

export async function sendAnnouncementNotification(
  to: string,
  locale: string | null | undefined,
  title: string,
  createdBy: string,
  link?: string,
) {
  const text = copy(locale);
  await sendEmail(to, `[Next Phantoms HQ] Neue Ankündigung: ${title}`, renderTemplate({
    locale,
    preheader: title,
    title: text.announcement,
    intro: `<strong>${createdBy}</strong> hat eine neue Ankündigung veröffentlicht.`,
    sections: [
      { label: text.title, value: title },
      { label: text.createdBy, value: createdBy },
    ],
    actions: absoluteLink(link) ? [{ label: text.open, href: absoluteLink(link)! }] : [],
  }));
}

export async function sendMatchResultNotification(
  to: string,
  locale: string | null | undefined,
  opponent: string,
  scoreUs: number,
  scoreThem: number,
  result: "WIN" | "LOSS" | "DRAW",
  map?: string | null,
  competition?: string | null,
  link?: string,
) {
  const text = copy(locale);
  await sendEmail(to, `[Next Phantoms HQ] Match-Ergebnis vs ${opponent}`, renderTemplate({
    locale,
    preheader: `Next Phantoms ${scoreUs}:${scoreThem} ${opponent}`,
    title: "Match-Ergebnis",
    intro: `Das Ergebnis gegen <strong>${opponent}</strong> ist da.`,
    sections: [
      { label: "Score", value: `Next Phantoms ${scoreUs}:${scoreThem} ${opponent}` },
      { label: "Ergebnis", value: result },
      { label: text.details, value: `${map || "Ohne Map"}${competition ? ` · ${competition}` : ""}` },
    ],
    actions: absoluteLink(link) ? [{ label: text.open, href: absoluteLink(link)! }] : [],
  }));
}

export async function sendPollResultNotification(
  to: string,
  locale: string | null | undefined,
  question: string,
  results: string[],
  link?: string,
) {
  const text = copy(locale);
  await sendEmail(to, `[Next Phantoms HQ] Umfrage beendet: ${question}`, renderTemplate({
    locale,
    preheader: question,
    title: text.pollClosed,
    intro: `Die Ergebnisse für <strong>${question}</strong> sind da.`,
    sections: results.map((line) => ({ value: line })),
    actions: absoluteLink(link) ? [{ label: text.open, href: absoluteLink(link)! }] : [],
  }));
}

export async function sendPollCreatedNotification(
  to: string,
  locale: string | null | undefined,
  question: string,
  createdBy: string,
  options: string[],
  link?: string,
) {
  const text = copy(locale);
  await sendEmail(to, `[Next Phantoms HQ] Neue Umfrage: ${question}`, renderTemplate({
    locale,
    preheader: question,
    title: text.pollCreated,
    intro: `<strong>${createdBy}</strong> hat eine neue Umfrage erstellt.`,
    sections: [
      { label: text.title, value: question },
      { label: text.createdBy, value: createdBy },
      { label: text.overview, value: options.map((option, index) => `${index + 1}. ${option}`).join("<br />") },
    ],
    actions: absoluteLink(link) ? [{ label: text.open, href: absoluteLink(link)! }] : [],
  }));
}

export async function sendAttendanceReminder(
  to: string,
  locale: string | null | undefined,
  eventType: string,
  title: string,
  date: string,
  token?: string,
  appUrl?: string,
) {
  const text = copy(locale);
  const baseUrl = appUrl || config.appUrl;
  const actions = token ? [
    { label: "✅ Verfügbar", href: `${baseUrl}/attendance/${token}?vote=AVAILABLE` },
    { label: "❌ Nicht verfügbar", href: `${baseUrl}/attendance/${token}?vote=UNAVAILABLE` },
    { label: "❔ Vielleicht", href: `${baseUrl}/attendance/${token}?vote=MAYBE` },
  ] : [];

  await sendEmail(to, `[Next Phantoms HQ] Erinnerung: ${title}`, renderTemplate({
    locale,
    preheader: `${title} wartet auf deine Antwort`,
    title: text.eventNeeded,
    intro: `Bitte gib deine Verfügbarkeit für <strong>${title}</strong> an.`,
    sections: [
      { label: text.type, value: eventType },
      { label: text.time, value: date },
    ],
    actions,
    outro: text.attendanceOutro,
  }));
}

export async function sendAttendanceAlreadyResponded(
  to: string,
  locale: string | null | undefined,
  eventType: string,
  title: string,
  date: string,
  response: string,
  reason?: string | null,
  link?: string,
) {
  const text = copy(locale);
  await sendEmail(to, `[Next Phantoms HQ] Bereits abgestimmt: ${title}`, renderTemplate({
    locale,
    preheader: `${title} ist bereits beantwortet`,
    title: text.alreadyResponded,
    intro: `Für <strong>${title}</strong> liegt bereits eine Antwort von dir vor.`,
    sections: [
      { label: text.type, value: eventType },
      { label: text.time, value: date },
      { label: text.answer, value: response },
      ...(reason ? [{ label: text.reason, value: reason }] : []),
    ],
    actions: absoluteLink(link) ? [{ label: text.open, href: absoluteLink(link)! }] : [],
    outro: text.infoOnlyOutro,
  }));
}
