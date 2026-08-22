/**
 * Gegenstandsinstanzen, Inventar und Bodenablage nach RPG.md Abschnitt 4.
 *
 * Stapelware (Munition, Verbrauchsgueter) bleibt in `PlayerState.ammo` und
 * `PlayerState.consumables`. Ausruestung ist eine Instanz mit eigener Identitaet.
 */
import type {
  ContentDb,
  EquipSlot,
  GameState,
  GroundItem,
  ItemDef,
  ItemInstance,
  MapRuntimeState,
  Rarity,
  RolledAffix,
  TileCoord,
  WeaponDef,
} from './types';

/** Obergrenze des Inventars, RPG.md Abschnitt 4. Ein Gegenstand belegt einen Platz. */
export const MAX_INVENTORY = 40;

/** Grundtyp der Startwaffe, BESTIARY Abschnitt 7. */
export const STARTER_WEAPON_ITEM = 'item_w_prybar';

/**
 * Verbrauchsgut, das einen Gegenstand identifiziert, RPG.md Abschnitt 4.
 * Der zweite Weg ueber die Fertigkeit `field_analysis` ist dort genannt, aber
 * noch nicht umgesetzt; sie liegt als gesperrter Platzhalter im Katalog.
 */
export const IDENTIFY_ITEM_ID = 'scanner_charge';

/**
 * Werte des unbewaffneten Angriffs, INTERFACES v1.3. Sie gelten, wenn der Platz
 * `weapon` leer ist.
 */
export const UNARMED: WeaponDef = {
  id: 'unarmed',
  name: 'Unbewaffnet',
  dmgMin: 1,
  dmgMax: 3,
  damageType: 'physical',
  critChance: 0,
  optimalRange: 1,
  maxRange: 1,
  ammoType: null,
  ammoPerShot: 0,
  sprite: 'unarmed',
  sound: 'unarmed',
};

/**
 * Die getragene Waffe, INTERFACES v1.3. Der Platz `weapon` ist die einzige
 * Quelle: seine `ItemInstance` verweist ueber `ItemDef.weaponId` auf den
 * `WeaponDef`. Null heisst leerer Platz, der Aufrufer nimmt dann `UNARMED`.
 */
export function equippedWeapon(state: GameState, content: ContentDb): WeaponDef | null {
  const instance = state.player.equipment['weapon'];
  if (instance === undefined) return null;
  const weaponId = content.items[instance.baseId]?.weaponId;
  if (weaponId === undefined) return null;
  return content.weapons[weaponId] ?? null;
}

/** Die Waffe, mit der tatsaechlich angegriffen wird. Nie null. */
export function activeWeapon(state: GameState, content: ContentDb): WeaponDef {
  return equippedWeapon(state, content) ?? UNARMED;
}

/**
 * Steckplaetze, in die ein Gegenstand passt.
 *
 * Seit INTERFACES v1.5 fuehrt `ItemDef` eine Liste. Ein Messgeraet traegt
 * `['gauge_left', 'gauge_right']` und passt damit in beide Handgelenke.
 * `ItemInstance.slot` bleibt der Platz, in dem das Stueck tatsaechlich sitzt.
 */
export function slotsFor(item: ItemInstance, content: ContentDb): EquipSlot[] {
  const fromDef = slotsForDef(content.items[item.baseId]);
  return fromDef.length > 0 ? fromDef : [item.slot];
}

/** Steckplaetze eines Grundtyps, bevor eine Instanz existiert. */
export function slotsForDef(def: ItemDef | undefined): EquipSlot[] {
  return def?.slots ?? [];
}

/**
 * Neue Instanz eines Grundtyps.
 *
 * INTERFACES kennt fuer `ItemInstance` das Pflichtfeld `slot`, die Steckplaetze
 * stehen aber nur in `ItemDef`. Deshalb traegt diese Funktion `content` als
 * letzten Parameter, ergaenzend zur Skizze in PHASE_3_6. Aus demselben Grund ist
 * der Rueckgabewert nullbar: ohne Grundtyp oder ohne Steckplatz gibt es keine
 * gueltige Instanz.
 *
 * Die `uid` kommt herein, wie es INTERFACES v1.5 fuer `rollItem` vorgibt. Wer
 * den Zaehler aus dem Zustand nehmen will, benutzt `takeItemUid`.
 *
 * `identified` ist immer true. Der Identifizierungsweg ueber `scanner_charge`
 * und `field_analysis` (RPG.md Abschnitt 4) gehoert nicht in diese Phase; ein
 * unidentifizierter Gegenstand haette hier keinen Weg zurueck.
 */
