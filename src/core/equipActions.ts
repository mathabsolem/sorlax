/**
 * Anlegen, Ablegen und Fallenlassen von Ausruestung, PHASE_3_6 Block 4.
 *
 * Alle drei Aktionen kosten keine Runde (SPEC 3.2). Jede prueft zuerst
 * vollstaendig und mutiert erst danach, damit ein ungueltiges Kommando den
 * Zustand nicht anfasst.
 */
import { currentScene } from './actionResult';
import type { ActionResult } from './actionResult';
import { effectiveAttributes } from './derived';
import {
  addGroundItem,
  addToInventory,
  equippedSlotOf,
  findItem,
  inventorySpace,
  removeFromInventory,
  slotsFor,
} from './items';
import { invalidatePlayerDerived, playerDerived } from './turn';
import type { ContentDb, EquipSlot, GameEvent, GameState } from './types';

/**
 * Sinkt `maxHealth` unter die aktuelle `health`, wird `health` mitgesenkt
 * (RPG.md Abschnitt 2). Steigt sie, bleibt `health` unveraendert.
 *
 * Der Rundencache muss vorher fallen, sonst rechnet dieselbe Runde noch mit der
 * alten Ausruestung.
 */
export function clampHealthToMax(state: GameState, content: ContentDb): void {
  invalidatePlayerDerived(state);
  const maxHealth = playerDerived(state, content).maxHealth;
  if (state.player.health > maxHealth) state.player.health = maxHealth;
}

/** Legt ein Teil aus dem Inventar an. Prueft `reqLevel`, `reqStrength`, `reqAgility`. */
export function equipAction(state: GameState, content: ContentDb, uid: number): ActionResult {
  const item = findItem(state, uid);
  if (item === null) return { ok: false, reason: 'unknown item' };
  if (equippedSlotOf(state, uid) !== null) return { ok: false, reason: 'item already equipped' };

  const def = content.items[item.baseId];
  if (def === undefined) return { ok: false, reason: 'unknown item base' };

  // Die Voraussetzungen zaehlen gegen die aktuellen Werte, also einschliesslich
  // der Attributsaffixe bereits angelegter Teile.
  const attributes = effectiveAttributes(state, content);
  if (state.player.level < def.reqLevel) {
    return { ok: false, reason: `requires level ${def.reqLevel}` };
  }
  if (attributes.strength < def.reqStrength) {
    return { ok: false, reason: `requires strength ${def.reqStrength}` };
  }
  if (attributes.agility < def.reqAgility) {
    return { ok: false, reason: `requires agility ${def.reqAgility}` };
  }

  // Passt der Gegenstand in mehrere Plaetze, gewinnt der erste freie.
  const candidates = slotsFor(item);
  const target = candidates.find((slot) => state.player.equipment[slot] === undefined) ?? item.slot;

  const previous = state.player.equipment[target];
  if (removeFromInventory(state, uid) === null) {
    return { ok: false, reason: 'item not in inventory' };
  }
  state.player.equipment[target] = item;

  // Der neue Gegenstand hat seinen Inventarplatz gerade frei gemacht, das
  // abgelegte Teil passt deshalb immer hinein. Ein voller Tausch kann nicht
  // scheitern, die Grenze aus addToInventory bleibt gewahrt.
  if (previous !== undefined) state.player.inventory.push(previous);

  clampHealthToMax(state, content);
  return { ok: true, events: [{ type: 'equipped', slot: target, uid }] };
}

/** Nimmt ein Teil ab und legt es ins Inventar. Bei vollem Inventar ungueltig. */
export function unequipAction(
  state: GameState,
  content: ContentDb,
  slot: EquipSlot
): ActionResult {
  const item = state.player.equipment[slot];
  if (item === undefined) return { ok: false, reason: 'slot is empty' };
  if (inventorySpace(state) <= 0) return { ok: false, reason: 'inventory is full' };

  delete state.player.equipment[slot];
  addToInventory(state, item);
  clampHealthToMax(state, content);

  // INTERFACES Abschnitt 7 kennt kein `unequipped`-Ereignis, deshalb eine Meldung.
  return { ok: true, events: [{ type: 'message', text: `unequipped ${slot}` }] };
}

/** Wirft ein Teil aus Inventar oder Ausruestung auf die Kachel des Spielers. */
export function dropItemAction(state: GameState, content: ContentDb, uid: number): ActionResult {
  const here = currentScene(state, content);
  if (here === null) return { ok: false, reason: 'unknown map' };

  const item = findItem(state, uid);
  if (item === null) return { ok: false, reason: 'unknown item' };

  const slot = equippedSlotOf(state, uid);
  if (slot !== null) delete state.player.equipment[slot];
  else removeFromInventory(state, uid);

  addGroundItem(here.mapState, state.player.pos, item);
  clampHealthToMax(state, content);

  const events: GameEvent[] = [
    { type: 'itemDropped', pos: { x: state.player.pos.x, y: state.player.pos.y }, uid },
  ];
  return { ok: true, events };
}
