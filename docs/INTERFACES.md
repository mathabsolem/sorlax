# Scepter of Sorlax — INTERFACES v1.1

Status: eingefroren. Ersetzt v1.0 vollständig.
Änderungen gegenüber v1.0: `AssetBundle` liefert Pixeldaten statt `ImageBitmap`, `MapDef`
hat Boden, Decke und Licht pro Kachel, `MapRuntimeState` unverändert.

Dies ist der Vertrag zwischen den Modulen. Kein Sub-Task ändert hier etwas.
Änderungsbedarf wird gemeldet, nicht umgesetzt.

---

## 1. Modulgrenzen

```
src/
  core/      reine Logik, kein DOM, kein Canvas, kein fetch, kein Math.random
  render/    Software-Renderer, liest core, schreibt nie
  ui/        DOM-Overlay, HUD, Menüs, sendet Kommandos an core
  input/     Touch und Tastatur, übersetzt zu Command
  data/      JSON-Inhalte plus Loader plus Laufzeitvalidierung
  net/       Auth und Save-Sync gegen die PHP-API
  app/       Bootstrap, verdrahtet alles, einziger Ort mit Seiteneffekten
```

Abhängigkeitsrichtung ist strikt: `app` darf alles, `render` `ui` `input` `net` dürfen
`core` und `data` lesen, `core` kennt nur sich selbst.

Alle hier definierten Typen leben in `src/core/types.ts`. Andere Module importieren von
dort und definieren sie nicht erneut.

## 2. Basistypen

```ts
export type TileCoord = { x: number; y: number };
export type Facing = 0 | 1 | 2 | 3; // Nord, Ost, Süd, West
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
  log: LogEntry[]; // maximal 100 Einträge, ältere werden vorne verworfen
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
  openedDoors: string[];   // Schlüssel "x,y"
  takenItems: string[];    // Schlüssel "x,y"
  firedTriggers: string[]; // Trigger-Id
  visited: boolean;
  explored: string[];      // für die Automap, Schlüssel "x,y"
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

Einziger Mutationspunkt ist `applyCommand`. Der Zustand wird in place verändert, die
Funktion gibt keinen neuen Zustand zurück, sondern eine Liste von Ereignissen.

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

Ein `invalid`-Ereignis bedeutet: keine Runde vergangen, Zustand unverändert.

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
  spriteWidth: number;     // Weltbreite in Kacheln, meist 0.8
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
  sprite: string;          // Basisname der Waffenansicht
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
  walls: number[];      // width * height, 0 = begehbar, sonst kodierter Wandwert
  floors: number[];     // width * height, kodierter Bodenwert
  ceilings: number[];   // width * height, kodierter Deckenwert
  light: number[];      // width * height, 0 bis 255
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
  intensity: number;    // 0 bis 255
};

export type MapEntityDef = {
  kind: 'enemy' | 'door' | 'item' | 'decoration';
  defId: string;
  pos: TileCoord;
  facing?: Facing;
  locked?: string;      // Schlüsselfarbe für Türen
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

Alle Raster sind row major, Index = `y * width + x`.

`lamps` ist Quellmaterial für `generateLightMap`. Das Ergebnis steht in `light` und hat
Vorrang. Wird `light` weggelassen oder ist es leer, erzeugt der Loader es aus `lamps`.

### Kachelkodierung

```ts
export const TEXTURE_ID_MASK = 0x0fff;
export const ROTATION_SHIFT = 12;
export const ROTATION_MASK = 0x3;

export function textureIdOf(value: number): number;
export function rotationOf(value: number): 0 | 1 | 2 | 3;
export function encodeTile(textureId: number, rotation: 0 | 1 | 2 | 3): number;
```

## 7. Assets

Der Renderer arbeitet auf rohen Pixeldaten, nicht auf `ImageBitmap`.

```ts
export type PixelSurface = {
  width: number;
  height: number;
  pixels: Uint32Array;  // Länge width * height
};

export type AssetBundle = {
  textures: Record<number, PixelSurface>;       // Wände, Boden, Decke, je 64 x 64
  sprites: Record<string, PixelSurface>;        // Gegner und Items, 64 x 64
  weaponSprites: Record<string, PixelSurface>;  // 160 x 100
  ui: Record<string, ImageBitmap>;              // nur DOM-Overlay, kein Pixelzugriff
  sounds: Record<string, AudioBuffer>;
};
```

Pixelformat: Byte-Reihenfolge identisch zu `ImageData.data`, also R, G, B, A.
Auf Little-Endian-Systemen entspricht ein `Uint32` damit `0xAABBGGRR`. Alle Zielplattformen
sind Little Endian, eine Byte-Order-Prüfung findet nicht statt.

Ein Alphawert von 0 bedeutet vollständig transparent und wird beim Zeichnen übersprungen.
Zwischenwerte werden nicht unterstützt, es gibt kein Alpha-Blending im Renderer.
Sprites müssen mit harter Kante freigestellt sein.

Dateikonvention:
```
public/assets/textures/<id>.png        64 x 64
public/assets/sprites/<name>.png       64 x 64
public/assets/weapons/<name>.png       160 x 100
public/assets/ui/<name>.png            beliebig
```

Framenamen in `EnemyDef.frames` sind Dateinamen ohne Endung, zum Beispiel
`grubling_idle_0`. Der Loader ergänzt Pfad und Endung.

## 8. Renderer

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

## 9. Netz

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
  checksum: string;   // SHA-256 über den serialisierten Zustand
};
```

Jeder Aufruf wirft bei HTTP-Status ungleich 200 einen `ApiError` mit `code` und `message`.
Netzfehler dürfen das Spiel nie blockieren, lokales Speichern hat Vorrang.
