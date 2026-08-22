/**
 * `sporemother`, PHASE_3_7 Block 7.
 *
 * Bewegt sich nie. Alle 4 Runden eine Giftwolke um den Spieler mit `toxin`,
 * alle 6 Runden zwei Sporentraeger, hoechstens sechs gleichzeitig lebend.
 * Solange mindestens ein Traeger lebt, nimmt sie nur halben Schaden. Das steht
 * als `scriptState.guarded` und wird in resolveAttack ausgewertet.
 */
import { applyResistance } from '../combat';
import { getDerivedStats, playerActor } from '../derived';
import { applyEffectDefault } from '../effects';
import { isAlive } from '../entities';
import { freeTilesAround, spawnEnemy } from '../spawn';
import { bossScene, counter, setCounter } from './shared';
import type { ContentDb, EnemyDef, Entity, GameEvent, GameState } from '../types';

/** Definition der Sporentraeger. */
export const SPORE_DEF_ID = 'spore_poison';

/** Hoechstzahl gleichzeitig lebender Sporentraeger. */
export const MAX_SPORES = 6;

const CLOUD_INTERVAL = 4;
const SPAWN_INTERVAL = 6;
const CLOUD_RADIUS = 3;
const CLOUD_DAMAGE = 10;
const SPAWN_COUNT = 2;

/** Lebende Sporentraeger auf der aktuellen Karte. */
export function liveSpores(state: GameState): Entity[] {
  const mapState = state.maps[state.currentMapId];
  if (mapState === undefined) return [];
  return mapState.entities.filter(
    (entity) => entity.kind === 'enemy' && entity.defId === SPORE_DEF_ID && isAlive(entity)
  );
}

/**
 * Giftwolke um den Spieler. Der Spieler steht im Mittelpunkt und nimmt den
 * vollen Wert; die eigene Brut bleibt verschont, sie traegt dasselbe Gift.
 */
function poisonCloud(state: GameState, entity: Entity, content: ContentDb): GameEvent[] {
  const stats = getDerivedStats(playerActor(state), content, state.difficulty);
  const damage = applyResistance(CLOUD_DAMAGE, stats.resistances.poison);
  const events: GameEvent[] = [
    { type: 'message', text: 'Eine Sporenwolke platzt auf' },
    {
      type: 'attack',
      attacker: entity.id,
      target: 'player',
      hit: true,
      damage,
      crit: false,
      damageType: 'poison',
    },
  ];

  state.player.health -= damage;
  if (state.player.health <= 0) {
    state.player.health = 0;
    events.push({ type: 'died', who: 'player' });
    return events;
  }

  events.push(...applyEffectDefault(playerActor(state), 'toxin', content, state.difficulty));
  return events;
}

/** Setzt bis zu zwei Sporentraeger auf die naechstgelegenen freien Felder. */
function sprout(state: GameState, entity: Entity, content: ContentDb): GameEvent[] {
  let alive = liveSpores(state).length;
  if (alive >= MAX_SPORES) {
    return [{ type: 'message', text: 'Die Sporenmutter presst, doch nichts wächst nach' }];
  }

  const events: GameEvent[] = [];
  for (const tile of freeTilesAround(state, entity.pos, CLOUD_RADIUS, content)) {
    if (alive >= MAX_SPORES || events.length >= SPAWN_COUNT) break;
    const spawned = spawnEnemy(state, SPORE_DEF_ID, tile, content);
    if (spawned === null) continue;
    alive += 1;
    events.push({ type: 'message', text: `Ein Sporenträger richtet sich auf (${spawned.id})` });
  }
  return events;
}

export function sporemotherHandler(
  state: GameState,
  entity: Entity,
  _def: EnemyDef,
  content: ContentDb
): GameEvent[] {
  if (bossScene(state, entity, content) === null) return [];

  // Der Schutz wird jede Runde neu gesetzt, damit ein gerade gestorbener
  // Traeger sofort nicht mehr zaehlt.
  setCounter(entity, 'guarded', liveSpores(state).length > 0 ? 1 : 0);

  const turns = counter(entity, 'turns') + 1;
  setCounter(entity, 'turns', turns);

  const events: GameEvent[] = [];
  if (turns % CLOUD_INTERVAL === 0) events.push(...poisonCloud(state, entity, content));
  if (turns % SPAWN_INTERVAL === 0) events.push(...sprout(state, entity, content));
  return events;
}
