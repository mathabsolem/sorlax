/**
 * Typen aus docs/INTERFACES.md v1.1, Abschnitt 2 bis 9, woertlich uebernommen.
 * Dies ist die einzige Quelle fuer diese Typen. Keine Logik in dieser Datei.
 *
 * Die Verweise auf ImageBitmap, AudioBuffer und HTMLCanvasElement sind reine
 * Typangaben. Zur Laufzeit fasst src/core nichts davon an.
 */

// --- Abschnitt 2: Basistypen -------------------------------------------------

export type TileCoord = { x: number; y: number };
export type Facing = 0 | 1 | 2 | 3; // Nord, Ost, Sued, West
export type EntityId = number;

export type Stats = {
  health: number;
  maxHealth: number;
  armor: number;
  accuracy: number;
  evasion: number;
};

// --- Abschnitt 3: Zustand ----------------------------------------------------

export type GameState = {
  version: number;
  rngState: [number, number, number, number];
  turnCount: number;
  playTimeMs: number;
  player: PlayerState;
  currentMapId: string;
  maps: Record<string, MapRuntimeState>;
  flags: Record<string, boolean | number>;
  log: LogEntry[]; // maximal 100 Eintraege, aeltere werden vorne verworfen
};

export type PlayerState = {
  pos: TileCoord;
  facing: Facing;
  stats: Stats;
  level: number;
  xp: number;
  actionPoints: number;
  equippedWeaponId: string;
  weapons: string[];
  ammo: Record<string, number>;
  items: Record<string, number>;
  keys: string[];
  effects: ActiveEffect[];
};

export type MapRuntimeState = {
  entities: Entity[];
  nextEntityId: EntityId;
  openedDoors: string[]; // Schluessel "x,y"
  takenItems: string[]; // Schluessel "x,y"
  firedTriggers: string[]; // Trigger-Id
  visited: boolean;
  explored: string[]; // fuer die Automap, Schluessel "x,y"
};

export type Entity = {
  id: EntityId;
  kind: 'enemy' | 'door' | 'item' | 'decoration';
  defId: string;
  pos: TileCoord;
  facing: Facing;
  stats?: Stats;
  actionPoints: number;
  active: boolean;
  state?: string;
  animation: { frame: string; startedAtTurn: number };
};

export type ActiveEffect = {
  id: string;
  remainingTurns: number;
  magnitude: number;
};

export type LogEntry = {
  turn: number;
  kind: 'combat' | 'pickup' | 'system' | 'story';
  text: string;
};

// --- Abschnitt 4: Kommandos und Ereignisse -----------------------------------

export type Command =
  | { type: 'move'; dir: 'forward' | 'back' | 'left' | 'right' }
  | { type: 'turn'; dir: 'cw' | 'ccw' }
  | { type: 'attack'; targetId?: EntityId }
  | { type: 'interact' }
  | { type: 'useItem'; itemId: string }
  | { type: 'switchWeapon'; weaponId: string }
  | { type: 'wait' };

export type GameEvent =
  | { type: 'moved'; who: EntityId | 'player'; from: TileCoord; to: TileCoord }
  | { type: 'turned'; who: EntityId | 'player'; facing: Facing }
  | {
      type: 'attack';
      attacker: EntityId | 'player';
      target: EntityId | 'player';
      hit: boolean;
      damage: number;
      crit: boolean;
    }
  | { type: 'died'; who: EntityId | 'player' }
  | { type: 'pickup'; defId: string; amount: number }
  | { type: 'doorChanged'; pos: TileCoord; state: 'open' | 'closed' | 'blocked' }
  | { type: 'levelUp'; newLevel: number }
  | { type: 'mapChange'; mapId: string }
  | { type: 'message'; text: string }
  | { type: 'invalid'; reason: string };

// --- Abschnitt 5: Inhalte ----------------------------------------------------

export type ContentDb = {
  enemies: Record<string, EnemyDef>;
  weapons: Record<string, WeaponDef>;
  items: Record<string, ItemDef>;
  maps: Record<string, MapDef>;
  progression: { xpThresholds: number[] };
};

export type EnemyDef = {
  id: string;
  name: string;
  stats: Stats;
  speed: number;
  behavior: 'melee' | 'ranged' | 'charger' | 'turret';
  aggroRange: number;
  preferredRange: number;
  weaponId: string;
  xpReward: number;
  spriteWidth: number; // Weltbreite in Kacheln, meist 0.8
  frames: { idle: string[]; attack: string[]; pain: string[]; death: string[] };
  drops?: { defId: string; amount: number; chance: number }[];
};

