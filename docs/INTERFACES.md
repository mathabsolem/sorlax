# Scepter of Sorlax — INTERFACES v1.8

Status: eingefroren. Ersetzt v1.7.

Änderung gegenüber v1.7, aus der Rückmeldung nach Phase 6.5:
- `RoomDef.dark?: boolean`. Bewusst unbeleuchtete Räume brauchen ein Kennzeichen, sonst
  ist die Lampenregel des Validators entweder unehrlich oder verbietet dunkle Räume ganz.
  Dunkle Räume sind gewollt.

Frühere Fassung, unverändert gültig:

Änderung gegenüber v1.6, aus der Rückmeldung nach Phase 6:
- `MapDef.rooms: RoomDef[]`. Der Validator konnte Räume aus dem Raster nicht mehr
  rekonstruieren, deshalb waren die Regeln 10 und 12 nicht ehrlich prüfbar.
  Der Generator kennt die Räume, also schreibt er sie mit.

Frühere Fassung, unverändert gültig:

Änderungen gegenüber v1.5, alle aus der Rückmeldung nach Phase 5:
- `EnemyDef.guaranteedUniqueId?: string`. Ein Boss trägt sein Stück ohne Wurf. Damit
  verschwindet die Zuordnungstabelle aus `src/core/bossLoot.ts`.
- `UniqueDef.bossExclusive?: boolean`. Hält ein Stück aus dem normalen Wurf heraus.
- `ItemDef.ammoType?: string`. Die Umgehung über das Präfix `ammo_` entfällt.

Frühere Fassung, unverändert gültig:
Grundlage: SPEC v1.2, BESTIARY v3, CONTENT_TABLES.md, RPG.md.

Änderungen gegenüber v1.4, alle aus der Rückmeldung nach Phase 4.5:
- `ItemDef.slot` wird zu `ItemDef.slots: EquipSlot[]`. Ein Messgerät passt damit in beide
  Handgelenke, ohne dass zwei Definitionen mit derselben Id nötig wären.
- `GameEvent` bekommt `unequipped`. Das Ablegen war bisher von einer beliebigen Textmeldung
  nicht zu unterscheiden.
- `SaveMeta` bekommt `mapName`, damit die Platzliste ohne `ContentDb` auskommt.
- `rollItem` bekommt als siebten Parameter `uid: number` statt des ganzen `GameState`.
  Der Zähler bleibt in `GameState.nextItemUid`, der Aufrufer liest ihn und erhöht ihn.
  Damit bleibt `rollItem` frei von Zustandswissen.
- `getDerivedStats` berücksichtigt `ActiveEffect`. Bisher gab es nur negative Effekte,
  Verbrauchsgüter aus CONTENT_TABLES.md brauchen auch positive.

Übernommen aus v1.4, dort direkt im Repo geändert:
- `useConsumable` bekommt `targetUid?: number`
- `GameState.flags` trägt zusätzlich `string`
- neues Kommando `assignSkillSlot`

Änderung gegenüber v1.2.1: `PlayerState.equippedWeaponId` entfällt. Die getragene Waffe
ist ausschließlich `equipment.weapon`, eine `ItemInstance`, deren `ItemDef` über
`weaponId` auf einen `WeaponDef` verweist. Damit tragen Waffen Affixe wie jedes andere
Ausrüstungsteil, und es gibt nur noch eine Quelle für die Frage, womit der Spieler
angreift. Zugriff über:

```ts
export function equippedWeapon(state: GameState, content: ContentDb): WeaponDef | null;
```

Gibt `null` zurück, wenn der Platz leer ist. In dem Fall greift der Spieler unbewaffnet an,
mit festen Werten dmg 1 bis 3, crit 0, Reichweite 1, `physical`.

Änderung gegenüber v1.2: `MapRuntimeState.tempWalls` und der Typ `TempWall` kamen dazu,
`isSolid` berücksichtigt sie.

Änderungen gegenüber v1.1: `PlayerState.stats` entfällt zugunsten von Attributen und
abgeleiteten Werten, Gegenstände werden Instanzen mit Affixen, Fertigkeiten kommen dazu,
Schadensarten und Resistenzen kommen dazu, `behavior` kennt `'scripted'`, Gegner tragen
Ausrüstung.

Dies ist der Vertrag zwischen den Modulen. Kein Sub-Task ändert hier etwas.
Änderungsbedarf wird gemeldet, nicht umgesetzt.

---

## 1. Modulgrenzen

