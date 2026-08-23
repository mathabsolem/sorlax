/**
 * Typen aus docs/INTERFACES.md v1.2, Abschnitte 2 bis 13, woertlich uebernommen.
 * Dies ist die einzige Quelle fuer diese Typen.
 *
 * INTERFACES v1.2 Abschnitt 1 verlangt ausdruecklich, dass alle dort definierten
 * Typen in dieser Datei liegen. Deshalb ist sie laenger als die Stilregel in
 * CLAUDE.md erlaubt; der Vertrag hat Vorrang.
 *
 * Die Verweise auf ImageBitmap, AudioBuffer und HTMLCanvasElement sind reine
 * Typangaben. Zur Laufzeit fasst src/core nichts davon an.
 */

// --- Abschnitt 2: Basistypen -------------------------------------------------

export type TileCoord = { x: number; y: number };
export type Facing = 0 | 1 | 2 | 3; // Nord, Ost, Sued, West
export type EntityId = number;

export type DamageType = 'physical' | 'fire' | 'poison' | 'ice' | 'shock' | 'void';

export const DAMAGE_TYPES: readonly DamageType[] = [
  'physical',
  'fire',
  'poison',
  'ice',
  'shock',
  'void',
];

export type Difficulty = 'normal' | 'hard' | 'nightmare';

export type EquipSlot =
  | 'suit'
  | 'helmet'
  | 'belt'
  | 'boots'
  | 'gloves'
  | 'weapon'
  | 'guard'
  | 'amulet'
  | 'gauge_left'
  | 'gauge_right';

export const EQUIP_SLOTS: readonly EquipSlot[] = [
  'suit',
  'helmet',
  'belt',
  'boots',
  'gloves',
  'weapon',
  'guard',
  'amulet',
  'gauge_left',
  'gauge_right',
];

export type Attributes = {
  strength: number;
  agility: number;
  vitality: number;
  focus: number;
};

export type Resistances = Record<DamageType, number>; // Prozent, -100 bis 90

// --- Abschnitt 3: Abgeleitete Werte ------------------------------------------

export type DerivedStats = {
  maxHealth: number;
  accuracy: number;
  evasion: number;
  armor: number;
  meleeBonus: number; // Faktor, 0.12 heisst plus 12 Prozent
  elemBonus: number;
  critBonus: number; // additiv auf weapon.critChance
  resistances: Resistances;
  lightRadius: number;
  freeActionChance: number; // 0 bis 1
  ammoSaveChance: number; // 0 bis 1
};

/** Gemeinsamer Nenner von Spieler und Gegner fuer getDerivedStats. */
export type Actor =
  | { kind: 'player'; state: PlayerState }
  | { kind: 'enemy'; entity: Entity; def: EnemyDef; monsterLevel: number };

// --- Abschnitt 4: Zustand ----------------------------------------------------

export type GameState = {
  version: number;
  rngState: [number, number, number, number];
  turnCount: number;
  playTimeMs: number;
  difficulty: Difficulty;
  unlockedDifficulties: Difficulty[];
  nextItemUid: number;
  player: PlayerState;
  currentMapId: string;
  maps: Record<string, MapRuntimeState>;
  flags: Record<string, boolean | number | string>;
  log: LogEntry[]; // maximal 100 Eintraege, aeltere werden vorne verworfen
};

export type PlayerState = {
  pos: TileCoord;
  facing: Facing;
  health: number; // einziger gespeicherter Kampfwert
  attributes: Attributes;
  unspentAttributePoints: number;
  level: number;
  xp: number;
  actionPoints: number;
  skills: Record<string, number>; // skillId auf Punkte, 0 bis 5
  unspentSkillPoints: number;
  cooldowns: Record<string, number>; // skillId auf verbleibende Runden
  equipment: Partial<Record<EquipSlot, ItemInstance>>;
  inventory: ItemInstance[]; // maximal 40
  weapons: string[]; // gefundene Grundwaffen fuer die Waffenleiste
  ammo: Record<string, number>;
  consumables: Record<string, number>;
  keys: string[];
  effects: ActiveEffect[];
};

export type MapRuntimeState = {
  entities: Entity[];
  nextEntityId: EntityId;
  openedDoors: string[]; // Schluessel "x,y"
  takenItems: string[]; // Schluessel "x,y"
  groundItems: GroundItem[];
  firedTriggers: string[];
  tempWalls: TempWall[];
  rolled: boolean; // true, sobald Ausruestung und Drops gewuerfelt wurden
  visited: boolean;
  explored: string[];
};

export type TempWall = {
  pos: TileCoord;
  tileValue: number; // kodierter Wandwert wie in MapDef.walls
  expiresAtTurn: number;
};

export type GroundItem = {
  pos: TileCoord;
  item: ItemInstance;
};

