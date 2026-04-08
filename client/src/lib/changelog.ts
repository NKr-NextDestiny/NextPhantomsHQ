export interface ChangelogEntry {
  version: string;
  date: string;
  tags: ("feature" | "fix" | "improvement" | "breaking")[];
  title: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: "0.1.0",
    date: "2026-04-08",
    tags: ["feature"],
    title: "Initial Release",
    changes: [
      "Discord OAuth Login mit Guild/Rollen/User-ID Zugriffskontrolle",
      "Training-Verwaltung mit Vorlagen, Abstimmungen und Erinnerungen",
      "Scrim-Management mit Ergebnissen und Bewertungen",
      "Match-Tracking mit Spieler-Statistiken und Reviews",
      "Strategien-System mit Versionierung und Playbooks",
      "Lineup-Builder fuer Map/Side-Kombinationen",
      "Gegner-Scouting mit Bedrohungslevel und Notizen",
      "R6 Siege Replay-Parser (.rec Dateien, ZIP-Upload, Kill-Erkennung)",
      "MOSS-Dateien Upload und Verwaltung pro Match",
      "Umfragen mit Mehrfachauswahl und Ablaufdatum",
      "Ankuendigungen mit Pin-Funktion",
      "Team-Wiki fuer Wissensdatenbank",
      "Persoenliche und Team-Notizen mit Privat-Modus",
      "Erinnerungen und Deadlines mit Ueberfaellig-Anzeige",
      "Verfuegbarkeits-Heatmap fuer das ganze Team",
      "Globale Suche ueber alle Bereiche",
      "AES-256-GCM Dateiverschluesselung fuer alle Uploads",
      "E-Mail-Benachrichtigungen (SMTP) und Discord-Webhooks",
      "Echtzeit-Updates via Socket.io",
      "Responsive Dark-Theme mit Orange-Akzent",
    ],
  },
];
