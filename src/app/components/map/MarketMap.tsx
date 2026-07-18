import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import type { GameState, MarketTile, MarketSegment } from '../../../types';
import { SEGMENT_COLORS, SEGMENT_LABELS } from '../../../data/generators';

const TILE_W = 96;
const TILE_H = 48;

interface Props {
  state: GameState | null;
  selectedTileId: string | null;
  onTileSelect: (tileId: string | null) => void;
  /** T: real-map placement — drop a player building on a tile instead of selecting it. */
  onPlaceTile?: (tileId: string) => void;
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

export const MarketMap: React.FC<Props> = ({ state, selectedTileId, onTileSelect, onPlaceTile }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const selectedTileIdRef = useRef(selectedTileId);
  const onTileSelectRef = useRef(onTileSelect);
  const onPlaceTileRef = useRef(onPlaceTile);
  const camStateRef = useRef<{ zoom: number; rotation: number; scrollX: number; scrollY: number } | null>(null);

  useEffect(() => { selectedTileIdRef.current = selectedTileId; }, [selectedTileId]);
  useEffect(() => { onTileSelectRef.current = onTileSelect; }, [onTileSelect]);
  useEffect(() => { onPlaceTileRef.current = onPlaceTile; }, [onPlaceTile]);
  // Rebuild the Phaser scene only when a new game state object is created.
  // (selection / callbacks flow through refs so they never reset the camera.)
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
      // eslint-disable-next-line @typescript-eslint/no-this-alias -- we need a stable alias for nested closures
      const scene = this;
      const W = scene.scale.width || containerRef.current!.clientWidth;
      const H = scene.scale.height || containerRef.current!.clientHeight;

      const tiles = Array.from(state!.marketTiles.values());
      const centers = new Map<string, { x: number; y: number }>();
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      tiles.forEach((t) => {
        const ix = (t.x - t.y) * (TILE_W / 2);
        const iy = (t.x + t.y) * (TILE_H / 2);
        centers.set(t.id, { x: ix, y: iy });
        minX = Math.min(minX, ix); maxX = Math.max(maxX, ix);
        minY = Math.min(minY, iy); maxY = Math.max(maxY, iy);
      });
      const offX = W / 2 - (minX + maxX) / 2;
      const offY = H / 2 - (minY + maxY) / 2 - TILE_H * 0.5;
      const boardW = maxX - minX + TILE_W;
      const boardH = maxY - minY + TILE_H * 3;
      const boardCenter = { x: offX + (minX + maxX) / 2, y: offY + (minY + maxY) / 2 };

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
        floor.clear();
        const pad = 700;
        floor.lineStyle(1, 0x14233f, 0.45);
        for (let gx = offX - pad; gx <= offX + maxX + pad; gx += 64) floor.lineBetween(gx, offY - pad, gx, offY + maxY + pad);
        for (let gy = offY - pad; gy <= offY + maxY + pad; gy += 64) floor.lineBetween(offX - pad, gy, offX + maxX + pad, gy);
      };
      drawBackdrops(W, H);
      scene.scale.on('resize', (gs: Phaser.Structs.Size) => drawBackdrops(gs.width, gs.height));

