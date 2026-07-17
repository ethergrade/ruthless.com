import { createRNG } from '../utils/rng';
import { generateId } from '../utils/ids';
import type { MarketTile, MarketSegment } from '../../types';

const SEGMENTS: MarketSegment[] = [
  'open_market', 'enterprise_cluster', 'public_sector', 'regulated_industry',
  'innovation_hub', 'price_sensitive', 'high_growth', 'legacy_market',
  'strategic_account', 'startup_zone',
];

export const createMarketMap = (
  rng: ReturnType<typeof createRNG>,
  width = 8,
  height = 8
): Map<string, MarketTile> => {
  const tiles = new Map<string, MarketTile>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const segment = rng.shuffle([...SEGMENTS]).pop()!;
      const tile = createTile(rng, x, y, segment);
      tiles.set(tile.id, tile);
    }
  }

  return tiles;
};

const createTile = (
  rng: ReturnType<typeof createRNG>,
  x: number,
  y: number,
  segment: MarketSegment
): MarketTile => {
  const id = generateId.tile();
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
  };
};

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

export const getAdjacentTiles = (tiles: Map<string, MarketTile>, tileId: string): MarketTile[] => {
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
