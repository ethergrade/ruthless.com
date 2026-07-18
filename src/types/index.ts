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

/** Ruthless-com inspired department classes (mirrors the original 9 dept types). */
export type RuthlessDept =
  | 'product'
  | 'rd'
  | 'marketing'
  | 'hr'
  | 'admin'
  | 'acquisitions'
  | 'legal'
  | 'security'
  | 'computer_core';

/** Asset kinds that can be listed on the open market auction house (req 2). */
export type AuctionAssetKind = 'technology' | 'patent' | 'product' | 'building' | 'department';

/** A live auction listing: assets up for sale across all corporations. */
export interface AuctionListing {
  id: string;
  sellerId: CompanyId;
  kind: AuctionAssetKind;
  assetId: string;            // productId / buildingId / departmentId
  name: string;
  basePrice: number;
  currentBid: number;
  highestBidderId: CompanyId | null;
  expiresTurn: number;        // turn when the auction closes
}

/** Tone of voice for CEO social / marketing campaigns. */
export type VoiceTone =
  | 'aggressive'
  | 'visionary'
  | 'technical'
  | 'provocative'
  | 'corporate'
  | 'rebellious';

/** Whether a marketing/social push is truthful or "fake it till you make it". */
export type CampaignAuthenticity = 'verified' | 'aspirational' | 'fabricated';

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
  // --- ruthless.com-inspired new actions ---
  | 'build_building'          // construct a new Building on a tile
  | 'industrial_espionage'    // steal an idea / cash / evidence from a rival
  | 'cyber_attack'            // hack a rival: data run / virus / breach
  | 'security_offline'        // physical security: guards, lockdown, sabotage defense
  | 'security_online'         // cyber defense: firewall, sweep, change passwords
  | 'legal_action'            // lawsuit / patent / dispute
  | 'ceo_social'              // CEO social post: tone + authenticity
  | 'public_tender_offer'     // OPA: public tender offer for a rival building/company
  | 'auction_sell'            // list one of your assets on the open auction house (req 2)
  | 'auction_bid'             // place a bid on an existing listing (buy side)
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
  // --- new: ruthless.com-inspired state ---
  /** CEO social brand: tone of voice + authenticity pledge. */
  voiceTone?: VoiceTone;
  campaignAuthenticity?: CampaignAuthenticity;
  /** Buildings owned (a Building = a structure sitting on a tile). */
  buildings: Building[];
  /** Computer points pool (hacking offense/defense). */
  computerPoints: number;
  /** Legal points pool (lawsuits / patents). */
  legalPoints: number;
  /** Scandal level 0..100 (drives stock/trust hits). */
  scandal: number;
  /** True for AI corps that are "start-ups" available for acquisition. */
  isStartup?: boolean;
}

export interface Building {
  id: string;
  tileId: TileId;
  /** Departments housed in this building (subset of company.departments). */
  departmentIds: DepartmentId[];
  productIds: ProductId[];
  /** Defense ratings (0..100). */
  firewall: number;
  physicalSecurity: number;
  /** Hush-money drain from criminal acts (cash/turn). */
  hushMoney: number;
  isHQ: boolean;
  /** True when this building is listed for auction (req 2). */
  upForAuction?: boolean;
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
  /** Building id sitting on this tile, if any. */
  buildingId?: string;
  /** Base Quality of the product controlling this tile (ruthless.com model). */
  baseQuality: number;
  /** True when the tile's building is listed for auction (req 2). */
  upForAuction?: boolean;
  /** Marks an in-progress offensive action targeting this tile (shown to the player). */
  pendingAction?: {
    type: ActionType;
    byCompanyId: CompanyId;
    expiresTurn: number;
  };
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
  /** Player-editable KPIs (startup refactor). */
  editableKpis?: ProductKpis;
  /** True if name/segment were chosen by the player at creation. */
  customNamed?: boolean;
  /** True when listed for auction (req 2). */
  upForAuction?: boolean;
}

/** Player-tunable product KPIs shown in the product editor. */
export interface ProductKpis {
  quality: number;        // 0..100
  security: number;       // 0..100
  scalability: number;    // 0..100
  marketFit: number;      // 0..100
  price: number;          // monthly price per client
  technicalDebt: number;  // 0..100 (higher = worse)
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
  /** Player-editable department KPIs. */
  editableKpis?: DepartmentKpis;
  /** Building/tile this department operates from (req 6: different depts in different buildings). */
  buildingId?: string;
}

export interface DepartmentKpis {
  efficiency: number;   // 0..100
  morale: number;       // 0..100
  capacity: number;     // 0..100
  risk: number;         // 0..100 (higher = worse)
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
  /** Turn in which this order was resolved (set when moved to actionHistory). */
  resolvedTurn?: number;
  outcome?: ActionOutcome;
  priority: number;
  // --- new action options ---
  /** Target company id (espionage / cyber / legal / OPA). */
  targetCompanyId?: CompanyId;
  /** Target department class for espionage/cyber/security. */
  targetDept?: RuthlessDept;
  /** CEO social / marketing tone. */
  tone?: VoiceTone;
  /** Marketing/social authenticity. */
  authenticity?: CampaignAuthenticity;
  /** Tile id to build a building on. */
  targetTileId?: TileId;
  /** Product id to improve / market (improve_product, marketing_campaign). */
  targetProductId?: ProductId;
  /** Generated/editable product name + category (product creation). */
  productName?: string;
  productCategory?: ProductCategory;
  /** OPA: tender price offered. */
  offerPrice?: number;
  /** Success-estimate preview (req 4): 0..1, filled by store before planning. */
  estimatedSuccess?: number;
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
  /** Discriminates world events so the engine can apply real effects (point 5/8). */
  kind?: 'stock_surge' | 'stock_crash' | 'tech_breakthrough' | 'cataclysm' | 'regulatory' | 'talent' | 'product' | 'ma' | 'reputation' | 'market' | 'cyber' | 'financial';
  title: string;
  description: string;
  impact: Record<string, number>;
  /** Real effects applied to the game state when this event fires (world events). */
  effects?: {
    marketInfluenceDelta?: number;
    cashDelta?: number;
    aiCapabilityDelta?: number;
    innovationDelta?: number;
    securityDelta?: number;
    tileDamage?: number; // 0..1 control loss on a random owned tile
    buildingDamage?: number; // 0..100 firewall/physical security loss on hit buildings
    deptDamage?: number; // 0..1 morale/effiency loss on departments on the hit tile
    scope: 'all' | 'player' | 'rivals' | 'random_tile';
  };
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
  auctionHouse: AuctionListing[];   // req 2: assets up for auction
  kpiHistory: Record<string, number[]>; // keyed by KPI key, last N turns, for sparklines
  actionHistory: TurnAction[]; // resolved/failed orders from previous turns (req: review & re-bid)
  disastersEnabled: boolean;
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