```
src/
  core/        reine Logik, kein DOM, kein Canvas, kein fetch, kein Math.random
  core/bosses/ Bossskripte, denselben Regeln unterworfen
  render/      Software-Renderer, liest core, schreibt nie
  ui/          DOM-Overlay, HUD, Menüs, Inventar, Skilltree
  input/       Touch und Tastatur, übersetzt zu Command
  data/        JSON-Inhalte plus Loader plus Laufzeitvalidierung
  net/         Auth und Save-Sync gegen die PHP-API
  app/         Bootstrap, verdrahtet alles, einziger Ort mit Seiteneffekten
```

Abhängigkeitsrichtung strikt: `app` darf alles, `render` `ui` `input` `net` dürfen `core`
und `data` lesen, `core` kennt nur sich selbst.

Alle hier definierten Typen leben in `src/core/types.ts`.

## 2. Basistypen

```ts
export type TileCoord = { x: number; y: number };
export type Facing = 0 | 1 | 2 | 3;              // Nord, Ost, Süd, West
export type EntityId = number;

export type DamageType = 'physical' | 'fire' | 'poison' | 'ice' | 'shock' | 'void';
export const DAMAGE_TYPES: readonly DamageType[];

export type Difficulty = 'normal' | 'hard' | 'nightmare';

export type EquipSlot =
  | 'suit' | 'helmet' | 'belt' | 'boots' | 'gloves'
  | 'weapon' | 'guard' | 'amulet' | 'gauge_left' | 'gauge_right';
export const EQUIP_SLOTS: readonly EquipSlot[];

export type Attributes = {
  strength: number;
  agility: number;
  vitality: number;
  focus: number;
};

export type Resistances = Record<DamageType, number>;   // Prozent, -100 bis 90
```

## 3. Abgeleitete Werte

```ts
export type DerivedStats = {
  maxHealth: number;
  accuracy: number;
  evasion: number;
  armor: number;
  meleeBonus: number;       // Faktor, 0.12 heißt plus 12 Prozent
  elemBonus: number;
  critBonus: number;        // additiv auf weapon.critChance
  resistances: Resistances;
  lightRadius: number;
  freeActionChance: number; // 0 bis 1
  ammoSaveChance: number;   // 0 bis 1
};

export function getDerivedStats(actor: Actor, content: ContentDb, difficulty: Difficulty): DerivedStats;
```

`getDerivedStats` bezieht `ActiveEffect` mit ein, sowohl negative aus SPEC 4.5 als auch
positive aus CONTENT_TABLES.md Abschnitt 1. Ein Effekt wirkt über seine `magnitude` auf
das Feld, das seine Definition nennt.

`Actor` ist der gemeinsame Nenner von Spieler und Gegner. Die Funktion ist rein und wird
pro Runde einmal berechnet und zwischengespeichert, nicht pro Angriff.

```ts
export type Actor =
  | { kind: 'player'; state: PlayerState }
  | { kind: 'enemy'; entity: Entity; def: EnemyDef; monsterLevel: number };
```

## 4. Zustand

```ts
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
  log: LogEntry[];          // maximal 100 Einträge, ältere werden vorne verworfen
};

export type PlayerState = {
  pos: TileCoord;
  facing: Facing;
  health: number;           // einziger gespeicherter Kampfwert
  attributes: Attributes;
  unspentAttributePoints: number;
  level: number;
  xp: number;
  actionPoints: number;
  skills: Record<string, number>;      // skillId auf Punkte, 0 bis 5
  unspentSkillPoints: number;
  cooldowns: Record<string, number>;   // skillId auf verbleibende Runden
  equipment: Partial<Record<EquipSlot, ItemInstance>>;
  inventory: ItemInstance[];           // maximal 40
  weapons: string[];                   // gefundene Grundwaffen für die Waffenleiste
  ammo: Record<string, number>;
  consumables: Record<string, number>;
  keys: string[];
  effects: ActiveEffect[];
};

export type MapRuntimeState = {
  entities: Entity[];
  nextEntityId: EntityId;
  openedDoors: string[];    // Schlüssel "x,y"
  takenItems: string[];     // Schlüssel "x,y"
  groundItems: GroundItem[];
  firedTriggers: string[];
  tempWalls: TempWall[];
  rolled: boolean;          // true, sobald Ausrüstung und Drops gewürfelt wurden
  visited: boolean;
  explored: string[];
};

export type TempWall = {
  pos: TileCoord;
  tileValue: number;        // kodierter Wandwert wie in MapDef.walls
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
  scriptState?: Record<string, number>;   // nur für behavior 'scripted'
  effects: ActiveEffect[];
  animation: { frame: string; startedAtTurn: number };
};

export type ActiveEffect = {
  id: string;               // 'burn' | 'toxin' | 'chill' | 'jolt' | 'drain'
  remainingTurns: number;
  magnitude: number;
  sourceType: DamageType;
};

export type LogEntry = {
  turn: number;
  kind: 'combat' | 'pickup' | 'system' | 'story' | 'skill';
  text: string;
};
```

