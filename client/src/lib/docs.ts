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
Klicke auf "Mit Discord anmelden" auf der Login-Seite. Du musst Mitglied des konfigurierten Discord-Servers sein und eine der freigegebenen Rollen besitzen, um Zugang zu erhalten. Nach erfolgreicher Authentifizierung wirst du automatisch weitergeleitet.

## Dashboard
Nach dem Login landest du auf dem Dashboard. Hier siehst du auf einen Blick:
- **Anstehende Trainings** — die nächsten geplanten Sessions mit Datum und Typ
- **Kommende Matches** — bevorstehende Spiele mit Gegner und Wettbewerb
- **Aktuelle Ankündigungen** — wichtige Team-News, angepinnte zuerst
- **Offene Umfragen** — Umfragen die auf deine Stimme warten
- **Verfügbarkeits-Übersicht** — wann sind die meisten Spieler da
- **Admin-Statistiken** — Admins sehen zusätzlich Nutzerzahlen, Speicherverbrauch und API-Anfragen

## Navigation
Die Sidebar links führt dich zu allen Bereichen der App. Auf Mobilgeräten öffnest du sie über das Menü-Icon oben links. Die Sidebar ist in zwei Bereiche aufgeteilt: oben die Hauptnavigation mit allen Features, unten Wiki, Changelog und Einstellungen.

## Globale Suche
In der Kopfzeile findest du die globale Suche (mindestens 2 Zeichen). Sie durchsucht gleichzeitig Trainings, Matches, Strategien, Wiki-Seiten und Spieler. Klicke auf ein Ergebnis um direkt dorthin zu navigieren.

## Sprache
Die App unterstützt mehrere Sprachen (Deutsch, English, Piratensprache). Du kannst die Sprache über das Dropdown im Header wechseln.`,
  },
  {
    id: "training",
    title: "Training",
    content: `## Training erstellen
Coaches und höher können Trainings erstellen. Fülle folgende Felder aus:
- **Typ** — Ranked, Custom, Aim Training, VOD Review oder Strat Practice
- **Datum & Uhrzeit** — wann das Training stattfindet
- **Dauer** — geplante Dauer in Minuten
- **Notizen** — optionale Beschreibung oder Agenda

## Vorlagen
Häufig verwendete Training-Konfigurationen können als Vorlage gespeichert werden. So lässt sich ein neues Training mit einem Klick aus einer Vorlage erstellen. Vorlagen können im Vorlagen-Manager angesehen und gelöscht werden.

## Abstimmung
Jedes Teammitglied kann seine Verfügbarkeit für ein Training angeben:
- **Verfügbar** — du bist dabei
- **Nicht verfügbar** — du kannst nicht
- **Vielleicht** — du bist unsicher
Du kannst deine Stimme jederzeit ändern oder zurückziehen, indem du erneut auf deine aktuelle Auswahl klickst.

## Erinnerungen
Automatische E-Mail/WhatsApp-Erinnerungen werden vor dem Training verschickt. Der Zeitpunkt ist in den Team-Einstellungen konfigurierbar.

## Kommentare
Unter jedem Training können Kommentare hinterlassen werden — z.B. für Rückfragen oder Feedback.`,
  },
  {
    id: "matches",
    title: "Matches",
    content: `## Übersicht
Alle Matches werden zentral verwaltet. Es gibt fünf Match-Typen:
- **Scrim** — Übungsspiele gegen andere Teams
- **Turnier** — Turnierspiele mit Pflichtfeldern für Wettbewerb und Score
- **Liga** — Ligaspiele mit Pflichtfeldern
- **Freundschaftlich** — lockere Spiele
- **Sonstige** — alles andere

## Match erstellen
Wähle den Typ und fülle die entsprechenden Felder aus. Je nach Typ sind unterschiedliche Felder verfügbar:
- **Scrim** — Map-Pool, Format (BO1/BO3/BO5), Kontaktinfos, Server-Region, Treffzeit
- **Turnier/Liga** — Map, Score (Pflicht), Wettbewerb (Pflicht)
- **Alle Typen** — Gegner, Datum, Notizen