export type Entity = {
  id: EntityId;
  kind: 'enemy' | 'door' | 'item' | 'decoration';
  defId: string;
  pos: TileCoord;
  facing: Facing;
  health?: number;
  monsterLevel?: number;
  rank?: 'common' | 'equipped' | 'boss';
  equipment?: Partial<Record<EquipSlot, ItemInstance>>;
  actionPoints: number;
  active: boolean;
  state?: string;
  scriptState?: Record<string, number>; // nur fuer behavior 'scripted'
  effects: ActiveEffect[];
  animation: { frame: string; startedAtTurn: number };
};

export type ActiveEffect = {
  id: string; // 'burn' | 'toxin' | 'chill' | 'jolt' | 'drain'
  remainingTurns: number;
  magnitude: number;
  sourceType: DamageType;
};

export type LogEntry = {
  turn: number;
  kind: 'combat' | 'pickup' | 'system' | 'story' | 'skill';
  text: string;
};

// --- Abschnitt 5: Gegenstaende -----------------------------------------------

export type Rarity = 'normal' | 'magic' | 'rare' | 'unique';

export type ItemInstance = {
  uid: number;
  baseId: string;
  slot: EquipSlot;
  rarity: Rarity;
  itemLevel: number;
  affixes: RolledAffix[];
  identified: boolean;
};

export type RolledAffix = {
  affixId: string;
  value: number;
};

export type AffixDef = {
  id: string;
  kind: 'prefix' | 'suffix';
  stat: string; // Feldname in DerivedStats oder 'res_fire' usw.
  mode: 'flat' | 'percent';
  min: number;
  max: number;
  tier: number; // 1 bis 6
  minItemLevel: number;
  slots: EquipSlot[];
  appliesTo: 'player' | 'enemy' | 'both';
};

export type UniqueDef = {
  id: string;
  baseId: string;
  name: string;
  minItemLevel: number;
  bossExclusive?: boolean; // wird von rollItem nie gezogen
  affixes: { affixId: string; value: number }[];
};

export type DropTableDef = {
  id: string;
  rarityWeights: Record<Rarity, number>;
  slotWeights: Partial<Record<EquipSlot, number>>;
};

// --- Abschnitt 6: Fertigkeiten -----------------------------------------------

export type SkillTreeId = 'tree_gear' | 'tree_reaction' | 'tree_endure';

export type SkillDef = {
  id: string;
  tree: SkillTreeId;
  name: string;
  description: string;
  maxPoints: number; // 5
  tier: 1 | 2 | 3;
  reqLevel: number;
  reqPointsInTree: number;
  active: boolean;
  cooldown: number; // Runden, 0 bei passiv
  locked: boolean; // true fuer noch nicht umgesetzte Baeume
  modifiers?: { stat: string; mode: 'flat' | 'percent'; perPoint: number }[];
};

export type SkillHandler = (
  state: GameState,
  skill: SkillDef,
  points: number,
  targetId: EntityId | undefined,
  content: ContentDb
) => GameEvent[];

// --- Abschnitt 7: Kommandos und Ereignisse -----------------------------------

export type Command =
  | { type: 'move'; dir: 'forward' | 'back' | 'left' | 'right' }
  | { type: 'turn'; dir: 'cw' | 'ccw' }
  | { type: 'attack'; targetId?: EntityId }
  | { type: 'useSkill'; skillId: string; targetId?: EntityId }
  | { type: 'interact' }
  | { type: 'useConsumable'; itemId: string; targetUid?: number }
  | { type: 'switchWeapon'; weaponId: string }
  | { type: 'equip'; uid: number }
  | { type: 'unequip'; slot: EquipSlot }
  | { type: 'dropItem'; uid: number }
  | { type: 'spendAttribute'; attr: keyof Attributes }
  | { type: 'spendSkillPoint'; skillId: string }
  | { type: 'assignSkillSlot'; index: number; skillId: string }
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
      damageType: DamageType;
    }
  | { type: 'skillUsed'; skillId: string; by: EntityId | 'player' }
  | { type: 'effectApplied'; who: EntityId | 'player'; effectId: string; turns: number }
  | { type: 'effectExpired'; who: EntityId | 'player'; effectId: string }
  | { type: 'effectTick'; who: EntityId | 'player'; effectId: string; damage: number }
  | { type: 'died'; who: EntityId | 'player' }
  | { type: 'itemDropped'; pos: TileCoord; uid: number }
  | { type: 'pickup'; defId: string; amount: number }
  | { type: 'itemPickedUp'; uid: number }
  | { type: 'equipped'; slot: EquipSlot; uid: number }
  | { type: 'unequipped'; slot: EquipSlot; uid: number }
  | { type: 'doorChanged'; pos: TileCoord; state: 'open' | 'closed' | 'blocked' }
  | { type: 'levelUp'; newLevel: number }
  | { type: 'mapChange'; mapId: string }
  | { type: 'difficultyUnlocked'; difficulty: Difficulty }
  | { type: 'message'; text: string }
  | { type: 'invalid'; reason: string };

// --- Abschnitt 8: Inhalte ----------------------------------------------------

