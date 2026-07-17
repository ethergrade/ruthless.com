export type CompanyId = string;
export type TileId = string;
export type ProductId = string;
export type DepartmentId = string;
export type ExecutiveId = string;
export type ActionId = string;

export type MarketSegment =
  | 'open_market'
  | 'enterprise_cluster'
  | 'public_sector'
  | 'regulated_industry'
  | 'innovation_hub'
  | 'price_sensitive'
  | 'high_growth'
  | 'legacy_market'
  | 'strategic_account'
  | 'startup_zone';

export type ProductCategory =
  | 'saas'
  | 'ai'
  | 'cybersecurity'
  | 'consulting'
  | 'managed_service'
  | 'data_service'
  | 'platform_api'
  | 'hybrid';

export type DepartmentType =
  | 'corporate_strategy'
  | 'product_rd'
  | 'ai_data'
  | 'cybersecurity'
  | 'consulting_services'
  | 'sales_marketing'
  | 'acquisitions'
  | 'legal_compliance'
  | 'people_culture'
  | 'finance_investor';

export type ActionType =
  | 'build_department'
  | 'launch_product'
  | 'improve_product'
  | 'expand_market'
  | 'marketing_campaign'
  | 'hire_executive'
  | 'security_hardening'
  | 'ai_automation'
  | 'launch_consulting_practice'
  | 'scout_acquisition'
  | 'acquire_company'
  | 'raise_capital'
  | 'reduce_costs'
  | 'end_turn';

export type CompanyArchetype =
  | 'hypergrowth_platform'
  | 'security_fortress'
  | 'acquisition_machine'
  | 'lean_specialist';

export interface Company {
  id: CompanyId;
  name: string;
  color: string;
  cash: number;
  debt: number;
  valuation: number;
  revenue: number;
  operatingCosts: number;
  cashFlow: number;
  marketInfluence: number;
  brandTrust: number;
  securityPosture: number;
  innovation: number;
  aiCapability: number;
  consultingCapacity: number;
  executiveOrderLimit: number;
  departments: Department[];
  products: Product[];
  executives: Executive[];
  archetype?: CompanyArchetype;
  controlledTiles: TileId[];
  isPlayer: boolean;
}

export interface MarketTile {
  id: TileId;
  x: number;
  y: number;
  segment: MarketSegment;
  value: number;
  growth: number;
  risk: number;
  regulation: number;
  loyalty: number;
  controllerId?: CompanyId;
  challengerId?: CompanyId;
  controlStrength: number;
  productId?: ProductId;
  demandLevel: number;
  priceSensitivity: number;
  techMaturity: number;
  acquisitionCost: number;
  competitivePressure: number;
}

export interface Product {
  id: ProductId;
  companyId: CompanyId;
  name: string;
  category: ProductCategory;
  maturity: number;
  quality: number;
  security: number;
  scalability: number;
  marketFit: number;
  price: number;
  operatingCost: number;
  technicalDebt: number;
  trust: number;
  targetSegments: MarketSegment[];
  tileIds: TileId[];
}

export interface Department {
  id: DepartmentId;
  type: DepartmentType;
  level: number;
  capacity: number;
  efficiency: number;
  morale: number;
  risk: number;
  recurringCost: number;
  executiveId?: ExecutiveId;
}

export interface Executive {
  id: ExecutiveId;
  role: ExecutiveRole;
  level: number;
  experience: number;
  specialization: string;
  energy: number;
  loyalty: number;
  ambition: number;
  reputation: number;
  cost: number;
  traits: ExecutiveTrait[];
  vulnerabilities: ExecutiveVulnerability[];
}

export type ExecutiveRole =
  | 'ceo'
  | 'cto'
  | 'ciso'
  | 'cfo'
  | 'cmo'
  | 'coo'
  | 'chief_ai_officer'
  | 'chief_product_officer'
  | 'head_consulting'
  | 'general_counsel';

