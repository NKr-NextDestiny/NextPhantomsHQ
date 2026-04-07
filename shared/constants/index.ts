export const GAME_PRESETS = {
  "Rainbow Six Siege": {
    maps: [
      "Bank", "Border", "Chalet", "Clubhouse", "Coastline", "Consulate",
      "Kafe Dostoyevsky", "Kanal", "Lair", "Nighthaven Labs", "Oregon",
      "Outback", "Skyscraper", "Theme Park", "Villa"
    ],
    characters: [
      // Attackers
      "Sledge", "Thatcher", "Ash", "Thermite", "Twitch", "Montagne",
      "Blitz", "IQ", "Buck", "Blackbeard", "Capitão", "Hibana",
      "Jackal", "Ying", "Zofia", "Dokkaebi", "Lion", "Finka",
      "Maverick", "Nomad", "Gridlock", "Nøkk", "Amaru", "Kali",
      "Iana", "Ace", "Zero", "Flores", "Osa", "Sens", "Grim",
      "Brava", "Ram", "Deimos", "Striker",
      // Defenders
      "Smoke", "Mute", "Castle", "Pulse", "Doc", "Rook", "Jäger",
      "Bandit", "Frost", "Valkyrie", "Caveira", "Echo", "Mira",
      "Lesion", "Ela", "Vigil", "Maestro", "Alibi", "Clash",
      "Kaid", "Mozzie", "Warden", "Goyo", "Wamai", "Oryx",
      "Melusi", "Aruni", "Thunderbird", "Thorn", "Azami", "Solis",
      "Fenrir", "Tubarão", "Skopos"
    ],
    characterLabel: "Operators",
    playerRoles: [
      "Entry", "Support", "Flex", "Hard Breach", "Anchor",
      "Roamer", "Intel", "Flank Watch"
    ],
  },
} as const;

export const DEFAULT_GAME = "Rainbow Six Siege";
