/**
 * Eingabesperre. Solange der Renderer animiert, werden Kommandos verworfen.
 * Genau eines darf zwischengespeichert und direkt danach ausgefuehrt werden.
 */
import type { Command } from '../core/types';

export class InputGate {
  private pending: Command | null = null;

  constructor(
    private readonly blocked: () => boolean,
    private readonly run: (cmd: Command) => void
  ) {}

  /** Nimmt ein Kommando entgegen oder legt es als einziges zurueck. */
  submit(cmd: Command): void {
    if (!this.blocked()) {
      this.run(cmd);
      return;
    }
    // Ist der Puffer belegt, faellt alles Weitere weg.
    if (this.pending === null) this.pending = cmd;
  }

  /** Fuehrt ein zwischengespeichertes Kommando aus, sobald die Sperre faellt. */
  flush(): void {
    if (this.pending === null || this.blocked()) return;
    const cmd = this.pending;
    this.pending = null;
    this.run(cmd);
  }

  hasPending(): boolean {
    return this.pending !== null;
  }
}
