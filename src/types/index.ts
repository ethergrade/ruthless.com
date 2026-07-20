export type CompanyId = string;
export type TileId = string;
export type ProductId = string;
export type DepartmentId = string;
export type ExecutiveId = string;
export type ActionId = string;

export type GameMode = 'scenario' | 'campaign' | 'free_game' | 'sandbox';

export type TurnPolicy =
  | { kind: 'limited'; maxTurns: number }
  | { kind: 'open' };

export type VictoryPolicy =
  | { kind: 'terminal' }
  | { kind: 'milestone_continue' }
  | { kind: 'disabled' };

export interface GameModeRules {
  mode: GameMode;
  turnPolicy: TurnPolicy;
  victoryPolicy: VictoryPolicy;
  achievementsEnabled: boolean;
  simulationRules: {
    market: boolean;
    technologies: boolean;
    cataclysms: boolean;
    auctions: boolean;
    corporateWarfare: boolean;
  };
}

export interface VictoryMilestone {
  id: string;
  turn: number;
  type: VictoryType;
  label: string;
  powerScore: number;
  marketShare: number;
  acknowledged: boolean;
}

export interface FreeGameConfig {
  seed?: number;
  mapSize: 'small' | 'medium' | 'large';
  aiRivals: number;
  startups: number;
  difficulty: 'docile' | 'aggressive' | 'ruthless';
  victoryConditions: VictoryType[];
  simulation: { marketSimulation: boolean; cataclysms: boolean; newTech: boolean };
}

export type SandboxCommandType =
  | 'set_cash' | 'set_debt' | 'set_reputation' | 'set_influence'
  | 'set_stock' | 'set_morale' | 'advance_turns' | 'toggle_victory'
  | 'reveal_intelligence';

export interface SandboxCommand {
  id: string;
  type: SandboxCommandType;
  companyId?: CompanyId;
  value?: number | boolean;
  createdAt: number;
}

export interface SandboxAuditEntry {
  command: SandboxCommand;
  previousValue?: number | boolean;
  description: string;
}

export interface SandboxState {
  godModeUsed: boolean;
  victoryEnabled: boolean;
  intelligenceRevealed: boolean;
  auditLog: SandboxAuditEntry[];
}

export type CampaignCondition =
  | { kind: 'always' }
  | { kind: 'market_share'; operator: 'gte' | 'lte'; value: number }
  | { kind: 'cash'; operator: 'gte' | 'lte'; value: number }
  | { kind: 'debt'; operator: 'gte' | 'lte'; value: number }
  | { kind: 'turn'; operator: 'gte' | 'lte'; value: number }
  | { kind: 'technology'; technologyId: string };

export interface CampaignEffect {
  kind: 'cash' | 'debt' | 'reputation' | 'technology' | 'placement_bonus';
  value: number | string;
}

export interface CampaignEdge {
  id: string;
  fromChapterId: string;
  toChapterId: string;
  label: string;
  conditions: CampaignCondition[];
  effects?: CampaignEffect[];
}

export interface NarrativeBeat {
  id: string;
  title: string;
  body: string;
  speaker?: string;
  trigger: CampaignCondition;
  priority: number;
}

export interface CampaignDefinition {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  entryChapterId: string;
  chapters: CampaignChapter[];
  edges: CampaignEdge[];
  updatedAt: number;
}

export interface PersistentCorporationSnapshot {
  company: Company;
  products: Product[];
  capturedAtTurn: number;
}

export interface CampaignRun {
  campaignId: string;
  currentChapterId: string;
  visitedChapterIds: string[];
  persistentCorporation?: PersistentCorporationSnapshot;
  completed: boolean;
}

export type InterturnPhase = 'results' | 'auction' | 'headlines' | 'victory' | 'briefing';

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
  | 'hybrid'
  | 'fintech'
  | 'cloud_infra'
  | 'iot'
  | 'blockchain'
  | 'healthtech'
  | 'edtech'
  | 'greentech'
  | 'gaming'
  | 'ecommerce'
  | 'data_analytics'
  | 'robotics'
  | 'biotech'
  | 'quantum'
  | 'ar_vr';

