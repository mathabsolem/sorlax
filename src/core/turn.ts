/**
 * Rundenablauf nach SPEC 3.2, Schritt 2 bis 4.
 * Die Reihenfolge der Akteure ist die Reihenfolge im `entities`-Array,
 * damit eine Runde bei gleichem Zustand immer gleich ablaeuft.
 */
import { checkActivation, takeEnemyTurn } from './ai';
import { isAlive } from './entities';
import type { ContentDb, GameEvent, GameState, MapRuntimeState } from './types';

/** Notbremse gegen absurde `speed`-Werte in den Inhalten. */
const MAX_ACTIONS_PER_ROUND = 16;

/** Entfernt tote Gegner von der Karte. Liefert deren Ids. */
export function reapDead(mapState: MapRuntimeState): number[] {
  const removed: number[] = [];
  for (let i = mapState.entities.length - 1; i >= 0; i--) {
    const entity = mapState.entities[i];
    if (entity === undefined) continue;
    if (entity.kind !== 'enemy' || isAlive(entity)) continue;
    removed.push(entity.id);
    mapState.entities.splice(i, 1);
  }
  return removed.reverse();
}

/**
 * Zaehlt aktive Effekte des Spielers herunter und entfernt abgelaufene.
 * Die Wirkung eines Effekts ist inhaltsabhaengig und wird hier nicht ausgewertet.
 */
export function tickEffects(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  const remaining = [];
  for (const effect of state.player.effects) {
    effect.remainingTurns -= 1;
    if (effect.remainingTurns > 0) {
      remaining.push(effect);
    } else {
      events.push({ type: 'message', text: `${effect.id} expired` });
    }
  }
  state.player.effects = remaining;
  return events;
}

/** Eine Runde: Rundenzaehler, Gegneraktionen, Statuseffekte, Todespruefung. */
export function advanceRound(state: GameState, content: ContentDb): GameEvent[] {
  const events: GameEvent[] = [];
  state.turnCount += 1;

  const mapState = state.maps[state.currentMapId];
  if (mapState === undefined) return events;

  const order = mapState.entities.filter((entity) => entity.kind === 'enemy').map((e) => e.id);

  for (const id of order) {
    if (state.player.stats.health <= 0) break;
    const entity = mapState.entities.find((candidate) => candidate.id === id);
    if (entity === undefined || !isAlive(entity)) continue;
    const def = content.enemies[entity.defId];
    if (def === undefined) continue;

    // Inaktive Gegner bekommen keine Aktionspunkte (SPEC 3.4).
    if (!checkActivation(state, entity, content)) continue;

    entity.actionPoints += def.speed;
    let actions = 0;
    while (entity.actionPoints >= 1 && actions < MAX_ACTIONS_PER_ROUND) {
      entity.actionPoints -= 1;
      actions += 1;
      events.push(...takeEnemyTurn(state, entity, content));
      if (!isAlive(entity)) break;
      if (state.player.stats.health <= 0) break;
    }
  }

  events.push(...tickEffects(state));
  reapDead(mapState);

  if (state.player.stats.health <= 0) {
    state.player.stats.health = 0;
    events.push({ type: 'died', who: 'player' });
  }

  return events;
}
