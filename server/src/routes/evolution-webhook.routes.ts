import { Router } from "express";
import { handleIncomingGroupCommand } from "../services/bot-commands.service.js";

export const evolutionWebhookRouter = Router();

function extractMessageText(payload: any): string {
  const message = payload?.data?.messages?.[0]?.message
    || payload?.data?.message
    || payload?.message;
  return (
    message?.conversation
    || message?.extendedTextMessage?.text
    || message?.imageMessage?.caption
    || ""
  );
}

function extractRemoteJid(payload: any): string {
  return payload?.data?.messages?.[0]?.key?.remoteJid || payload?.data?.key?.remoteJid || payload?.key?.remoteJid || "";
}

function extractFromMe(payload: any): boolean {
  return Boolean(payload?.data?.messages?.[0]?.key?.fromMe ?? payload?.data?.key?.fromMe ?? payload?.key?.fromMe);
}

async function handleWebhookMessage(req: any, res: any) {
  const remoteJid = extractRemoteJid(req.body);
  const text = extractMessageText(req.body);
  const fromMe = extractFromMe(req.body);

  if (!fromMe && remoteJid && text) {
    await handleIncomingGroupCommand(req.body?.instance || req.body?.data?.instance || "", remoteJid, text);
  }

  res.json({ success: true });
}

evolutionWebhookRouter.post("/", async (req, res) => {
  const event = String(req.body?.event || "").toUpperCase();
  if (!event || event === "MESSAGES_UPSERT") {
    await handleWebhookMessage(req, res);
    return;
  }

  res.json({ success: true });
});

evolutionWebhookRouter.post("/messages-upsert", handleWebhookMessage);