export type DepartmentType =
  | 'corporate_strategy'
  | 'product_rd'
  | 'ai_data'
  | 'cybersecurity'
  | 'consulting_services'
  | 'sales_marketing'
  | 'acquisitions'
  | 'legal_compliance'
  | 'people_culture'   // HR
  | 'finance_investor'
  | 'dev_engineering'; // T: DEV with vertical tech skills

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
  | 'allocate_compute'       // assign compute capacity to a launched product
  | 'allocate_cybersecurity' // assign cyber resilience to an owned building
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
  | 'sabotage_building'       // arson / physical sabotage: set a rival building on fire
  | 'defend_tile'            // internal id: Defend Building, reinforces one owned structure
  | 'security_online'         // cyber defense: firewall, sweep, change passwords
  | 'legal_action'            // lawsuit / patent / dispute
  | 'ceo_social'              // CEO social post: tone + authenticity
  | 'public_tender_offer'     // OPA: public tender offer for a rival building/company
  | 'auction_sell'            // list one of your assets on the open auction house (req 2)
  | 'auction_bid'             // place a bid on an existing listing (buy side)
  // --- T9: R&D ideas + source-code economy ---
  | 'create_ideas'            // R&D: invent a new technology/idea (brevity → trend)
  | 'release_source'          // open-source an idea: +awareness/trust, can mature a weak signal
  | 'sell_source'             // sell an idea's source code to a rival: +cash, flips trend ownership
  // --- T: product lifecycle ---
  | 'pivot_product'           // change a product's scope/features → new version push
  // --- T: building & department GDR ---
  | 'hire_ceo'                // assign a CEO to a (new) HQ building — needs HR dept
  | 'hire_coo'                // assign a COO to an HQ — needs HR dept
  | 'mass_layoff'             // lay off staff: cuts costs but crushes morale/brand
  | 'end_turn'
  // --- CEO GDR: market-moving PR, training & firing ---
  | 'ceo_praise'             // CEO PR: publicly praise a rival (diplomatic market nudge)
  | 'ceo_discredit'          // CEO PR: trash-talk / discredit a rival to move the market
  | 'train_ceo'              // Train a CEO's executive pillar (spend budget/special pts)
  | 'fire_ceo'               // Remove a seated CEO (frees the HQ, -1 order)
  // --- Legal & Compliance (ruthless.com-inspired) ---
  | 'legal_sue'              // File a lawsuit vs a rival (damages + valuation hit)
  | 'legal_patent'           // Lock a patent/tech to block a rival category
  | 'legal_subpoena'         // Subpoena a rival's data (intel + compliance pressure)
  | 'acquire_below_value';   // Buy a rival cheap (below its valuation) — needs Finance

/** Win condition for a Scenario (tactical single-board setup). */
export type ScenarioWinCondition =
  | { kind: 'tile_control'; target: number }      // control N tiles
  | { kind: 'valuation'; target: number }          // reach $ valuation
  | { kind: 'market_share'; target: number }       // % of total map share
  | { kind: 'eliminate'; targetCompanyId?: string } // bankrupt a rival
  | { kind: 'turn_limit'; turns: number };         // survive N turns

/** Tactical, self-contained board setup (no continuity between plays). */
export interface ScenarioConfig {
  id: string;
  name: string;
  mapSize: 'small' | 'medium' | 'large';
  seed?: number;
  aiRivals: number;            // 1..7 rival corporations
  disasters: boolean;          // @deprecated legacy — derive from `simulation`
  /** Granular world-simulation toggles (player chooses each at new game). */
  simulation?: { marketSimulation: boolean; cataclysms: boolean; newTech: boolean };
  winConditions: ScenarioWinCondition[];
  startCash: number;           // player starting cash
  description?: string;
}

/** A single chapter inside a Campaign arc. */
export interface CampaignChapter {
  id: string;
  title: string;
  scenario: ScenarioConfig;
  narrativeIntro?: string;     // story beat shown before the chapter
  aiDifficulty: 'docile' | 'aggressive' | 'ruthless';
  description?: string;
  isFinal?: boolean;
  turnLimit?: number;
  narrativeBeats?: NarrativeBeat[];
  entryConditions?: CampaignCondition[];
  rewards?: CampaignEffect[];
}

