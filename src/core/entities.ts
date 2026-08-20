/**
 * Nachschlagehilfen fuer Entitaeten einer Karte.
 * Bewusst ohne Import aus grid.ts, damit grid.ts hier importieren kann.
 */
import type { Entity, EntityId, MapRuntimeState, TileCoord } from './types';

/** Entitaet ueber ihre Id, oder undefined wenn sie nicht mehr existiert. */
export function findEntity(mapState: MapRuntimeState, id: EntityId): Entity | undefined {
  return mapState.entities.find((entity) => entity.id === id);
}

/** Alle Entitaeten auf einer Kachel. */
export function entitiesAt(mapState: MapRuntimeState, x: number, y: number): Entity[] {
  return mapState.entities.filter((entity) => entity.pos.x === x && entity.pos.y === y);
}

/**
 * Lebendig heisst: entweder ohne Lebenswert (Tuer, Item, Deko) oder ueber 0.
 * Tote Gegner werden aus `entities` entfernt, diese Pruefung deckt das Fenster
 * zwischen Todesstoss und Aufraeumen ab.
 */
export function isAlive(entity: Entity): boolean {
  return entity.health === undefined || entity.health > 0;
}

/** Tuer auf einer Kachel. */
export function doorAt(mapState: MapRuntimeState, x: number, y: number): Entity | undefined {
  return mapState.entities.find(
    (entity) => entity.kind === 'door' && entity.pos.x === x && entity.pos.y === y
  );
}

/** Lebender Gegner auf einer Kachel. */
export function enemyAt(mapState: MapRuntimeState, x: number, y: number): Entity | undefined {
  return mapState.entities.find(
    (entity) =>
      entity.kind === 'enemy' && entity.pos.x === x && entity.pos.y === y && isAlive(entity)
  );
}

/** Noch nicht aufgesammeltes Item auf einer Kachel. */
export function itemAt(mapState: MapRuntimeState, x: number, y: number): Entity | undefined {
  return mapState.entities.find(
    (entity) => entity.kind === 'item' && entity.pos.x === x && entity.pos.y === y
  );
}

/** Eine Tuer blockiert alles ausser im Zustand `open`. */
export function isDoorBlocking(door: Entity): boolean {
  return door.state !== 'open';
}

/** Entfernt eine Entitaet, liefert true wenn sie vorhanden war. */
export function removeEntity(mapState: MapRuntimeState, id: EntityId): boolean {
  const index = mapState.entities.findIndex((entity) => entity.id === id);
  if (index < 0) return false;
  mapState.entities.splice(index, 1);
  return true;
}

/**
 * Frische Gegner-Entitaet. `monsterLevel` wird beim Spawn festgeschrieben und
 * aendert sich danach nicht mehr (SPEC v1.2 Abschnitt 8).
 */
export function createEnemyEntity(
  id: EntityId,
  defId: string,
  pos: TileCoord,
  facing: Entity['facing'],
  health: number,
  monsterLevel: number,
  rank: Entity['rank'] = 'common'
): Entity {
  return {
    id,
    kind: 'enemy',
    defId,
    pos: { x: pos.x, y: pos.y },
    facing,
    health,
    monsterLevel,
    rank,
    actionPoints: 0,
    active: false,
    effects: [],
    animation: { frame: 'idle', startedAtTurn: 0 },
  };
}

/**
 * Steht die Entitaet gerade unter dem Schutz eines Bossskripts?
 * Der Wert liegt in `scriptState.guarded` und wird dort jede Runde gesetzt.
 */
export function isGuarded(entity: Entity): boolean {
  return (entity.scriptState?.['guarded'] ?? 0) > 0;
}

/** Lebenswert-Traeger einer Entitaet, ohne Kopie. Schreibt in die Entitaet zurueck. */
export function vitalsOf(entity: Entity): { health: number } {
  return {
    get health(): number {
      return entity.health ?? 0;
    },
    set health(value: number) {
      entity.health = value;
    },
  };
}
