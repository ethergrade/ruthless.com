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
  CEOTrait,
} from '../../types';
import { ARCHETYPE_STATS, CEO_TRAIT_DEFS, type CompanyStats } from '../../data/archetypes';

/** Clamp a 0..100 capability metric. */
const clamp = (n: number): number => Math.max(0, Math.min(100, Math.round(n)));

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
  colorIndex = 0,
  ceoTrait?: CEOTrait,
  /** T: point-buy overrides (0..100) applied on top of archetype + CEO mods. */
  statOverrides?: Partial<CompanyStats>,
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

  // CEO trait shapes the starting position (ruthless.com-inspired GDR build).
  const trait = ceoTrait ?? 'none';
  const traitDef = CEO_TRAIT_DEFS[trait];
  const base = ARCHETYPE_STATS[companyArchetype];
  // Apply CEO trait stat modifiers on top of the archetype baseline.
  const stats: CompanyStats = {
    security: clamp(base.security + (traitDef.statMods.security ?? 0) + (statOverrides?.security ?? 0)),
    ai: clamp(base.ai + (traitDef.statMods.ai ?? 0) + (statOverrides?.ai ?? 0)),
    consulting: clamp(base.consulting + (traitDef.statMods.consulting ?? 0) + (statOverrides?.consulting ?? 0)),
    innovation: clamp(base.innovation + (traitDef.statMods.innovation ?? 0) + (statOverrides?.innovation ?? 0)),
    trust: clamp(base.trust + (traitDef.statMods.trust ?? 0) + (statOverrides?.trust ?? 0)),
    productQuality: clamp(base.productQuality + (traitDef.statMods.productQuality ?? 0) + (statOverrides?.productQuality ?? 0)),
    productRd: clamp(base.productRd + (traitDef.statMods.productRd ?? 0) + (statOverrides?.productRd ?? 0)),
    salesMarketing: clamp(base.salesMarketing + (traitDef.statMods.salesMarketing ?? 0) + (statOverrides?.salesMarketing ?? 0)),
  };

  const startingCash = isPlayer
    ? 5000000 + (traitDef.cashMod ?? 0)
    : rng.nextInt(3000000, 8000000);
  const startingDebt = isPlayer
    ? (traitDef.debtMod ?? 0)
    : rng.nextInt(0, 2000000);

  const departments = createStartingDepartments(rng, isPlayer);
  const products = createStartingProducts(rng, companyArchetype);
  const executives = createStartingExecutives(rng, isPlayer);

  const costMult = traitDef.costMult ?? 1;
  const operatingCosts = Math.round(departments.reduce((sum, d) => sum + d.recurringCost, 0) * costMult);
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
    brandTrust: isPlayer ? stats.trust : rng.nextInt(30, 70),
    securityPosture: isPlayer ? stats.security : rng.nextInt(20, 60),
    innovation: isPlayer ? stats.innovation : rng.nextInt(10, 50),
    aiCapability: isPlayer ? stats.ai : rng.nextInt(5, 40),
    consultingCapacity: isPlayer ? stats.consulting : rng.nextInt(5, 30),
    productQuality: isPlayer ? stats.productQuality : stats.productQuality,
    productRd: isPlayer ? stats.productRd : stats.productRd,
    salesMarketing: isPlayer ? stats.salesMarketing : stats.salesMarketing,
    executiveOrderLimit: isPlayer ? 3 : rng.nextInt(2, 4),
    departments,
    products,
    executives,
    archetype: companyArchetype,
    ceoTrait: trait,
    ceoLevel: 1,
    controlledTiles: [],
    isPlayer,
    voiceTone: isPlayer ? 'aggressive' : undefined,
    campaignAuthenticity: isPlayer ? 'aspirational' : undefined,
    buildings: [],
    computerPoints: 0,
    legalPoints: 0,
    scandal: 0,
    ideas: [],
    // T: building & department GDR — seed initial HQ + CEO roster + workforce.
    ceos: isPlayer ? [{
      id: generateId.executive(),
      role: 'ceo',
      level: 1,
      experience: 5,
      specialization: 'chief_executive',
      energy: 0.9,
      loyalty: 1,
      ambition: 0.5,
      reputation: 50,
      cost: 0,
      traits: [],
      vulnerabilities: [],
      hqBuildingId: 'hq_' + id,
      xp: 0,
      perks: [...traitDef.perks],
    }] : [],
    employeeMorale: isPlayer ? 75 : rng.nextInt(50, 80),
    employerBrand: isPlayer ? 60 : rng.nextInt(40, 70),
    hrMetrics: {
      workLifeBalance: isPlayer ? 70 : rng.nextInt(50, 75),
      internalBrand: isPlayer ? 60 : rng.nextInt(40, 70),
      headcount: departments.length * 12,
      layoffsThisTurn: 0,
    },
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
    dev_engineering: 180000,
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
    fintech: ['regulated_industry', 'strategic_account', 'enterprise_cluster'],
    cloud_infra: ['enterprise_cluster', 'high_growth', 'innovation_hub'],
    iot: ['enterprise_cluster', 'legacy_market', 'high_growth'],
    blockchain: ['innovation_hub', 'startup_zone', 'strategic_account'],
    healthtech: ['regulated_industry', 'public_sector', 'innovation_hub'],
    edtech: ['public_sector', 'startup_zone', 'high_growth'],
    greentech: ['public_sector', 'high_growth', 'innovation_hub'],
    gaming: ['high_growth', 'startup_zone', 'open_market'],
    ecommerce: ['open_market', 'price_sensitive', 'high_growth'],
    data_analytics: ['enterprise_cluster', 'innovation_hub', 'strategic_account'],
    robotics: ['enterprise_cluster', 'legacy_market', 'high_growth'],
    biotech: ['regulated_industry', 'innovation_hub', 'public_sector'],
    quantum: ['innovation_hub', 'enterprise_cluster', 'strategic_account'],
    ar_vr: ['high_growth', 'startup_zone', 'open_market'],
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
      lifecycleStage: 'mature',
      version: 1,
      adopters: rng.nextFloat(0.2, 0.5),
      baseInstalled: rng.nextFloat(10, 40),
      pivotCount: 0,
      ageTurns: rng.nextInt(5, 15),
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
    fintech: ['Pay', 'Bank', 'Capital', 'Ledger', 'Coin', 'Finance', 'Fund', 'Trade'],
    cloud_infra: ['Cloud', 'Stack', 'Compute', 'Scale', 'Grid', 'Edge', 'Mesh', 'Node'],
    iot: ['Sense', 'Connect', 'Thing', 'Device', 'Edge', 'Mesh', 'Pulse', 'Track'],
    blockchain: ['Chain', 'Ledger', 'Token', 'Block', 'Node', 'Protocol', 'Verify', 'Trust'],
    healthtech: ['Health', 'Care', 'Med', 'Bio', 'Vital', 'Clinic', 'Genome', 'Therapy'],
    edtech: ['Learn', 'Academy', 'Edu', 'Class', 'Teach', 'Scholar', 'Campus', 'Tutor'],
    greentech: ['Green', 'Eco', 'Solar', 'Clean', 'Carbon', 'Earth', 'Leaf', 'Volt'],
    gaming: ['Play', 'Quest', 'Arcade', 'Arena', 'World', 'Pixel', 'Realm', 'Game'],
    ecommerce: ['Shop', 'Cart', 'Store', 'Market', 'Buy', 'Retail', 'Mall', 'Deal'],
    data_analytics: ['Metrics', 'Insight', 'Graph', 'Query', 'Report', 'Dash', 'BI', 'Stats'],
    robotics: ['Bot', 'Arm', 'Automaton', 'Mech', 'Drone', 'Assembly', 'Kinetic', 'Servo'],
    biotech: ['Gene', 'Cell', 'Protein', 'Vitro', 'Therapy', 'Lab', 'Biome', 'Culture'],
    quantum: ['Qubit', 'Entangle', 'Superpose', 'Gate', 'Compute', 'Cipher', 'Cohere', 'Phase'],
    ar_vr: ['Vision', 'Immerse', 'Reality', 'Holo', 'Spatial', 'Lens', 'World', 'Mixed'],
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
