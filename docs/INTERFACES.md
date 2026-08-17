# Scepter of Sorlax — INTERFACES v1.0

Status: eingefroren. Dies ist der Vertrag zwischen den Modulen.
Kein Sub-Task darf hier etwas aendern. Aenderungsbedarf wird gemeldet, nicht umgesetzt.

---

## 1. Modulgrenzen

```
src/
  core/      reine Logik, kein DOM, kein Canvas, kein fetch, kein Math.random
  render/    Canvas, Raycaster, Sprites, liest core, schreibt nie
  ui/        DOM-Overlay, HUD, Menues, sendet Kommandos an core
  input/     Touch und Tastatur, uebersetzt zu Command
  data/      JSON-Inhalte plus Loader plus Laufzeitvalidierung
  net/       Auth und Save-Sync gegen die PHP-API
  app/       Bootstrap, verdrahtet alles, einziger Ort mit Seiteneffekten
```

Abhaengigkeitsrichtung ist strikt: `app` darf alles, `render` `ui` `input` `net` duerfen `core`
und `data` lesen, `core` darf nur `data`-Typen kennen, sonst nichts.

## 2. Basistypen

```ts
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
```

## 3. Zustand

```ts
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
  openedDoors: string[];   // Schluessel "x,y"
  takenItems: string[];    // Schluessel "x,y"
  firedTriggers: string[]; // Trigger-Id
  visited: boolean;
  explored: string[];      // fuer die Automap, Schluessel "x,y"
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
```

## 4. Kommandos und Ereignisse

Der einzige Weg, den Zustand zu aendern, ist `applyCommand`. Rueckgabe ist eine Liste von
Ereignissen, die Renderer und UI konsumieren. Der Zustand wird in place mutiert, die Funktion
gibt keinen neuen Zustand zurueck.

```ts
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
  | { type: 'attack'; attacker: EntityId | 'player'; target: EntityId | 'player'; hit: boolean; damage: number; crit: boolean }
  | { type: 'died'; who: EntityId | 'player' }
  | { type: 'pickup'; defId: string; amount: number }
  | { type: 'doorChanged'; pos: TileCoord; state: 'open' | 'closed' | 'blocked' }
  | { type: 'levelUp'; newLevel: number }
  | { type: 'mapChange'; mapId: string }
  | { type: 'message'; text: string }
  | { type: 'invalid'; reason: string };

export function applyCommand(state: GameState, cmd: Command, content: ContentDb): GameEvent[];
```

Regel: Ein `invalid`-Ereignis bedeutet, dass keine Runde vergangen ist und der Zustand
unveraendert bleibt.

## 5. Inhalte

```ts
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
  sprite: string;          // Basisname in assets/sprites
  frames: { idle: string[]; attack: string[]; pain: string[]; death: string[] };
  drops?: { defId: string; amount: number; chance: number }[];
};

export type WeaponDef = {
  id: string;
  name: string;
  dmgMin: number;
  dmgMax: number;
  critChance: number;      // 0 bis 1
  optimalRange: number;
  maxRange: number;
  ammoType: string | null;
  ammoPerShot: number;
  splash?: { radius: number; baseDamage: number };
  sprite: string;          // Waffe in der Hand, HUD-Ansicht
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
```

## 6. Kartenformat

```ts
export type MapDef = {
  id: string;
  name: string;
  width: number;
  height: number;
  walls: number[];               // width * height, 0 = Boden, sonst Textur-Id
  floorTexture: number;
  ceilingTexture: number;
  spawn: { pos: TileCoord; facing: Facing };
  entities: MapEntityDef[];
  triggers: TriggerDef[];
  exits: { pos: TileCoord; targetMapId: string; targetSpawnId?: string }[];
  ambientLight: number;          // 0 bis 1
};

export type MapEntityDef = {
  kind: 'enemy' | 'door' | 'item' | 'decoration';
  defId: string;
  pos: TileCoord;
  facing?: Facing;
  locked?: string;               // Schluesselfarbe fuer Tueren
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
```

`walls` ist row major, Index = `y * width + x`.

## 7. Renderer

```ts
export interface Renderer {
  init(canvas: HTMLCanvasElement, assets: AssetBundle): Promise<void>;
  setState(state: GameState, content: ContentDb): void;
  consumeEvents(events: GameEvent[]): void;   // startet Animationen
  frame(dtMs: number): void;                  // zeichnet, mutiert den Zustand nicht
  isAnimating(): boolean;                     // solange true nimmt Input keine Kommandos an
  pickEntityAt(screenX: number, screenY: number): EntityId | null;
}
```

## 8. Netz

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
  mapId: string;
  playTimeMs: number;
  updatedAt: string;
  checksum: string;   // SHA-256 ueber den serialisierten Zustand
};
```

Fehlerbehandlung: Jeder Aufruf wirft bei HTTP-Status ungleich 200 ein `ApiError` mit `code`
und `message`. Netzfehler duerfen das Spiel nie blockieren, lokales Speichern hat Vorrang.

## 9. Assets

```ts
export type AssetBundle = {
  textures: Record<number, ImageBitmap>;     // Wandtexturen, 64 x 64
  sprites: Record<string, ImageBitmap>;      // Gegner und Items, 64 x 64
  weaponSprites: Record<string, ImageBitmap>; // 160 x 100
  ui: Record<string, ImageBitmap>;
  sounds: Record<string, AudioBuffer>;
};
```

Dateikonvention: `assets/textures/<id>.png`, `assets/sprites/<name>_<frame>.png`,
`assets/weapons/<name>_<frame>.png`. Alles PNG mit Alphakanal, Palette maximal 64 Farben.
