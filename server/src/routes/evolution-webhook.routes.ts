import { Router } from "express";
import { handleIncomingGroupCommand } from "../services/bot-commands.service.js";

export const evolutionWebhookRouter = Router();

function extractMessageText(payload: any): string {
  return (
    payload?.data?.message?.conversation
    || payload?.data?.message?.extendedTextMessage?.text
    || payload?.message?.conversation
    || payload?.message?.extendedTextMessage?.text
    || ""
  );
}

function extractRemoteJid(payload: any): string {
  return payload?.data?.key?.remoteJid || payload?.key?.remoteJid || "";
}

function extractFromMe(payload: any): boolean {
  return Boolean(payload?.data?.key?.fromMe ?? payload?.key?.fromMe);
}

evolutionWebhookRouter.post("/messages-upsert", async (req, res) => {
  const remoteJid = extractRemoteJid(req.body);
  const text = extractMessageText(req.body);
  const fromMe = extractFromMe(req.body);

  if (!fromMe && remoteJid && text) {
    await handleIncomingGroupCommand(req.body?.instance || "", remoteJid, text);
  }

  res.json({ success: true });
});

evolutionWebhookRouter.post("/qrcode-updated", async (_req, res) => {
  res.json({ success: true });
});

evolutionWebhookRouter.post("/connection-update", async (_req, res) => {
  res.json({ success: true });
});

evolutionWebhookRouter.post("/groups-upsert", async (_req, res) => {
  res.json({ success: true });
});

evolutionWebhookRouter.post("/groups-update", async (_req, res) => {
  res.json({ success: true });
});