export type ExecutiveTrait =
  | 'systems_thinker'
  | 'deal_maker'
  | 'trusted_operator'
  | 'ai_native'
  | 'crisis_leader'
  | 'growth_hacker'
  | 'product_visionary'
  | 'cost_cutter'
  | 'security_first'
  | 'political_capital';

export type ExecutiveVulnerability =
  | 'fragile_ego'
  | 'overconfident'
  | 'burnout_risk'
  | 'short_termist'
  | 'risk_averse'
  | 'micromanager'
  | 'delegation_issues'
  | 'conflict_avoidant';

export interface TurnAction {
  id: ActionId;
  companyId: CompanyId;
  type: ActionType;
  targetId?: string;
  budget: number;
  executiveId?: ExecutiveId;
  status: 'planned' | 'resolved' | 'failed';
  outcome?: ActionOutcome;
  priority: number;
}

export interface ActionOutcome {
  success: boolean;
  message: string;
  effects: Record<string, number>;
  risksTriggered: string[];
}

export interface GameEvent {
  id: string;
  turn: number;
  category: EventCategory;
  title: string;
  description: string;
  impact: Record<string, number>;
  affectedCompanies: CompanyId[];
  duration: number;
  options?: EventOption[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export type EventCategory =
  | 'market'
  | 'cyber'
  | 'regulatory'
  | 'financial'
  | 'talent'
  | 'product'
  | 'ma'
  | 'reputation'
  | 'global';

export interface EventOption {
  id: string;
  label: string;
  cost: number;
  effects: Record<string, number>;
  risk: number;
}

export interface GameState {
  turn: number;
  maxTurns: number;
  playerCompanyId: CompanyId;
  companies: Map<CompanyId, Company>;
  marketTiles: Map<TileId, MarketTile>;
  products: Map<ProductId, Product>;
  actions: TurnAction[];
  events: GameEvent[];
  newsFeed: NewsItem[];
  marketBriefing: MarketBriefing;
  isGameOver: boolean;
  victoryType?: VictoryType;
  seed: number;
}

export interface NewsItem {
  id: string;
  turn: number;
  category: EventCategory;
  headline: string;
  body: string;
  companyId?: CompanyId;
  importance: 'minor' | 'major' | 'critical';
}

export interface MarketBriefing {
  demandShifts: DemandShift[];
  globalEvents: GameEvent[];
  competitorMoves: CompetitorMove[];
  cyberAlerts: CyberAlert[];
  maOpportunities: MAOpportunity[];
  clientRequests: ClientRequest[];
}

export interface DemandShift {
  segment: MarketSegment;
  change: number;
  reason: string;
}

export interface CompetitorMove {
  companyId: CompanyId;
  action: string;
  targetTile?: TileId;
  visibility: number;
}

export interface CyberAlert {
  severity: 'low' | 'medium' | 'high' | 'critical';
  targetSegment: MarketSegment;
  description: string;
  estimatedImpact: number;
}

export interface MAOpportunity {
  targetId: CompanyId;
  targetName: string;
  price: number;
  revenue: number;
  talent: number;
  technology: number;
  clients: number;
  reputation: number;
  cyberRisk: number;
  techDebt: number;
  cultureFit: number;
  integrationDifficulty: number;
}

export interface ClientRequest {
  tileId: TileId;
  segment: MarketSegment;
  requirement: string;
  budget: number;
  urgency: number;
}

export type VictoryType =
  | 'market_dominance'
  | 'tech_leadership'
  | 'brand_trust'
  | 'consolidation'
  | 'operational_resilience'
  | 'diversified_portfolio'
  | 'niche_specialization'
  | 'platform_ecosystem';

export interface AICompany {
  id: CompanyId;
  archetype: CompanyArchetype;
  personality: AIPersonality;
  memory: AIMemory;
}

export interface AIPersonality {
  riskTolerance: number;
  aggression: number;
  innovationFocus: number;
  costConsciousness: number;
  longTermPlanning: number;
}

export interface AIMemory {
  lastPlayerActions: ActionType[];
  threatLevel: number;
  trustedCompetitors: CompanyId[];
  rivalCompetitors: CompanyId[];
  missedOpportunities: string[];
}
