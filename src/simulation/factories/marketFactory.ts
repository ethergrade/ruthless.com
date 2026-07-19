import { createRNG } from '../utils/rng';
import { generateId } from '../utils/ids';
import type { MarketTile, MarketSegment, TileId } from '../../types';

const SEGMENTS: MarketSegment[] = [
  'open_market', 'enterprise_cluster', 'public_sector', 'regulated_industry',
  'innovation_hub', 'price_sensitive', 'high_growth', 'legacy_market',
  'strategic_account', 'startup_zone',
];

/** T — deterministic per-tile RNG seeded from world seed + coords, so the same
 *  (x,y) always yields the same tile (infinite, reproducible world). */
const tileRng = (seed: number, x: number, y: number): ReturnType<typeof createRNG> => {
  // Cantor-ish pairing into a single int, then fold with the world seed.
  const combined = ((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) >>> 0;
  return createRNG(combined || 1);
};

export const createTile = (
  seed: number,
  x: number,
  y: number,
  forcedSegment?: MarketSegment,
): MarketTile => {
  const rng = tileRng(seed, x, y);
  const id: TileId = generateId.tile();
  const segment = forcedSegment ?? SEGMENTS[rng.nextInt(0, SEGMENTS.length - 1)];
  const baseValue = rng.nextInt(100000, 1000000);
  const growth = rng.nextFloat(-0.05, 0.25);
  const risk = rng.nextFloat(0.1, 0.5);
  const regulation = rng.nextFloat(0.1, 0.4);
  const loyalty = rng.nextFloat(0.3, 0.8);
  const demandLevel = rng.nextFloat(0.5, 1.5);
  const priceSensitivity = rng.nextFloat(0.3, 0.9);
  const techMaturity = rng.nextFloat(0.2, 0.9);
  const acquisitionCost = Math.round(baseValue * rng.nextFloat(0.5, 1.5));
  const competitivePressure = rng.nextFloat(0.1, 0.6);

  return {
    id,
    x,
    y,
    segment,
    value: baseValue,
    growth,
    risk,
    regulation,
    loyalty,
    controllerId: undefined,
    challengerId: undefined,
    controlStrength: 0,
    productId: undefined,
    demandLevel,
    priceSensitivity,
    techMaturity,
    acquisitionCost,
    competitivePressure,
    buildingId: undefined,
    baseQuality: 0,
  };
};

/** Generate a rectangular region of tiles into the provided map + index.
 *  Idempotent: skips tiles already present. Used for the initial board and for
 *  lazy streaming of infinite chunks. */
export const generateChunk = (
  seed: number,
  tiles: Map<TileId, MarketTile>,
  tileIndex: Record<string, TileId>,
  cx: number,
  cy: number,
  radius: number,
  forcedSegment?: MarketSegment,
): void => {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const key = `${x},${y}`;
      if (tileIndex[key]) continue; // already generated
      const t = createTile(seed, x, y, forcedSegment);
      tiles.set(t.id, t);
      tileIndex[key] = t.id;
    }
  }
};

/** Initial finite board (the player starts here). The world extends infinitely
 *  beyond this via generateChunk() on demand. */
export const createMarketMap = (
  rng: ReturnType<typeof createRNG>,
  width = 8,
  height = 8,
  seed = 1,
): Map<TileId, MarketTile> => {
  const tiles = new Map<TileId, MarketTile>();
  const tileIndex: Record<string, TileId> = {};
  const mw = Math.floor(width / 2), mh = Math.floor(height / 2);
  generateChunk(seed, tiles, tileIndex, mw, mh, Math.max(mw, mh));
  // keep `rng` referenced for API compatibility (seed drives determinism now)
  void rng;
  return tiles;
};

/** Build the tileIndex for a freshly loaded tile set (e.g. after save/load of a
 *  full snapshot). For diff-based saves the index is reconstructed from coords. */
export const buildTileIndex = (tiles: Map<TileId, MarketTile>): Record<string, TileId> => {
  const idx: Record<string, TileId> = {};
  tiles.forEach(t => { idx[`${t.x},${t.y}`] = t.id; });
  return idx;
};

/** O(1) tile lookup by grid coords using the spatial index. */
export const tileAt = (tileIndex: Record<string, TileId>, x: number, y: number): TileId | undefined =>
  tileIndex[`${x},${y}`];

export const getSegmentName = (segment: MarketSegment): string => {
  const names: Record<MarketSegment, string> = {
    open_market: 'Open Market',
    enterprise_cluster: 'Enterprise Cluster',
    public_sector: 'Public Sector',
    regulated_industry: 'Regulated Industry',
    innovation_hub: 'Innovation Hub',
    price_sensitive: 'Price-Sensitive Segment',
    high_growth: 'High-Growth Segment',
    legacy_market: 'Legacy Market',
    strategic_account: 'Strategic Account',
    startup_zone: 'Startup Zone',
  };
  return names[segment];
};

export const getSegmentColor = (segment: MarketSegment): string => {
  const colors: Record<MarketSegment, string> = {
    open_market: '#4a4a6a',
    enterprise_cluster: '#1a5f7a',
    public_sector: '#2d5a2d',
    regulated_industry: '#5a2d5a',
    innovation_hub: '#1a7a7a',
    price_sensitive: '#7a5a1a',
    high_growth: '#7a1a3a',
    legacy_market: '#5a5a2d',
    strategic_account: '#2d3a5a',
    startup_zone: '#5a1a4a',
  };
  return colors[segment];
};

export const getAdjacentTiles = (tiles: Map<TileId, MarketTile>, tileId: string): MarketTile[] => {
  const tile = tiles.get(tileId);
  if (!tile) return [];

  const adjacent: MarketTile[] = [];
  const directions = [
    { dx: 0, dy: -1 }, { dx: 1, dy: 0 },
    { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
    { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
    { dx: 1, dy: 1 }, { dx: -1, dy: 1 },
  ];

  for (const { dx, dy } of directions) {
    const neighbor = Array.from(tiles.values()).find(
      t => t.x === tile.x + dx && t.y === tile.y + dy
    );
    if (neighbor) adjacent.push(neighbor);
  }

  return adjacent;
};