/** Narrative multi-chapter arc with a PERSISTENT player corporation. */
export interface CampaignConfig {
  id: string;
  name: string;
  chapters: CampaignChapter[];
  // Persistent player corp carried across chapters.
  playerCorp: {
    name: string;
    archetype: CompanyArchetype;
    ceoTrait: CEOTrait;
    color: string;
  };
  intro?: string;              // campaign-level story hook
  definition?: CampaignDefinition;
}

export type CompanyArchetype =
  | 'hypergrowth_platform'
  | 'security_fortress'
  | 'acquisition_machine'
  | 'lean_specialist';

export interface Company {
  id: CompanyId;
  name: string;
  color: string;
  /** T: distinguishes the human player, AI rivals, and neutral start-ups. */
  kind: 'player' | 'rival' | 'startup';
  cash: number;
  debt: number;
  valuation: number;
  revenue: number;
  operatingCosts: number;
  cashFlow: number;
  /** T: composite Company Power Score (0..100) driving victory + progress UI.
   *  Weighs market share, valuation, CEO executive pillars, trends, weak signals, trust/security, cash. */
  powerScore?: number;
  marketInfluence: number;
  brandTrust: number;
  securityPosture: number;
  innovation: number;
  aiCapability: number;
  consultingCapacity: number;
  /** T: GDR build metrics — product & go-to-market capabilities (0..100). */
  productQuality: number;       // avg product quality / craftsmanship
  productRd: number;            // Product R&D strength / pipeline
  salesMarketing: number;       // Sales & Marketing reach
  executiveOrderLimit: number;
  departments: Department[];
  products: Product[];
  executives: Executive[];
  archetype?: CompanyArchetype;
  /** Initial CEO trait (ruthless.com-inspired): shapes starting bonuses. */
  ceoTrait?: CEOTrait;
  /** CEO experience level (grows over time; drives Initiative extra-order chance). */
  ceoLevel: number;
  controlledTiles: TileId[];
  isPlayer: boolean;
  // --- new: ruthless.com-inspired state ---
  /** CEO social brand: tone of voice + authenticity pledge. */
  voiceTone?: VoiceTone;
  campaignAuthenticity?: CampaignAuthenticity;
  /** Buildings owned (a Building = a structure sitting on a tile). */
  buildings: Building[];
  /** @deprecated save-compatible alias mirrored from computePoints. */
  computerPoints: number;
  /** Unallocated compute capacity. AI/Data creates it; products can compound it when profitable. */
  computePoints: number;
  /** Unallocated cyber-resilience capacity generated by Cybersecurity departments. */
  cybersecurityPoints: number;
  /** Legal points pool (lawsuits / patents). */
  legalPoints: number;
  /** Scandal level 0..100 (drives stock/trust hits). */
  scandal: number;
  /** T — Crisis-risk 0..1 (higher = worse). Lowered by the CEO's Resilience pillar. */
  risk: number;
  /** True for AI corps that are "start-ups" available for acquisition. */
  isStartup?: boolean;
  /** Acquisition appeal for a startup (empty shell vs promising/high). */
  startupPotential?: 'empty' | 'promising' | 'high';
  /** Count of startups / companies acquired by this company. */
  acquisitions?: number;
  /** T9: R&D ideas / invented technologies owned by this company. */
  ideas: Idea[];
  /** T: CEO roster — one per HQ; each grants +1 executive order. */
  ceos: ChiefExecutive[];
  /** T: the GDR build used for the starting CEO (kept for reference / re-roll). */
  ceoBuild?: CeoBuild;
  /** T: workforce morale 0..100 (news/market events move it; layoffs crush it). */
  employeeMorale: number;
  /** T: employer brand / internal brand 0..100 (HR builds it). */
  employerBrand: number;
  /** T: HR-managed workforce metrics. */
  hrMetrics: {
    workLifeBalance: number;   // 0..100
    internalBrand: number;     // 0..100
    headcount: number;
    layoffsThisTurn: number;
  };
}

/** T: a technology in the consultable tech book (CI/CD present + invented futuristic). */
export interface Technology {
  id: string;
  name: string;
  category: 'cicd' | 'cloud' | 'ai' | 'futuristic' | 'security';
  tier: 1 | 2 | 3 | 4 | 5;
  /** Short description for the tech book. */
  description: string;
  /** Vertical skill it develops in DEV departments. */
  skill: string;
  invented: boolean; // true = futuristic/invented, false = real-world CI/CD
}

