import { createRNG } from '../utils/rng';
import { generateId } from '../utils/ids';
import type {
  Company,
  CompanyArchetype,
  Department,
  DepartmentType,
  Product,
  Executive,
  ExecutiveRole,
  ExecutiveTrait,
  ExecutiveVulnerability,
  MarketSegment,
  ProductCategory,
} from '../../types';

const COMPANY_NAMES = [
  'NexusTech', 'Apex Digital', 'Quantum Systems', 'Vertex Solutions',
  'Meridian AI', 'Sentinel Cyber', 'Axiom Cloud', 'Catalyst Labs',
  'Horizon Data', 'Pinnacle Soft', 'Zenith Networks', 'Orion Analytics',
  'Nova Security', 'Prism Computing', 'Eclipse AI', 'Vanguard Tech',
];

const EXECUTIVE_NAMES = [
  'Alex Chen', 'Morgan Rivera', 'Taylor Kim', 'Jordan Park', 'Casey Wong',
  'Riley Singh', 'Avery Okafor', 'Quinn Mueller', 'Dana Takahashi', 'Sage Gupta',
];

const TRAITS: ExecutiveTrait[] = [
  'systems_thinker', 'deal_maker', 'trusted_operator', 'ai_native',
  'crisis_leader', 'growth_hacker', 'product_visionary', 'cost_cutter',
  'security_first', 'political_capital',
];

const VULNERABILITIES: ExecutiveVulnerability[] = [
  'fragile_ego', 'overconfident', 'burnout_risk', 'short_termist',
  'risk_averse', 'micromanager', 'delegation_issues', 'conflict_avoidant',
];

const ARCHETYPE_COLORS: Record<CompanyArchetype, string> = {
  hypergrowth_platform: '#00d4aa',
  security_fortress: '#007bff',
  acquisition_machine: '#ff6b35',
  lean_specialist: '#ffc107',
};

const DEFAULT_COLORS = [
  '#00d4aa', '#ff6b35', '#007bff', '#ffc107',
  '#e83e8c', '#6f42c1', '#20c997', '#fd7e14',
];

export const createCompany = (
  rng: ReturnType<typeof createRNG>,
  name?: string,
  archetype?: CompanyArchetype,
  isPlayer = false,
  colorIndex = 0
): Company => {
  const companyName = name ?? rng.shuffle([...COMPANY_NAMES]).pop()!;
  const companyArchetype = archetype ?? rng.shuffle([
    'hypergrowth_platform',
    'security_fortress',
    'acquisition_machine',
    'lean_specialist',
  ] as CompanyArchetype[]).pop()!;

  const id = generateId.company();
  const color = isPlayer ? '#00d4aa' : (ARCHETYPE_COLORS[companyArchetype] ?? DEFAULT_COLORS[colorIndex % DEFAULT_COLORS.length]);

  const startingCash = isPlayer ? 5000000 : rng.nextInt(3000000, 8000000);
  const startingDebt = isPlayer ? 0 : rng.nextInt(0, 2000000);

  const departments = createStartingDepartments(rng, isPlayer);
  const products = createStartingProducts(rng, companyArchetype);
  const executives = createStartingExecutives(rng, isPlayer);

  const operatingCosts = departments.reduce((sum, d) => sum + d.recurringCost, 0);
  const revenue = products.reduce((sum, p) => sum + p.price * 100, 0);

  return {
    id,
    name: companyName,
    color,
    cash: startingCash,
    debt: startingDebt,
    valuation: startingCash * 2,
    revenue,
    operatingCosts,
    cashFlow: revenue - operatingCosts,
    marketInfluence: isPlayer ? 5 : rng.nextInt(3, 15),
    brandTrust: isPlayer ? 50 : rng.nextInt(30, 70),
    securityPosture: isPlayer ? 40 : rng.nextInt(20, 60),
    innovation: isPlayer ? 30 : rng.nextInt(10, 50),
    aiCapability: isPlayer ? 20 : rng.nextInt(5, 40),
    consultingCapacity: isPlayer ? 10 : rng.nextInt(5, 30),
    executiveOrderLimit: isPlayer ? 3 : rng.nextInt(2, 4),
    departments,
    products,
    executives,
    archetype: companyArchetype,
    controlledTiles: [],
    isPlayer,
  };
};

