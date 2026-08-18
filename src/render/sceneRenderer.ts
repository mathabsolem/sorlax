/**
 * Gesamte Zeichenlogik, kopflos. Kennt nur einen Framebuffer und ein AssetBundle,
 * kein Canvas, kein document, kein window.
 *
 * Zeichenreihenfolge nach docs/tasks/PHASE_3.md: Boden und Decke, Waende,
 * Sprites, Waffenansicht, Vollbildeffekte. Der Spielzustand wird nie veraendert.
 */
import type {
  AssetBundle,
  ContentDb,
  GameEvent,
  GameState,
  PixelSurface,
} from '../core/types';
import { AnimationState } from './animation';
import { makeCamera } from './camera';
import type { DebugView } from './debug';
import { drawFloorAndCeiling } from './floorcast';
import type { Framebuffer } from './framebuffer';
import { DOOR_TILE_VALUE } from './placeholders';
import { drawWalls } from './raycaster';
import { createRenderMap } from './renderMap';
import type { RenderMap } from './renderMap';
import { buildShadeLut } from './shading';
import { DEFAULT_SPRITE_WIDTH, drawSprites } from './sprites';
import type { Billboard, SpriteRect } from './sprites';

const FLASH_COLOR = { r: 220, g: 40, b: 30 };
const WEAPON_RECOIL_PIXELS = 12;

export class SceneRenderer {
  private readonly animation = new AnimationState();
  private readonly lut = buildShadeLut();
  private readonly zBuffer: Float32Array;

  private state: GameState | null = null;
  private content: ContentDb | null = null;
  private renderMap: RenderMap | null = null;
  private lastMapId: string | null = null;
  private rects: SpriteRect[] = [];
  private debug: DebugView = 'off';

  constructor(
    private readonly framebuffer: Framebuffer,
    private readonly assets: AssetBundle
  ) {
    this.zBuffer = new Float32Array(framebuffer.width);
  }

  /** Uebernimmt Zustand und Inhalte, ohne beides anzufassen. */
  setScene(state: GameState, content: ContentDb): void {
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

  /** Debugansicht umschalten. Der Bootstrap ruft das nur im Entwicklungsbetrieb. */
  setDebugView(view: DebugView): void {
    this.debug = view;
  }

  debugView(): DebugView {
    return this.debug;
  }

  isAnimating(): boolean {
    return this.animation.isAnimating();
  }

  /** Bildschirmrechtecke der zuletzt gezeichneten Gegner, fuer die Zielauswahl. */
  spriteRects(): readonly SpriteRect[] {
    return this.rects;
  }

  /** Treibt die Animationen voran und zeichnet ein Bild in den Framebuffer. */
  render(dtMs: number): void {
    this.animation.advance(dtMs);

    const state = this.state;
    const content = this.content;
    const map = this.renderMap;
    if (state === null || content === null || map === null) return;

    const width = this.framebuffer.width;
    const height = this.framebuffer.height;
    const pixels = this.framebuffer.pixels;

    const position = this.animation.positionOf('player', state.player.pos);
    const camera = makeCamera(position.x, position.y, this.animation.angleOf());

    this.framebuffer.clear();
    drawFloorAndCeiling(
      pixels,
      width,
      height,
      camera,
      map,
      this.assets.textures,
      this.lut,
      this.debug
    );
    drawWalls(
      pixels,
      width,
      height,
      camera,
      map,
      this.assets.textures,
      this.lut,
      this.zBuffer,
      this.debug
    );
    this.rects = drawSprites(
      pixels,
      width,
      height,
      camera,
      map,
      this.collectBillboards(state, content),
      this.lut,
      this.zBuffer
    );

    this.drawWeaponView(pixels, width, height, state, content);
    this.drawHitFlash(pixels);
  }

  private collectBillboards(state: GameState, content: ContentDb): Billboard[] {
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
      const surface = this.assets.sprites[frameName];
      if (surface === undefined) continue;
      const at = this.animation.positionOf(entity.id, entity.pos);
      billboards.push({ id: entity.id, x: at.x, y: at.y, widthTiles, surface });
    }

    for (const corpse of this.animation.corpseFrames(content.enemies)) {
      const surface = this.assets.sprites[corpse.frame];
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
    screenWidth: number,
    screenHeight: number,
    state: GameState,
    content: ContentDb
  ): void {
    const weapon = content.weapons[state.player.equippedWeaponId];
    if (weapon === undefined) return;
    const surface: PixelSurface | undefined = this.assets.weaponSprites[weapon.sprite];
    if (surface === undefined) return;

    const originX = Math.floor((screenWidth - surface.width) / 2);
    const originY =
      screenHeight -
      surface.height +
      Math.round(this.animation.weaponRecoil() * WEAPON_RECOIL_PIXELS);

    for (let y = 0; y < surface.height; y++) {
      const screenY = originY + y;
      if (screenY < 0 || screenY >= screenHeight) continue;
      for (let x = 0; x < surface.width; x++) {
        const screenX = originX + x;
        if (screenX < 0 || screenX >= screenWidth) continue;
        const pixel = surface.pixels[y * surface.width + x] ?? 0;
        if (pixel >>> 24 === 0) continue;
        target[screenY * screenWidth + screenX] = pixel;
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