## Abstimmung
Bei Scrims kann jedes Teammitglied seine Verfügbarkeit angeben. Stimmen können geändert oder durch erneutes Klicken zurückgezogen werden.

## Ergebnis eintragen
Für Matches ohne initiales Ergebnis kann der Score nachträglich eingetragen werden inkl. Map-Scores. Zusätzlich können Bewertungen vergeben werden:
- **Skill-Bewertung** — Gesamtleistung des Teams (1-5)
- **Kommunikation** — wie gut war die Kommunikation (1-5)
- **Pünktlichkeit** — waren alle rechtzeitig da (1-5)

## Spieler-Statistiken
Pro Match und Map können für jeden Spieler individuelle Stats eingetragen werden:
- **Kills, Deaths, Assists** — K/D wird automatisch berechnet
- **Headshots** — Headshot-Rate wird automatisch berechnet

## Match Review
Nach dem Match kann ein detailliertes Review erstellt werden mit:
- **Positives** — was gut gelaufen ist
- **Negatives** — was schlecht gelaufen ist
- **Verbesserungen** — konkrete Punkte zur Verbesserung
- **Notizen** — weitere Anmerkungen

## Statistiken & Analyse
Die Match-Liste zeigt aggregierte Statistiken:
- **Winrate** — Siegquote nach Typ gefiltert
- **Map-Statistiken** — Siege/Niederlagen pro Map
- **Gegner-Statistiken** — Bilanz gegen bestimmte Gegner

## Typ-Filter
Die Match-Liste kann nach Typ gefiltert werden. Alle Statistiken passen sich dem aktiven Filter an.

## Kommentare
Jedes Match hat einen Kommentarbereich für Diskussionen und Nachbesprechung.`,
  },
  {
    id: "strats",
    title: "Strategien",
    content: `## Strats erstellen
Erstelle Strategien für bestimmte Maps und Sites. Wähle:
- **Map** — auf welcher Map die Strat gespielt wird
- **Site** — welcher Bombsite (z.B. A, B, Basement)
- **Seite** — Attack oder Defense
- **Typ** — Default, Anti-Strat, Retake, Post-Plant, Rush oder Slow Execute
- **Beschreibung** — detaillierte Erklärung der Strategie

## Dateien & Medien
Lade Bilder, Zeichnungen oder andere Dateien hoch um Strats visuell darzustellen. Alle Dateien werden mit AES-256-GCM verschlüsselt auf dem Server gespeichert.

## Versionierung
Jede Änderung an einer Strategie erstellt automatisch eine neue Version. Du kannst jederzeit ältere Versionen einsehen — so geht nichts verloren.

## Favoriten
Markiere häufig benötigte Strats als Favorit (Stern-Symbol) für schnellen Zugriff. Favoriten werden in der Liste hervorgehoben.

## Playbooks
Fasse mehrere Strats zu einem Playbook zusammen, z.B. für ein bestimmtes Match-Szenario oder einen Gegner. Ein Playbook kann beliebig viele Strats enthalten.

## Kommentare
Jede Strategie hat einen Kommentarbereich für Feedback und Verbesserungsvorschläge.`,
  },
  {
    id: "lineup",
    title: "Lineups",
    content: `## Lineup erstellen
Erstelle Lineups für Map/Side-Kombinationen. Für jeden Spieler kannst du festlegen:
- **Rolle** — die Spieler-Rolle (z.B. Entry, Support, Flex)
- **Operator** — welcher Operator gespielt wird
- **Position** — wo der Spieler steht/anfängt

## Übersicht
Sieh auf einen Blick welche Spieler auf welcher Map welche Rolle spielen. Lineups helfen bei der Planung und stellen sicher, dass jeder seine Aufgabe kennt.

