import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import type { GameState, MarketTile, MarketSegment, TileId } from '../../../types';
import { SEGMENT_COLORS, SEGMENT_LABELS } from '../../../data/generators';

const TILE_W = 96;
const TILE_H = 48;

/** T: targeting mode — when an action needs a tile, the map highlights valid
 *  tiles and reports the picked tile id instead of just selecting it. */
export interface TargetingState {
  /** returns true if the tile is a legal target for the pending action */
  isValid: (t: MarketTile) => boolean;
  /** called when the player clicks a valid tile */
  onPick: (tileId: TileId) => void;
  /** human-readable hint shown in the banner */
  hint: string;
}

interface Props {
  state: GameState | null;
  selectedTileId: string | null;
  onTileSelect: (tileId: string | null) => void;
  /** T: real-map placement — drop a player building on a tile instead of selecting it. */
  onPlaceTile?: (tileId: string) => void;
  /** T: action targeting — pick a tile directly from the board. */
  targeting?: TargetingState | null;
  /** T: infinite map — stream tiles around a grid cell as the camera pans. */
  onExplore?: (cx: number, cy: number, radius?: number) => void;
}

/* ---- color helpers ------------------------------------------------------- */
function shade(color: number, amt: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)));
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
}
function diamondPoints(cx: number, cy: number): Phaser.Geom.Point[] {
  return [
    new Phaser.Geom.Point(cx, cy - TILE_H / 2),
    new Phaser.Geom.Point(cx + TILE_W / 2, cy),
    new Phaser.Geom.Point(cx, cy + TILE_H / 2),
    new Phaser.Geom.Point(cx - TILE_W / 2, cy),
  ];
}
function isoBox(
  g: Phaser.GameObjects.Graphics,
  cx: number, cyTop: number, w: number, height: number,
  baseColor: number, windows: boolean,
): void {
  const hw = w / 2, hh = w / 4;
  const top = [
    new Phaser.Geom.Point(cx, cyTop - hh), new Phaser.Geom.Point(cx + hw, cyTop),
    new Phaser.Geom.Point(cx, cyTop + hh), new Phaser.Geom.Point(cx - hw, cyTop),
  ];
  const right = [
    new Phaser.Geom.Point(cx + hw, cyTop), new Phaser.Geom.Point(cx, cyTop + hh),
    new Phaser.Geom.Point(cx, cyTop + hh + height), new Phaser.Geom.Point(cx + hw, cyTop + height),
  ];
  const left = [
    new Phaser.Geom.Point(cx - hw, cyTop), new Phaser.Geom.Point(cx, cyTop + hh),
    new Phaser.Geom.Point(cx, cyTop + hh + height), new Phaser.Geom.Point(cx - hw, cyTop + height),
  ];
  g.fillStyle(shade(baseColor, -55), 1); g.fillPoints(left, true);
  g.fillStyle(shade(baseColor, -25), 1); g.fillPoints(right, true);
  g.fillStyle(shade(baseColor, 35), 1); g.fillPoints(top, true);
  if (windows) {
    g.fillStyle(shade(baseColor, 120), 0.9);
    const step = Math.max(4, height / 3);
    for (let y = cyTop + hh + step * 0.6; y < cyTop + hh + height - 2; y += step) {
      g.fillRect(cx - hw * 0.5, y, 3, 3);
      g.fillRect(cx + hw * 0.25, y + step * 0.4, 3, 3);
    }
  }
}

// T: draw a building as a stacked iso box — base footprint (always visible) plus
// one floor per housed department, so mass scales with departments and an empty
// shell still reads on the board. Used for player/rival buildings and startup shells.
function drawBuilding(
  g: Phaser.GameObjects.Graphics,
  glow: Phaser.GameObjects.Graphics,
  sx: number, sy: number, deptCount: number, col: number,
): void {
  const h = Math.min(92, 30 + deptCount * 9);
  const segs = Math.max(1, Math.min(6, deptCount + 1));
  let topY = sy - TILE_H / 2, w = 40;
  for (let s = 0; s < segs; s++) {
    const segH = h / segs;
    isoBox(g, sx, topY, w, segH, col, true);
    topY -= segH; w *= 0.82;
  }
  glow.fillStyle(col, 0.10 + Math.min(0.35, deptCount * 0.05)).fillCircle(sx, sy - h * 0.6, 24);
}

