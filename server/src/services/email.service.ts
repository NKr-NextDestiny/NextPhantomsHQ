import nodemailer from "nodemailer";
import { config } from "../config/index.js";

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

export async function sendEmail(to: string, subject: string, html: string) {
  const t = getTransporter();
  if (!t) return;
  await t.sendMail({ from: config.smtpFrom, to, subject, html });
}

export async function sendNewEventNotification(to: string, eventType: string, title: string, date: string, createdBy: string) {
  await sendEmail(to, `[NextPhantoms] Neues ${eventType}: ${title}`,
    `<p><strong>${createdBy}</strong> hat ein neues ${eventType} erstellt:</p>
     <p><strong>${title}</strong><br>Datum: ${date}</p>
     <p>Logge dich ein um abzustimmen.</p>`);
}

export async function sendAttendanceReminder(to: string, eventType: string, title: string, date: string, token?: string, appUrl?: string) {
  const links = token && appUrl ? `
    <p>Schnell abstimmen:</p>
    <p>
      <a href="${appUrl}/attendance/${token}?vote=AVAILABLE">&#x2705; Verf&uuml;gbar</a> |
      <a href="${appUrl}/attendance/${token}?vote=UNAVAILABLE">&#x274C; Nicht verf&uuml;gbar</a> |
      <a href="${appUrl}/attendance/${token}?vote=MAYBE">&#x2753; Vielleicht</a>
    </p>` : "";
  await sendEmail(to, `[NextPhantoms] Erinnerung: ${title}`,
    `<p>Erinnerung an <strong>${title}</strong> (${eventType})</p>
     <p>Datum: ${date}</p>${links}`);
}
