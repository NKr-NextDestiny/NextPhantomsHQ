"use client";
import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/lib/auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

let globalSocket: Socket | null = null;
let refCount = 0;

function getSocket(): Socket {
  if (!globalSocket) {
    globalSocket = io(API_URL, {
      autoConnect: false,
      withCredentials: true,
    });
  }
  return globalSocket;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { user, teamId } = useAuthStore();

  useEffect(() => {
    if (!user) return;

    const socket = getSocket();
    socketRef.current = socket;
    refCount++;

    if (!socket.connected) {
      // Get auth token from cookie
      const token = document.cookie
        .split("; ")
        .find((c) => c.startsWith("token="))
        ?.split("=")[1];
      if (token) {
        socket.auth = { token };
      }
      socket.connect();
    }

    if (teamId) {
      socket.emit("join:team", teamId);
    }

    return () => {
      refCount--;
      if (refCount <= 0 && globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
        refCount = 0;
      }
    };
  }, [user, teamId]);

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    const socket = socketRef.current;
    if (!socket) return () => {};
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, []);

  return { on, socket: socketRef.current };
}
