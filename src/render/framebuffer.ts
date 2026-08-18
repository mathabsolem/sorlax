/**
 * Pixelpuffer und Ausgabe. Ein Uint32Array und ein ImageData teilen sich
 * denselben ArrayBuffer, damit putImageData ohne Kopie auskommt.
 *
 * Der Offscreen-Canvas von 320 x 200 wird mit abgeschaltetem Glaetten auf den
 * sichtbaren Canvas skaliert, Seitenverhaeltnis bleibt erhalten, Rest schwarz.
 */

export const SCREEN_WIDTH = 320;
export const SCREEN_HEIGHT = 200;

/** Abbildung vom sichtbaren Canvas auf die interne Aufloesung. */
export type Viewport = { offsetX: number; offsetY: number; scale: number };

export class Framebuffer {
  readonly width = SCREEN_WIDTH;
  readonly height = SCREEN_HEIGHT;
  readonly pixels: Uint32Array;

  private readonly image: ImageData;
  private readonly offscreen: HTMLCanvasElement;
  private readonly offscreenCtx: CanvasRenderingContext2D;
  private target: HTMLCanvasElement | null = null;
  private targetCtx: CanvasRenderingContext2D | null = null;
  private observer: ResizeObserver | null = null;
  private viewport: Viewport = { offsetX: 0, offsetY: 0, scale: 1 };

  constructor() {
    const buffer = new ArrayBuffer(SCREEN_WIDTH * SCREEN_HEIGHT * 4);
    this.pixels = new Uint32Array(buffer);
    this.image = new ImageData(new Uint8ClampedArray(buffer), SCREEN_WIDTH, SCREEN_HEIGHT);

    this.offscreen = document.createElement('canvas');
    this.offscreen.width = SCREEN_WIDTH;
    this.offscreen.height = SCREEN_HEIGHT;
    const ctx = this.offscreen.getContext('2d');
    if (ctx === null) throw new Error('2d context not available');
    this.offscreenCtx = ctx;
  }

  /** Bindet den sichtbaren Canvas und haelt seine Groesse nach. */
  attach(canvas: HTMLCanvasElement): void {
    this.target = canvas;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('2d context not available');
    this.targetCtx = ctx;

    this.resize();
    this.observer?.disconnect();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
  }

  detach(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.target = null;
    this.targetCtx = null;
  }

  /** Setzt die Canvas-Aufloesung auf die CSS-Groesse mal devicePixelRatio. */
  private resize(): void {
    const canvas = this.target;
    if (canvas === null) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const pixelWidth = Math.max(1, Math.round(rect.width * ratio));
    const pixelHeight = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

    const scale = Math.max(
      1,
      Math.floor(Math.min(pixelWidth / SCREEN_WIDTH, pixelHeight / SCREEN_HEIGHT))
    );
    this.viewport = {
      scale,
      offsetX: Math.floor((pixelWidth - SCREEN_WIDTH * scale) / 2),
      offsetY: Math.floor((pixelHeight - SCREEN_HEIGHT * scale) / 2),
    };
  }

  clear(color = 0xff000000): void {
    this.pixels.fill(color);
  }

  /** Schreibt den Puffer einmal pro Bild auf den sichtbaren Canvas. */
  present(): void {
    const canvas = this.target;
    const ctx = this.targetCtx;
    if (canvas === null || ctx === null) return;

    this.offscreenCtx.putImageData(this.image, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      this.offscreen,
      this.viewport.offsetX,
      this.viewport.offsetY,
      SCREEN_WIDTH * this.viewport.scale,
      SCREEN_HEIGHT * this.viewport.scale
    );
  }

  /** Rechnet CSS-Koordinaten des sichtbaren Canvas in interne Pixel um. */
  toInternal(clientX: number, clientY: number): { x: number; y: number } | null {
    const canvas = this.target;
    if (canvas === null) return null;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const px = (clientX - rect.left) * ratio;
    const py = (clientY - rect.top) * ratio;
    const x = Math.floor((px - this.viewport.offsetX) / this.viewport.scale);
    const y = Math.floor((py - this.viewport.offsetY) / this.viewport.scale);
    if (x < 0 || y < 0 || x >= SCREEN_WIDTH || y >= SCREEN_HEIGHT) return null;
    return { x, y };
  }
}
