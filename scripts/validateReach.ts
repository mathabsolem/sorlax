/**
 * Erreichbarkeit einer Karte, PHASE_6_5 Block 1.
 *
 * Ein Schluessel wird beim Oeffnen verbraucht (CONTENT_TABLES v1.2
 * Abschnitt 7), deshalb reicht es nicht, jeden Schluessel einzeln zu pruefen:
 * zwei Tueren derselben Farbe bilden eine Falle, wenn der zweite Schluessel
 * hinter der ersten Tuer liegt.
 */
import type { MapDef, MapEntityDef, TileCoord } from '../src/core/types.ts';

/** Flutfuellung von `from` aus ueber alle Kacheln, fuer die `open` gilt. */
export function flood(map: MapDef, from: TileCoord, open: readonly boolean[]): boolean[] {
  const seen = new Array<boolean>(map.width * map.height).fill(false);
  const start = from.y * map.width + from.x;
  if (open[start] !== true) return seen;
  seen[start] = true;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    if (index === undefined) continue;
    const x = index % map.width;
    const y = (index - x) / map.width;
    for (const next of [
      x > 0 ? index - 1 : -1,
      x < map.width - 1 ? index + 1 : -1,
      y > 0 ? index - map.width : -1,
      y < map.height - 1 ? index + map.width : -1,
    ]) {
      if (next < 0 || seen[next] === true || open[next] !== true) continue;
      seen[next] = true;
      queue.push(next);
    }
  }
  return seen;
}

/**
 * Spielt Schluessel und Tueren durch, CONTENT_TABLES v1.2 Abschnitt 7.
 *
 * Ein Schluessel wird beim Oeffnen verbraucht, deshalb reicht es nicht, jeden
 * Schluessel einzeln zu pruefen: zwei Tueren derselben Farbe bilden eine Falle,
 * wenn der zweite Schluessel hinter der ersten Tuer liegt.
 *
 * Genommen wird, was erreichbar ist; geoeffnet wird jede erreichbare Tuer, fuer
 * die noch ein Schluessel im Bestand liegt. Das wiederholt sich, bis nichts
 * mehr geht.
 */
export function simulate(map: MapDef): { reached: boolean[]; missed: MapEntityDef[] } {
  const open = map.walls.map((value) => value === 0);
  const doors = map.entities.filter((entity) => entity.kind === 'door');
  const keys = map.entities.filter(
    (entity) => entity.kind === 'item' && entity.defId.startsWith('key_')
  );

  // Tueren sind zu, bis sie geoeffnet werden. Die Geheimtuer bleibt zu: hinter
  // ihr darf nichts liegen, was der Spieler braucht.
  for (const door of doors) open[door.pos.y * map.width + door.pos.x] = false;

  const held = new Map<string, number>();
  const taken = new Set<MapEntityDef>();
  let reached = flood(map, map.spawn.pos, open);

  for (let round = 0; round <= doors.length; round++) {
    for (const key of keys) {
      if (taken.has(key)) continue;
      if (reached[key.pos.y * map.width + key.pos.x] !== true) continue;
      taken.add(key);
      held.set(key.defId, (held.get(key.defId) ?? 0) + 1);
    }

    const next = doors.find((door) => {
      const index = door.pos.y * map.width + door.pos.x;
      if (open[index] === true) return false;
      if (door.locked === undefined) return false;
      if ((held.get(door.locked) ?? 0) <= 0) return false;
      return touchesReached(map, door.pos, reached);
    });
    if (next === undefined) break;

    const lock = next.locked ?? '';
    held.set(lock, (held.get(lock) ?? 0) - 1);
    open[next.pos.y * map.width + next.pos.x] = true;
    reached = flood(map, map.spawn.pos, open);
  }

  return { reached, missed: keys.filter((key) => !taken.has(key)) };
}

/** Grenzt die Kachel an etwas Erreichtes? Nur dann steht der Spieler davor. */
function touchesReached(map: MapDef, pos: TileCoord, reached: readonly boolean[]): boolean {
  const index = pos.y * map.width + pos.x;
  const x = pos.x;
  return [
    x > 0 ? index - 1 : -1,
    x < map.width - 1 ? index + 1 : -1,
    pos.y > 0 ? index - map.width : -1,
    pos.y < map.height - 1 ? index + map.width : -1,
  ].some((next) => next >= 0 && reached[next] === true);
}
