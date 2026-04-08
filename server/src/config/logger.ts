import pino from "pino";
import { config } from "./index.js";

export const logger = pino({
  level: process.env.LOG_LEVEL || (config.nodeEnv === "production" ? "info" : "debug"),
  transport: config.nodeEnv !== "production" ? {
    target: "pino/file",
    options: { destination: 1 }, // stdout
  } : undefined,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
