import type { Company, Product } from '../../types';

export const COMPUTE_POOL_CAP = 500;
export const COMPUTE_INFRASTRUCTURE_CAP = 100;
export const COMPUTE_INFRASTRUCTURE_UPKEEP = 1_500;
export const COMPUTE_EXPANSION_BASE_COST = 200_000;

const isDepartmentActive = (disruptedUntilTurn: number | undefined, currentTurn?: number): boolean =>
  currentTurn === undefined || !disruptedUntilTurn || disruptedUntilTurn < currentTurn;

/** Raw renewable capacity supplied by the operating departments. */
export const calculateBaseComputeGeneration = (company: Company, currentTurn?: number): number =>
  company.departments.reduce((sum, department) => {
    if (!isDepartmentActive(department.disruptedUntilTurn, currentTurn)) return sum;
    if (department.type === 'ai_data') {
      return sum + Math.max(1, Math.round(8 * department.level * department.efficiency));
    }
    if (department.type === 'dev_engineering') {
      return sum + Math.max(1, Math.round(3 * department.level * department.efficiency));
    }
    return sum;
  }, 0);

/** Forecast including the persistent grid multiplier. A level-100 grid doubles output. */
export const calculateComputeGeneration = (company: Company, currentTurn?: number): number => {
  const infrastructure = Math.max(0, Math.min(COMPUTE_INFRASTRUCTURE_CAP, company.computeInfrastructure ?? 0));
  return Math.round(calculateBaseComputeGeneration(company, currentTurn) * (1 + infrastructure / 100));
};

/**
 * An expansion adds a durable generation multiplier and an immediate commissioning
 * reserve. Diminishing returns keep late-game grids from jumping past the cap.
 */
export const calculateComputeExpansion = (company: Company, budget: number): { infrastructureGain: number; immediatePoints: number } => {
  const infrastructure = Math.max(0, Math.min(COMPUTE_INFRASTRUCTURE_CAP, company.computeInfrastructure ?? 0));
  const aiDepartments = company.departments.filter(department => department.type === 'ai_data');
  if (budget < COMPUTE_EXPANSION_BASE_COST || aiDepartments.length === 0 || infrastructure >= COMPUTE_INFRASTRUCTURE_CAP) {
    return { infrastructureGain: 0, immediatePoints: 0 };
  }
  const averageEfficiency = aiDepartments.reduce((sum, department) => sum + department.efficiency, 0) / aiDepartments.length;
  const budgetUnits = budget / COMPUTE_EXPANSION_BASE_COST;
  const diminishingReturn = Math.max(0.2, 1 - infrastructure / 125);
  const infrastructureGain = Math.min(
    COMPUTE_INFRASTRUCTURE_CAP - infrastructure,
    Math.max(1, Math.round(10 * budgetUnits * averageEfficiency * diminishingReturn)),
  );
  return { infrastructureGain, immediatePoints: Math.round(infrastructureGain * 1.5) };
};

/** Compute performance for a product, including its lead over direct rivals. */
export const calculateProductComputePerformance = (
  product: Product,
  ownerId: string,
  companies: Iterable<Company>,
): { throughputBonus: number; competitiveBonus: number; multiplier: number; rivalCompute: number } => {
  let rivalCompute = 0;
  for (const rival of companies) {
    if (rival.id === ownerId) continue;
    for (const rivalProduct of rival.products) {
      const overlapsMarket = rivalProduct.category === product.category
        && rivalProduct.targetSegments.some(segment => product.targetSegments.includes(segment));
      if (overlapsMarket) rivalCompute = Math.max(rivalCompute, rivalProduct.computePoints);
    }
  }
  const throughputBonus = Math.min(0.5, product.computePoints / 200);
  const competitiveBonus = Math.min(0.2, Math.max(0, product.computePoints - rivalCompute) / 500);
  return {
    throughputBonus,
    competitiveBonus,
    multiplier: (1 + throughputBonus) * (1 + competitiveBonus),
    rivalCompute,
  };
};