## Kommentare
Auch Lineups haben einen Kommentarbereich für Diskussionen und Anpassungsvorschläge.`,
  },
  {
    id: "scouting",
    title: "Scouting",
    content: `## Gegner anlegen
Lege Gegner-Teams an mit:
- **Name** — vollständiger Teamname
- **Tag** — Kurzbezeichnung (z.B. Clan-Tag)
- **Bedrohungslevel** — Low, Medium, High oder Critical
- **Allgemeine Infos** — Spielstil, Stärken, Schwächen

## Scouting-Notizen
Für jeden Gegner können detaillierte, map-spezifische Scouting-Notizen erstellt werden:
- **Map** — auf welche Map bezieht sich die Notiz
- **Kategorie** — z.B. Defaults, Tendencies, Weaknesses
- **Inhalt** — detaillierte Beobachtungen

## Bedrohungslevel
Die farbliche Markierung gibt eine schnelle Einschätzung der Stärke des Gegners:
- **Low** — Gegner unter eurem Niveau
- **Medium** — gleichwertig
- **High** — starker Gegner, Vorbereitung nötig
- **Critical** — Top-Team, intensive Vorbereitung Pflicht`,
  },
  {
    id: "replays",
    title: "Replays",
    content: `## Upload
Lade einzelne .rec Replay-Dateien oder ZIP-Archive mit mehreren Runden hoch. Optional kannst du sie einem Match zuordnen für verknüpfte Statistiken.

## Automatisches Parsing
Rainbow Six Siege .rec Dateien werden automatisch geparst:
- **Runden-Erkennung** — jede Runde wird einzeln analysiert
- **Kill-Tracking** — Kills, Deaths und Headshots pro Spieler und Runde
- **Zeitstempel** — wann was passiert ist

## Spieler-Zuordnung
Der Parser erkennt R6-Usernamen. Du kannst diese manuell Team-Mitgliedern zuordnen. Bei Zuordnung zu einem Match fließen die Stats automatisch in die Match-Statistiken ein.

## Tags
Runden können mit Tags versehen werden für späteres Filtern:
- z.B. "Clutch", "Eco-Runde", "Ace", "Pistol Round"
- Tags helfen beim schnellen Finden interessanter Situationen

## Download
Alle Replay-Dateien können jederzeit entschlüsselt heruntergeladen werden. Die Verschlüsselung passiert transparent — beim Download erhältst du die Originaldatei.`,
  },
  {
    id: "moss",
    title: "MOSS-Dateien",
    content: `## Was ist MOSS?
MOSS (Multi-Overt Surveillance Software) ist eine Anti-Cheat-Lösung die Screenshots und Prozess-Überwachung während Matches aufzeichnet. Viele Turniere und Ligen erfordern MOSS-Dateien als Nachweis.

## Upload
Lade MOSS-Dateien (.zip) pro Match hoch. Sie werden verschlüsselt gespeichert und können bei Bedarf heruntergeladen werden.

## Zuordnung
Jede MOSS-Datei ist einem Match zugeordnet. Über die Match-Detailseite findest du alle zugehörigen MOSS-Dateien.

## Verschlüsselung
Wie alle Uploads werden auch MOSS-Dateien mit AES-256-GCM verschlüsselt auf dem Server abgelegt.`,
  },
  {
    id: "polls",
    title: "Umfragen",
    content: `## Umfrage erstellen
Erstelle Umfragen mit beliebig vielen Optionen. Konfigurierbare Einstellungen:
- **Mehrfachauswahl** — ob Spieler mehrere Optionen wählen dürfen
- **Ablaufdatum** — nach Ablauf kann nicht mehr abgestimmt werden
- **Optionen** — beliebig viele Antwortmöglichkeiten

## Abstimmen
Klicke auf eine Option um abzustimmen. Ergebnisse werden in Echtzeit angezeigt:
- **Prozent-Balken** — visuelle Darstellung der Verteilung
- **Stimmenanzahl** — wie viele Spieler jede Option gewählt haben
Du kannst deine Stimme ändern oder durch erneutes Klicken zurückziehen.

