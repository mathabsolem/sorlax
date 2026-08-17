/**
 * Nachschlagehilfen fuer Entitaeten einer Karte.
 * Bewusst ohne Import aus grid.ts, damit grid.ts hier importieren kann.
 */
import type { Entity, EntityId, MapRuntimeState, Stats, TileCoord } from './types';

/** Entitaet ueber ihre Id, oder undefined wenn sie nicht mehr existiert. */
export function findEntity(mapState: MapRuntimeState, id: EntityId): Entity | undefined {
  return mapState.entities.find((entity) => entity.id === id);
}

/** Alle Entitaeten auf einer Kachel. */
export function entitiesAt(mapState: MapRuntimeState, x: number, y: number): Entity[] {
  return mapState.entities.filter((entity) => entity.pos.x === x && entity.pos.y === y);
}

/**
 * Lebendig heisst: entweder ohne Stats (Tuer, Item, Deko) oder mit Health ueber 0.
 * Tote Gegner werden aus `entities` entfernt, diese Pruefung deckt das Fenster
 * zwischen Todesstoss und Aufraeumen ab.
 */
export function isAlive(entity: Entity): boolean {
  return entity.stats === undefined || entity.stats.health > 0;
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

/** Frische Gegner-Entitaet mit eigener Kopie der Stats. */
export function createEnemyEntity(
  id: EntityId,
  defId: string,
  pos: TileCoord,
  facing: Entity['facing'],
  stats: Stats
): Entity {
  return {
    id,
    kind: 'enemy',
    defId,
    pos: { x: pos.x, y: pos.y },
    facing,
    stats: { ...stats },
    actionPoints: 0,
    active: false,
    animation: { frame: 'idle', startedAtTurn: 0 },
  };
}