export function createInstance(
  uid: number,
  baseId: string,
  itemLevel: number,
  rarity: Rarity,
  affixes: readonly RolledAffix[],
  content: ContentDb
): ItemInstance | null {
  const def = content.items[baseId];
  if (def === undefined) return null;
  // Der erste Eintrag ist der Standardplatz; equipAction darf ausweichen.
  const slot = def.slots?.[0];
  if (slot === undefined) return null;

  return {
    uid,
    baseId,
    slot,
    rarity,
    itemLevel,
    affixes: affixes.map((affix) => ({ affixId: affix.affixId, value: affix.value })),
    identified: true,
  };
}

/** Praefix der Munitionsgegenstaende, CONTENT_TABLES Abschnitt 1. */
export const AMMO_PREFIX = 'ammo_';

/**
 * Munitionssorte eines Gegenstands. `WeaponDef.ammoType` nennt die Sorte ohne
 * Praefix (`pistol`), der Katalog fuehrt sie als `ammo_pistol`. `ItemDef` hat
 * kein eigenes Feld dafuer, deshalb steht die Zuordnung im Namen. Ohne Praefix
 * gilt die Id selbst als Sorte.
 */
export function ammoTypeOf(def: ItemDef): string {
  return def.id.startsWith(AMMO_PREFIX) ? def.id.slice(AMMO_PREFIX.length) : def.id;
}

/** Naechste freie uid aus dem Zustand. Erhoeht den Zaehler. */
export function takeItemUid(state: GameState): number {
  const uid = state.nextItemUid;
  state.nextItemUid += 1;
  return uid;
}

/** Legt einen Gegenstand ins Inventar. False heisst: voll, nichts veraendert. */
export function addToInventory(state: GameState, item: ItemInstance): boolean {
  if (state.player.inventory.length >= MAX_INVENTORY) return false;
  state.player.inventory.push(item);
  return true;
}

/** Freie Plaetze im Inventar. */
export function inventorySpace(state: GameState): number {
  return MAX_INVENTORY - state.player.inventory.length;
}

/** Nimmt einen Gegenstand aus dem Inventar, oder null wenn er nicht dort liegt. */
export function removeFromInventory(state: GameState, uid: number): ItemInstance | null {
  const index = state.player.inventory.findIndex((item) => item.uid === uid);
  if (index < 0) return null;
  const [removed] = state.player.inventory.splice(index, 1);
  return removed ?? null;
}

/** Sucht einen Gegenstand im Inventar und in der Ausruestung. */
export function findItem(state: GameState, uid: number): ItemInstance | null {
  const inInventory = state.player.inventory.find((item) => item.uid === uid);
  if (inInventory !== undefined) return inInventory;
  for (const item of Object.values(state.player.equipment)) {
    if (item !== undefined && item.uid === uid) return item;
  }
  return null;
}

/** Steckplatz, in dem ein Gegenstand gerade steckt, oder null. */
export function equippedSlotOf(state: GameState, uid: number): EquipSlot | null {
  for (const [slot, item] of Object.entries(state.player.equipment)) {
    if (item !== undefined && item.uid === uid) return slot as EquipSlot;
  }
  return null;
}

/** Legt einen Gegenstand auf eine Kachel. */
export function addGroundItem(
  mapState: MapRuntimeState,
  pos: TileCoord,
  item: ItemInstance
): GroundItem {
  const entry: GroundItem = { pos: { x: pos.x, y: pos.y }, item };
  mapState.groundItems.push(entry);
  return entry;
}

/** Alle Gegenstaende auf einer Kachel, in Ablagereihenfolge. */
export function groundItemsAt(
  mapState: MapRuntimeState,
  pos: TileCoord
): GroundItem[] {
  return mapState.groundItems.filter(
    (entry) => entry.pos.x === pos.x && entry.pos.y === pos.y
  );
}

/** Nimmt einen konkreten Gegenstand vom Boden. Liefert false, wenn er dort nicht lag. */
export function removeGroundItem(mapState: MapRuntimeState, uid: number): boolean {
  const index = mapState.groundItems.findIndex((entry) => entry.item.uid === uid);
  if (index < 0) return false;
  mapState.groundItems.splice(index, 1);
  return true;
}