/** T: per-HQ CEO roster (multi-HQ corps run one CEO per HQ, each grants +1 order). */
export type ChiefPerk =
  | 'extra_order'        // +1 executive order / 3 turns (Initiative)
  | 'fast_learner'       // +10% capability gain / turn (Smart)
  | 'high_leverage'      // debt compounds 2x — high risk/reward (Banker)
  | 'talent_magnet'      // +workforce morale & employer brand (HR-minded)
  | 'cost_cutter'        // -10% operating costs (lean operator)
  | 'market_savant'      // +brandTrust/influence on market actions
  | 'iron_will'         // -scandal impact, +crisis resilience
  | 'corporate_intelligence'; // CEO reads rival interiors WITHOUT offensive action

export interface ChiefExecutive extends Executive {
  hqBuildingId: string;
  /** XP gained from successful actions, market moves, awareness & social posts. */
  xp: number;
  /** Perks unlocked by XP or granted by the CEO trait at hire. */
  perks: ChiefPerk[];
  /** T — Executive pillars (0..10), e.g. Vision / Network / Analytics ... */
  skills: Partial<Record<CEOSkill, number>>;
  /** T — Luck pillar (mirrors skills.luck; separate for clarity). */
  luck: number;
  /** T — traits layered on this CEO (multi). */
  ceoTraits: CEOTrait[];
  /** T — special-action points available this turn (regenerated each turn). */
  specialPoints: number;
  /** T — cumulative points spent training (for display / caps). */
  trainedSkills?: Partial<Record<CEOSkill, number>>;
}

export interface Building {
  id: string;
  tileId: TileId;
  /** Player-given name (e.g. "BUILDING 1", "R&D Tower"). Falls back to HQ/Branch. */
  name?: string;
  /** Departments housed in this building (subset of company.departments). */
  departmentIds: DepartmentId[];
  productIds: ProductId[];
  /** Defense ratings (0..100). */
  firewall: number;
  physicalSecurity: number;
  /** Spendable resilience assigned from the corporate cybersecurity pool. */
  cybersecurityPoints: number;
  /** Hush-money drain from criminal acts (cash/turn). */
  hushMoney: number;
  isHQ: boolean;
  /** T: CEO resident at this HQ (multi-HQ corps have one CEO per HQ). */
  ceoId?: ExecutiveId;
  /** T: hard cap on departments per building (ruthless.com: max 8). */
  maxDepartments: number;
  /** True when this building is listed for auction (req 2). */
  upForAuction?: boolean;
}

/** T: New Game placement — a building the player hand-places before rivals spawn. */
export interface InitialBuildingSpec {
  name?: string;
  /** T: optional; placePlayerBuilding derives HQ from pendingBuildings order if omitted. */
  isHQ?: boolean;
  /** up to 3 department types housed inside this building at game start */
  deptTypes: DepartmentType[];
  /** placement slot index into the starting market grid (row*mw + col) */
  slot?: number;
  /** T: real-map placement — the actual tile id the player dropped this on */
  tileId?: TileId;
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
  /** Marks an in-play startup territory (acquirable, may be empty). */
  isStartupTile?: boolean;
  /** Acquisition appeal for a startup tile (shown on the map / in the buy flow). */
  startupPotential?: 'empty' | 'promising' | 'high';
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
  /** Persistent compute capacity assigned to this product (0..100). */
  computePoints: number;
  /** Revenue attributed to this product by the last financial resolution. */
  lastTurnRevenue: number;
  /** Gross margin after product + compute operating costs, -1..1. */
  lastTurnMargin: number;
  technicalDebt: number;
  trust: number;
  targetSegments: MarketSegment[];
  tileIds: TileId[];
  /** T: product lifecycle phase. */
  lifecycleStage: 'early' | 'growth' | 'mature' | 'decline';
  /** T: version number (v1, v2, …) — incremented on decline→relaunch. */
  version: number;
  /** T: market penetration / adopter fraction 0..1 (early adopters → mainstream). */
  adopters: number;
  /** T: installed base of loyal customers that repurchase (fidelizzati). */
  baseInstalled: number;
  /** T: number of pivots performed on this product. */
  pivotCount: number;
  /** T: turns since launch (drives lifecycle progression). */
  ageTurns: number;
  /** Player-editable KPIs (startup refactor). */
  editableKpis?: ProductKpis;
  /** True if name/segment were chosen by the player at creation. */
  customNamed?: boolean;
  /** True when listed for auction (req 2). */
  upForAuction?: boolean;
  /** Timing against the most recent global trend for this category. */
  trendTiming?: 'on_time' | 'late' | 'none';
}

