"use client";
import { useEffect, useCallback, useState } from "react";

export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const supported = typeof window !== "undefined" && "Notification" in window;
  const enabled = permission === "granted";

  useEffect(() => {
    if (!supported) return;
    setPermission(Notification.permission);
  }, [supported]);

  const requestPermission = useCallback(async () => {
    if (!supported) return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result === "granted";
  }, [supported]);

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

  return { supported, permission, enabled, requestPermission, showNotification };
}

export function shouldPromptNotifications(): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  return Notification.permission === "default";
}