export type ContentDb = {
  enemies: Record<string, EnemyDef>;
  weapons: Record<string, WeaponDef>;
  items: Record<string, ItemDef>;
  affixes: Record<string, AffixDef>;
  uniques: Record<string, UniqueDef>;
  dropTables: Record<string, DropTableDef>;
  skills: Record<string, SkillDef>;
  maps: Record<string, MapDef>;
  progression: { xpThresholds: number[] }; // Laenge 60
};

export type EnemyDef = {
  id: string;
  archetype: string; // 'rat', 'miner', ...
  element: DamageType;
  name: string;
  baseHealth: number;
  baseArmor: number;
  baseAccuracy: number;
  baseEvasion: number;
  resistances: Resistances;
  speed: number;
  behavior: 'melee' | 'ranged' | 'charger' | 'turret' | 'scripted';
  scriptId?: string; // Pflicht bei behavior 'scripted'
  aggroRange: number;
  preferredRange: number;
  weaponId: string;
  baseXp: number;
  spriteWidth: number;
  guaranteedUniqueId?: string; // Boss traegt dieses Stueck ohne Wurf
  frames: { idle: string[]; attack: string[]; pain: string[]; death: string[] };
  drops?: { defId: string; amount: number; chance: number }[];
  dropTableId?: string; // fuer Ausruestung
};

export type WeaponDef = {
  id: string;
  name: string;
  dmgMin: number;
  dmgMax: number;
  damageType: DamageType;
  critChance: number;
  optimalRange: number;
  maxRange: number;
  ammoType: string | null;
  ammoPerShot: number;
  splash?: { radius: number; baseDamage: number };
  appliesEffect?: string; // Effekt-Id
  sprite: string;
  sound: string;
};

export type ItemDef = {
  id: string;
  name: string;
  type:
    | 'weapon'
    | 'ammo'
    | 'heal'
    | 'armor'
    | 'key'
    | 'keyCard'
    | 'quest'
    | 'powerup'
    | 'equipment';
  slots?: EquipSlot[]; // Pflicht bei type 'equipment' und 'weapon'
  weaponId?: string; // Pflicht bei type 'weapon', verweist auf WeaponDef
  ammoType?: string; // Pflicht bei type 'ammo', verweist auf WeaponDef.ammoType
  amount: number; // bei 'heal' die Heilmenge, bei 'ammo' die Stapelgroesse
  reqLevel: number;
  reqStrength: number;
  reqAgility: number;
  baseModifiers?: { stat: string; mode: 'flat' | 'percent'; value: number }[];
  sprite: string;
  icon: string;
  effect?: { id: string; turns: number; magnitude: number };
};

// --- Abschnitt 9: Kartenformat -----------------------------------------------

export type MapDef = {
  id: string;
  name: string;
  depth: number; // Sohle 1 bis 16
  width: number;
  height: number;
  walls: number[];
  floors: number[];
  ceilings: number[];
  light: number[];
  spawn: { pos: TileCoord; facing: Facing };
  lamps: LampDef[];
  entities: MapEntityDef[];
  triggers: TriggerDef[];
  exits: { pos: TileCoord; targetMapId: string; targetSpawnId?: string }[];
  ambientLight: number;
};

export type LampDef = { pos: TileCoord; radius: number; intensity: number };

export type MapEntityDef = {
  kind: 'enemy' | 'door' | 'item' | 'decoration';
  defId: string;
  pos: TileCoord;
  facing?: Facing;
  locked?: string;
  secret?: boolean;
  forceRank?: 'common' | 'equipped' | 'boss';
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

// --- Abschnitt 10: Bossskripte -----------------------------------------------

export type BossHandler = (
  state: GameState,
  entity: Entity,
  def: EnemyDef,
  content: ContentDb
) => GameEvent[];

// --- Abschnitt 11: Assets ----------------------------------------------------

export type PixelSurface = {
  width: number;
  height: number;
  pixels: Uint32Array;
};

export type AssetBundle = {
  textures: Record<number, PixelSurface>; // 64 x 64
  sprites: Record<string, PixelSurface>; // 64 x 64
  weaponSprites: Record<string, PixelSurface>; // 160 x 100
  ui: Record<string, ImageBitmap>;
  icons: Record<string, ImageBitmap>; // Inventarsymbole, 32 x 32
  sounds: Record<string, AudioBuffer>;
};

// --- Abschnitt 12: Renderer --------------------------------------------------

export interface Renderer {
  init(canvas: HTMLCanvasElement, assets: AssetBundle): Promise<void>;
  setState(state: GameState, content: ContentDb): void;
  consumeEvents(events: GameEvent[]): void;
  frame(dtMs: number): void;
  isAnimating(): boolean;
  pickEntityAt(screenX: number, screenY: number): EntityId | null;
}

// --- Abschnitt 13: Netz ------------------------------------------------------

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
  difficulty: Difficulty;
  mapId: string;
  mapName: string;
  playTimeMs: number;
  updatedAt: string;
  checksum: string;
};
