export interface AuditLikeEntry {
  action: string;
  entity: string;
  details?: Record<string, unknown> | null;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  entity: string;
  message: string;
  createdAt: string;
  user?: { displayName: string };
}

const NORMAL_VISIBLE_ENTITIES = new Set([
  "training",
  "match",
  "match_result",
  "announcement",
  "poll",
  "poll_result",
  "reminder",
  "lineup",
  "opponent",
  "strat",
  "replay",
  "moss_file",
  "note",
  "wiki_page",
]);

function readDetail(details: Record<string, unknown> | null | undefined, key: string) {
  const value = details?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function canSeeAuditEntity(entity: string, isAdmin: boolean) {
  return isAdmin || NORMAL_VISIBLE_ENTITIES.has(entity);
}

export function formatAuditMessage(entry: AuditLikeEntry) {
  const entity = entry.entity;
  const details = entry.details ?? undefined;

  switch (entity) {
    case "training":
      return entry.action === "DELETE"
        ? `Training gelöscht${readDetail(details, "title") ? `: ${readDetail(details, "title")}` : ""}`
        : entry.action === "UPDATE"
          ? "Training aktualisiert"
          : `Training erstellt${readDetail(details, "title") ? `: ${readDetail(details, "title")}` : ""}`;
    case "match":
      return entry.action === "DELETE"
        ? `Match gelöscht${readDetail(details, "opponent") ? `: vs ${readDetail(details, "opponent")}` : ""}`
        : entry.action === "UPDATE"
          ? "Match aktualisiert"
          : `Match erstellt${readDetail(details, "opponent") ? `: vs ${readDetail(details, "opponent")}` : ""}`;
    case "match_result":
      return "Match-Ergebnis eingetragen";
    case "announcement":
      return entry.action === "DELETE" ? "Ankündigung gelöscht" : entry.action === "UPDATE" ? "Ankündigung aktualisiert" : "Ankündigung erstellt";
    case "poll":
      return entry.action === "DELETE" ? "Umfrage gelöscht" : entry.action === "UPDATE" ? "Umfrage aktualisiert" : "Umfrage erstellt";
    case "poll_result":
      return "Umfrage-Ergebnisse gesendet";
    case "reminder":
      return entry.action === "DELETE" ? "Erinnerung gelöscht" : entry.action === "UPDATE" ? "Erinnerung aktualisiert" : "Erinnerung erstellt";
    case "lineup":
      return entry.action === "DELETE" ? "Lineup gelöscht" : entry.action === "UPDATE" ? "Lineup aktualisiert" : "Lineup erstellt";
    case "opponent":
      return entry.action === "DELETE" ? "Scouting-Eintrag gelöscht" : entry.action === "UPDATE" ? "Scouting-Eintrag aktualisiert" : "Scouting-Eintrag erstellt";
    case "strat":
      return entry.action === "DELETE" ? "Strategie gelöscht" : entry.action === "UPDATE" ? "Strategie aktualisiert" : "Strategie erstellt";
    case "replay":
    case "Replay":
      return entry.action === "DELETE" ? "Replay gelöscht" : "Replay hochgeladen";
    case "moss_file":
      return entry.action === "DELETE" ? "MOSS-Datei gelöscht" : "MOSS-Datei hochgeladen";
    case "note":
      return entry.action === "DELETE" ? "Notiz gelöscht" : entry.action === "UPDATE" ? "Notiz aktualisiert" : "Notiz erstellt";
    case "wiki_page":
      return entry.action === "DELETE" ? "Wiki-Seite gelöscht" : entry.action === "UPDATE" ? "Wiki-Seite aktualisiert" : "Wiki-Seite erstellt";
    case "whatsapp_command_post":
      return "Befehlsliste in WhatsApp gepostet";
    case "group_description":
      return "WhatsApp-Gruppenbeschreibung aktualisiert";
    case "team":
      return "Team-Einstellungen aktualisiert";
    case "team_member":
      return "Mitglieds-Einstellungen aktualisiert";
    case "game_config":
      return "Spielkonfiguration aktualisiert";
    case "user":
      return "Admin- oder Benutzerstatus geändert";
    default:
      return `${entry.entity} ${entry.action.toLowerCase()}`;
  }
}
