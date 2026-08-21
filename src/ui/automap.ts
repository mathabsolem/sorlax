/**
 * Automap auf eigenem Canvas, PHASE_4 Block 5.
 * Nicht der Pixelpuffer des Spiels: die Karte ist Vektorzeichnung, kein Raycast.
 *
 * Die Geometrie kommt aus automapModel.ts, hier steht nur das Zeichnen.
 */
import { automapForState } from './automapModel';
import type { AutomapTiles } from './automapModel';
import type { ContentDb, GameState } from '../core/types';

const COLORS = {
  floor: '#2a2a34',
  wall: '#9a9aa6',
  player: '#e8e8f0',
  exit: '#5ac278',
  doorOpen: '#8a8a94',
  doorLocked: '#d4c25a',
};

/** Kantenlaenge der kleinen Uebersicht in CSS-Pixeln. */
export const MINI_SIZE = 132;

export type AutomapView = { scale: number; offsetX: number; offsetY: number };

/** Passt die Karte so ein, dass sie ganz in die Flaeche passt. */
export function fitView(tiles: AutomapTiles, width: number, height: number): AutomapView {
  const xs = tiles.floors.map((tile) => tile.x);
  const ys = tiles.floors.map((tile) => tile.y);
  if (xs.length === 0) return { scale: 6, offsetX: width / 2, offsetY: height / 2 };

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs) + 1;
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys) + 1;
  const scale = Math.max(2, Math.min(width / (maxX - minX), height / (maxY - minY)));

  return {
    scale,
    offsetX: (width - (maxX - minX) * scale) / 2 - minX * scale,
    offsetY: (height - (maxY - minY) * scale) / 2 - minY * scale,
  };
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  tiles: AutomapTiles,
  view: AutomapView
): void {
  const cx = view.offsetX + (tiles.player.pos.x + 0.5) * view.scale;
  const cy = view.offsetY + (tiles.player.pos.y + 0.5) * view.scale;
  const radius = Math.max(3, view.scale * 0.45);
  // 0 Nord, 1 Ost, 2 Sued, 3 West. Der Bildschirm zaehlt y nach unten.
  const angle = (tiles.player.facing * Math.PI) / 2 - Math.PI / 2;

  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  for (let corner = 0; corner < 3; corner++) {
    const step = angle + (corner * 2 * Math.PI) / 3;
    const length = corner === 0 ? radius : radius * 0.7;
    const px = cx + Math.cos(step) * length;
    const py = cy + Math.sin(step) * length;
    if (corner === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/** Zeichnet Boden, Wandkanten, Tueren, Ausgaenge und den Spieler. */
export function drawAutomap(
  ctx: CanvasRenderingContext2D,
  tiles: AutomapTiles,
  view: AutomapView,
  width: number,
  height: number
): void {
  ctx.clearRect(0, 0, width, height);

  const at = (x: number, y: number): [number, number] => [
    view.offsetX + x * view.scale,
    view.offsetY + y * view.scale,
  ];

  ctx.fillStyle = COLORS.floor;
  for (const tile of tiles.floors) {
    const [px, py] = at(tile.x, tile.y);
    ctx.fillRect(px, py, view.scale, view.scale);
  }

  ctx.fillStyle = COLORS.exit;
  for (const exit of tiles.exits) {
    const [px, py] = at(exit.x + 0.25, exit.y + 0.25);
    ctx.fillRect(px, py, view.scale * 0.5, view.scale * 0.5);
  }

  for (const door of tiles.doors) {
    ctx.fillStyle = door.locked === null || door.open ? COLORS.doorOpen : COLORS.doorLocked;
    const [px, py] = at(door.pos.x + 0.2, door.pos.y + 0.2);
    ctx.fillRect(px, py, view.scale * 0.6, view.scale * 0.6);
  }

  ctx.strokeStyle = COLORS.wall;
  ctx.lineWidth = Math.max(1, view.scale * 0.12);
  ctx.beginPath();
  for (const edge of tiles.walls) {
    const [px, py] = at(edge.x, edge.y);
    const size = view.scale;
    if (edge.side === 'north') {
      ctx.moveTo(px, py);
      ctx.lineTo(px + size, py);
    } else if (edge.side === 'south') {
      ctx.moveTo(px, py + size);
      ctx.lineTo(px + size, py + size);
    } else if (edge.side === 'west') {
      ctx.moveTo(px, py);
      ctx.lineTo(px, py + size);
    } else {
      ctx.moveTo(px + size, py);
      ctx.lineTo(px + size, py + size);
    }
  }
  ctx.stroke();

  drawPlayer(ctx, tiles, view);
}

/**
 * Kleine Uebersicht in der Ecke. Die Vollbildansicht baut auf denselben
 * Zeichenfunktionen auf und erlaubt zusaetzlich Zoom und Verschieben.
 */
export class Automap {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private view: AutomapView | null = null;
  private manual = false;

  constructor(host: HTMLElement, size = MINI_SIZE) {
    const doc = host.ownerDocument;
    this.canvas = doc.createElement('canvas');
    this.canvas.className = 'sx-automap';
    this.canvas.width = size;
    this.canvas.height = size;
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
  }

  /** Zeichnet die aktuelle Sohle. Einmal je Kommando, nicht je Bild. */
  update(state: GameState, content: ContentDb): void {
    if (this.ctx === null) return;
    const tiles = automapForState(state, content.maps);
    if (tiles === null) return;

    if (!this.manual || this.view === null) {
      this.view = fitView(tiles, this.canvas.width, this.canvas.height);
    }
    drawAutomap(this.ctx, tiles, this.view, this.canvas.width, this.canvas.height);
  }

  /** Zoom aus einer Geste, Faktor relativ zur aktuellen Ansicht. */
  zoomBy(factor: number): void {
    if (this.view === null) return;
    this.manual = true;
    this.view = { ...this.view, scale: Math.max(2, Math.min(48, this.view.scale * factor)) };
  }

  /** Verschieben aus einer Geste, in CSS-Pixeln. */
  panBy(dx: number, dy: number): void {
    if (this.view === null) return;
    this.manual = true;
    this.view = { ...this.view, offsetX: this.view.offsetX + dx, offsetY: this.view.offsetY + dy };
  }

  /** Zurueck zur automatischen Einpassung. */
  resetView(): void {
    this.manual = false;
  }

  element(): HTMLCanvasElement {
    return this.canvas;
  }

  setSize(size: number): void {
    this.canvas.width = size;
    this.canvas.height = size;
    this.manual = false;
  }

  destroy(): void {
    this.canvas.remove();
  }
}