export const MarketMap: React.FC<Props> = ({ state, selectedTileId, onTileSelect, onPlaceTile, targeting, onExplore }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const selectedTileIdRef = useRef(selectedTileId);
  const onTileSelectRef = useRef(onTileSelect);
  const onPlaceTileRef = useRef(onPlaceTile);
  const targetingRef = useRef(targeting);
  const onExploreRef = useRef(onExplore);
  const camStateRef = useRef<{ zoom: number; rotation: number; scrollX: number; scrollY: number } | null>(null);

  useEffect(() => { selectedTileIdRef.current = selectedTileId; }, [selectedTileId]);
  useEffect(() => { onTileSelectRef.current = onTileSelect; }, [onTileSelect]);
  useEffect(() => { onPlaceTileRef.current = onPlaceTile; }, [onPlaceTile]);
  useEffect(() => { targetingRef.current = targeting; }, [targeting]);
  useEffect(() => { onExploreRef.current = onExplore; }, [onExplore]);

  // Rebuild the Phaser scene only when a new game state object is created.
  useEffect(() => {
    if (!containerRef.current || !state) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      backgroundColor: '#05060d',
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      scene: { preload, create, update },
      render: { antialias: true },
    };

    function preload(this: Phaser.Scene) {
      const tex = this.textures.createCanvas('glow', 64, 64);
      if (tex) {
        const ctx = tex.getContext();
        const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grd.addColorStop(0, 'rgba(255,255,255,0.9)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64);
        tex.refresh();
      }
    }

    function create(this: Phaser.Scene) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias -- stable alias for nested closures
      const scene = this;
      const W = scene.scale.width || containerRef.current!.clientWidth;
      const H = scene.scale.height || containerRef.current!.clientHeight;

      const companyColors = new Map<string, number>();
      state!.companies.forEach((c) =>
        companyColors.set(c.id, Phaser.Display.Color.HexStringToColor(c.color).color));

      /* ---- backdrops: static screen frame + world floor grid ----------- */
      const bg = scene.add.graphics().setDepth(0).setScrollFactor(0);
      const floor = scene.add.graphics().setDepth(0);
      const drawBackdrops = (w: number, h: number) => {
        bg.clear();
        bg.fillStyle(0x07080f, 1).fillRect(0, 0, w, h);
        bg.lineStyle(1, 0x12203a, 0.35);
        for (let gx = 0; gx <= w; gx += 48) bg.lineBetween(gx, 0, gx, h);
        for (let gy = 0; gy <= h; gy += 48) bg.lineBetween(0, gy, w, gy);
        bg.fillStyle(0x05060d, 0.5);
        bg.fillRect(0, 0, w, h * 0.1); bg.fillRect(0, h * 0.9, w, h * 0.1);
        bg.fillRect(0, 0, w * 0.06, h); bg.fillRect(w * 0.94, 0, w * 0.06, h);
      };
      drawBackdrops(W, H);
      scene.scale.on('resize', (gs: Phaser.Structs.Size) => drawBackdrops(gs.width, gs.height));

      const scan = scene.add.graphics().setDepth(0).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD);
      (scene as unknown as { _scan: Phaser.GameObjects.Graphics })._scan = scan;

      /* ---- world layers (redrawn each frame in viewport) -------------- */
      const tileLayer = scene.add.graphics().setDepth(1);
      const linesLayer = scene.add.graphics().setDepth(1.5).setBlendMode(Phaser.BlendModes.ADD);
      const glowLayer = scene.add.graphics().setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
      const overlay = scene.add.graphics().setDepth(5);

      const hideRivals = state?.phase === 'placement';

      /* ---- inverse projection + O(1) tile pick via spatial index ------- */
      const screenToTile = (wx: number, wy: number): MarketTile | null => {
        const ix = wx / (TILE_W / 2);
        const iy = wy / (TILE_H / 2);
        const gx = Math.round((ix + iy) / 2);
        const gy = Math.round((iy - ix) / 2);
        const id = state!.tileIndex[`${gx},${gy}`];
        if (id) return state!.marketTiles.get(id) ?? null;
        // T: infinite map — materialize the tile on demand if it was never seen.
        onExploreRef.current?.(gx, gy, 2);
        return state!.marketTiles.get(state!.tileIndex[`${gx},${gy}`] ?? '') ?? null;
      };

      const toWorld = (t: MarketTile) => ({
        x: (t.x - t.y) * (TILE_W / 2),
        y: (t.x + t.y) * (TILE_H / 2),
      });

      // T: draw only the tiles intersecting the camera viewport (culling).
      const drawWorld = () => {
        const cam = scene.cameras.main;
        tileLayer.clear(); linesLayer.clear(); glowLayer.clear(); overlay.clear();

        // visible world rect -> grid range
        const tl = cam.getWorldPoint(0, 0);
        const br = cam.getWorldPoint(scene.scale.width, scene.scale.height);
        const gxMin = Math.floor(((tl.x / (TILE_W / 2)) + (tl.y / (TILE_H / 2))) / 2) - 2;
        const gxMax = Math.ceil(((br.x / (TILE_W / 2)) + (br.y / (TILE_H / 2))) / 2) + 2;
        const gyMin = Math.floor(((br.y / (TILE_H / 2)) - (br.x / (TILE_W / 2))) / 2) - 2;
        const gyMax = Math.ceil(((tl.y / (TILE_H / 2)) - (tl.x / (TILE_W / 2))) / 2) + 2;

        // T: light infinite grid — draw empty diamond outlines across the visible
        // range so the world reads as boundless even before tiles are generated.
        floor.clear();
        floor.lineStyle(1, 0x14233f, 0.35);
        for (let gy = gyMin; gy <= gyMax; gy++) {
          for (let gx = gxMin; gx <= gxMax; gx++) {
            const sx = (gx - gy) * (TILE_W / 2);
            const sy = (gx + gy) * (TILE_H / 2);
            floor.strokePoints(diamondPoints(sx, sy), true);
          }
        }

        // territory lines (cheap, only for owned tiles)
        const byCompany = new Map<string, MarketTile[]>();
        state!.marketTiles.forEach((t) => {
          if (t.controllerId) {
            if (!byCompany.has(t.controllerId)) byCompany.set(t.controllerId, []);
            byCompany.get(t.controllerId)!.push(t);
          }
        });
        byCompany.forEach((list, cid) => {
          if (hideRivals && cid !== state!.playerCompanyId) return;
          const col = companyColors.get(cid) || 0x00d4aa;
          linesLayer.lineStyle(1.5, col, 0.18);
          const cxavg = list.reduce((s, t) => s + toWorld(t).x, 0) / list.length;
          const cyavg = list.reduce((s, t) => s + toWorld(t).y, 0) / list.length;
          list.forEach((t) => {
            const c = toWorld(t);
            linesLayer.lineBetween(c.x, c.y, cxavg, cyavg);
          });
        });

        const tgt = targetingRef.current;
        state!.marketTiles.forEach((t) => {
          if (t.x < gxMin || t.x > gxMax || t.y < gyMin || t.y > gyMax) return; // cull
          const c = toWorld(t);
          const sx = c.x, sy = c.y;
          const ownedByPlayer = !!t.controllerId && t.controllerId === state!.playerCompanyId;
          const owned = hideRivals ? ownedByPlayer : !!t.controllerId;
          const contested = owned && t.challengerId && t.challengerId !== t.controllerId;
          const fill = owned
            ? contested ? 0x241433
              : (t.controllerId === state!.playerCompanyId ? 0x0c2a24 : 0x1a1320)
            : 0x0d0f1a;
          const segCol = Phaser.Display.Color.HexStringToColor(SEGMENT_COLORS[t.segment]).color;
          tileLayer.fillStyle(fill, 1).fillPoints(diamondPoints(sx, sy), true);
          tileLayer.lineStyle(2, segCol, owned ? 0.55 : 0.35).strokePoints(diamondPoints(sx, sy), true);

          // T: targeting highlight — valid tiles pulse brighter
          if (tgt && tgt.isValid(t)) {
            tileLayer.lineStyle(3, 0x00ffa3, 0.9).strokePoints(diamondPoints(sx, sy), true);
          }

          if (owned) {
            const col = companyColors.get(t.controllerId!) || 0x00d4aa;
            const building = t.buildingId ? state!.companies.get(t.controllerId!)?.buildings.find(b => b.id === t.buildingId) : undefined;
            const deptCount = building ? building.departmentIds.length : 0;
            drawBuilding(tileLayer, glowLayer, sx, sy, deptCount, col);
          } else if (t.isStartupTile && !t.buildingId && !hideRivals) {
            drawBuilding(tileLayer, glowLayer, sx, sy, 0, 0x8a94a6);
          }
          if (t.isStartupTile && !hideRivals) {
            const pot = t.startupPotential ?? 'empty';
            const starCol = pot === 'high' ? 0xffd166 : pot === 'promising' ? 0xf4a259 : 0x8a8f9c;
            tileLayer.lineStyle(2.5, starCol, 0.9).strokePoints(diamondPoints(sx, sy), true);
            const star = scene.add.text(sx, sy - 6, pot === 'empty' ? '✦' : '★', {
              fontFamily: 'JetBrains Mono, monospace', fontSize: '16px', color: '#ffd166',
            }).setOrigin(0.5).setDepth(6);
            star.setShadow(0, 0, '#000', 4);
            if (pot !== 'empty') {
              glowLayer.fillStyle(starCol, 0.18 + (pot === 'high' ? 0.18 : 0.08)).fillCircle(sx, sy - 18, 20);
            }
          } else if (t.productId) {
            tileLayer.fillStyle(0x00d4aa, 1).fillCircle(sx, sy - 6, 4);
          }
          if (t.pendingAction) {
            const paCol = t.pendingAction.byCompanyId === state!.playerCompanyId ? 0x00ffa3 : 0xff5c5c;
            glowLayer.fillStyle(paCol, 0.5).fillCircle(sx, sy - 40, 12);
            overlay.lineStyle(2, paCol, 0.9).strokeCircle(sx, sy - 40, 9);
            const pulse = scene.add.text(sx, sy - 40, '!', {
              fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: '#0b0e16', fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(6);
            scene.tweens.add({ targets: pulse, alpha: { from: 0.4, to: 1 }, duration: 600, yoyo: true, repeat: -1 });
          }
        });

        // selection / hover ring
        const ring = (id: string, color: number) => {
          const t = state!.marketTiles.get(id);
          if (!t) return;
          const c = toWorld(t);
          overlay.lineStyle(2.5, color, 0.9).strokePoints(diamondPoints(c.x, c.y), true);
        };
        if (selectedTileIdRef.current) ring(selectedTileIdRef.current, 0xffc107);
      };
      (scene as unknown as { _drawWorld: () => void })._drawWorld = drawWorld;

      /* ---- tooltip (counter-rotated, screen space) --------------------- */
      const tooltip = scene.add.container(0, 0).setDepth(100).setScrollFactor(0).setVisible(false);
      const tipBg = scene.add.graphics();
      const tipText = scene.add.text(0, 0, '', {
        fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#e8e8f0', lineSpacing: 4,
      });
      tooltip.add([tipBg, tipText]);

      /* ---- camera: fit / restore + controls ---------------------------- */
      const cam = scene.cameras.main;
      scene.input.mouse?.disableContextMenu();
      const camState = { zoom: 1, rot: 0, scrollX: 0, scrollY: 0 };
      const setCamZoom = (z: number) => { cam.setZoom(z); camState.zoom = z; };
      const setCamRot = (r: number) => { cam.setRotation(r); camState.rot = r; };
      const setCamScroll = (x: number, y: number) => { cam.setScroll(x, y); camState.scrollX = x; camState.scrollY = y; };
      const syncCamState = () => {
        camStateRef.current = { zoom: camState.zoom, rotation: camState.rot, scrollX: camState.scrollX, scrollY: camState.scrollY };
      };

      const saved = camStateRef.current;
      if (saved) {
        setCamZoom(saved.zoom); setCamRot(saved.rotation);
        setCamScroll(saved.scrollX, saved.scrollY);
      } else {
        const margin = 120;
        const fit = Math.min(W / (TILE_W * 8 + margin * 2), H / (TILE_H * 16 + margin * 2));
        setCamZoom(Phaser.Math.Clamp(fit * 0.95, 0.35, 1.4));
        cam.centerOn(0, 0);
      }

      const spaceKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      scene.input.keyboard!.addCapture('SPACE');
      const keyQ = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
      const keyE = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
      keyQ.on('down', () => { setCamRot(camState.rot - Phaser.Math.DegToRad(90)); syncCamState(); });
      keyE.on('down', () => { setCamRot(camState.rot + Phaser.Math.DegToRad(90)); syncCamState(); });

      let panning = false, lastPX = 0, lastPY = 0, hoverId: string | null = null;
      scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        const isPan = p.middleButtonDown() || p.rightButtonDown() || (spaceKey.isDown && p.leftButtonDown());
        if (isPan) { panning = true; lastPX = p.x; lastPY = p.y; scene.input.setDefaultCursor('grabbing'); return; }
        const t = screenToTile(p.worldX, p.worldY);
        const tgt = targetingRef.current;
        if (t && tgt && tgt.isValid(t)) {
          tgt.onPick(t.id);
        } else if (t && state?.phase === 'placement' && onPlaceTileRef.current) {
          onPlaceTileRef.current(t.id);
        } else {
          onTileSelectRef.current(t ? t.id : null);
        }
      });

      scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (panning) {
          cam.scrollX -= (p.x - lastPX) / cam.zoom;
          cam.scrollY -= (p.y - lastPY) / cam.zoom;
          lastPX = p.x; lastPY = p.y; syncCamState();
          // T: stream new tiles as the camera leaves explored space
          const c = cam.getWorldPoint(scene.scale.width / 2, scene.scale.height / 2);
          const gx = Math.round((c.x / (TILE_W / 2) + c.y / (TILE_H / 2)) / 2);
          const gy = Math.round((c.y / (TILE_H / 2) - c.x / (TILE_W / 2)) / 2);
          onExploreRef.current?.(gx, gy, 12);
          return;
        }
        const t = screenToTile(p.worldX, p.worldY);
        const id = t?.id || null;
        if (id !== hoverId) {
          hoverId = id;
          if (id) {
            const ctrl = t!.controllerId ? state!.companies.get(t!.controllerId) : null;
            const ch = t!.challengerId ? state!.companies.get(t!.challengerId) : null;
            let txt = `${t!.id.replace('tile_', '').toUpperCase()}\nSegment: ${t!.segment.replace('_', ' ')}\n`;
            txt += `Value: $${t!.value.toLocaleString()}\nGrowth: ${(t!.growth * 100).toFixed(1)}%\nRisk: ${(t!.risk * 100).toFixed(0)}%\nControl: ${(t!.controlStrength * 100).toFixed(0)}%`;
            if (ctrl) txt += `\nOwner: ${ctrl.name}`;
            if (ch) txt += `\nChallenger: ${ch.name}`;
            if (t!.isStartupTile) {
              const pp = t!.startupPotential ?? 'empty';
              txt += `\n★ STARTUP (${pp === 'empty' ? 'empty shell — blind buy' : pp})`;
            }
            tipText.setText(txt);
            tipBg.clear().fillStyle(0x141420, 0.95).fillRoundedRect(0, 0, tipText.width + 20, tipText.height + 18, 6)
              .lineStyle(1, 0x00d4aa, 0.6).strokeRoundedRect(0, 0, tipText.width + 20, tipText.height + 18, 6);
            tooltip.setPosition(p.x + 16, p.y + 16).setVisible(true);
          } else tooltip.setVisible(false);
        }
      });
      const stopPan = () => { panning = false; scene.input.setDefaultCursor('default'); };
      scene.input.on('pointerup', stopPan);
      scene.input.on('pointerout', () => { stopPan(); hoverId = null; tooltip.setVisible(false); });
      scene.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        const wp = cam.getWorldPoint(p.x, p.y);
        const nz = Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.3, 2.5);
        cam.setZoom(nz);
        const wp2 = cam.getWorldPoint(p.x, p.y);
        cam.scrollX += wp.x - wp2.x; cam.scrollY += wp.y - wp2.y;
        syncCamState();
      });

      drawWorld();
    }

    function update(this: Phaser.Scene, time: number) {
      const scan = (this as unknown as { _scan?: Phaser.GameObjects.Graphics })._scan;
      if (scan) {
        const H = this.scale.height, W = this.scale.width;
        const y = (time * 0.04) % (H + 80) - 40;
        scan.clear(); scan.fillStyle(0x00d4aa, 0.05).fillRect(0, y, W, 60);
      }
      const drawWorld = (this as unknown as { _drawWorld?: () => void })._drawWorld;
      drawWorld?.();
    }

      const game = new Phaser.Game(config);
      gameRef.current = game;
      return () => { game.destroy(true); gameRef.current = null; };
  }, [state]);

  return (
    <div className="market-map-wrap">
      <div ref={containerRef} className="market-map-container" />
      <div className="map-controls-hint">
        <span><b>DRAG</b> (o Spazio+tasto) = pan</span>
        <span><b>WHEEL</b> = zoom</span>
        <span><b>Q / E</b> = ruota 90°</span>
      </div>
      {targeting && (
        <div className="map-targeting-banner">{targeting.hint}</div>
      )}
      <div className="segment-legend">
        <div className="legend-title">Market Segments</div>
        {Object.entries(SEGMENT_COLORS).map(([seg, col]) => (
          <div key={seg} className="legend-row">
            <span className="legend-swatch" style={{ background: col }} />
            <span className="legend-label">{SEGMENT_LABELS[seg as MarketSegment]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
