/**
 * Renderer-Fassade nach INTERFACES v1.1 Abschnitt 8. Die Signaturen bleiben
 * unveraendert. Hier liegt der gesamte DOM-Anteil: Canvas, Kontext,
 * Groessenanpassung und die Umrechnung von Zeigerkoordinaten.
 * Gezeichnet wird ausschliesslich im SceneRenderer.
 */
import type {
  AssetBundle,
  ContentDb,
  EntityId,
  GameEvent,
  GameState,
  Renderer,
} from '../core/types';
import { Framebuffer } from './framebuffer';
import { SceneRenderer } from './sceneRenderer';

export class SoftwareRenderer implements Renderer {
  private readonly framebuffer = new Framebuffer();
  private scene: SceneRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private observer: ResizeObserver | null = null;

  init(canvas: HTMLCanvasElement, assets: AssetBundle): Promise<void> {
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('2d context not available');
    this.canvas = canvas;
    this.ctx = ctx;
    this.scene = new SceneRenderer(this.framebuffer, assets);

    this.resize();
    this.observer?.disconnect();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    return Promise.resolve();
  }

  /** Loest die Bindung an den Canvas, etwa beim Abbau der Ansicht. */
  dispose(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.canvas = null;
    this.ctx = null;
  }

  setState(state: GameState, content: ContentDb): void {
    this.scene?.setScene(state, content);
  }

  consumeEvents(events: GameEvent[]): void {
    this.scene?.consumeEvents(events);
  }

  isAnimating(): boolean {
    return this.scene?.isAnimating() ?? false;
  }

  frame(dtMs: number): void {
    const ctx = this.ctx;
    if (this.scene === null || ctx === null) return;
    this.scene.render(dtMs);
    this.framebuffer.presentTo(ctx);
  }

  pickEntityAt(screenX: number, screenY: number): EntityId | null {
    const canvas = this.canvas;
    const scene = this.scene;
    if (canvas === null || scene === null) return null;

    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const point = this.framebuffer.toInternal(
      (screenX - rect.left) * ratio,
      (screenY - rect.top) * ratio,
      canvas.width,
      canvas.height
    );
    if (point === null) return null;

    // Von hinten nach vorn, die Liste steht von weit nach nah.
    const rects = scene.spriteRects();
    for (let i = rects.length - 1; i >= 0; i--) {
      const box = rects[i];
      if (box === undefined) continue;
      if (point.x >= box.x0 && point.x < box.x1 && point.y >= box.y0 && point.y < box.y1) {
        return box.id;
      }
    }
    return null;
  }

  /** Setzt die Canvas-Aufloesung auf die CSS-Groesse mal devicePixelRatio. */
  private resize(): void {
    const canvas = this.canvas;
    if (canvas === null) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const pixelWidth = Math.max(1, Math.round(rect.width * ratio));
    const pixelHeight = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  }
}