## 5. Gegenstände

```ts
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
  stat: string;             // Feldname in DerivedStats oder 'res_fire' usw.
  mode: 'flat' | 'percent';
  min: number;
  max: number;
  tier: number;             // 1 bis 6
  minItemLevel: number;
  slots: EquipSlot[];
  appliesTo: 'player' | 'enemy' | 'both';
};

export type UniqueDef = {
  id: string;
  baseId: string;
  name: string;
  minItemLevel: number;
  bossExclusive?: boolean;            // wird von rollItem nie gezogen
  affixes: { affixId: string; value: number }[];
};

export type DropTableDef = {
  id: string;
  rarityWeights: Record<Rarity, number>;
  slotWeights: Partial<Record<EquipSlot, number>>;
};

export function rollItem(
  rng: Rng,
  baseId: string,
  itemLevel: number,
  table: DropTableDef,
  content: ContentDb,
  forEnemy: boolean,
  uid: number
): ItemInstance;
```

## 6. Fertigkeiten

```ts
export type SkillTreeId = 'tree_gear' | 'tree_reaction' | 'tree_endure';

export type SkillDef = {
  id: string;
  tree: SkillTreeId;
  name: string;
  description: string;
  maxPoints: number;                // 5
  tier: 1 | 2 | 3;
  reqLevel: number;
  reqPointsInTree: number;
  active: boolean;
  cooldown: number;                 // Runden, 0 bei passiv
  locked: boolean;                  // true für noch nicht umgesetzte Bäume
  modifiers?: { stat: string; mode: 'flat' | 'percent'; perPoint: number }[];
};
```

Passive Fertigkeiten wirken über `modifiers` in `getDerivedStats`.
Aktive Fertigkeiten werden in `src/core/skills/` implementiert und über eine Registry
`Record<string, SkillHandler>` aufgelöst.

```ts
export type SkillHandler = (
  state: GameState,
  skill: SkillDef,
  points: number,
  targetId: EntityId | undefined,
  content: ContentDb
) => GameEvent[];
```

## 7. Kommandos und Ereignisse

```ts
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
  | { type: 'attack'; attacker: EntityId | 'player'; target: EntityId | 'player'; hit: boolean; damage: number; crit: boolean; damageType: DamageType }
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

export function applyCommand(state: GameState, cmd: Command, content: ContentDb): GameEvent[];
```

Ein `invalid`-Ereignis bedeutet: keine Runde vergangen, Zustand unverändert.
`equip`, `unequip`, `dropItem`, `spendAttribute` und `spendSkillPoint` kosten keine Runde.

## 8. Inhalte

```ts
export type ContentDb = {
  enemies: Record<string, EnemyDef>;
  weapons: Record<string, WeaponDef>;
  items: Record<string, ItemDef>;
  affixes: Record<string, AffixDef>;
  uniques: Record<string, UniqueDef>;
  dropTables: Record<string, DropTableDef>;
  skills: Record<string, SkillDef>;
  maps: Record<string, MapDef>;
  progression: { xpThresholds: number[] };   // Länge 60
};

export type EnemyDef = {
  id: string;
  archetype: string;                  // 'rat', 'miner', ...
  element: DamageType;
  name: string;
  baseHealth: number;
  baseArmor: number;
  baseAccuracy: number;
  baseEvasion: number;
  resistances: Resistances;
  speed: number;
  behavior: 'melee' | 'ranged' | 'charger' | 'turret' | 'scripted';
  scriptId?: string;                  // Pflicht bei behavior 'scripted'
  aggroRange: number;
  preferredRange: number;
  weaponId: string;
  baseXp: number;
  spriteWidth: number;
  guaranteedUniqueId?: string;        // Boss trägt dieses Stück ohne Wurf
  frames: { idle: string[]; attack: string[]; pain: string[]; death: string[] };
  drops?: { defId: string; amount: number; chance: number }[];
  dropTableId?: string;               // für Ausrüstung
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
  appliesEffect?: string;             // Effekt-Id
  sprite: string;
  sound: string;
};

export type ItemDef = {
  id: string;
  name: string;
  type: 'weapon' | 'ammo' | 'heal' | 'armor' | 'key' | 'keyCard' | 'quest' | 'powerup' | 'equipment';
  slots?: EquipSlot[];                // Pflicht bei type 'equipment' und 'weapon'
  weaponId?: string;                  // Pflicht bei type 'weapon', verweist auf WeaponDef
  ammoType?: string;                  // Pflicht bei type 'ammo', verweist auf WeaponDef.ammoType
  amount: number;                     // bei 'heal' die Heilmenge, bei 'ammo' die Stapelgröße
  reqLevel: number;
  reqStrength: number;
  reqAgility: number;
  baseModifiers?: { stat: string; mode: 'flat' | 'percent'; value: number }[];
  sprite: string;
  icon: string;
  effect?: { id: string; turns: number; magnitude: number };
};
```

