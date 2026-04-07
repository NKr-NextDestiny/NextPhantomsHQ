import crypto from "node:crypto";
import fs from "node:fs";
import { config } from "../config/index.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const MAGIC_HEADER = Buffer.from("NEXE");

function getKey(): Buffer {
  if (!config.fileEncryptionKey) throw new Error("FILE_ENCRYPTION_KEY not set");
  return crypto.scryptSync(config.fileEncryptionKey, "nextphantoms-salt", 32);
}

export function encryptFile(inputPath: string, outputPath: string): void {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const input = fs.readFileSync(inputPath);
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const output = Buffer.concat([MAGIC_HEADER, iv, authTag, encrypted]);
  fs.writeFileSync(outputPath, output);
}

export function decryptFile(inputPath: string): Buffer {
  const key = getKey();
  const data = fs.readFileSync(inputPath);

  const magic = data.subarray(0, MAGIC_HEADER.length);
  if (!magic.equals(MAGIC_HEADER)) {
    // Not encrypted, return as-is
    return data;
  }

  let offset = MAGIC_HEADER.length;
  const iv = data.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;
  const authTag = data.subarray(offset, offset + AUTH_TAG_LENGTH);
  offset += AUTH_TAG_LENGTH;
  const encrypted = data.subarray(offset);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function isEncrypted(filePath: string): boolean {
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(MAGIC_HEADER.length);
  fs.readSync(fd, buf, 0, MAGIC_HEADER.length, 0);
  fs.closeSync(fd);
  return buf.equals(MAGIC_HEADER);
}
