import nodemailer from "nodemailer";
import { config } from "../config/index.js";

let transporter: nodemailer.Transporter | null = null;
const AUTOMATED_NOTICE = "<p><em>Dies ist eine automatisierte Nachricht von Next Phantoms HQ.</em></p>";

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

export async function sendEmail(to: string, subject: string, html: string) {
  const t = getTransporter();
  if (!t) return;
  await t.sendMail({ from: config.smtpFrom, to, subject, html });
}

export async function sendNewEventNotification(to: string, eventType: string, title: string, date: string, createdBy: string) {
  await sendEmail(to, `[Next Phantoms HQ] Neues ${eventType}: ${title}`,
    `<p><strong>${createdBy}</strong> hat ein neues ${eventType} erstellt:</p>
     <p><strong>${title}</strong><br>Datum: ${date}</p>
     <p>Logge dich ein um abzustimmen.</p>${AUTOMATED_NOTICE}`);
}

export async function sendEventUpdatedNotification(to: string, eventType: string, title: string, date: string, updatedBy: string) {
  await sendEmail(to, `[Next Phantoms HQ] ${eventType} aktualisiert: ${title}`,
    `<p><strong>${updatedBy}</strong> hat das ${eventType} aktualisiert:</p>
     <p><strong>${title}</strong><br>Datum: ${date}</p>${AUTOMATED_NOTICE}`);
}

export async function sendEventDeletedNotification(to: string, eventType: string, title: string, deletedBy: string) {
  await sendEmail(to, `[Next Phantoms HQ] ${eventType} abgesagt: ${title}`,
    `<p><strong>${deletedBy}</strong> hat das ${eventType} <strong>${title}</strong> abgesagt/gel&ouml;scht.</p>${AUTOMATED_NOTICE}`);
}

export async function sendAnnouncementNotification(to: string, title: string, createdBy: string) {
  await sendEmail(to, `[Next Phantoms HQ] Neue Ankündigung: ${title}`,
    `<p><strong>${createdBy}</strong> hat eine neue Ank&uuml;ndigung erstellt:</p>
     <p><strong>${title}</strong></p>
     <p>Logge dich ein um die Ank&uuml;ndigung zu lesen.</p>${AUTOMATED_NOTICE}`);
}

export async function sendMatchResultNotification(
  to: string,
  opponent: string,
  scoreUs: number,
  scoreThem: number,
  result: "WIN" | "LOSS" | "DRAW",
  map?: string | null,
  competition?: string | null,
) {
  await sendEmail(to, `[Next Phantoms HQ] Match-Ergebnis vs ${opponent}`,
    `<p><strong>Match-Ergebnis</strong></p>
     <p>Next Phantoms ${scoreUs}:${scoreThem} ${opponent}</p>
     <p>Resultat: ${result}</p>
     <p>Map: ${map || "Unbekannt"}<br>Wettbewerb: ${competition || "Unbekannt"}</p>${AUTOMATED_NOTICE}`);
}

export async function sendPollResultNotification(to: string, question: string, results: string[]) {
  await sendEmail(to, `[Next Phantoms HQ] Poll beendet: ${question}`,
    `<p>Die Abstimmung <strong>${question}</strong> ist beendet.</p>
     <p>Ergebnis:</p><ul>${results.map((line) => `<li>${line}</li>`).join("")}</ul>${AUTOMATED_NOTICE}`);
}

export async function sendAttendanceReminder(to: string, eventType: string, title: string, date: string, token?: string, appUrl?: string) {
  const links = token && appUrl ? `
    <p>Schnell abstimmen:</p>
    <p>
      <a href="${appUrl}/attendance/${token}?vote=AVAILABLE">&#x2705; Verf&uuml;gbar</a> |
      <a href="${appUrl}/attendance/${token}?vote=UNAVAILABLE">&#x274C; Nicht verf&uuml;gbar</a> |
      <a href="${appUrl}/attendance/${token}?vote=MAYBE">&#x2753; Vielleicht</a>
    </p>` : "";
  await sendEmail(to, `[Next Phantoms HQ] Erinnerung: ${title}`,
    `<p>Erinnerung an <strong>${title}</strong> (${eventType})</p>
     <p>Datum: ${date}</p>${links}${AUTOMATED_NOTICE}`);
}

export async function sendAttendanceAlreadyResponded(
  to: string,
  eventType: string,
  title: string,
  date: string,
  response: string,
  reason?: string | null,
) {
  await sendEmail(
    to,
    `[Next Phantoms HQ] Bereits abgestimmt: ${title}`,
    `<p>Du hast fuer <strong>${title}</strong> (${eventType}) bereits abgestimmt.</p>
     <p>Datum: ${date}</p>
     <p>Aktuelle Antwort: <strong>${response}</strong></p>
     ${reason ? `<p>Grund: ${reason}</p>` : ""}
     <p>Der E-Mail-Link ist nur noch zur Information sichtbar und kann deine Antwort nicht mehr aendern.</p>${AUTOMATED_NOTICE}`,
  );
}
