/**
 * Software-Renderer nach docs/tasks/PHASE_3.md.
 * Zeichenreihenfolge: Boden und Decke, Waende, Sprites, Waffenansicht, Vollbildeffekte.
 * Der Spielzustand wird nie veraendert, der Animationszustand liegt daneben.
 */
import type {
  AssetBundle,
  ContentDb,
  EntityId,
  GameEvent,
  GameState,
  PixelSurface,
  Renderer,
} from '../core/types';
import { AnimationState } from './animation';
import { makeCamera } from './camera';
import { drawFloorAndCeiling } from './floorcast';
import { Framebuffer, SCREEN_HEIGHT, SCREEN_WIDTH } from './framebuffer';
import { DOOR_TILE_VALUE } from './placeholders';
import { drawWalls } from './raycaster';
import { createRenderMap } from './renderMap';
import type { RenderMap } from './renderMap';
import { buildShadeLut } from './shading';
import { DEFAULT_SPRITE_WIDTH, drawSprites } from './sprites';
import type { Billboard, SpriteRect } from './sprites';

const FLASH_COLOR = { r: 220, g: 40, b: 30 };
const WEAPON_RECOIL_PIXELS = 12;

export class SoftwareRenderer implements Renderer {
  private framebuffer: Framebuffer | null = null;
  private assets: AssetBundle | null = null;
  private state: GameState | null = null;
  private content: ContentDb | null = null;
  private renderMap: RenderMap | null = null;
  private lastMapId: string | null = null;
  private rects: SpriteRect[] = [];

  private readonly animation = new AnimationState();
  private readonly lut = buildShadeLut();
  private readonly zBuffer = new Float32Array(SCREEN_WIDTH);

  init(canvas: HTMLCanvasElement, assets: AssetBundle): Promise<void> {
    const framebuffer = new Framebuffer();
    framebuffer.attach(canvas);
    this.framebuffer = framebuffer;
    this.assets = assets;
    return Promise.resolve();
  }

  setState(state: GameState, content: ContentDb): void {
    this.state = state;
    this.content = content;

    const map = content.maps[state.currentMapId];
    const mapState = state.maps[state.currentMapId];
    if (map === undefined || mapState === undefined) return;

    if (this.lastMapId !== state.currentMapId) {
      this.animation.clearCorpses();
      this.animation.snapTo(state);
      this.lastMapId = state.currentMapId;
    }

    this.renderMap = createRenderMap(map, mapState, DOOR_TILE_VALUE);
    this.animation.observe(state);
  }

  consumeEvents(events: GameEvent[]): void {
    this.animation.consumeEvents(events);
  }

  isAnimating(): boolean {
    return this.animation.isAnimating();
  }

  frame(dtMs: number): void {
    this.animation.advance(dtMs);

    const framebuffer = this.framebuffer;
    const state = this.state;
    const content = this.content;
    const map = this.renderMap;
    const assets = this.assets;
    if (framebuffer === null || state === null || content === null || map === null || assets === null) {
      return;
    }

    const position = this.animation.positionOf('player', state.player.pos);
    const camera = makeCamera(position.x, position.y, this.animation.angleOf());

    framebuffer.clear();
    drawFloorAndCeiling(
      framebuffer.pixels,
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
      camera,
      map,
      assets.textures,
      this.lut
    );
    drawWalls(
      framebuffer.pixels,
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
      camera,
      map,
      assets.textures,
      this.lut,
      this.zBuffer
    );
    this.rects = drawSprites(
      framebuffer.pixels,
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
      camera,
      map,
      this.collectBillboards(state, content, assets),
      this.lut,
      this.zBuffer
    );

    this.drawWeaponView(framebuffer.pixels, state, content, assets);
    this.drawHitFlash(framebuffer.pixels);
    framebuffer.present();
  }