export type WeaponDef = {
  id: string;
  name: string;
  dmgMin: number;
  dmgMax: number;
  critChance: number; // 0 bis 1
  optimalRange: number;
  maxRange: number;
  ammoType: string | null;
  ammoPerShot: number;
  splash?: { radius: number; baseDamage: number };
  sprite: string; // Basisname der Waffenansicht
  sound: string;
};

export type ItemDef = {
  id: string;
  name: string;
  type: 'weapon' | 'ammo' | 'heal' | 'armor' | 'key' | 'keyCard' | 'quest' | 'powerup';
  amount: number;
  sprite: string;
  effect?: { id: string; turns: number; magnitude: number };
};

// --- Abschnitt 6: Kartenformat -----------------------------------------------

export type MapDef = {
  id: string;
  name: string;
  width: number;
  height: number;
  walls: number[]; // width * height, 0 = begehbar, sonst kodierter Wandwert
  floors: number[]; // width * height, kodierter Bodenwert
  ceilings: number[]; // width * height, kodierter Deckenwert
  light: number[]; // width * height, 0 bis 255
  spawn: { pos: TileCoord; facing: Facing };
  lamps: LampDef[];
  entities: MapEntityDef[];
  triggers: TriggerDef[];
  exits: { pos: TileCoord; targetMapId: string; targetSpawnId?: string }[];
  ambientLight: number; // 0 bis 1, globaler Multiplikator
};

export type LampDef = {
  pos: TileCoord;
  radius: number;
  intensity: number; // 0 bis 255
};

export type MapEntityDef = {
  kind: 'enemy' | 'door' | 'item' | 'decoration';
  defId: string;
  pos: TileCoord;
  facing?: Facing;
  locked?: string; // Schluesselfarbe fuer Tueren
  secret?: boolean;
};

export type TriggerDef = {
  id: string;
  pos: TileCoord;
  on: 'enter' | 'use';
  once: boolean;
  actions: TriggerAction[];
};

export type TriggerAction =
  | { type: 'openDoor'; pos: TileCoord }
  | { type: 'spawn'; defId: string; pos: TileCoord }
  | { type: 'message'; text: string }
  | { type: 'setFlag'; key: string; value: boolean | number }
  | { type: 'damage'; amount: number };

// --- Abschnitt 7: Assets -----------------------------------------------------

export type PixelSurface = {
  width: number;
  height: number;
  pixels: Uint32Array; // Laenge width * height
};

export type AssetBundle = {
  textures: Record<number, PixelSurface>; // Waende, Boden, Decke, je 64 x 64
  sprites: Record<string, PixelSurface>; // Gegner und Items, 64 x 64
  weaponSprites: Record<string, PixelSurface>; // 160 x 100
  ui: Record<string, ImageBitmap>; // nur DOM-Overlay, kein Pixelzugriff
  sounds: Record<string, AudioBuffer>;
};

// --- Abschnitt 8: Renderer ---------------------------------------------------

export interface Renderer {
  init(canvas: HTMLCanvasElement, assets: AssetBundle): Promise<void>;
  setState(state: GameState, content: ContentDb): void;
  consumeEvents(events: GameEvent[]): void; // startet Animationen
  frame(dtMs: number): void; // zeichnet, mutiert den Zustand nicht
  isAnimating(): boolean; // solange true nimmt Input keine Kommandos an
  pickEntityAt(screenX: number, screenY: number): EntityId | null;
}

// --- Abschnitt 9: Netz -------------------------------------------------------

export interface ApiClient {
  register(email: string, password: string): Promise<AuthResult>;
  login(email: string, password: string): Promise<AuthResult>;
  logout(): Promise<void>;
  listSaves(): Promise<SaveMeta[]>;
  pullSave(slot: number): Promise<{ meta: SaveMeta; state: GameState }>;
  pushSave(slot: number, state: GameState): Promise<SaveMeta>;
}

export type AuthResult = { userId: number; token: string; expiresAt: string };

export type SaveMeta = {
  slot: number;
  turnCount: number;
  level: number;
  mapId: string;
  playTimeMs: number;
  updatedAt: string;
  checksum: string; // SHA-256 ueber den serialisierten Zustand
};