      const scan = scene.add.graphics().setDepth(0).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD);
      (scene as unknown as { _scan: Phaser.GameObjects.Graphics })._scan = scan;

      /* ---- tiles + buildings + network lines --------------------------- */
      const tileLayer = scene.add.graphics().setDepth(1);
      const linesLayer = scene.add.graphics().setDepth(1.5).setBlendMode(Phaser.BlendModes.ADD);
      const glowLayer = scene.add.graphics().setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
      const sorted = [...tiles].sort((a, b) => a.x + a.y - (b.x + b.y));

      const byCompany = new Map<string, MarketTile[]>();
      tiles.forEach((t) => {
        if (t.controllerId) {
          if (!byCompany.has(t.controllerId)) byCompany.set(t.controllerId, []);
          byCompany.get(t.controllerId)!.push(t);
        }
      });
      // T: during real-map placement, rivals/startups are hidden — only the player's
      // tiles (dropped live) show. Territory lines therefore skip non-player corps.
      const hideRivals = state?.phase === 'placement';
      byCompany.forEach((list, cid) => {
        if (hideRivals && cid !== state!.playerCompanyId) return;
        const col = companyColors.get(cid) || 0x00d4aa;
        linesLayer.lineStyle(1.5, col, 0.18);
        const cxavg = list.reduce((s, t) => s + centers.get(t.id)!.x, 0) / list.length;
        const cyavg = list.reduce((s, t) => s + centers.get(t.id)!.y, 0) / list.length;
        list.forEach((t) => {
          const c = centers.get(t.id)!;
          linesLayer.lineBetween(offX + c.x, offY + c.y, offX + cxavg, offY + cyavg);
        });
      });

      sorted.forEach((t) => {
        const c = centers.get(t.id)!;
        const sx = offX + c.x, sy = offY + c.y;
        const ownedByPlayer = !!t.controllerId && t.controllerId === state!.playerCompanyId;
        // T: in placement, only the player's own tiles read as owned; rivals/startups
        // are masked so the board looks empty until the player finishes.
        const owned = hideRivals ? ownedByPlayer : !!t.controllerId;
        const contested = owned && t.challengerId && t.challengerId !== t.controllerId;
        const fill = owned
          ? contested ? 0x241433
            : (t.controllerId === state!.playerCompanyId ? 0x0c2a24 : 0x1a1320)
          : 0x0d0f1a;
        tileLayer.fillStyle(fill, 1).fillPoints(diamondPoints(sx, sy), true);
        // Segment-colored border so market segments read by color (P6-C).
        const segCol = Phaser.Display.Color.HexStringToColor(SEGMENT_COLORS[t.segment]).color;
        tileLayer.lineStyle(2, segCol, owned ? 0.55 : 0.35).strokePoints(diamondPoints(sx, sy), true);
        if (owned) {
          const col = companyColors.get(t.controllerId!) || 0x00d4aa;
          const building = t.buildingId ? state!.companies.get(t.controllerId!)?.buildings.find(b => b.id === t.buildingId) : undefined;
          const deptCount = building ? building.departmentIds.length : 0;
          drawBuilding(tileLayer, glowLayer, sx, sy, deptCount, col);
        } else if (t.isStartupTile && !t.buildingId && !hideRivals) {
          // T: empty-shell startups still render a base-height building (grey) so
          // the board reads as occupied; departments raise it (same rule as all).
          drawBuilding(tileLayer, glowLayer, sx, sy, 0, 0x8a94a6);
        }
        // Startup territories: distinct amber border + a marker. "Empty" shells
        // are blind buys (no building); promising/high carry a building + idea.
        // Hidden entirely during placement so the board reads as empty.
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
        // In-progress offensive action marker (cyber / legal / physical raid).
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
      scene.tweens.add({ targets: glowLayer, alpha: { from: 0.6, to: 1 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

      /* ---- tooltip (counter-rotated, screen space) --------------------- */
      const tooltip = scene.add.container(0, 0).setDepth(100).setScrollFactor(0).setVisible(false);
      const tipBg = scene.add.graphics();
      const tipText = scene.add.text(0, 0, '', {
        fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#e8e8f0', lineSpacing: 4,
      });
      tooltip.add([tipBg, tipText]);

      const overlay = scene.add.graphics().setDepth(5);
      const screenToTile = (wx: number, wy: number): MarketTile | null => {
        const ix = (wx - offX) / (TILE_W / 2);
        const iy = (wy - offY) / (TILE_H / 2);
        const gx = Math.round((ix + iy) / 2);
        const gy = Math.round((iy - ix) / 2);
        return tiles.find((t) => t.x === gx && t.y === gy) || null;
      };
      const drawOverlay = (hoverId?: string | null) => {
        overlay.clear();
        const ring = (id: string, color: number) => {
          const c = centers.get(id); if (!c) return;
          overlay.lineStyle(2.5, color, 0.9).strokePoints(diamondPoints(offX + c.x, offY + c.y), true);
        };
        if (hoverId && hoverId !== selectedTileIdRef.current) ring(hoverId, 0xffffff);
        if (selectedTileIdRef.current) ring(selectedTileIdRef.current, 0xffc107);
      };
      (scene as unknown as { _drawOverlay: (id?: string | null) => void })._drawOverlay = drawOverlay;
      drawOverlay();

      /* ---- camera: fit / restore + controls ---------------------------- */
      const cam = scene.cameras.main;
      scene.input.mouse?.disableContextMenu();
      const camState = { zoom: 1, rot: 0, scrollX: 0, scrollY: 0 };
      const setCamZoom = (z: number) => { cam.setZoom(z); camState.zoom = z; };
      const setCamRot = (r: number) => { cam.setRotation(r); camState.rot = r; };
      const setCamScroll = (x: number, y: number) => { cam.setScroll(x, y); camState.scrollX = x; camState.scrollY = y; };
      const syncCamState = () => {
        const sceneAny = scene as unknown as { _camRot?: number; _camZoom?: number };
        sceneAny._camRot = camState.rot;
        sceneAny._camZoom = camState.zoom;
        camStateRef.current = { zoom: camState.zoom, rotation: camState.rot, scrollX: camState.scrollX, scrollY: camState.scrollY };
      };

      const saved = camStateRef.current;
      if (saved) {
        setCamZoom(saved.zoom); setCamRot(saved.rotation);
        setCamScroll(saved.scrollX, saved.scrollY);
      } else {
        const margin = 120;
        const fit = Math.min(W / (boardW + margin * 2), H / (boardH + margin * 2));
        setCamZoom(Phaser.Math.Clamp(fit * 0.95, 0.35, 1.4));
        cam.centerOn(boardCenter.x, boardCenter.y);
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
        // T: in placement mode, a click drops a building on the tile (if free);
        // otherwise it just selects (drives the DEPARTMENTS tab).
        if (t && state?.phase === 'placement' && onPlaceTileRef.current) {
          onPlaceTileRef.current(t.id);
        } else {
          onTileSelectRef.current(t ? t.id : null);
        }
      });

      scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (panning) {
          cam.scrollX -= (p.x - lastPX) / cam.zoom;
          cam.scrollY -= (p.y - lastPY) / cam.zoom;
          lastPX = p.x; lastPY = p.y; syncCamState(); return;
        }
        const t = screenToTile(p.worldX, p.worldY);
        const id = t?.id || null;
        if (id !== hoverId) {
          hoverId = id; drawOverlay(id);
          scene.input.setDefaultCursor(id ? 'pointer' : 'default');
          if (t) {
            const ctrl = t.controllerId ? state!.companies.get(t.controllerId) : null;
            const ch = t.challengerId ? state!.companies.get(t.challengerId) : null;
            let txt = `${t.id.replace('tile_', '').toUpperCase()}\nSegment: ${t.segment.replace('_', ' ')}\n`;
            txt += `Value: $${t.value.toLocaleString()}\nGrowth: ${(t.growth * 100).toFixed(1)}%\nRisk: ${(t.risk * 100).toFixed(0)}%\nControl: ${(t.controlStrength * 100).toFixed(0)}%`;
            if (ctrl) txt += `\nOwner: ${ctrl.name}`;
            if (ch) txt += `\nChallenger: ${ch.name}`;
            if (t.isStartupTile) {
              const p = t.startupPotential ?? 'empty';
              txt += `\n★ STARTUP (${p === 'empty' ? 'empty shell — blind buy' : p})`;
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
      scene.input.on('pointerout', () => { stopPan(); hoverId = null; drawOverlay(); tooltip.setVisible(false); });
      scene.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        const wp = cam.getWorldPoint(p.x, p.y);
        const nz = Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.3, 2.5);
        cam.setZoom(nz);
        const wp2 = cam.getWorldPoint(p.x, p.y);
        cam.scrollX += wp.x - wp2.x; cam.scrollY += wp.y - wp2.y;
        syncCamState();
      });

      (scene as unknown as { _camState: () => void })._camState = syncCamState;
    }

    function update(this: Phaser.Scene, time: number) {
      const scan = (this as unknown as { _scan?: Phaser.GameObjects.Graphics })._scan;
      if (scan) {
        const H = this.scale.height, W = this.scale.width;
        const y = (time * 0.04) % (H + 80) - 40;
        scan.clear(); scan.fillStyle(0x00d4aa, 0.05).fillRect(0, y, W, 60);
      }
      // keep tooltip upright/crisp under camera rotation & zoom
      const tip = this.children.list.find((c) => c instanceof Phaser.GameObjects.Container && (c as Phaser.GameObjects.Container).depth === 100) as Phaser.GameObjects.Container | undefined;
      const camRot = (this as unknown as { _camRot?: number })._camRot ?? 0;
      const camZoom = (this as unknown as { _camZoom?: number })._camZoom ?? 1;
      if (tip) { tip.setRotation(-camRot); tip.setScale(1 / camZoom); }
      // resync selection ring if selectedTileId changed via props
      const sel = selectedTileIdRef.current;
      const last = (this as unknown as { _lastSel?: string | null })._lastSel;
      if (sel !== last) {
        (this as unknown as { _lastSel?: string | null })._lastSel = sel;
        (this as unknown as { _drawOverlay?: (id?: string | null) => void })._drawOverlay?.(undefined);
      }
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