/** T9 — an R&D idea / invented technology. Can be patented, open-sourced, or sold. */
export interface Idea {
  id: string;
  name: string;
  category: ProductCategory;
  /** 0..100 research maturity. */
  maturity: number;
  /** True for a breakthrough that can spark a market trend. */
  breakthrough: boolean;
  /** Company that owns it. */
  companyId: CompanyId;
  /** Turn it was created. */
  createdTurn: number;
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
  /** T: this department owns/produces exactly ONE product (1 product = 1 product). */
  productId?: ProductId;
  /** A breached R&D/data department operates at reduced output until this turn. */
  disruptedUntilTurn?: number;
  /** T: DEV vertical tech skills — name→skill 0..100 (CI/CD + futuristic techs). */
  techStack?: Record<string, number>;
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

export type CEOTrait =
  | 'banker'     // debt accumulates 2x (higher recurring costs)
  | 'smart'      // +10% experience / capability gain
  | 'initiative' // +10% chance/turn of a free extra executive order
  | 'none';

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

/**
 * T — Executive pillar attribute set for CEOs (0..10 each). The ruthless.com
 * re-theme of the old S.P.E.C.I.A.L. clone: Vision / Network / Analytics /
 * Charisma / Strategy / Operations / Resilience (+ Luck). Each pillar drives a
 * global company metric via applyCeoPillarMods (market pull, brand, cost
 * discipline, crisis survival) — not just the CEO's own action bonus.
 */
export type CEOSkill =
  | 'vision'        // market foresight / anticipation of trends
  | 'network'       // reach, partnerships, talent pipeline
  | 'analytics'     // R&D, data, precision of action
  | 'charisma'      // negotiation, PR, talent magnetism
  | 'strategy'      // build efficiency, expansion, cost discipline
  | 'operations'    // execution speed, operating-cost control
  | 'resilience'    // crisis survival, scandal recovery
  | 'luck';         // soft random bonus across the board

/** A GDR "character build" for the starting CEO (point-buy at new game). */
export interface CeoBuild {
  /** One or more trait ids (multi-select within the token budget). */
  traits: CEOTrait[];
  /** Executive pillar attributes (0..10). */
  skills?: Partial<Record<CEOSkill, number>>;
  /** Luck is also tracked separately for clarity (mirrors skills.luck). */
  luck: number;
  /** Special action points regenerated per turn (gated by traits/perks). */
  specialPoints: number;
}

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
  /** Global trend explicitly pursued by an EXPLOIT order. */
  trendId?: string;
  /** Weak signal explicitly funded through an INVEST order. */
  weakSignalId?: string;
  budget: number;
  executiveId?: ExecutiveId;
  status: 'planned' | 'resolved' | 'failed';
  /** Turn in which this order was resolved (set when moved to actionHistory). */
  resolvedTurn?: number;
  outcome?: ActionOutcome;
  priority: number;
  /** Compute/cyber points committed by a capacity-allocation or cyber order. */
  resourcePoints?: number;
  // --- new action options ---
  /** Target company id (espionage / cyber / legal / OPA). */
  targetCompanyId?: CompanyId;
  /** Target department class for espionage/cyber/security. */
  targetDept?: RuthlessDept;
  /** Exact opponent department selected for Industrial Espionage. */
  targetDepartmentId?: DepartmentId;
  /** CEO social / marketing tone. */
  tone?: VoiceTone;
  /** Marketing/social authenticity. */
  authenticity?: CampaignAuthenticity;
  /** Tile id to build a building on. */
  targetTileId?: TileId;
  /** Department type to build (build_department) — player-chosen. */
  departmentType?: DepartmentType;
  /** Product id to improve / market (improve_product, marketing_campaign). */
  targetProductId?: ProductId;
  /** T9: idea id to release / sell as source code (release_source, sell_source). */
  ideaId?: string;
  /** T: pivot_product — new category / segments for the scope change. */
  pivotCategory?: ProductCategory;
  pivotSegments?: MarketSegment[];
  /** T: build_building — if true, the new building is an HQ (needs HR + hire_ceo after). */
  makeHQ?: boolean;
  /** T: build_building — player-given name (e.g. "BUILDING 1"). */
  buildingName?: string;
  /** T: hire_ceo / hire_coo — target HQ building id to seat the executive at. */
  hqBuildingId?: string;
  /** Generated/editable product name + category (product creation). */
  productName?: string;
  productCategory?: ProductCategory;
  /** Market sectors locked into a product launch by a trend/signal investment. */
  targetSegments?: MarketSegment[];
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
  /** Legacy display value. The authoritative limit lives in modeRules.turnPolicy. */
  maxTurns: number;
  mode: GameMode;
  modeRules: GameModeRules;
  victoryMilestones: VictoryMilestone[];
  sandbox?: SandboxState;
  campaignRun?: CampaignRun;
  campaignDefinition?: CampaignDefinition;
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
  /** T — granular world-simulation toggles (player chooses each at new game). */
  simulation: {
    /** Demand shifts, trends, weak signals & competitor moves. */
    marketSimulation: boolean;
    /** Market shocks: crashes, surges, cataclysms. */
    cataclysms: boolean;
    /** New technologies / inventions surface over time. */
    newTech: boolean;
  };
  /** @deprecated legacy flag — kept for save compatibility; derive from simulation. */
  disastersEnabled?: boolean;
  isGameOver: boolean;
  victoryType?: VictoryType;
  seed: number;
  /** T — deterministic world seed used to lazily (re)generate infinite map chunks. */
  mapSeed: number;
  /** T — O(1) spatial index "x,y" -> TileId for viewport culling & tile picking. */
  tileIndex: Record<string, TileId>;
  /** Active global market trends (T5): demanded category x sector. */
  trends: MarketTrend[];
  /** Trends removed because the opportunity was pursued or missed. */
  trendHistory: TrendHistoryEntry[];
  /** Early weak signals hinting at emerging trends (T5). */
  weakSignals: WeakSignal[];
  /** T6: persistent alert log (news/events that warranted a toast) surfaced in the Orders tab. */
  alerts: AlertItem[];
  /** T9: every invented idea across all corps (source-code economy reference). */
  inventions: Idea[];
  /** T: building ids whose interior (departments) the player has revealed via espionage / cyber breach. */
  revealedBuildings: string[];
  /** T: New Game real-map placement phase. While 'placement', rivals/startups are
   *  hidden and the player drops their HQ + buildings on real tiles. Flips to
   *  'playing' (rivals spawn / become visible) when the player finishes. */
  phase: 'placement' | 'playing';
  /** T: buildings the player has already dropped during the placement phase. */
  pendingBuildings: InitialBuildingSpec[];
}

