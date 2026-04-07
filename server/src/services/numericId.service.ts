import { prisma } from "../config/prisma.js";

export async function generateUniqueNumericId(): Promise<number> {
  let numericId: number;
  let exists: boolean;
  do {
    numericId = Math.floor(100000 + Math.random() * 900000);
    const user = await prisma.user.findUnique({ where: { numericId } });
    exists = !!user;
  } while (exists);
  return numericId;
}
