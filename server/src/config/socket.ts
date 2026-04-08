import { Server as HttpServer } from "node:http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "./index.js";

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.appUrl,
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error("Authentication required"));
    try {
      const decoded = jwt.verify(token as string, config.jwtSecret) as { userId: string };
      (socket as any).userId = decoded.userId;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId as string;
    socket.join(`user:${userId}`);

    socket.on("join:team", (teamId: string) => {
      socket.join(`team:${teamId}`);
    });

    socket.on("join:entity", (entityId: string) => {
      socket.join(`entity:${entityId}`);
    });

    socket.on("leave:entity", (entityId: string) => {
      socket.leave(`entity:${entityId}`);
    });

    socket.on("disconnect", () => {
      // cleanup handled by socket.io
    });
  });

  console.log("🔌 Socket.io initialized");
  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

/** Safely emit to a room — logs errors instead of throwing */
export function safeEmit(room: string, event: string, data: unknown): void {
  try {
    if (!io) return;
    io.to(room).emit(event, data);
  } catch (e) {
    console.error(`[socket] Failed to emit ${event} to ${room}:`, e);
  }
}