## Ablauf
Abgelaufene Umfragen werden automatisch als beendet markiert. Ergebnisse bleiben sichtbar, aber es kann nicht mehr abgestimmt werden.`,
  },
  {
    id: "announcements",
    title: "Ankündigungen",
    content: `## Ankündigung erstellen
Coaches und höher können Ankündigungen für das Team erstellen:
- **Titel** — kurze Überschrift
- **Inhalt** — detaillierte Nachricht
- **Anpinnen** — wichtige Ankündigungen erscheinen immer oben
- **Ablaufdatum** — optional, nach Ablauf wird die Ankündigung ausgeblendet

## Bestätigung
Teammitglieder können Ankündigungen als gelesen markieren. So sieht der Ersteller wer die Nachricht bereits gesehen hat.

## Sortierung
Angepinnte Ankündigungen erscheinen immer zuerst, danach wird nach Erstellungsdatum sortiert (neueste zuerst).`,
  },
  {
    id: "wiki",
    title: "Wiki",
    content: `## Seiten erstellen
Analysten und höher können Wiki-Seiten erstellen. Jede Seite hat:
- **Titel** — Name der Seite
- **Slug** — URL-freundlicher Name (wird automatisch generiert, kann manuell angepasst werden)
- **Inhalt** — der Seiteninhalt

## Bearbeiten
Seiten können jederzeit bearbeitet werden. Der letzte Bearbeiter und das Änderungsdatum werden angezeigt.

## Verwendung
Das Wiki eignet sich für:
- Team-Regeln und Verhaltensregeln
- Tutorials und Guides
- Wichtige Links und Ressourcen
- Dauerhaftes Wissen das nicht verloren gehen soll

## Löschen
Nur Admins können Wiki-Seiten löschen.`,
  },
  {
    id: "notes",
    title: "Notizen",
    content: `## Erstellen
Jedes Teammitglied kann Notizen erstellen. Wähle die Sichtbarkeit:
- **Privat** — nur für dich sichtbar (z.B. persönliche Match-Notizen)
- **Team** — für alle Teammitglieder sichtbar (z.B. geteilte Erkenntnisse)

## Bearbeiten/Löschen
Du kannst nur eigene Notizen bearbeiten und löschen. Admins haben Zugriff auf alle Notizen im Team.

## Verwendung
Notizen eignen sich für schnelle Gedanken, die nicht in eine andere Kategorie passen — z.B. Beobachtungen während eines Streams, Ideen für neue Strats, oder persönliche Verbesserungsziele.`,
  },
  {
    id: "reminders",
    title: "Erinnerungen",
    content: `## Erstellen
Coaches und höher können Erinnerungen für das Team erstellen:
- **Titel** — worum geht es
- **Details** — optionale ausführliche Beschreibung
- **Deadline** — bis wann soll es erledigt sein

## Abhaken
Jedes Teammitglied kann Erinnerungen als erledigt markieren. Der Status wird für jeden Spieler individuell getrackt.

## Überfällig
Erinnerungen deren Deadline überschritten ist werden rot hervorgehoben, damit nichts übersehen wird.`,
  },
  {
    id: "availability",
    title: "Verfügbarkeit",
    content: `## Eigene Zeiten eintragen
Klicke auf Zeitslots im Wochen-Raster um deine Verfügbarkeit einzutragen. Grüne Felder = verfügbar. Vergiss nicht zu speichern nach Änderungen.

## Team-Heatmap
Wechsle zum "Team"-Tab um die Team-Übersicht zu sehen:
- **Heatmap** — dunklere Felder bedeuten mehr verfügbare Spieler
- **Optimale Zeiten** — finde auf einen Blick wann die meisten Spieler da sind
- **Planung** — nutze die Heatmap um Trainings und Scrims optimal zu planen