const createStartingDepartments = (rng: ReturnType<typeof createRNG>, isPlayer: boolean): Department[] => {
  const deptTypes: DepartmentType[] = isPlayer
    ? ['product_rd', 'sales_marketing', 'cybersecurity']
    : ['product_rd', 'sales_marketing', 'cybersecurity', 'finance_investor'];

  return deptTypes.map((type, i) => ({
    id: generateId.department(),
    type,
    level: isPlayer && i === 0 ? 2 : rng.nextInt(1, 2),
    capacity: rng.nextInt(50, 100),
    efficiency: rng.nextFloat(0.7, 1.0),
    morale: rng.nextFloat(0.7, 1.0),
    risk: rng.nextFloat(0.1, 0.3),
    recurringCost: getDepartmentCost(type, rng.nextInt(1, 2)),
    executiveId: undefined,
  }));
};

const getDepartmentCost = (type: DepartmentType, level: number): number => {
  const baseCosts: Record<DepartmentType, number> = {
    corporate_strategy: 50000,
    product_rd: 150000,
    ai_data: 200000,
    cybersecurity: 120000,
    consulting_services: 80000,
    sales_marketing: 100000,
    acquisitions: 200000,
    legal_compliance: 80000,
    people_culture: 60000,
    finance_investor: 120000,
  };
  return baseCosts[type] * level;
};

const createStartingProducts = (rng: ReturnType<typeof createRNG>, archetype: CompanyArchetype): Product[] => {
  const products: Product[] = [];
  const archetypeProducts: Record<CompanyArchetype, ProductCategory[]> = {
    hypergrowth_platform: ['saas', 'platform_api'],
    security_fortress: ['cybersecurity', 'managed_service'],
    acquisition_machine: ['saas', 'data_service'],
    lean_specialist: ['consulting', 'ai'],
  };

  const categories = archetypeProducts[archetype] ?? ['saas', 'cybersecurity'];
  const segmentsByCategory: Record<ProductCategory, MarketSegment[]> = {
    saas: ['enterprise_cluster', 'high_growth', 'startup_zone'],
    ai: ['innovation_hub', 'enterprise_cluster', 'high_growth'],
    cybersecurity: ['regulated_industry', 'enterprise_cluster', 'public_sector'],
    consulting: ['enterprise_cluster', 'public_sector', 'strategic_account'],
    managed_service: ['enterprise_cluster', 'legacy_market', 'strategic_account'],
    data_service: ['innovation_hub', 'enterprise_cluster', 'high_growth'],
    platform_api: ['innovation_hub', 'startup_zone', 'high_growth'],
    hybrid: ['enterprise_cluster', 'regulated_industry', 'high_growth'],
  };

  categories.forEach(category => {
    const name = generateProductName(rng, category);
    const segments = segmentsByCategory[category] ?? ['open_market'];
    products.push({
      id: generateId.product(),
      companyId: '',
      name,
      category,
      maturity: rng.nextInt(30, 60),
      quality: rng.nextInt(50, 80),
      security: category === 'cybersecurity' ? rng.nextInt(70, 90) : rng.nextInt(40, 70),
      scalability: category === 'saas' || category === 'platform_api' ? rng.nextInt(70, 90) : rng.nextInt(40, 70),
      marketFit: rng.nextInt(40, 70),
      price: rng.nextInt(5000, 50000),
      operatingCost: rng.nextInt(1000, 10000),
      technicalDebt: rng.nextInt(10, 30),
      trust: rng.nextInt(50, 80),
      targetSegments: segments,
      tileIds: [],
    });
  });

  return products;
};

