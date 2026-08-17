/**
 * Typen aus docs/INTERFACES.md Abschnitt 2 bis 6, woertlich uebernommen.
 * Dies ist die einzige Quelle fuer diese Typen. Keine Logik in dieser Datei.
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
  log: LogEntry[]; // maximal 100 Eintraege, aeltere werden verworfen
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
  sprite: string; // Basisname in assets/sprites
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
  sprite: string; // Waffe in der Hand, HUD-Ansicht
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
  walls: number[]; // width * height, 0 = Boden, sonst Textur-Id
  floorTexture: number;
  ceilingTexture: number;
  spawn: { pos: TileCoord; facing: Facing };
  entities: MapEntityDef[];
  triggers: TriggerDef[];
  exits: { pos: TileCoord; targetMapId: string; targetSpawnId?: string }[];
  ambientLight: number; // 0 bis 1
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
