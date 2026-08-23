/**
 * Kanonische Tabellen fuer den Kartengenerator, PHASE_6.
 *
 * Quellen: CONTENT_TABLES v1.1 Abschnitt 6 (Texturen und Zonen), BESTIARY v3
 * Abschnitt 7 (Fundorte der Waffen) und Abschnitt 10 (Sohlenplan). Die Werte
 * sind abgeschrieben, nicht aus dem Markdown gelesen.
 */

/** Sohlen mit Boss, BESTIARY Abschnitt 10. */
export const BOSS_DEPTHS: Record<number, string> = {
  4: 'boss_halvern',
  8: 'boss_sporemother',
  12: 'boss_rime',
  16: 'boss_sorlax',
};

export type Zone = {
  walls: number[];
  floors: number[];
  ceilings: number[];
  lamp: number;
  ambientLight: number;
  /** Farbe des Zonenschluessels, BESTIARY Abschnitt 10. */
  keyId: string;
  /** Lampenstaerke, fallend von 220 in Zone 1 auf 150 in Zone 4. */
  intensity: number;
};

/** CONTENT_TABLES Abschnitt 6, vier Zonen zu je vier Sohlen. */
export const ZONES: Record<number, Zone> = {
  1: {
    walls: [10, 11, 12, 13],
    floors: [40, 41, 42],
    ceilings: [70, 72],
    lamp: 71,
    ambientLight: 0.55,
    keyId: 'key_red',
    intensity: 220,
  },
  2: {
    walls: [14, 15, 16, 17],
    floors: [43, 44, 45],
    ceilings: [73, 75],
    lamp: 74,
    ambientLight: 0.4,
    keyId: 'key_green',
    intensity: 197,
  },
  3: {
    walls: [18, 19, 20, 21],
    floors: [46, 47, 48],
    ceilings: [76, 78],
    lamp: 77,
    ambientLight: 0.45,
    keyId: 'key_blue',
    intensity: 173,
  },
  4: {
    walls: [22, 23, 24, 25],
    floors: [49, 50, 51],
    ceilings: [79, 81],
    lamp: 80,
    ambientLight: 0.25,
    keyId: 'key_violet',
    intensity: 150,
  },
};

/** Stuetzpfeiler der Bossarena: der vierte Wandtyp jeder Zone. */
export const PILLAR_INDEX = 3;

export type TraceSet = { start: number; straight: number; curve: number; end: number };

/**
 * Bodenspuren, CONTENT_TABLES Abschnitt 6.
 *
 * Ab Zone 2 die Blutspur mit ihren vier Teilen. Zone 1 hat keine eigenen
 * Anfangs- und Endstuecke; dort steht der Oelfleck 64 an beiden Enden der
 * Staubspur. Das ist als Luecke gemeldet.
 */
export const BLOOD_TRACE: TraceSet = { start: 62, straight: 60, curve: 61, end: 63 };
export const DUST_TRACE: TraceSet = { start: 64, straight: 65, curve: 66, end: 64 };

/** Alle Textur-Ids aus Abschnitt 6, fuer die Pruefung des Validators. */
export const KNOWN_TEXTURES: ReadonlySet<number> = new Set([
  ...Object.values(ZONES).flatMap((zone) => [...zone.walls, ...zone.floors, ...zone.ceilings, zone.lamp]),
  BLOOD_TRACE.start,
  BLOOD_TRACE.straight,
  BLOOD_TRACE.curve,
  BLOOD_TRACE.end,
  DUST_TRACE.start,
  DUST_TRACE.straight,
  DUST_TRACE.curve,
]);

/** Zone einer Sohle: vier Sohlen je Zone. */
export function zoneOf(depth: number): Zone {
  const zone = ZONES[Math.min(4, Math.ceil(depth / 4))];
  if (zone === undefined) throw new Error(`keine Zone fuer Sohle ${depth}`);
  return zone;
}

/** BESTIARY Abschnitt 7, Spalte Fundort. Bosswaffen liegen nicht auf der Karte. */
export const WEAPON_FINDS: Record<number, string> = {
  2: 'item_w_pistol',
  5: 'item_w_shotgun',
  7: 'item_w_riveter',
  10: 'item_w_rod',
  14: 'item_w_charger',
};

/** Die vier Zonenschluessel als Gegenstaende, BESTIARY Abschnitt 10. */
export const KEY_ITEMS: Record<string, string> = {
  key_red: 'Roter Schlüssel',
  key_green: 'Grüner Schlüssel',
  key_blue: 'Blauer Schlüssel',
  key_violet: 'Violetter Schlüssel',
};

/** Kartengroesse nach Tiefe, PHASE_6 Block 1. Bosskarten sind fest 32 x 32. */
export function sizeFor(depth: number): number {
  return BOSS_DEPTHS[depth] !== undefined ? 32 : Math.min(44, 28 + depth);
}

/** Fester Seed je Sohle, PHASE_6 Block 1. */
export function seedFor(depth: number): number {
  return 0x50524c + depth * 7919;
}
