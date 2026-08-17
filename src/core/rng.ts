/**
 * Seeded RNG (xorshift128).
 *
 * Der gesamte Zufall des Spiels kommt aus dieser Klasse. `Math.random()` ist in src/core
 * verboten, weil der Zustand Teil des Savegames ist und ein Spielverlauf reproduzierbar
 * bleiben muss (SPEC 3.3).
 */

/** Zustandsform wie in INTERFACES.md, Feld `GameState.rngState`. */
export type RngState = [number, number, number, number];

const UINT32 = 0x100000000;

/**
 * splitmix32 zum Aufspreizen eines einzelnen Seeds auf vier Woerter.
 * Ohne diesen Schritt liefern benachbarte Seeds stark korrelierte Sequenzen.
 */
function splitmix32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    return (z ^ (z >>> 15)) >>> 0;
  };
}

export class Rng {
  private x0: number;
  private x1: number;
  private x2: number;
  private x3: number;

  constructor(seed: number) {
    const mix = splitmix32(seed);
    this.x0 = mix();
    this.x1 = mix();
    this.x2 = mix();
    this.x3 = mix();
    // Der Nullzustand ist ein Fixpunkt von xorshift und muss ausgeschlossen werden.
    if ((this.x0 | this.x1 | this.x2 | this.x3) === 0) {
      this.x0 = 0x9e3779b9;
    }
  }

  /** Ein Schritt xorshift128, Ergebnis als vorzeichenlose 32-Bit-Zahl. */
  private nextUint32(): number {
    let t = this.x3;
    const s = this.x0;
    this.x3 = this.x2;
    this.x2 = this.x1;
    this.x1 = s;
    t ^= t << 11;
    t ^= t >>> 8;
    this.x0 = (t ^ s ^ (s >>> 19)) >>> 0;
    return this.x0;
  }

  /** Gleichverteilter Float in [0, 1). */
  next(): number {
    return this.nextUint32() / UINT32;
  }

  /** Ganze Zahl in [min, max], beide Grenzen eingeschlossen. */
  randInt(min: number, max: number): number {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    if (hi <= lo) return lo;
    const span = hi - lo + 1;
    return lo + Math.floor(this.next() * span);
  }

  /** Kopie des Zustands fuer das Savegame. */
  getState(): RngState {
    return [this.x0, this.x1, this.x2, this.x3];
  }

  /** Stellt einen gespeicherten Zustand wieder her. */
  setState(state: RngState): void {
    this.x0 = state[0] >>> 0;
    this.x1 = state[1] >>> 0;
    this.x2 = state[2] >>> 0;
    this.x3 = state[3] >>> 0;
  }
}