## 9. Kartenformat

```ts
export type MapDef = {
  id: string;
  name: string;
  depth: number;                      // Sohle 1 bis 16
  width: number;
  height: number;
  walls: number[];
  floors: number[];
  ceilings: number[];
  light: number[];
  spawn: { pos: TileCoord; facing: Facing };
  rooms: RoomDef[];
  lamps: LampDef[];
  entities: MapEntityDef[];
  triggers: TriggerDef[];
  exits: { pos: TileCoord; targetMapId: string; targetSpawnId?: string }[];
  ambientLight: number;
};

export type LampDef = { pos: TileCoord; radius: number; intensity: number };

export type RoomDef = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'start' | 'exit' | 'normal' | 'secret' | 'arena' | 'corridor';
  dark?: boolean;                     // bewusst ohne Lampe, ab Zone 3
};

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
```

Alle Raster sind row major, Index = `y * width + x`.

### Kachelkodierung

```ts
export const TEXTURE_ID_MASK = 0x0fff;
export const ROTATION_SHIFT = 12;
export const ROTATION_MASK = 0x3;

export function textureIdOf(value: number): number;
export function rotationOf(value: number): 0 | 1 | 2 | 3;
export function encodeTile(textureId: number, rotation: 0 | 1 | 2 | 3): number;
```

## 10. Bossskripte

```ts
export type BossHandler = (
  state: GameState,
  entity: Entity,
  def: EnemyDef,
  content: ContentDb
) => GameEvent[];

export const BOSS_REGISTRY: Record<string, BossHandler>;
```

Bossskripte liegen in `src/core/bosses/<scriptId>.ts`, unterliegen denselben Regeln wie
`core` und nutzen `entity.scriptState` für Phasenzähler und Abklingzeiten. Kein eigener
Zufallsgenerator.

## 11. Assets

```ts
export type PixelSurface = {
  width: number;
  height: number;
  pixels: Uint32Array;
};

export type AssetBundle = {
  textures: Record<number, PixelSurface>;       // 64 x 64
  sprites: Record<string, PixelSurface>;        // 64 x 64
  weaponSprites: Record<string, PixelSurface>;  // 160 x 100
  ui: Record<string, ImageBitmap>;
  icons: Record<string, ImageBitmap>;           // Inventarsymbole, 32 x 32
  sounds: Record<string, AudioBuffer>;
};
```

Pixelformat: Byte-Reihenfolge wie `ImageData.data`, also R, G, B, A. Auf Little Endian
entspricht ein `Uint32` damit `0xAABBGGRR`. Alpha 0 wird übersprungen, kein Blending.

Raritätsfarben werden als Rahmen im DOM gezeichnet, nicht als eigene Symbole.

```
public/assets/textures/<id>.png       64 x 64
public/assets/sprites/<name>.png      64 x 64
public/assets/weapons/<name>.png      160 x 100
public/assets/icons/<name>.png        32 x 32
public/assets/ui/<name>.png           beliebig
```

## 12. Renderer

```ts
export interface Renderer {
  init(canvas: HTMLCanvasElement, assets: AssetBundle): Promise<void>;
  setState(state: GameState, content: ContentDb): void;
  consumeEvents(events: GameEvent[]): void;
  frame(dtMs: number): void;
  isAnimating(): boolean;
  pickEntityAt(screenX: number, screenY: number): EntityId | null;
}
```

## 13. Netz

```ts
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
```

Netzfehler dürfen das Spiel nie blockieren, lokales Speichern hat Vorrang.
Ein serialisierter Spielstand ist auf 2 MB begrenzt, siehe BACKEND.md.