export interface AlertItem {
  id: string;
  turn: number;
  title: string;
  body: string;
  importance: 'minor' | 'major' | 'critical';
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

/**
 * A global market trend: the world is demanding a product CATEGORY in a SECTOR.
 * Players who launch/market matching products ride the wave (demand + fit bonus).
 */
export interface MarketTrend {
  id: string;
  title: string;
  category: ProductCategory;
  sector: MarketSegment;
  /** 0..1 strength of the demand pull. */
  strength: number;
  /** turn this trend expires. */
  expiresTurn: number;
  /** Turn the opportunity first became actionable. */
  appearedTurn: number;
  /** Last turn in which EXPLOIT captures the full opportunity. */
  decisionDeadlineTurn: number;
  /** short narrative. */
  blurb: string;
}

export interface TrendHistoryEntry {
  trend: MarketTrend;
  outcome: 'pursued' | 'missed';
  resolvedTurn: number;
  companyId?: CompanyId;
}

/**
 * A weak signal: an early hint of an emerging trend. Lower confidence than a
 * full trend. Savvy players act before it becomes obvious.
 */
export interface WeakSignal {
  id: string;
  hint: string;
  /** category likely to surge if the signal matures. */
  relatedCategory: ProductCategory;
  /** market sector in which the early demand is emerging. */
  relatedSector: MarketSegment;
  /** 0..1 confidence the signal becomes a real trend. */
  confidence: number;
  expiresTurn: number;
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