## Tipps
- Aktualisiere deine Verfügbarkeit regelmäßig (idealerweise wöchentlich)
- Sei ehrlich bei "Vielleicht" — lieber ehrlich als unzuverlässig
- Coaches können die Team-Heatmap nutzen um optimale Trainingszeiten zu finden`,
  },
  {
    id: "roles",
    title: "Rollen & Berechtigungen",
    content: `## Rollen-Hierarchie
Die Rollen bestimmen, was du in der App tun kannst (aufsteigend):
- **Tryout** — Eingeschränkter Zugang, kann an Abstimmungen teilnehmen und eigene Notizen erstellen
- **Player** — Standard-Zugang, kann Notizen erstellen, abstimmen und Kommentare schreiben
- **Analyst** — Kann zusätzlich Strats und Wiki-Seiten erstellen und bearbeiten
- **Coach** — Kann Trainings, Matches, Erinnerungen und Vorlagen verwalten, Ankündigungen erstellen
- **Leader** — Erweiterte Rechte, kann Lineups erstellen und Scouting-Infos pflegen
- **Admin** — Voller Zugriff auf alles inkl. Team-Einstellungen und Mitgliederverwaltung

## Admin-Zugang
Admin-Zugang wird ausschließlich über Discord konfiguriert — NICHT über die App-Oberfläche:
- **ADMIN_ROLE_IDS** — Discord-Rollen die automatisch Admin-Zugang erhalten
- **ADMIN_USER_IDS** — Discord-User-IDs die immer Admin-Zugang haben
- **Erster User** — der erste User der sich einloggt wird automatisch Admin

## Team-Rollen
Team-Rollen (Tryout bis Leader) können von Admins in den Einstellungen unter "Mitglieder" zugewiesen werden.`,
  },
  {
    id: "search",
    title: "Suche",
    content: `## Globale Suche
Die Suchfunktion in der Kopfzeile durchsucht alle Bereiche gleichzeitig:
- **Trainings** — nach Typ und Notizen
- **Matches** — nach Gegner und Wettbewerb
- **Strategien** — nach Map, Site und Beschreibung
- **Wiki-Seiten** — nach Titel und Inhalt
- **Spieler** — nach Anzeigename

## Verwendung
- Mindestens 2 Zeichen eingeben um die Suche zu starten
- Ergebnisse werden nach Kategorie gruppiert angezeigt
- Klicke auf ein Ergebnis um direkt zur entsprechenden Seite zu navigieren
- Die Suche aktualisiert sich automatisch während du tippst (300ms Verzögerung)`,
  },
  {
    id: "security",
    title: "Sicherheit",
    content: `## Datei-Verschlüsselung
Alle hochgeladenen Dateien werden mit AES-256-GCM verschlüsselt auf dem Server gespeichert:
- **Strat-Dateien** — Bilder und Dokumente zu Strategien
- **Replays** — .rec Dateien und ZIP-Archive
- **MOSS-Dateien** — Anti-Cheat Nachweise
Downloads werden automatisch entschlüsselt — die Verschlüsselung ist für den User transparent.

## Discord-Authentifizierung
Login läuft ausschließlich über Discord OAuth 2.0:
- **Keine Passwörter** — es werden keine Passwörter in der App gespeichert
- **Server-Bindung** — nur Mitglieder des konfigurierten Discord-Servers haben Zugang
- **Rollen-Bindung** — Zugang kann auf bestimmte Discord-Rollen eingeschränkt werden

## Sessions & Tokens
- **Access-Token** — läuft nach 7 Tagen ab
- **Refresh-Token** — läuft nach 30 Tagen ab
- **httpOnly Cookies** — Tokens sind nicht per JavaScript auslesbar
- **Automatische Erneuerung** — abgelaufene Access-Tokens werden automatisch über den Refresh-Token erneuert

## Datenexport
Admins können Team-Daten als CSV oder JSON exportieren (Matches, Training-Attendance, Verfügbarkeit) über die Einstellungen.`,
  },
];
