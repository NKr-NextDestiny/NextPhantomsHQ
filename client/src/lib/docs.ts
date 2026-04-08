export interface DocSection {
  id: string;
  title: string;
  content: string;
}

export const docs: DocSection[] = [
  {
    id: "getting-started",
    title: "Erste Schritte",
    content: `## Login
Klicke auf "Mit Discord anmelden" auf der Login-Seite. Du musst Mitglied des konfigurierten Discord-Servers sein um Zugang zu erhalten.

## Dashboard
Nach dem Login landest du auf dem Dashboard. Hier siehst du eine Uebersicht ueber anstehende Trainings, Scrims und aktuelle Ankuendigungen.

## Navigation
Die Sidebar links fuehrt dich zu allen Bereichen. Auf Mobilgeraeten oeffnest du sie ueber das Menu-Icon oben links.`,
  },
  {
    id: "training",
    title: "Training",
    content: `## Training erstellen
Coaches und hoeher koennen Trainings erstellen. Waehle Typ (Ranked, Custom, Aim Training, VOD Review, Strat Practice), Datum und optionale Notizen.

## Vorlagen
Haeufig verwendete Training-Konfigurationen koennen als Vorlage gespeichert werden. So laesst sich ein neues Training schnell aus einer Vorlage erstellen.

## Abstimmung
Jedes Teammitglied kann seine Verfuegbarkeit fuer ein Training angeben: Verfuegbar, Nicht verfuegbar oder Vielleicht. Die Uebersicht zeigt wer dabei ist.

## Erinnerungen
Automatische E-Mail-Erinnerungen werden vor dem Training verschickt (konfigurierbar).`,
  },
  {
    id: "scrims",
    title: "Scrims",
    content: `## Scrim erstellen
Coaches erstellen Scrims mit Gegner, Datum, Map-Pool, Format und optionalen Kontaktinfos.

## Abstimmung
Wie beim Training kann jeder seine Verfuegbarkeit angeben.

## Ergebnis eintragen
Nach dem Scrim kann das Ergebnis (Score, Maps, Bewertungen) eingetragen werden. Skill-, Kommunikations- und Puenktlichkeits-Bewertungen helfen bei der Nachbereitung.`,
  },
  {
    id: "matches",
    title: "Matches",
    content: `## Match erstellen
Trage Matches mit Gegner, Map, Score und Ergebnis ein. Optional: Competition, Operator-Bans, Overtime.

## Spieler-Statistiken
Pro Match koennen Kills, Deaths, Assists und Headshots fuer jeden Spieler eingetragen werden. K/D und Headshot-Rate werden automatisch berechnet.

## Match Review
Nach dem Match kann ein Review erstellt werden mit Positives, Negatives, Verbesserungen und Notizen fuer die Nachbesprechung.`,
  },
  {
    id: "strats",
    title: "Strategien",
    content: `## Strats erstellen
Erstelle Strategien fuer bestimmte Maps und Sites. Waehle Seite (Attack/Defense) und Typ (Default, Anti-Strat, Retake, Post-Plant, Rush, Slow Execute).

## Dateien
Lade Bilder oder Dateien hoch um Strats visuell darzustellen. Alle Dateien werden verschluesselt gespeichert.

## Versionierung
Aenderungen an einer Strategie erstellen automatisch eine neue Version. So gehen aeltere Versionen nicht verloren.

## Playbooks
Fasse mehrere Strats zu einem Playbook zusammen fuer bestimmte Match-Szenarien.`,
  },
  {
    id: "lineup",
    title: "Lineups",
    content: `## Lineup erstellen
Erstelle Lineups fuer Map/Side-Kombinationen. Weise Spielern Rollen und Operators zu.

## Uebersicht
Sieh auf einen Blick welche Spieler auf welcher Map welche Rolle spielen.`,
  },
  {
    id: "scouting",
    title: "Scouting",
    content: `## Gegner anlegen
Lege Gegner-Teams mit Name, Tag, Bedrohungslevel und allgemeinen Infos an.

## Scouting-Notizen
Fuer jeden Gegner koennen Map-spezifische Scouting-Notizen erstellt werden. Kategorisiere sie fuer bessere Uebersicht.

## Bedrohungslevel
Bewerte Gegner als Low, Medium, High oder Critical fuer eine schnelle Einschaetzung.`,
  },
  {
    id: "replays",
    title: "Replays",
    content: `## Upload
Lade einzelne .rec Dateien oder ZIP-Archive mit mehreren Runden hoch. Optional kannst du sie einem Match zuordnen.

## Automatisches Parsing
R6 Siege .rec Dateien werden automatisch geparst. Kills, Deaths und Headshots werden pro Runde und Spieler erkannt.

## Spieler-Zuordnung
Der Parser erkennt R6-Usernamen. Du kannst diese manuell Team-Mitgliedern zuordnen. Bei Zuordnung zu einem Match fliessen die Stats in die Match-Statistiken ein.

## Tags
Runden koennen mit Tags versehen werden (z.B. "Clutch", "Eco-Runde") fuer spaeteres Filtern.

## Download
Alle Dateien koennen jederzeit entschluesselt heruntergeladen werden.`,
  },
  {
    id: "moss",
    title: "MOSS-Dateien",
    content: `## Upload
Lade MOSS-Dateien pro Match hoch. Sie werden verschluesselt gespeichert und koennen bei Bedarf heruntergeladen werden.

## Zuordnung
Jede MOSS-Datei ist einem Match zugeordnet fuer einfache Nachverfolgung.`,
  },
  {
    id: "polls",
    title: "Umfragen",
    content: `## Umfrage erstellen
Erstelle Umfragen mit beliebig vielen Optionen. Optional: Mehrfachauswahl und Ablaufdatum.

## Abstimmen
Klicke auf eine Option um abzustimmen. Ergebnisse werden in Echtzeit angezeigt mit Prozent-Balken.`,
  },
  {
    id: "announcements",
    title: "Ankuendigungen",
    content: `## Ankuendigung erstellen
Erstelle Ankuendigungen fuer das Team. Wichtige Ankuendigungen koennen angepinnt werden.

## Ablaufdatum
Optional kann ein Ablaufdatum gesetzt werden, nach dem die Ankuendigung automatisch ausgeblendet wird.

## Bestätigung
Teammitglieder koennen Ankuendigungen als gelesen markieren.`,
  },
  {
    id: "wiki",
    title: "Wiki",
    content: `## Seiten erstellen
Analysten und hoeher koennen Wiki-Seiten erstellen. Jede Seite hat einen Titel, Slug (URL-freundlicher Name) und Inhalt.

## Bearbeiten
Seiten koennen jederzeit bearbeitet werden. Der letzte Bearbeiter wird angezeigt.

## Loeschen
Nur Admins koennen Wiki-Seiten loeschen.`,
  },
  {
    id: "notes",
    title: "Notizen",
    content: `## Erstellen
Jeder kann Notizen erstellen. Waehle ob die Notiz privat (nur fuer dich) oder fuer das ganze Team sichtbar sein soll.

## Bearbeiten/Loeschen
Du kannst nur eigene Notizen bearbeiten und loeschen. Admins haben Zugriff auf alle Notizen.`,
  },
  {
    id: "reminders",
    title: "Erinnerungen",
    content: `## Erstellen
Coaches und hoeher erstellen Erinnerungen mit Titel, optionalen Details und Deadline.

## Abhaken
Jeder kann Erinnerungen als erledigt markieren. Ueberfaellige Deadlines werden rot hervorgehoben.`,
  },
  {
    id: "availability",
    title: "Verfuegbarkeit",
    content: `## Eigene Zeiten eintragen
Klicke auf Zeitslots im Raster um deine Verfuegbarkeit einzutragen. Speichern nicht vergessen.

## Team-Heatmap
Wechsle zum "Team"-Tab um zu sehen wann die meisten Teammitglieder verfuegbar sind. Dunklere Felder = mehr verfuegbare Spieler.`,
  },
  {
    id: "roles",
    title: "Rollen & Berechtigungen",
    content: `## Rollen-Hierarchie
- **Tryout** — Eingeschraenkter Zugang, kann abstimmen
- **Player** — Standard-Zugang, kann Notizen erstellen, abstimmen
- **Analyst** — Kann Strats und Wiki-Seiten erstellen/bearbeiten
- **Coach** — Kann Trainings, Scrims, Erinnerungen und Vorlagen verwalten
- **Captain** — Erweiterte Rechte
- **Admin** — Voller Zugriff auf alles

## Admin-Zugang
Admin-Zugang wird ueber Discord konfiguriert:
- Bestimmte Discord-Rollen (ADMIN_ROLE_IDS)
- Bestimmte Discord-User-IDs (ADMIN_USER_IDS)
- Der erste User der sich einloggt wird automatisch Admin`,
  },
  {
    id: "search",
    title: "Suche",
    content: `## Globale Suche
Die Suchfunktion durchsucht Trainings, Scrims, Strategien, Matches, Spieler und Wiki-Seiten gleichzeitig. Mindestens 2 Zeichen eingeben.`,
  },
  {
    id: "security",
    title: "Sicherheit",
    content: `## Verschluesselung
Alle hochgeladenen Dateien (Strats, Replays, MOSS) werden mit AES-256-GCM verschluesselt auf dem Server gespeichert. Downloads werden automatisch entschluesselt.

## Discord-Auth
Login laeuft ausschliesslich ueber Discord OAuth. Es werden keine Passwoerter gespeichert. Zugang kann ueber Server-Mitgliedschaft und Rollen eingeschraenkt werden.

## Sessions
Login-Sessions laufen nach 7 Tagen ab, Refresh-Tokens nach 30 Tagen. Alle Tokens sind httpOnly-Cookies.`,
  },
];
