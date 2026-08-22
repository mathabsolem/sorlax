/**
 * Gemeinsamer Vergleich der Inhaltspruefungen. Eine Abweichung wird nicht
 * geworfen, sondern gesammelt: ein Lauf soll alle Abweichungen zeigen und nicht
 * bei der ersten stehen bleiben.
 */

/** Sammelt Abweichungen als lesbare Zeilen: Feld, Ist und Soll. */
export function check(
  into: string[],
  id: string,
  field: string,
  actual: unknown,
  expected: unknown
): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return;
  into.push(`${id}.${field}: ist ${JSON.stringify(actual)}, soll ${JSON.stringify(expected)}`);
}
