import de from "./messages/de.json";
import en from "./messages/en.json";
import pirate from "./messages/pirate.json";

export const locales = ["de", "en", "pirate"] as const;
export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  de: "Deutsch",
  en: "English",
  pirate: "\u2620\ufe0f Pirate",
};

const messages: Record<Locale, Record<string, unknown>> = { de, en, pirate };

export function getMessages(locale: Locale): Record<string, unknown> {
  return messages[locale] || messages.de;
}

/** Resolve a dot-path like "dashboard.welcome" from a nested object. */
function resolve(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

function repairMojibake(value: string): string {
  if (!/[Ãâð]/.test(value)) return value;

  try {
    const bytes = Uint8Array.from(Array.from(value), (char) => char.charCodeAt(0));
    const repaired = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return repaired.includes("\uFFFD") ? value : repaired;
  } catch {
    return value;
  }
}

/** Interpolate {placeholders} in a string. */
function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return values[key] != null ? String(values[key]) : `{${key}}`;
  });
}

/**
 * Create a namespaced translation function.
 * Usage: const t = createT(locale, "dashboard"); t("welcome", { name: "Max" })
 */
export function createT(locale: Locale, namespace?: string) {
  const msgs = getMessages(locale);
  const fallback = getMessages("de");

  return function t(key: string, values?: Record<string, string | number>): string {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    const result = resolve(msgs, fullKey) ?? resolve(fallback, fullKey) ?? fullKey;
    return interpolate(repairMojibake(result), values);
  };
}

/** Detect browser locale and map to our supported locales. */
export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "de";
  const lang = navigator.language?.toLowerCase() || "";
  if (lang.startsWith("en")) return "en";
  if (lang.startsWith("de")) return "de";
  return "de"; // default
}