const generateProductName = (rng: ReturnType<typeof createRNG>, category: ProductCategory): string => {
  const prefixes = ['Nexus', 'Apex', 'Quantum', 'Vertex', 'Meridian', 'Sentinel', 'Axiom', 'Catalyst', 'Horizon', 'Pinnacle'];
  const suffixesByCategory: Record<ProductCategory, string[]> = {
    saas: ['Flow', 'Sync', 'Core', 'Hub', 'Stream', 'Link', 'Bridge', 'Pulse'],
    ai: ['Mind', 'Brain', 'Cortex', 'Neural', 'Insight', 'Predict', 'Vision', 'Sense'],
    cybersecurity: ['Shield', 'Guard', 'Wall', 'Fortress', 'Sentinel', 'Bastion', 'Aegis', 'Defense'],
    consulting: ['Advisory', 'Strategy', 'Partners', 'Consulting', 'Experts', 'Group', 'Associates', 'Solutions'],
    managed_service: ['Ops', 'Manage', 'Care', 'Support', 'Run', 'Maintain', 'Service', 'Control'],
    data_service: ['Data', 'Analytics', 'Insights', 'Intelligence', 'Metrics', 'Warehouse', 'Lake', 'Stream'],
    platform_api: ['Platform', 'API', 'Gateway', 'Connect', 'Bridge', 'Mesh', 'Fabric', 'Layer'],
    hybrid: ['Fusion', 'Blend', 'Hybrid', 'Unified', 'Integrated', 'Combined', 'Joint', 'Merged'],
  };

  const prefix = rng.shuffle([...prefixes]).pop()!;
  const suffix = rng.shuffle([...suffixesByCategory[category]]).pop()!;
  return `${prefix}${suffix}`;
};

const createStartingExecutives = (rng: ReturnType<typeof createRNG>, isPlayer: boolean): Executive[] => {
  const executives: Executive[] = [];
  const roles: ExecutiveRole[] = isPlayer
    ? ['ceo', 'cto', 'cmo']
    : ['ceo', 'cto', 'cfo', 'ciso'];

  roles.forEach(role => {
      rng.shuffle([...EXECUTIVE_NAMES]).pop();
    const traitCount = isPlayer ? 2 : rng.nextInt(1, 3);
    const vulnCount = isPlayer ? 1 : rng.nextInt(0, 2);
    const traits = rng.shuffle([...TRAITS]).slice(0, traitCount);
    const vulnerabilities = rng.shuffle([...VULNERABILITIES]).slice(0, vulnCount);

    executives.push({
      id: generateId.executive(),
      role,
      level: isPlayer && role === 'ceo' ? 3 : rng.nextInt(1, 3),
      experience: rng.nextInt(5, 20),
      specialization: getSpecialization(role),
      energy: rng.nextFloat(0.7, 1.0),
      loyalty: isPlayer ? 0.9 : rng.nextFloat(0.5, 0.9),
      ambition: rng.nextFloat(0.3, 0.8),
      reputation: rng.nextInt(40, 80),
      cost: getExecutiveCost(role, rng.nextInt(1, 3)),
      traits,
      vulnerabilities,
    });
  });

  return executives;
};

const getSpecialization = (role: ExecutiveRole): string => {
  const specs: Record<ExecutiveRole, string[]> = {
    ceo: ['corporate_strategy', 'm_and_a', 'capital_allocation'],
    cto: ['product_development', 'architecture', 'technical_debt'],
    ciso: ['security_architecture', 'incident_response', 'compliance'],
    cfo: ['financial_planning', 'fundraising', 'cost_optimization'],
    cmo: ['brand_building', 'demand_generation', 'market_positioning'],
    coo: ['operations', 'delivery', 'process_optimization'],
    chief_ai_officer: ['ml_strategy', 'ai_governance', 'data_strategy'],
    chief_product_officer: ['product_strategy', 'user_experience', 'roadmap'],
    head_consulting: ['practice_development', 'delivery_quality', 'utilization'],
    general_counsel: ['ip_protection', 'regulatory', 'contracts'],
  };
  return specs[role][0];
};

const getExecutiveCost = (role: ExecutiveRole, level: number): number => {
  const baseCosts: Record<ExecutiveRole, number> = {
    ceo: 400000,
    cto: 300000,
    ciso: 280000,
    cfo: 300000,
    cmo: 280000,
    coo: 280000,
    chief_ai_officer: 350000,
    chief_product_officer: 280000,
    head_consulting: 250000,
    general_counsel: 280000,
  };
  return baseCosts[role] * level;
};
