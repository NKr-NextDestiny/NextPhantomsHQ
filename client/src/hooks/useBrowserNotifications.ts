"use client";
import { useEffect, useRef, useCallback, useState } from "react";

const STORAGE_KEY = "browser-notifications-enabled";

export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [enabled, setEnabled] = useState(false);
  const supported = typeof window !== "undefined" && "Notification" in window;

  useEffect(() => {
    if (!supported) return;
    setPermission(Notification.permission);
    setEnabled(localStorage.getItem(STORAGE_KEY) === "true" && Notification.permission === "granted");
  }, [supported]);

  const requestPermission = useCallback(async () => {
    if (!supported) return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      localStorage.setItem(STORAGE_KEY, "true");
      setEnabled(true);
      return true;
    }
    return false;
  }, [supported]);

  const disable = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "false");
    setEnabled(false);
  }, []);

  const enable = useCallback(() => {
    if (permission === "granted") {
      localStorage.setItem(STORAGE_KEY, "true");
      setEnabled(true);
    }
  }, [permission]);

  const showNotification = useCallback(
    (title: string, options?: { body?: string; tag?: string; link?: string }) => {
      if (!supported || !enabled || Notification.permission !== "granted") return;
      if (document.hasFocus()) return; // don't show when tab is focused
      const n = new Notification(title, {
        body: options?.body,
        icon: "/logo.png",
        tag: options?.tag,
      });
      if (options?.link) {
        n.onclick = () => {
          window.focus();
          window.location.href = options.link!;
          n.close();
        };
      }
    },
    [supported, enabled],
  );

  return { supported, permission, enabled, requestPermission, enable, disable, showNotification };
}

/** Returns true if the user hasn't been asked about browser notifications yet. */
export function shouldPromptNotifications(): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "default") return false;
  return localStorage.getItem(STORAGE_KEY) === null;
}
