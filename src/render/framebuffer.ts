/**
 * Pixelpuffer. Der Konstruktor kommt ohne DOM aus, damit die Zeichenlogik
 * kopflos testbar bleibt. ImageData und Canvas entstehen erst in presentTo.
 */

export const SCREEN_WIDTH = 320;
export const SCREEN_HEIGHT = 200;

/** Abbildung vom Zielcanvas auf die interne Aufloesung. */
export type Viewport = { offsetX: number; offsetY: number; scale: number };

export class Framebuffer {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint32Array;

  private readonly buffer: ArrayBuffer;
  private image: ImageData | null = null;
  private offscreen: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;

  constructor(width: number = SCREEN_WIDTH, height: number = SCREEN_HEIGHT) {
    this.width = width;
    this.height = height;
    this.buffer = new ArrayBuffer(width * height * 4);
    this.pixels = new Uint32Array(this.buffer);
  }

  clear(color = 0xff000000): void {
    this.pixels.fill(color);
  }

  /**
   * Ganzzahliger Skalierungsfaktor und Randversatz fuer ein Ziel dieser Groesse.
   * Seitenverhaeltnis bleibt erhalten, der Rest bleibt schwarz. Reine Rechnung.
   */
  viewportFor(targetWidth: number, targetHeight: number): Viewport {
    const scale = Math.max(
      1,
      Math.floor(Math.min(targetWidth / this.width, targetHeight / this.height))
    );
    return {
      scale,
      offsetX: Math.floor((targetWidth - this.width * scale) / 2),
      offsetY: Math.floor((targetHeight - this.height * scale) / 2),
    };
  }

  /** Rechnet Zielpixel in interne Pixel um, ausserhalb des Bildes null. */
  toInternal(
    targetX: number,
    targetY: number,
    targetWidth: number,
    targetHeight: number
  ): { x: number; y: number } | null {
    const viewport = this.viewportFor(targetWidth, targetHeight);
    const x = Math.floor((targetX - viewport.offsetX) / viewport.scale);
    const y = Math.floor((targetY - viewport.offsetY) / viewport.scale);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    return { x, y };
  }

  /**
   * Einziger Ort mit DOM-Zugriff. ImageData teilt sich den ArrayBuffer mit
   * `pixels`, deshalb kostet putImageData keine Kopie.
   */
  presentTo(ctx: CanvasRenderingContext2D): void {
    const target = ctx.canvas;
    if (this.image === null) {
      this.image = new ImageData(new Uint8ClampedArray(this.buffer), this.width, this.height);
    }
    if (this.offscreenCtx === null) {
      const offscreen = ctx.canvas.ownerDocument.createElement('canvas');
      offscreen.width = this.width;
      offscreen.height = this.height;
      const offscreenCtx = offscreen.getContext('2d');
      if (offscreenCtx === null) throw new Error('2d context not available');
      this.offscreen = offscreen;
      this.offscreenCtx = offscreenCtx;
    }
    if (this.offscreen === null) return;

    this.offscreenCtx.putImageData(this.image, 0, 0);
    const viewport = this.viewportFor(target.width, target.height);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(
      this.offscreen,
      viewport.offsetX,
      viewport.offsetY,
      this.width * viewport.scale,
      this.height * viewport.scale
    );
  }
}
