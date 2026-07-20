import type { CompanyId, MarketTrend, TurnAction, WeakSignal } from '../../types';

/** Global Trend EXPLOIT captures market territory; it never forces a product launch. */
export const createTrendExploitDraft = (
  companyId: CompanyId,
  trend: MarketTrend,
  timestamp = Date.now(),
): TurnAction => ({
  id: `exploit_${trend.category}_${timestamp}`,
  companyId,
  type: 'expand_market',
  budget: 200_000,
  priority: 1,
  status: 'planned',
  productCategory: trend.category,
  targetSegments: [trend.sector],
  trendId: trend.id,
});

/** Weak Signal INVEST remains an early product bet bound to its category and sector. */
export const createWeakSignalInvestmentDraft = (
  companyId: CompanyId,
  signal: WeakSignal,
  timestamp = Date.now(),
): TurnAction => ({
  id: `invest_${signal.relatedCategory}_${timestamp}`,
  companyId,
  type: 'launch_product',
  budget: 300_000,
  priority: 1,
  status: 'planned',
  productCategory: signal.relatedCategory,
  targetSegments: [signal.relatedSector],
  weakSignalId: signal.id,
});
