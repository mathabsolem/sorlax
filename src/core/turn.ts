/**
 * Rundenablauf nach SPEC v1.2 Abschnitt 3.2.
 * Die Reihenfolge der Akteure ist die Reihenfolge im `entities`-Array,
 * damit eine Runde bei gleichem Zustand immer gleich ablaeuft.
 *
 * Hier liegt auch der Rundencache fuer die abgeleiteten Werte des Spielers.
 * getDerivedStats bleibt rein, gecacht wird nur der Aufruf.
 */
import { checkActivation, takeEnemyTurn } from './ai';
import { getDerivedStats, playerActor } from './derived';
import { hasChill, tickEffects } from './effects';
import { isAlive } from './entities';
import { loadRng, saveRng } from './state';
import type { ContentDb, DerivedStats, GameEvent, GameState, MapRuntimeState } from './types';

/** Notbremse gegen absurde `speed`-Werte in den Inhalten. */
const MAX_ACTIONS_PER_ROUND = 16;

type CacheEntry = { turn: number; stats: DerivedStats };

const playerCache = new WeakMap<GameState, CacheEntry>();

/**
 * Abgeleitete Werte des Spielers, hoechstens einmal je Runde berechnet.
 * Nach jeder Aenderung an Attributen oder Ausruestung muss der Cache verworfen
 * werden, sonst rechnet dieselbe Runde noch mit den alten Werten.
 */
export function playerDerived(state: GameState, content: ContentDb): DerivedStats {
  const cached = playerCache.get(state);
  if (cached !== undefined && cached.turn === state.turnCount) return cached.stats;
  const stats = getDerivedStats(playerActor(state), content, state.difficulty);
  playerCache.set(state, { turn: state.turnCount, stats });
  return stats;
}

/** Verwirft den Rundencache, etwa nach `spendAttribute`. */
export function invalidatePlayerDerived(state: GameState): void {
  playerCache.delete(state);
}

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

/** Senkt alle Abklingzeiten um 1, SPEC 3.2 Schritt 4. */
export function tickCooldowns(state: GameState): void {
  for (const [skillId, turns] of Object.entries(state.player.cooldowns)) {
    if (turns <= 1) {
      delete state.player.cooldowns[skillId];
    } else {
      state.player.cooldowns[skillId] = turns - 1;
    }
  }
}

/**
 * Prueft die Chance auf eine freie Aktion, SPEC 3.2. Bei Erfolg kostet die
 * Aktion keine Runde. Bei Chance 0 wird kein Wurf verbraucht, damit der
 * Zufallsstrom nicht unnoetig weiterlaeuft.
 */
export function rollFreeAction(state: GameState, content: ContentDb): boolean {
  const chance = playerDerived(state, content).freeActionChance;
  if (chance <= 0) return false;
  const rng = loadRng(state);
  const free = rng.next() < chance;
  saveRng(state, rng);
  return free;
}

/**
 * Eine Runde: Rundenzaehler, Gegneraktionen, Statuseffekte, Abklingzeiten,
 * Todespruefung. Liefert null, wenn die Aktion frei war und keine Runde kostet.
 */
export function advanceRound(state: GameState, content: ContentDb): GameEvent[] | null {
  if (rollFreeAction(state, content)) return null;

  const events: GameEvent[] = [];
  state.turnCount += 1;
  invalidatePlayerDerived(state);

  const mapState = state.maps[state.currentMapId];
  if (mapState === undefined) return events;

  // `chill` beim Spieler verdoppelt die Aktionspunkte aller Gegner (SPEC 3.2).
  const apFactor = hasChill(state.player.effects) ? 2 : 1;
  const order = mapState.entities.filter((entity) => entity.kind === 'enemy').map((e) => e.id);

  for (const id of order) {
    if (state.player.health <= 0) break;
    const entity = mapState.entities.find((candidate) => candidate.id === id);
    if (entity === undefined || !isAlive(entity)) continue;
    const def = content.enemies[entity.defId];
    if (def === undefined) continue;

    // Inaktive Gegner bekommen keine Aktionspunkte (SPEC 3.4).
    if (!checkActivation(state, entity, content)) continue;

    entity.actionPoints += def.speed * apFactor;
    let actions = 0;
    while (entity.actionPoints >= 1 && actions < MAX_ACTIONS_PER_ROUND) {
      entity.actionPoints -= 1;
      actions += 1;
      events.push(...takeEnemyTurn(state, entity, content));
      if (!isAlive(entity)) break;
      if (state.player.health <= 0) break;
    }
  }

  events.push(...tickEffects(state, content));
  tickCooldowns(state);
  reapDead(mapState);

  if (state.player.health <= 0) {
    state.player.health = 0;
    events.push({ type: 'died', who: 'player' });
  }

  return events;
}
