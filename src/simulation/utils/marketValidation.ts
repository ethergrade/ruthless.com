import type { MarketTile, Product } from '../../types';

/**
 * An explored tile is a viable validation market when it matches the INVEST
 * thesis, is actually growing, has meaningful demand, and is not already tied
 * to a different product. All tiles passed by the UI or stored by the engine
 * have already been explored/generated.
 */
export const isMarketValidationOpportunity = (tile: MarketTile, product: Product): boolean =>
  product.marketValidationStatus === 'unvalidated'
  && Boolean(product.marketValidationSector)
  && tile.segment === product.marketValidationSector
  && tile.growth > 0
  && tile.demandLevel >= 0.8
  && (!tile.productId || tile.productId === product.id);

/** 0..1 score used by both the engine and UI to explain the quality of a tile. */
export const calculateMarketOpportunityScore = (tile: MarketTile): number => {
  const demand = (tile.demandLevel - 0.5) / 1;
  const growth = tile.growth / 0.25;
  const friction = tile.risk * 0.35 + tile.competitivePressure * 0.35 + tile.regulation * 0.15;
  return Math.max(0, Math.min(1, demand * 0.5 + growth * 0.5 - friction));
};
