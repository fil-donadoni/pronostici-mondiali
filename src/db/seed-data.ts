/**
 * Dataset UFFICIALE: 48 nazionali del sorteggio finale FIFA World Cup 2026
 * (Washington, 5 dic 2025), distribuite nei 12 gironi A..L nell'ordine di
 * posizione del sorteggio (pos. 1..4).
 *
 * Fonte: sorteggio finale FIFA / Wikipedia "2026 FIFA World Cup draw".
 * Usato quando FOOTBALL_DATA_API_KEY non è impostata.
 */
export const FALLBACK_TEAMS: { id: string; name: string; group: string }[] = [
  // Girone A
  { id: "MEX", name: "Messico", group: "A" },
  { id: "RSA", name: "Sudafrica", group: "A" },
  { id: "KOR", name: "Corea del Sud", group: "A" },
  { id: "CZE", name: "Rep. Ceca", group: "A" },
  // Girone B
  { id: "CAN", name: "Canada", group: "B" },
  { id: "BIH", name: "Bosnia ed Erzegovina", group: "B" },
  { id: "QAT", name: "Qatar", group: "B" },
  { id: "SUI", name: "Svizzera", group: "B" },
  // Girone C
  { id: "BRA", name: "Brasile", group: "C" },
  { id: "MAR", name: "Marocco", group: "C" },
  { id: "HAI", name: "Haiti", group: "C" },
  { id: "SCO", name: "Scozia", group: "C" },
  // Girone D
  { id: "USA", name: "Stati Uniti", group: "D" },
  { id: "PAR", name: "Paraguay", group: "D" },
  { id: "AUS", name: "Australia", group: "D" },
  { id: "TUR", name: "Turchia", group: "D" },
  // Girone E
  { id: "GER", name: "Germania", group: "E" },
  { id: "CUW", name: "Curaçao", group: "E" },
  { id: "CIV", name: "Costa d'Avorio", group: "E" },
  { id: "ECU", name: "Ecuador", group: "E" },
  // Girone F
  { id: "NED", name: "Paesi Bassi", group: "F" },
  { id: "JPN", name: "Giappone", group: "F" },
  { id: "SWE", name: "Svezia", group: "F" },
  { id: "TUN", name: "Tunisia", group: "F" },
  // Girone G
  { id: "BEL", name: "Belgio", group: "G" },
  { id: "EGY", name: "Egitto", group: "G" },
  { id: "IRN", name: "Iran", group: "G" },
  { id: "NZL", name: "Nuova Zelanda", group: "G" },
  // Girone H
  { id: "ESP", name: "Spagna", group: "H" },
  { id: "CPV", name: "Capo Verde", group: "H" },
  { id: "KSA", name: "Arabia Saudita", group: "H" },
  { id: "URU", name: "Uruguay", group: "H" },
  // Girone I
  { id: "FRA", name: "Francia", group: "I" },
  { id: "SEN", name: "Senegal", group: "I" },
  { id: "IRQ", name: "Iraq", group: "I" },
  { id: "NOR", name: "Norvegia", group: "I" },
  // Girone J
  { id: "ARG", name: "Argentina", group: "J" },
  { id: "ALG", name: "Algeria", group: "J" },
  { id: "AUT", name: "Austria", group: "J" },
  { id: "JOR", name: "Giordania", group: "J" },
  // Girone K
  { id: "POR", name: "Portogallo", group: "K" },
  { id: "COD", name: "RD Congo", group: "K" },
  { id: "UZB", name: "Uzbekistan", group: "K" },
  { id: "COL", name: "Colombia", group: "K" },
  // Girone L
  { id: "ENG", name: "Inghilterra", group: "L" },
  { id: "CRO", name: "Croazia", group: "L" },
  { id: "GHA", name: "Ghana", group: "L" },
  { id: "PAN", name: "Panama", group: "L" },
];