  pickEntityAt(screenX: number, screenY: number): EntityId | null {
    const framebuffer = this.framebuffer;
    if (framebuffer === null) return null;
    const point = framebuffer.toInternal(screenX, screenY);
    if (point === null) return null;
    // Von hinten nach vorn, die Liste steht von weit nach nah.
    for (let i = this.rects.length - 1; i >= 0; i--) {
      const rect = this.rects[i];
      if (rect === undefined) continue;
      if (point.x >= rect.x0 && point.x < rect.x1 && point.y >= rect.y0 && point.y < rect.y1) {
        return rect.id;
      }
    }
    return null;
  }

  private collectBillboards(
    state: GameState,
    content: ContentDb,
    assets: AssetBundle
  ): Billboard[] {
    const mapState = state.maps[state.currentMapId];
    if (mapState === undefined) return [];
    const billboards: Billboard[] = [];

    for (const entity of mapState.entities) {
      let frameName: string | undefined;
      let widthTiles = DEFAULT_SPRITE_WIDTH;

      if (entity.kind === 'enemy') {
        const def = content.enemies[entity.defId];
        if (def === undefined) continue;
        frameName = this.animation.frameOf(entity.id, def);
        widthTiles = def.spriteWidth;
      } else if (entity.kind === 'item') {
        frameName = content.items[entity.defId]?.sprite;
      } else if (entity.kind === 'decoration') {
        frameName = entity.defId;
      }

      if (frameName === undefined) continue;
      const surface = assets.sprites[frameName];
      if (surface === undefined) continue;
      const at = this.animation.positionOf(entity.id, entity.pos);
      billboards.push({ id: entity.id, x: at.x, y: at.y, widthTiles, surface });
    }

    for (const corpse of this.animation.corpseFrames(content.enemies)) {
      const surface = assets.sprites[corpse.frame];
      if (surface === undefined) continue;
      billboards.push({
        id: null,
        x: corpse.x,
        y: corpse.y,
        widthTiles: content.enemies[corpse.defId]?.spriteWidth ?? DEFAULT_SPRITE_WIDTH,
        surface,
      });
    }

    return billboards;
  }

  /** Waffenansicht liegt ungeprueft ueber dem Bild, ohne zBuffer und ohne Schattierung. */
  private drawWeaponView(
    target: Uint32Array,
    state: GameState,
    content: ContentDb,
    assets: AssetBundle
  ): void {
    const weapon = content.weapons[state.player.equippedWeaponId];
    if (weapon === undefined) return;
    const surface: PixelSurface | undefined = assets.weaponSprites[weapon.sprite];
    if (surface === undefined) return;

    const originX = Math.floor((SCREEN_WIDTH - surface.width) / 2);
    const originY =
      SCREEN_HEIGHT - surface.height + Math.round(this.animation.weaponRecoil() * WEAPON_RECOIL_PIXELS);

    for (let y = 0; y < surface.height; y++) {
      const screenY = originY + y;
      if (screenY < 0 || screenY >= SCREEN_HEIGHT) continue;
      for (let x = 0; x < surface.width; x++) {
        const screenX = originX + x;
        if (screenX < 0 || screenX >= SCREEN_WIDTH) continue;
        const pixel = surface.pixels[y * surface.width + x] ?? 0;
        if (pixel >>> 24 === 0) continue;
        target[screenY * SCREEN_WIDTH + screenX] = pixel;
      }
    }
  }

  /** Roter Vollbildblitz. Einziger Ort mit echtem Blending. */
  private drawHitFlash(target: Uint32Array): void {
    const alpha = this.animation.flashAlpha();
    if (alpha <= 0) return;
    for (let i = 0; i < target.length; i++) {
      const pixel = target[i] ?? 0;
      const r = (pixel & 0xff) + (FLASH_COLOR.r - (pixel & 0xff)) * alpha;
      const g = ((pixel >> 8) & 0xff) + (FLASH_COLOR.g - ((pixel >> 8) & 0xff)) * alpha;
      const b = ((pixel >> 16) & 0xff) + (FLASH_COLOR.b - ((pixel >> 16) & 0xff)) * alpha;
      target[i] =
        ((0xff << 24) | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
    }
  }
}
