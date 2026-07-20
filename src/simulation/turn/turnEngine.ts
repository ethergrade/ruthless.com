import { createRNG } from '../utils/rng';
import { ACTION_PILLAR, unlockPerksForCeo, PERK_LABELS } from '../../data/archetypes';
import type { MarketSegment,
  GameState,
  Company,
  MarketTile,
  TileId,
  Product,
  ProductCategory,
  Department,
  TurnAction,
  ActionType,
  DepartmentType,
  ExecutiveRole,
  GameEvent,
  NewsItem,
  MarketBriefing,
  DemandShift,
  CompetitorMove,
  CyberAlert,
  CompanyId,
  ProductId,
  DepartmentId,
  EventCategory,
  AuctionListing,
  CEOTrait,
  ScenarioConfig,
  CompanyArchetype,
  CeoBuild,
  CEOSkill,
  MarketTrend,
  WeakSignal,
  Idea,
  Building,
  InitialBuildingSpec,
  ChiefExecutive,
  GameMode,
  GameModeRules,
  EspionageIntel,
} from '../../types';
import { generateId } from '../utils/ids';
import { createMarketMap, buildTileIndex, createTile } from '../factories/marketFactory';
import { createCompany } from '../factories/companyFactory';
import { generateCompanyName } from '../../data/generators';
import {
  DEPARTMENT_INITIATIVE_BASE_COST,
  getDepartmentInitiative,
  type DepartmentInitiativeEffects,
} from '../../data/departmentInitiatives';
import { findBuildingOnTile, getBuildingDisplayName, getBuildingFreeSlots, getBuildingUsedSlots } from '../utils/buildings';
import {
  COMPUTE_INFRASTRUCTURE_CAP,
  COMPUTE_INFRASTRUCTURE_UPKEEP,
  COMPUTE_POOL_CAP,
  calculateComputeExpansion,
  calculateComputeGeneration,
  calculateProductComputePerformance,
} from '../utils/compute';

export interface TurnResult {
  newState: GameState;
  events: GameEvent[];
  newsItems: NewsItem[];
  marketBriefing: MarketBriefing;
}

interface PendingAcquisitionShock {
  buyerId: CompanyId;
  targetId: CompanyId;
  targetName: string;
  segments: MarketSegment[];
  change: number;
  acquiredValue: number;
}

export class TurnEngine {
  private rng: ReturnType<typeof createRNG>;
  private state: GameState;
  private ceoTrait: CEOTrait = 'none';
  private scenarioOpts: ScenarioConfig | null = null;
  private ceoBuild?: CeoBuild;
  /** T: player's hand-placed starting empire (New Game placement flow). */
  private initialBuildings?: InitialBuildingSpec[];
  /** T: New Game "place on the real map" mode — player drops buildings live on the
   *  Phaser board; rivals stay hidden until the player finishes (phase -> playing). */
  private realMapPlacement = false;
  /** Ideas actually created this turn, per company — backs the R&D capacity cap. */
  private ideasCreatedThisTurn = new Map<string, number>();
  /** M&A shocks resolve after company metrics, so their quote movement is not overwritten. */
  private pendingAcquisitionShocks: PendingAcquisitionShock[] = [];

  // T: point-buy stat overrides for the player's starting build.
  private statOverrides?: Partial<Record<string, number>>;

  constructor(
    seed?: number,
    ceoTrait?: CEOTrait,
    scenario?: ScenarioConfig,
    statOverrides?: Partial<Record<string, number>>,
    ceoBuild?: CeoBuild,
    initialBuildings?: InitialBuildingSpec[],
    realMapPlacement = false,
    mapSeed?: number,
    mode: GameMode = scenario ? 'scenario' : 'free_game',
    modeRules?: Partial<GameModeRules>,
  ) {
    this.rng = createRNG(seed);
    if (ceoTrait) this.ceoTrait = ceoTrait;
    if (scenario) this.scenarioOpts = scenario;
    this.statOverrides = statOverrides;
    this.ceoBuild = ceoBuild;
    this.initialBuildings = initialBuildings;
    this.realMapPlacement = realMapPlacement;
    this.mapSeed = mapSeed ?? seed ?? 1;
    this.mode = mode;
    this.modeRulesOverride = modeRules;
    this.state = this.initializeGameState();
    this.state.marketBriefing = this.generateMarketBriefing();
  }

  /** T — deterministic world seed (infinite map). */
  private mapSeed: number;
  private mode: GameMode;
  private modeRulesOverride?: Partial<GameModeRules>;

  getState(): GameState {
    return this.state;
  }

  // Replace the entire state (used by load/save). Restores RNG continuity
  // from the saved seed so subsequent turns stay deterministic per save.
  setState(state: GameState): void {
    this.state = this.migrateState(state);
    this.mode = this.state.mode;
    this.rng.setSeed(state.seed);
  }

  private migrateState(state: GameState): GameState {
    const legacyMode: GameMode = state.mode ?? 'scenario';
    const legacyLimit = state.maxTurns ?? 20;
    const defaults = this.defaultModeRules(legacyMode, legacyLimit);
    state.companies.forEach(company => {
      const migratedCompute = Math.max(0, company.computePoints ?? company.computerPoints ?? 0);
      company.computePoints = migratedCompute;
      company.computerPoints = migratedCompute;
      company.computeInfrastructure = Math.max(0, Math.min(COMPUTE_INFRASTRUCTURE_CAP, company.computeInfrastructure ?? 0));
      company.lastComputeGenerated = Math.max(0, company.lastComputeGenerated ?? 0);
      company.cybersecurityPoints = Math.max(0, company.cybersecurityPoints ?? 0);
      company.espionageIntel = company.espionageIntel ?? [];
      company.products.forEach(product => {
        product.computePoints = Math.max(0, Math.min(100, product.computePoints ?? 0));
        product.lastComputeMultiplier = Math.max(1, product.lastComputeMultiplier ?? 1);
        product.computeAdvantage = Math.max(0, Math.min(0.2, product.computeAdvantage ?? 0));
        product.lastTurnRevenue = product.lastTurnRevenue ?? 0;
        product.lastTurnMargin = Math.max(-1, Math.min(1, product.lastTurnMargin ?? 0));
      });
      company.buildings.forEach((building, index) => {
        building.cybersecurityPoints = Math.max(0, Math.min(100, building.cybersecurityPoints ?? 0));
        if (!building.name?.trim()) building.name = building.isHQ ? `${company.name} Headquarters` : `${company.name} Building ${index + 1}`;
        const tile = state.marketTiles.get(building.tileId);
        if (tile && tile.controllerId === company.id) tile.buildingId = building.id;
        building.departmentIds.forEach(departmentId => {
          const department = company.departments.find(candidate => candidate.id === departmentId);
          if (department) department.buildingId = building.id;
        });
      });
    });
    return {
      ...state,
      mode: legacyMode,
      modeRules: state.modeRules ?? defaults,
      victoryMilestones: state.victoryMilestones ?? [],
      trendHistory: state.trendHistory ?? [],
      trends: (state.trends ?? []).map(trend => ({
        ...trend,
        appearedTurn: trend.appearedTurn ?? state.turn,
        decisionDeadlineTurn: trend.decisionDeadlineTurn ?? state.turn + 2,
      })),
      weakSignals: (state.weakSignals ?? []).map(signal => ({
        ...signal,
        relatedSector: signal.relatedSector ?? 'open_market',
      })),
      sandbox: legacyMode === 'sandbox'
        ? (state.sandbox ?? { godModeUsed: false, victoryEnabled: false, intelligenceRevealed: false, auditLog: [] })
        : state.sandbox,
    };
  }

  private defaultModeRules(mode: GameMode, scenarioLimit?: number): GameModeRules {
    const limited = mode === 'scenario' && scenarioLimit !== undefined;
    return {
      mode,
      turnPolicy: limited ? { kind: 'limited', maxTurns: scenarioLimit } : { kind: 'open' },
      victoryPolicy: mode === 'free_game' ? { kind: 'milestone_continue' }
        : mode === 'sandbox' ? { kind: 'disabled' } : { kind: 'terminal' },
      achievementsEnabled: mode !== 'sandbox',
      simulationRules: { market: true, technologies: true, cataclysms: false, auctions: true, corporateWarfare: true },
    };
  }

  getRNG(): ReturnType<typeof createRNG> {
    return this.rng;
  }

  private initializeGameState(): GameState {
    const so = this.scenarioOpts;
    const mapDims: Record<string, [number, number]> = { small: [7, 7], medium: [9, 9], large: [11, 11] };
    const [mw, mh] = so ? (mapDims[so.mapSize] ?? [8, 8]) : [8, 8];
    const rivalCount = so ? Math.max(1, Math.min(7, so.aiRivals)) : 3;
    const rivalDefs: [string, CompanyArchetype][] = [
      ['NexusTech', 'hypergrowth_platform'],
      ['SentinelCyber', 'security_fortress'],
      ['ApexDigital', 'acquisition_machine'],
      ['Vertex Dynamics', 'lean_specialist'],
      ['Helix Union', 'hypergrowth_platform'],
      ['Obsidian Systems', 'security_fortress'],
      ['Kestrel Group', 'acquisition_machine'],
    ];
    const aiCompanies = rivalDefs.slice(0, rivalCount).map(([name, arch], i) =>
      createCompany(this.rng, name, arch, false, i, undefined, undefined, undefined, 'rival'));

    const playerCompany = createCompany(this.rng, 'PlayerCorp', undefined, true, 0, this.ceoTrait, this.statOverrides, this.ceoBuild);
    // T: in real-map placement with pre-distributed buildings, the player's
    // departments come from the New Game setup (via placePlayerBuilding) — so
    // drop the factory-default departments to avoid duplicates (11 instead of 8).
    if (this.realMapPlacement && this.initialBuildings?.length) playerCompany.departments = [];
    if (so?.startCash) playerCompany.cash = so.startCash;
    playerCompany.ceoBuild = this.ceoBuild;
    const marketTiles = createMarketMap(this.rng, mw, mh, this.mapSeed);
    const tileIndex = buildTileIndex(marketTiles);
    // T: in real-map placement rivals get NO territories at init — their tiles
    // must stay free so the player can drop buildings anywhere, and they spawn
    // only in finishPlacement() (after the 3rd building). Outside placement the
    // usual starting territories are assigned to player + rivals.
    this.assignStartingTerritories(marketTiles, this.realMapPlacement ? [] : [playerCompany, ...aiCompanies]);

    const companies = new Map<CompanyId, Company>();
    [playerCompany, ...aiCompanies].forEach(c => companies.set(c.id, c));

    // T: in real-map placement the player drops their own buildings live on the
    // In real-map placement the player drops their own buildings live on the
    // board (with departments pre-distributed from the New Game setup). Rivals are
    // NOT seeded here — they spawn only when finishPlacement() runs (after the
    // player's 3 buildings are placed), so their tiles stay free during placement
    // and they appear the instant the game begins.
    if (this.initialBuildings && this.initialBuildings.length > 0 && !this.realMapPlacement) {
      this.seedPlayerBuildings(playerCompany, marketTiles, this.initialBuildings);
    } else if (!this.realMapPlacement) {
      [playerCompany, ...aiCompanies].forEach(c => this.seedCompanyNetwork(c, marketTiles));
    }

    // Spawn neutral "start-up" corporations sitting on random tiles that the
    // player (or AI) can acquire via payment / public tender offer.
    const startups = this.spawnStartups(marketTiles, 4);

    const products = new Map<ProductId, Product>();
    [...playerCompany.products, ...aiCompanies.flatMap(c => c.products), ...startups.flatMap(c => c.products)]
      .forEach(p => products.set(p.id, p));
    [...aiCompanies, ...startups].forEach(c => companies.set(c.id, c));

    const scenarioLimit = so?.winConditions.find(w => w.kind === 'turn_limit');
    const introScenarioLimit = scenarioLimit?.kind === 'turn_limit' ? scenarioLimit.turns : (this.mode === 'scenario' ? 12 : undefined);
    const baseRules = this.defaultModeRules(this.mode, introScenarioLimit);
    const modeRules: GameModeRules = {
      ...baseRules,
      ...this.modeRulesOverride,
      simulationRules: { ...baseRules.simulationRules, ...(this.modeRulesOverride?.simulationRules ?? {}) },
    };
    const result: GameState = {
      turn: 1,
      maxTurns: modeRules.turnPolicy.kind === 'limited' ? modeRules.turnPolicy.maxTurns : 0,
      mode: this.mode,
      modeRules,
      victoryMilestones: [],
      sandbox: this.mode === 'sandbox'
        ? { godModeUsed: false, victoryEnabled: false, intelligenceRevealed: false, auditLog: [] }
        : undefined,
      playerCompanyId: playerCompany.id,
      companies,
      marketTiles,
      products,
      actions: [],
      events: [],
      newsFeed: [{
        id: generateId.action(), turn: 1, category: 'market',
        headline: 'Markets Open: A New Corporate War Begins',
        body: 'Global demand is moving. Review Market Intel and Global Trends before committing executive orders.',
        companyId: playerCompany.id, importance: 'major',
      }],
      marketBriefing: {
        demandShifts: [], globalEvents: [], competitorMoves: [],
        cyberAlerts: [], maOpportunities: [], clientRequests: [],
      },
      auctionHouse: [],
      kpiHistory: {},
      actionHistory: [],
      simulation: { marketSimulation: false, cataclysms: false, newTech: false },
      isGameOver: false,
      seed: this.rng.getSeed(),
      mapSeed: this.mapSeed,
      tileIndex,
      trends: this.generateMarketTrends(2),
      trendHistory: [],
      weakSignals: this.generateWeakSignals(2),
      alerts: [],
      inventions: [],
      revealedBuildings: [],
      phase: this.realMapPlacement ? 'placement' : 'playing',
      pendingBuildings: this.realMapPlacement ? [] : (this.initialBuildings ?? []),
    };
    // T: seed composite power scores so the UI/progress is meaningful from turn 1.
    this.state = result;
    result.companies.forEach(c => { c.powerScore = this.computePowerScore(c); });
    return result;
  }

  /** Lazily grow the authored market up to the canonical 207-tile ceiling.
   *  Deterministic: same coords + mapSeed => same tiles.
   *  Returns the list of freshly generated tile ids (for UI/invalidation). */
  ensureRegion(cx: number, cy: number, radius = 8): TileId[] {
    const fresh: TileId[] = [];
    const candidates: { x: number; y: number; distance: number }[] = [];
    for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) {
      const distance = (x - cx) ** 2 + (y - cy) ** 2;
      if (distance <= radius * radius) candidates.push({ x, y, distance });
    }
    candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
    for (const candidate of candidates) {
      if (this.state.marketTiles.size >= 207) break;
      const key = `${candidate.x},${candidate.y}`;
      if (this.state.tileIndex[key]) continue;
      const tile = createTile(this.mapSeed, candidate.x, candidate.y);
      this.state.marketTiles.set(tile.id, tile);
      this.state.tileIndex[key] = tile.id;
      this.knownTiles.add(tile.id);
      fresh.push(tile.id);
    }
    return fresh;
  }

  /** T — player-driven exploration (called by the map when the camera pans far). */
  explore(cx: number, cy: number, radius = 10): TileId[] {
    return this.ensureRegion(cx, cy, radius);
  }

  /** T — after loading a diff-serialized save, regenerate every explored tile from
   *  the deterministic mapSeed (identical to when saved) and overlay the saved
   *  (modified) tiles. Leaves marketTiles complete + tileIndex consistent. */
  rehydrateWorld(): void {
    const idx = this.state.tileIndex;
    // regenerate all explored coordinates deterministically
    for (const key of Object.keys(idx)) {
      const [x, y] = key.split(',').map(Number);
      if (!this.state.marketTiles.has(idx[key])) {
        const t = createTile(this.mapSeed, x, y);
        this.state.marketTiles.set(t.id, t);
        // keep the saved id mapping in the index
        this.state.tileIndex[`${x},${y}`] = t.id;
      }
    }
  }

  /** T — tiles the player/AI has ever interacted with (for save-diff & culling). */
  private knownTiles = new Set<TileId>();
  /** Create one real building per authored starting territory. The HQ owns all
   * starting departments/products; remaining branches are intentionally empty. */
  private seedCompanyNetwork(company: Company, tiles: Map<string, MarketTile>): void {
    company.buildings = [];
    company.controlledTiles.forEach((tileId, index) => {
      const tile = tiles.get(tileId);
      if (!tile) return;
      const id = generateId.building();
      const isHQ = index === 0;
      const building: Building = {
        id,
        tileId,
        name: isHQ ? `${company.name} Headquarters` : `${company.name} Building ${index + 1}`,
        departmentIds: isHQ ? company.departments.map(department => department.id) : [],
        productIds: isHQ ? company.products.map(product => product.id) : [],
        firewall: isHQ && company.archetype === 'security_fortress' ? 40 : isHQ ? 20 : 10,
        physicalSecurity: isHQ ? 30 : 15,
        cybersecurityPoints: 0,
        hushMoney: 0,
        isHQ,
        ceoId: isHQ ? company.ceos[0]?.id : undefined,
        maxDepartments: 8,
      };
      company.buildings.push(building);
      tile.buildingId = id;
      if (isHQ) {
        company.departments.forEach(department => { department.buildingId = id; });
        if (company.ceos[0]) company.ceos[0].hqBuildingId = id;
      }
    });
  }

  /**
   * T: New Game placement — build the player's hand-placed empire.
   * Each spec becomes a real Building on the tile at `slot`, housing the chosen
   * departments. Rivals still spawn afterwards (see initializeGameState).
   */
  private seedPlayerBuildings(
    company: Company,
    tiles: Map<string, MarketTile>,
    specs: InitialBuildingSpec[],
  ): void {
    const allTiles = Array.from(tiles.values());
    specs.forEach((spec, idx) => {
      const tile = allTiles[spec.slot ?? idx] ?? allTiles[idx];
      if (!tile) return;
      const id = generateId.building();
      const isHQ = spec.isHQ || idx === 0;
      const deptTypes = spec.deptTypes.slice(0, 3);
      const deptIds: DepartmentId[] = [];
      deptTypes.forEach(dt => {
        const dId = generateId.department();
        const dept: Department = {
          id: dId,
          type: dt,
          level: 1,
          capacity: 10,
          efficiency: 0.7,
          morale: 0.8,
          risk: 0.2,
          recurringCost: 50000,
          buildingId: id,
        };
        company.departments.push(dept);
        deptIds.push(dId);
      });
      // also register the housed departments as controlled (tile ownership)
      company.buildings.push({
        id,
        tileId: tile.id,
        name: spec.name?.trim() || (isHQ ? 'HQ' : `BUILDING ${idx + 1}`),
        departmentIds: deptIds,
        productIds: [],
        firewall: isHQ ? 30 : 10,
        physicalSecurity: isHQ ? 40 : 15,
        cybersecurityPoints: 0,
        hushMoney: 0,
        isHQ,
        ceoId: isHQ ? company.ceos[0]?.id : undefined,
        maxDepartments: 8,
      });
      tile.buildingId = id;
      tile.controllerId = company.id;
      if (!company.controlledTiles.includes(tile.id)) company.controlledTiles.push(tile.id);
    });
  }

  /**
   * T: real-map placement — drop one player building on a real tile. Creates the
   * Building (+ chosen departments) live so it renders immediately; appends to
   * pendingBuildings so finishPlacement() can flip the phase. No-op if the tile is
   * already occupied or not player-controlled.
   */
  placePlayerBuilding(spec: InitialBuildingSpec): void {
    const state = this.state;
    if (state.phase !== 'placement') return;
    const player = state.companies.get(state.playerCompanyId);
    if (!player) return;
    const tile = state.marketTiles.get(spec.tileId!);
    if (!tile || tile.buildingId) return;
    const id = generateId.building();
    const isHQ = spec.isHQ || state.pendingBuildings.length === 0;
    // T: player pre-distributes up to 8 departments across the 3 buildings in the
    // New Game setup; per-building cap stays maxDepartments (8). No slice(0,3).
    const deptTypes = spec.deptTypes;
    const deptIds: DepartmentId[] = [];
    deptTypes.forEach(dt => {
      const dId = generateId.department();
      const dept: Department = {
        id: dId, type: dt, level: 1, capacity: 10, efficiency: 0.7,
        morale: 0.8, risk: 0.2, recurringCost: 50000, buildingId: id,
      };
      player.departments.push(dept);
      deptIds.push(dId);
    });
    player.buildings.push({
      id, tileId: tile.id, name: spec.name?.trim() || (isHQ ? 'HQ' : `BUILDING ${state.pendingBuildings.length + 1}`),
      departmentIds: deptIds, productIds: [], firewall: isHQ ? 30 : 10, physicalSecurity: isHQ ? 40 : 15,
      cybersecurityPoints: 0,
      hushMoney: 0, isHQ, ceoId: isHQ ? player.ceos[0]?.id : undefined, maxDepartments: 8,
    });
    tile.buildingId = id;
    if (!tile.controllerId) tile.controllerId = player.id;
    if (!player.controlledTiles.includes(tile.id)) player.controlledTiles.push(tile.id);
    state.pendingBuildings.push({ ...spec, isHQ, tileId: tile.id });
    // T: once the player has dropped all 3 buildings, auto-finish placement —
    // spawn rivals / start the game without waiting for a manual DONE button.
    if (state.pendingBuildings.length >= 3) this.finishPlacement();
  }

  /** T: finish the real-map placement — spawn rivals on free tiles, game begins. */
  finishPlacement(): void {
    if (this.state.phase !== 'placement') return;
    if (this.state.pendingBuildings.length < 3) return;
    // T: rivals were NOT seeded at init (their tiles must stay free during
    // placement). Spawn them now, on tiles the player has not claimed.
    const rivals = Array.from(this.state.companies.values()).filter(
      c => c.id !== this.state.playerCompanyId && c.controlledTiles.length === 0
    );
    this.assignStartingTerritories(this.state.marketTiles, rivals);
    rivals.forEach(c => this.seedCompanyNetwork(c, this.state.marketTiles));
    this.state.phase = 'playing';
  }

  /** Create neutral start-up corps on random unclaimed tiles. */
  private spawnStartups(tiles: Map<string, MarketTile>, count: number): Company[] {
    const free = Array.from(tiles.values()).filter(t => !t.controllerId);
    this.rng.shuffle(free);
    const startups: Company[] = [];
    for (let i = 0; i < count && free.length > 0; i++) {
      const tile = free.pop()!;
      const c = createCompany(this.rng, undefined, undefined, false, i, undefined, undefined, undefined, 'startup');
      c.isStartup = true;
      c.name = generateCompanyName(this.rng.getSeed() + i * 13 + 1);
      c.cash = this.rng.nextInt(300000, 900000);
      c.marketInfluence = this.rng.nextInt(1, 4);
      tile.controllerId = c.id;
      tile.controlStrength = this.rng.nextFloat(0.5, 0.8);
      c.controlledTiles = [tile.id];
      tile.isStartupTile = true;

      // ~half are "empty" shells (tile only, no building) — cheap, blind buys;
      // the rest carry a building + an idea/tech (real acquisition targets).
      const empty = i % 2 === 1;
      if (empty) {
        tile.startupPotential = 'empty';
        c.startupPotential = 'empty';
      } else {
        const potential = i % 4 === 0 ? 'high' : 'promising';
        tile.startupPotential = potential;
        c.startupPotential = potential;
        const id = generateId.building();
        c.buildings.push({
          id, tileId: tile.id, name: `${c.name} Headquarters`,
          departmentIds: c.departments.slice(0, 1).map(d => d.id),
          productIds: c.products.slice(0, 1).map(p => p.id),
          firewall: 10, physicalSecurity: 10, cybersecurityPoints: 0, hushMoney: 0, isHQ: true,
          maxDepartments: 8,
        });
        c.departments.slice(0, 1).forEach(department => { department.buildingId = id; });
        tile.buildingId = id;
      }
      startups.push(c);
    }
    return startups;
  }

  private assignStartingTerritories(
    tiles: Map<string, MarketTile>,
    companies: Company[]
  ): void {
    // T: only hand out tiles that are still free — the player may have already
    // claimed some during real-map placement.
    const unassignedTiles = Array.from(tiles.values()).filter(t => !t.controllerId);
    this.rng.shuffle(unassignedTiles);

    companies.forEach((company, i) => {
      const tileCount = i === 0 ? 3 : 2;
      for (let j = 0; j < tileCount && unassignedTiles.length > 0; j++) {
        const tile = unassignedTiles.pop()!;
        tile.controllerId = company.id;
        tile.controlStrength = this.rng.nextFloat(0.6, 0.9);
        company.controlledTiles.push(tile.id);
      }
    });
  }

  endTurn(): TurnResult {
    // T: in real-map placement you cannot take turns until your 3 buildings are
    // placed — otherwise the game would advance while rivals are still hidden.
    if (this.state.phase === 'placement') {
      if (this.state.pendingBuildings.length >= 3) this.finishPlacement();
      else return { newState: this.state, events: [], newsItems: [], marketBriefing: this.state.marketBriefing };
    }
    const events: GameEvent[] = [];
    const newsItems: NewsItem[] = [];
    this.ideasCreatedThisTurn.clear(); // reset per-turn R&D idea capacity

    this.processPlayerActions(events, newsItems);
    this.processAIActions(events, newsItems);
    this.resolveEspionageLawsuits(newsItems);
    this.resolveAuctions(newsItems);
    this.resolveMarket();
    this.resolveFinancials();
    this.resolveOperationalCapacity();
    this.resolveRisks(events, newsItems);
    this.autoAggression();
    this.applySharkMarket();
    this.applyGlobalEvents(newsItems);
    // Expire in-progress tile action markers.
    this.state.marketTiles.forEach(t => {
      if (t.pendingAction && t.pendingAction.expiresTurn <= this.state.turn) t.pendingAction = undefined;
    });
    Array.from(this.state.companies.values()).forEach(c => this.recalculateCompanyMetrics(c));
    const acquisitionBriefing = this.applyPendingAcquisitionShocks();
    this.state.marketBriefing = this.generateMarketBriefing();
    this.state.marketBriefing.demandShifts = [
      ...acquisitionBriefing.demandShifts,
      ...this.state.marketBriefing.demandShifts,
    ];
    this.state.marketBriefing.globalEvents = [
      ...acquisitionBriefing.globalEvents,
      ...this.state.marketBriefing.globalEvents,
    ];
    this.refreshTrends();
    this.advanceProductLifecycles();

    // Record KPI snapshot for the player (drives sparklines in the UI).
    const player = this.state.companies.get(this.state.playerCompanyId);
    if (player) {
      const snap: Record<string, number> = {
        cash: player.cash, cashFlow: player.cashFlow, valuation: player.valuation,
        marketInfluence: player.marketInfluence, brandTrust: player.brandTrust,
        securityPosture: player.securityPosture, innovation: player.innovation,
        aiCapability: player.aiCapability, revenue: player.revenue,
      };
      const hist = this.state.kpiHistory;
      for (const [k, v] of Object.entries(snap)) {
        const arr = hist[k] ?? [];
        arr.push(Math.round(v));
        if (arr.length > 20) arr.shift();
        hist[k] = arr;
      }
    }

    this.state.turn++;
    // T: CEO special-action points regenerate each turn (Agility raises the cap),
    // so special CEO moves (praise / discredit / train) are a renewable resource.
    const p0 = this.state.companies.get(this.state.playerCompanyId);
    if (p0 && p0.ceos[0]) {
      const operations = p0.ceos[0].skills.operations ?? 5;
      p0.ceos[0].specialPoints = 1 + Math.floor(operations / 4); // 1..3
    }
    // CEO gains experience over time (drives Initiative bonus scaling).
    if (this.state.turn % 4 === 0) {
      const p = this.state.companies.get(this.state.playerCompanyId);
      if (p) p.ceoLevel += 1;
    }
    // T: apply CEO executive-pillar modifiers to the company's global metrics
    // (ruthless.com re-theme — pillars drive economy, not just CEO actions).
    this.state.companies.forEach(c => this.applyCeoPillarMods(c));
    // T: recompute composite power score for every company (drives victory + UI).
    this.state.companies.forEach(c => { c.powerScore = this.computePowerScore(c); });
    this.resolveCampaignTransition();
    this.checkVictoryConditions();

    // Persist this turn's news into the feed (P3: news must actually appear).
    this.state.newsFeed = [...this.state.newsFeed, ...newsItems].slice(-60);
    // Persist the RNG cursor, not merely the initial seed, so save/load continues
    // the exact same deterministic sequence.
    this.state.seed = this.rng.getSeed();

    return {
      newState: { ...this.state },
      events,
      newsItems,
      marketBriefing: this.state.marketBriefing,
    };
  }

  private processPlayerActions(events: GameEvent[], newsItems: NewsItem[]): void {
    const player = this.state.companies.get(this.state.playerCompanyId);
    // Initiative CEO: every 3 turns a free bonus executive order (expand market).
    if (player && player.ceoTrait === 'initiative' && this.state.turn % 3 === 0) {
      this.state.actions.push({
        id: generateId.action(),
        companyId: this.state.playerCompanyId,
        type: 'expand_market',
        budget: 200000,
        priority: 0,
        status: 'planned',
      });
      newsItems.push(this.createNewsItem(
        this.state.turn, 'market',
        'Initiative Bonus Order',
        'Your Initiative CEO secured a free market-expansion order this turn.',
        this.state.playerCompanyId, 'minor'
      ));
    }

    const playerActions = this.state.actions.filter(
      a => a.companyId === this.state.playerCompanyId && a.status === 'planned'
    );

    playerActions.forEach(action => {
      const outcome = this.resolveAction(action);
      action.status = outcome.success ? 'resolved' : 'failed';
      action.outcome = outcome;
      action.resolvedTurn = this.state.turn;

      if (outcome.success) {
        newsItems.push(this.createNewsItem(
          this.state.turn,
          'product',
          `Azione Eseguita: ${action.type}`,
          outcome.message,
          this.state.playerCompanyId,
          'minor'
        ));
        // T: CEO grows from doing — successful actions train the relevant
        // S.P.E.C.I.A.L. pillar, accrue XP, and can unlock threshold perks.
        const playerCompany = this.state.companies.get(this.state.playerCompanyId);
        const ceo = playerCompany?.ceos[0];
        if (ceo && playerCompany) {
          ceo.xp += 10;
          const pillar = ACTION_PILLAR[action.type];
          if (pillar) {
            ceo.skills[pillar] = Math.min(10, (ceo.skills[pillar] ?? 5) + 1);
          }
          // Risky / social actions also nudge Luck.
          if (['cyber_attack', 'industrial_espionage', 'legal_sue', 'public_tender_offer', 'ceo_discredit'].includes(action.type)) {
            ceo.skills.luck = Math.min(10, (ceo.skills.luck ?? 5) + 1);
          }
          const unlocked = unlockPerksForCeo(ceo);
          if (unlocked.length) {
            newsItems.push(this.createNewsItem(
              this.state.turn, 'talent', 'CEO Perk Unlocked',
              `Your CEO earned: ${unlocked.map(p => PERK_LABELS[p]).join(', ')}.`,
              this.state.playerCompanyId, 'minor'
            ));
          }
          if (ceo.xp >= 100 && !ceo.perks.includes('extra_order')) { ceo.perks.push('extra_order'); playerCompany.executiveOrderLimit += 1; }
          playerCompany.ceoLevel = Math.max(playerCompany.ceoLevel, 1 + Math.floor(ceo.xp / 100));
        }
      } else {
        newsItems.push(this.createNewsItem(
          this.state.turn,
          'financial',
          `Azione Fallita: ${action.type}`,
          outcome.message,
          this.state.playerCompanyId,
          'major'
        ));
      }
    });

    // Keep resolved/failed orders in history (for review & re-bid), keep only
    // planned orders queued for processing next turn.
    const resolved = this.state.actions.filter(a => a.status !== 'planned');
    this.state.actionHistory.push(...resolved);
    this.state.actions = this.state.actions.filter(a => a.status === 'planned');
  }

  private processAIActions(_events: GameEvent[], _newsItems: NewsItem[]): void {
    const aiCompanies = Array.from(this.state.companies.values()).filter(c => c.kind === 'rival');

    aiCompanies.forEach(company => {
      const actions = this.generateAIActions(company);
      actions.forEach(action => {
        const outcome = this.resolveAction(action);
        action.status = outcome.success ? 'resolved' : 'failed';
        action.outcome = outcome;

        if (outcome.success) {
          // effects already applied inside resolveAction -> applyActionEffectsToCompany
        }
      });
    });
  }

  private generateAIActions(company: Company): TurnAction[] {
    const actions: TurnAction[] = [];
    const archetype = company.archetype || 'lean_specialist';
    const orderLimit = company.executiveOrderLimit;

    for (let i = 0; i < orderLimit; i++) {
      const actionType = this.selectAIAction(archetype, company);
      if (!actionType) break;

      const action: TurnAction = {
        id: generateId.action(),
        companyId: company.id,
        type: actionType,
        budget: this.calculateAIBudget(company, actionType),
        priority: this.rng.nextInt(1, 10),
        status: 'planned',
      };

      if (actionType === 'industrial_espionage') {
        const targets = [...this.state.companies.values()].filter(target => target.id !== company.id && target.departments.length > 0);
        const target = this.rng.shuffle(targets).pop();
        const department = target ? this.rng.shuffle([...target.departments]).pop() : undefined;
        if (!target || !department) continue;
        action.targetCompanyId = target.id;
        action.targetDepartmentId = department.id;
      }
      if (actionType === 'department_initiative') {
        const availableDepartments = company.departments.filter(department =>
          department.lastInitiativeTurn !== this.state.turn
          && (!department.disruptedUntilTurn || department.disruptedUntilTurn < this.state.turn));
        const department = this.rng.shuffle(availableDepartments).pop();
        if (!department) continue;
        action.targetDepartmentId = department.id;
      }
      if (actionType === 'cyber_attack') {
        if (company.computePoints < 1 || !company.departments.some(department => department.type === 'cybersecurity')) continue;
        const targets = [...this.state.companies.values()].filter(target => target.id !== company.id && target.buildings.length > 0);
        const target = this.rng.shuffle(targets).pop();
        const building = target ? this.rng.shuffle([...target.buildings]).pop() : undefined;
        if (!target || !building) continue;
        action.targetCompanyId = target.id;
        action.targetTileId = building.tileId;
        action.resourcePoints = Math.min(company.computePoints, this.rng.nextInt(8, 20));
      }
      if (actionType === 'allocate_compute') {
        if (!company.departments.some(department => department.type === 'ai_data')) continue;
        const product = [...company.products].sort((a, b) => a.computePoints - b.computePoints)[0];
        if (!product || company.computePoints < 1) continue;
        action.targetProductId = product.id;
        action.resourcePoints = Math.min(company.computePoints, this.rng.nextInt(5, 15));
      }
      if (actionType === 'generate_compute') {
        if (!company.departments.some(department => department.type === 'ai_data')) continue;
        if (company.computeInfrastructure >= COMPUTE_INFRASTRUCTURE_CAP) continue;
      }
      if (actionType === 'allocate_cybersecurity') {
        if (!company.departments.some(department => department.type === 'cybersecurity')) continue;
        const building = [...company.buildings].sort((a, b) => a.cybersecurityPoints - b.cybersecurityPoints)[0];
        if (!building || company.cybersecurityPoints < 1) continue;
        action.targetTileId = building.tileId;
        action.resourcePoints = Math.min(company.cybersecurityPoints, this.rng.nextInt(5, 15));
      }
      if (actionType === 'build_department') {
        const building = company.buildings.find(candidate => getBuildingFreeSlots(candidate) > 0);
        if (!building) continue;
        action.targetTileId = building.tileId;
      }

      actions.push(action);
    }

    return actions;
  }

  private selectAIAction(archetype: string, _company: Company): ActionType | null {
    const weights: Record<string, Partial<Record<ActionType, number>>> = {
      hypergrowth_platform: {
        build_department: 20, launch_product: 25, improve_product: 15,
        expand_market: 20, marketing_campaign: 10, hire_executive: 5,
        department_initiative: 7, security_hardening: 2, generate_compute: 5, allocate_compute: 8, allocate_cybersecurity: 3, ai_automation: 3, launch_consulting_practice: 1,
        scout_acquisition: 5, acquire_company: 3, raise_capital: 10, reduce_costs: 1,
        build_building: 8, industrial_espionage: 4, cyber_attack: 3, security_offline: 2,
        security_online: 2, legal_action: 2, ceo_social: 6, public_tender_offer: 4, auction_sell: 3, end_turn: 0, auction_bid: 0,
      },
      security_fortress: {
        build_department: 15, launch_product: 10, improve_product: 15,
        expand_market: 5, marketing_campaign: 5, hire_executive: 10,
        department_initiative: 6, security_hardening: 25, generate_compute: 3, allocate_compute: 3, allocate_cybersecurity: 14, ai_automation: 5, launch_consulting_practice: 5,
        scout_acquisition: 5, acquire_company: 2, raise_capital: 5, reduce_costs: 5,
        build_building: 5, industrial_espionage: 3, cyber_attack: 4, security_offline: 8,
        security_online: 10, legal_action: 6, ceo_social: 3, public_tender_offer: 2, auction_sell: 2, end_turn: 0, auction_bid: 0,
      },
      acquisition_machine: {
        build_department: 10, launch_product: 10, improve_product: 10,
        expand_market: 10, marketing_campaign: 5, hire_executive: 10,
        department_initiative: 8, security_hardening: 5, generate_compute: 3, allocate_compute: 4, allocate_cybersecurity: 5, ai_automation: 5, launch_consulting_practice: 5,
        scout_acquisition: 20, acquire_company: 20, raise_capital: 10, reduce_costs: 5,
        build_building: 6, industrial_espionage: 4, cyber_attack: 3, security_offline: 3,
        security_online: 3, legal_action: 5, ceo_social: 4, public_tender_offer: 12, auction_sell: 4, end_turn: 0, auction_bid: 0,
      },
      lean_specialist: {
        build_department: 10, launch_product: 15, improve_product: 20,
        expand_market: 10, marketing_campaign: 10, hire_executive: 10,
        department_initiative: 8, security_hardening: 10, generate_compute: 6, allocate_compute: 10, allocate_cybersecurity: 8, ai_automation: 10, launch_consulting_practice: 15,
        scout_acquisition: 2, acquire_company: 2, raise_capital: 5, reduce_costs: 10,
        build_building: 4, industrial_espionage: 5, cyber_attack: 4, security_offline: 4,
        security_online: 5, legal_action: 3, ceo_social: 8, public_tender_offer: 3, auction_sell: 3, end_turn: 0, auction_bid: 0,
      },
    };

    const archetypeWeights = weights[archetype] || weights.lean_specialist;
    const total = Object.values(archetypeWeights).reduce((a, b) => a + b, 0);
    let roll = this.rng.nextFloat(0, total);

    for (const [type, weight] of Object.entries(archetypeWeights)) {
      roll -= weight;
      if (roll <= 0) return type as ActionType;
    }

    return 'improve_product';
  }

  private calculateAIBudget(company: Company, actionType: ActionType): number {
    const baseBudgets: Record<ActionType, number> = {
      build_department: 500000,
      launch_product: 300000,
      improve_product: 100000,
      expand_market: 200000,
      marketing_campaign: 150000,
      hire_executive: 400000,
      department_initiative: DEPARTMENT_INITIATIVE_BASE_COST,
      security_hardening: 200000,
      generate_compute: 200000,
      allocate_compute: 0,
      allocate_cybersecurity: 0,
      ai_automation: 250000,
      launch_consulting_practice: 150000,
      scout_acquisition: 50000,
      acquire_company: 2000000,
      raise_capital: 0,
      reduce_costs: 0,
      build_building: 750000,
      industrial_espionage: 200000,
      exploit_stolen_asset: 0,
      repatent_stolen_asset: 200000,
      cyber_attack: 250000,
      security_offline: 200000,
      sabotage_building: 300000,
      security_online: 150000,
      legal_action: 250000,
      ceo_social: 100000,
      public_tender_offer: 1500000,
      auction_sell: 0,
      end_turn: 0,
      auction_bid: 0,
      create_ideas: 400000,
      release_source: 0,
      sell_source: 0,
      pivot_product: 250000,
      hire_ceo: 500000,
      hire_coo: 400000,
      mass_layoff: 0,
      defend_tile: 150000,
      // T — CEO GDR + Legal & Compliance
      ceo_praise: 100000,
      ceo_discredit: 150000,
      train_ceo: 300000,
      fire_ceo: 0,
      legal_sue: 250000,
      legal_patent: 200000,
      legal_subpoena: 150000,
      acquire_below_value: 500000,
    };

    const base = baseBudgets[actionType] || 100000;
    const variance = this.rng.nextFloat(0.5, 1.5);
    const calculated = Math.round(base * variance * (company.cash / 1000000));
    return actionType === 'department_initiative' ? Math.max(base, calculated) : calculated;
  }

  private resolveAction(action: TurnAction): { success: boolean; message: string; effects: Record<string, number>; risksTriggered: string[] } {
    const company = this.state.companies.get(action.companyId);
    if (!company) return { success: false, message: 'Company not found', effects: {}, risksTriggered: [] };

    if (action.type === 'create_ideas') {
      const rdCapacity = company.departments.filter(department => department.type === 'product_rd').length;
      const usedCapacity = this.ideasCreatedThisTurn.get(company.id) ?? 0;
      if (usedCapacity >= rdCapacity) {
        return { success: false, message: 'R&D capacity exhausted — each R&D department creates at most one idea per turn', effects: {}, risksTriggered: [] };
      }
    }
    if (action.type === 'department_initiative') {
      const department = action.targetDepartmentId
        ? company.departments.find(candidate => candidate.id === action.targetDepartmentId)
        : undefined;
      if (!department) {
        return { success: false, message: 'Select one of your operating departments', effects: {}, risksTriggered: [] };
      }
      if (action.budget < DEPARTMENT_INITIATIVE_BASE_COST) {
        return { success: false, message: `Department initiatives require at least $${DEPARTMENT_INITIATIVE_BASE_COST.toLocaleString()}`, effects: {}, risksTriggered: [] };
      }
      if (department.lastInitiativeTurn === this.state.turn) {
        return { success: false, message: 'This department has already run an initiative this turn', effects: {}, risksTriggered: [] };
      }
      if (department.disruptedUntilTurn && department.disruptedUntilTurn >= this.state.turn) {
        return { success: false, message: 'This department is disrupted and cannot run an initiative', effects: {}, risksTriggered: [] };
      }
    }
    if (action.type === 'launch_product') {
      const idea = action.ideaId ? company.ideas.find(candidate => candidate.id === action.ideaId) : undefined;
      const committedTrend = this.findCommittedTrend(action);
      const investedSignal = this.findInvestedSignal(action);
      if (action.ideaId && !idea) {
        return { success: false, message: 'Selected R&D idea is no longer available', effects: {}, risksTriggered: [] };
      }
      if (action.trendId && !committedTrend) {
        return { success: false, message: 'The exploited trend is no longer committed to this launch', effects: {}, risksTriggered: [] };
      }
      if (action.weakSignalId && !investedSignal) {
        return { success: false, message: 'The invested weak signal has expired or is no longer available', effects: {}, risksTriggered: [] };
      }
      const boundCategory = committedTrend?.category ?? investedSignal?.relatedCategory ?? idea?.category;
      const boundSector = committedTrend?.sector ?? investedSignal?.relatedSector;
      if (boundCategory && action.productCategory && action.productCategory !== boundCategory) {
        return { success: false, message: `Product category is locked to ${boundCategory.replace('_', ' ')}`, effects: {}, risksTriggered: [] };
      }
      if (idea && boundCategory && idea.category !== boundCategory) {
        return { success: false, message: `Selected idea must match the invested ${boundCategory.replace('_', ' ')} category`, effects: {}, risksTriggered: [] };
      }
      if (boundSector && action.targetSegments?.length && !action.targetSegments.includes(boundSector)) {
        return { success: false, message: `Product sector is locked to ${boundSector.replace('_', ' ')}`, effects: {}, risksTriggered: [] };
      }
    }
    if (action.type === 'build_building') {
      const tile = action.targetTileId ? this.state.marketTiles.get(action.targetTileId) : undefined;
      if (!tile) return { success: false, message: 'Select a valid tile for the new building', effects: {}, risksTriggered: [] };
      if (tile.buildingId) return { success: false, message: 'Tile occupied — a tile can contain only one building', effects: {}, risksTriggered: [] };
      if (tile.controllerId && tile.controllerId !== company.id) return { success: false, message: 'Rival territory must be acquired before construction', effects: {}, risksTriggered: [] };
      if (company.buildings.length >= 10) return { success: false, message: 'Corporate building limit reached (10)', effects: {}, risksTriggered: [] };
    }
    if (action.type === 'build_department') {
      const tile = action.targetTileId ? this.state.marketTiles.get(action.targetTileId) : undefined;
      const building = findBuildingOnTile(company, action.targetTileId);
      const usedSlots = building ? getBuildingUsedSlots(building) : 0;
      if (!tile || tile.controllerId !== company.id || !building) {
        return { success: false, message: 'Build Department must target one of your buildings', effects: {}, risksTriggered: [] };
      }
      if (usedSlots >= building.maxDepartments) {
        return { success: false, message: `${getBuildingDisplayName(company, building)} has no free department slots`, effects: {}, risksTriggered: [] };
      }
    }
    if (action.type === 'security_offline') {
      const tile = action.targetTileId ? this.state.marketTiles.get(action.targetTileId) : undefined;
      const building = tile?.buildingId ? company.buildings.find(candidate => candidate.id === tile.buildingId) : undefined;
      if (!tile || tile.controllerId !== company.id || !building) {
        return { success: false, message: 'Physical Security must target one of your buildings', effects: {}, risksTriggered: [] };
      }
    }
    if (action.type === 'sabotage_building') {
      const tile = action.targetTileId ? this.state.marketTiles.get(action.targetTileId) : undefined;
      const owner = tile?.controllerId ? this.state.companies.get(tile.controllerId) : undefined;
      const building = tile?.buildingId ? owner?.buildings.find(candidate => candidate.id === tile.buildingId) : undefined;
      if (!tile || !owner || owner.id === company.id || !building) {
        return { success: false, message: 'Sabotage requires a named opponent building', effects: {}, risksTriggered: [] };
      }
    }
    if (action.type === 'defend_tile') {
      const tile = action.targetTileId ? this.state.marketTiles.get(action.targetTileId) : undefined;
      const building = tile?.buildingId ? company.buildings.find(candidate => candidate.id === tile.buildingId) : undefined;
      if (!tile || tile.controllerId !== company.id || !building) {
        return { success: false, message: 'Defend Building must target one of your buildings', effects: {}, risksTriggered: [] };
      }
    }
    if (action.type === 'industrial_espionage') {
      const target = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
      const department = action.targetDepartmentId ? target?.departments.find(candidate => candidate.id === action.targetDepartmentId) : undefined;
      if (!target || target.id === company.id) {
        return { success: false, message: 'Industrial Espionage requires an opponent corporation', effects: {}, risksTriggered: [] };
      }
      if (!department) {
        return { success: false, message: 'Select a real department belonging to the opponent corporation', effects: {}, risksTriggered: [] };
      }
    }
    if (action.type === 'exploit_stolen_asset' || action.type === 'repatent_stolen_asset') {
      const intel = action.stolenAssetId
        ? company.espionageIntel.find(candidate => candidate.id === action.stolenAssetId)
        : undefined;
      if (!intel) {
        return { success: false, message: 'Select intelligence secured through Industrial Espionage', effects: {}, risksTriggered: [] };
      }
      if (intel.availableTurn > this.state.turn) {
        return { success: false, message: `Stolen intelligence becomes actionable on turn ${intel.availableTurn}`, effects: {}, risksTriggered: [] };
      }
      if (action.type === 'exploit_stolen_asset') {
        if (intel.exploitedTurn) return { success: false, message: 'This stolen asset has already been exploited', effects: {}, risksTriggered: [] };
        if (intel.expiresTurn < this.state.turn) return { success: false, message: 'This espionage dossier has expired', effects: {}, risksTriggered: [] };
      } else {
        if (!company.departments.some(department => department.type === 'legal_compliance')) {
          return { success: false, message: 'Re-Patent requires a Legal & Compliance department', effects: {}, risksTriggered: [] };
        }
        if (intel.kind !== 'idea' && intel.kind !== 'product_blueprint') {
          return { success: false, message: 'Re-Patent applies only to stolen ideas or product blueprints', effects: {}, risksTriggered: [] };
        }
        if (intel.repatentedTurn) return { success: false, message: 'This stolen IP has already been re-patented', effects: {}, risksTriggered: [] };
      }
    }
    if (action.type === 'cyber_attack') {
      if (!company.departments.some(department => department.type === 'cybersecurity')) {
        return { success: false, message: 'Cyber Attack requires a Cybersecurity department', effects: {}, risksTriggered: [] };
      }
      const target = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
      const tile = action.targetTileId ? this.state.marketTiles.get(action.targetTileId) : undefined;
      const building = tile?.buildingId ? target?.buildings.find(candidate => candidate.id === tile.buildingId) : undefined;
      if (!target || target.id === company.id) {
        return { success: false, message: 'Cyber Attack requires a rival target corporation', effects: {}, risksTriggered: [] };
      }
      if (!tile || tile.controllerId !== target.id || !building) {
        return { success: false, message: 'Select a building belonging to the target corporation', effects: {}, risksTriggered: [] };
      }
      const spend = Math.floor(action.resourcePoints ?? Math.min(20, company.computePoints));
      if (spend < 1 || spend > company.computePoints) {
        return { success: false, message: 'Cyber Attack requires available Compute Points', effects: {}, risksTriggered: [] };
      }
    }
    if (action.type === 'generate_compute') {
      if (!company.departments.some(department => department.type === 'ai_data')) {
        return { success: false, message: 'Compute Grid expansion requires an AI & Data department', effects: {}, risksTriggered: [] };
      }
      if (action.budget < 200_000) {
        return { success: false, message: 'Compute Grid expansion requires at least $200,000', effects: {}, risksTriggered: [] };
      }
      if (company.computeInfrastructure >= COMPUTE_INFRASTRUCTURE_CAP) {
        return { success: false, message: 'Compute Grid is already at maximum level', effects: {}, risksTriggered: [] };
      }
    }
    if (action.type === 'allocate_compute') {
      if (!company.departments.some(department => department.type === 'ai_data')) {
        return { success: false, message: 'Compute allocation requires an AI & Data department', effects: {}, risksTriggered: [] };
      }
      const product = action.targetProductId ? company.products.find(candidate => candidate.id === action.targetProductId) : undefined;
      const points = Math.floor(action.resourcePoints ?? 0);
      if (!product) return { success: false, message: 'Select one of your launched products', effects: {}, risksTriggered: [] };
      if (points < 1 || points > company.computePoints) return { success: false, message: 'Not enough unallocated Compute Points', effects: {}, risksTriggered: [] };
      if (product.computePoints + points > 100) return { success: false, message: 'Product compute capacity cannot exceed 100', effects: {}, risksTriggered: [] };
    }
    if (action.type === 'allocate_cybersecurity') {
      if (!company.departments.some(department => department.type === 'cybersecurity')) {
        return { success: false, message: 'Cyber allocation requires a Cybersecurity department', effects: {}, risksTriggered: [] };
      }
      const tile = action.targetTileId ? this.state.marketTiles.get(action.targetTileId) : undefined;
      const building = tile?.buildingId ? company.buildings.find(candidate => candidate.id === tile.buildingId) : undefined;
      const points = Math.floor(action.resourcePoints ?? 0);
      if (!building) return { success: false, message: 'Select one of your buildings', effects: {}, risksTriggered: [] };
      if (points < 1 || points > company.cybersecurityPoints) return { success: false, message: 'Not enough unallocated Cybersecurity Points', effects: {}, risksTriggered: [] };
      if (building.cybersecurityPoints + points > 100) return { success: false, message: 'Building cyber resilience cannot exceed 100', effects: {}, risksTriggered: [] };
    }

    if (action.budget > Math.max(0, company.cash * 0.5)) {
      return { success: false, message: 'Insufficient funds', effects: {}, risksTriggered: [] };
    }

    // T: Acquire Company is an investment, not a gamble — but the target only
    // accepts if the offer clears a minimum price (scales with valuation). The
    // composer's offer slider controls this; below the floor the deal is rejected.
    if (action.type === 'acquire_company') {
      const target = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
      if (!target) return { success: false, message: 'Target not found', effects: {}, risksTriggered: [] };
      const minAccept = Math.round(target.valuation * (target.isStartup ? 0.6 : 0.8));
      if (action.budget < minAccept) {
        return { success: false, message: `Offer rejected — minimum acceptable $${minAccept.toLocaleString()}`, effects: {}, risksTriggered: [] };
      }
    }
    // Building/construction actions are investments, not gambles: they always succeed.
    // Only offensive / market / social actions are subject to the success roll.
    const alwaysSucceed = ['launch_product', 'build_department', 'build_building', 'hire_executive', 'hire_ceo', 'hire_coo', 'mass_layoff', 'raise_capital', 'reduce_costs', 'ai_automation', 'generate_compute', 'allocate_compute', 'allocate_cybersecurity', 'launch_consulting_practice', 'acquire_company', 'acquire_below_value', 'security_offline', 'defend_tile', 'exploit_stolen_asset', 'repatent_stolen_asset'];
    const successChance = this.calculateSuccessChance(action, company);
    const success = alwaysSucceed.includes(action.type) || this.rng.nextBoolean(successChance);

    const effects: Record<string, number> = {};
    const risks: string[] = [];

    if (success) {
      this.applyActionEffectsToCompany(action, company, effects);
    } else {
      if (action.type === 'department_initiative') {
        const department = action.targetDepartmentId
          ? company.departments.find(candidate => candidate.id === action.targetDepartmentId)
          : undefined;
        const failureCost = Math.round(action.budget * 0.35);
        company.cash -= failureCost;
        effects.cash = -failureCost;
        if (department) {
          this.resolveDepartmentInitiative(company, department, action.budget, false, effects);
          risks.push(`department_backfire:${department.type}`);
        }
      } else {
        effects.cash = -action.budget * 0.1;
        company.cash -= Math.round(action.budget * 0.1);
        risks.push('execution_failure');
      }
    }

    const initiativeDepartment = action.type === 'department_initiative' && action.targetDepartmentId
      ? company.departments.find(candidate => candidate.id === action.targetDepartmentId)
      : undefined;
    const initiative = initiativeDepartment ? getDepartmentInitiative(initiativeDepartment.type) : undefined;

    return {
      success,
      message: initiative
        ? `${initiative.label} ${success ? 'delivered its upside' : 'backfired'} — ${success ? initiative.upside : initiative.downside}`
        : success && action.type === 'generate_compute'
        ? `Compute Grid expanded by ${effects.computeInfrastructure ?? 0}; ${effects.computePoints ?? 0} Compute Points commissioned`
        : success ? 'Action completed successfully' : 'Action failed to achieve objectives',
      effects,
      risksTriggered: risks,
    };
  }

  private calculateSuccessChance(action: TurnAction, company: Company): number {
    void company;
    return this.estimateSuccess(action);
  }

  private getActionBaseCost(actionType: ActionType): number {
    const costs: Record<ActionType, number> = {
      build_department: 500000,
      launch_product: 300000,
      improve_product: 100000,
      expand_market: 200000,
      marketing_campaign: 150000,
      hire_executive: 400000,
      department_initiative: DEPARTMENT_INITIATIVE_BASE_COST,
      security_hardening: 200000,
      generate_compute: 200000,
      allocate_compute: 0,
      allocate_cybersecurity: 0,
      ai_automation: 250000,
      launch_consulting_practice: 150000,
      scout_acquisition: 50000,
      acquire_company: 2000000,
      raise_capital: 0,
      reduce_costs: 0,
      build_building: 750000,
      industrial_espionage: 200000,
      exploit_stolen_asset: 0,
      repatent_stolen_asset: 200000,
      cyber_attack: 250000,
      security_offline: 200000,
      sabotage_building: 300000,
      security_online: 150000,
      legal_action: 250000,
      ceo_social: 100000,
      public_tender_offer: 1500000,
      auction_sell: 0,
      end_turn: 0,
      auction_bid: 0,
      create_ideas: 400000,
      release_source: 0,
      sell_source: 0,
      pivot_product: 250000,
      hire_ceo: 500000,
      hire_coo: 400000,
      mass_layoff: 0,
      defend_tile: 150000,
      // T — CEO GDR + Legal & Compliance
      ceo_praise: 100000,
      ceo_discredit: 150000,
      train_ceo: 300000,
      fire_ceo: 0,
      legal_sue: 250000,
      legal_patent: 200000,
      legal_subpoena: 150000,
      acquire_below_value: 500000,
    };
    return costs[actionType] || 100000;
  }

  private isDepartmentRelevant(deptType: string, actionType: ActionType): boolean {
    const mapping: Record<ActionType, string[]> = {
      build_department: ['corporate_strategy', 'finance_investor'],
      launch_product: ['product_rd', 'ai_data'],
      improve_product: ['product_rd', 'ai_data'],
      expand_market: ['sales_marketing', 'corporate_strategy'],
      marketing_campaign: ['sales_marketing'],
      hire_executive: ['people_culture', 'corporate_strategy'],
      department_initiative: ['product_rd', 'ai_data', 'cybersecurity', 'sales_marketing', 'consulting_services', 'acquisitions', 'legal_compliance', 'people_culture', 'finance_investor', 'corporate_strategy', 'dev_engineering'],
      security_hardening: ['cybersecurity', 'ai_data'],
      generate_compute: ['ai_data', 'dev_engineering'],
      allocate_compute: ['ai_data', 'dev_engineering'],
      allocate_cybersecurity: ['cybersecurity'],
      ai_automation: ['ai_data', 'product_rd'],
      launch_consulting_practice: ['consulting_services', 'sales_marketing'],
      scout_acquisition: ['acquisitions', 'finance_investor'],
      acquire_company: ['acquisitions', 'finance_investor', 'legal_compliance'],
      raise_capital: ['finance_investor', 'corporate_strategy'],
      reduce_costs: ['finance_investor', 'people_culture'],
      build_building: ['corporate_strategy', 'finance_investor'],
      industrial_espionage: ['cybersecurity', 'product_rd', 'ai_data'],
      exploit_stolen_asset: ['product_rd', 'ai_data', 'cybersecurity'],
      repatent_stolen_asset: ['legal_compliance'],
      cyber_attack: ['cybersecurity', 'ai_data'],
      security_offline: ['cybersecurity', 'people_culture'],
      sabotage_building: ['cybersecurity', 'corporate_strategy'],
      security_online: ['cybersecurity', 'ai_data'],
      defend_tile: ['cybersecurity', 'corporate_strategy'],
      legal_action: ['legal_compliance', 'corporate_strategy'],
      ceo_social: ['sales_marketing', 'corporate_strategy'],
      public_tender_offer: ['acquisitions', 'finance_investor', 'legal_compliance'],
      auction_sell: ['finance_investor', 'corporate_strategy', 'acquisitions'],
      auction_bid: ['corporate_strategy', 'finance_investor', 'acquisitions'],
      create_ideas: ['product_rd', 'ai_data', 'consulting_services'],
      release_source: ['product_rd', 'ai_data', 'sales_marketing'],
      sell_source: ['finance_investor', 'corporate_strategy', 'legal_compliance'],
      pivot_product: ['product_rd', 'ai_data', 'consulting_services'],
      hire_ceo: ['people_culture', 'corporate_strategy'],
      hire_coo: ['people_culture', 'corporate_strategy'],
      mass_layoff: ['people_culture', 'finance_investor'],
      // T — CEO GDR + Legal & Compliance gates
      ceo_praise: ['sales_marketing', 'corporate_strategy'],
      ceo_discredit: ['sales_marketing', 'corporate_strategy'],
      train_ceo: ['people_culture', 'corporate_strategy'],
      fire_ceo: ['people_culture', 'corporate_strategy'],
      legal_sue: ['legal_compliance', 'corporate_strategy'],
      legal_patent: ['legal_compliance'],
      legal_subpoena: ['legal_compliance'],
      acquire_below_value: ['finance_investor', 'corporate_strategy', 'acquisitions'],
      end_turn: [],
    };
    return mapping[actionType]?.includes(deptType) ?? false;
  }

  private applyActionEffects(action: TurnAction): void {
    const company = this.state.companies.get(action.companyId);
    if (!company) return;

    this.applyActionEffectsToCompany(action, company, {});
  }

  private applyActionEffectsToCompany(
    action: TurnAction,
    company: Company,
    _effects: Record<string, number>
  ): void {
    // Auction bids reserve intent and are paid exactly once when the listing settles.
    if (action.type !== 'auction_bid') company.cash -= action.budget;

    switch (action.type) {
      case 'build_department':
        this.buildDepartment(company, action);
        break;
      case 'launch_product':
        this.launchProduct(company, action);
        break;
      case 'improve_product':
        this.improveProduct(company, action.budget, action.targetProductId);
        break;
      case 'expand_market':
        this.expandMarket(company, action);
        break;
      case 'marketing_campaign':
        this.runMarketingCampaign(company, action.budget, action.targetProductId);
        break;
      case 'hire_executive':
        this.hireExecutive(company, action.budget);
        break;
      case 'department_initiative': {
        const department = action.targetDepartmentId
          ? company.departments.find(candidate => candidate.id === action.targetDepartmentId)
          : undefined;
        if (department) this.resolveDepartmentInitiative(company, department, action.budget, true, _effects);
        break;
      }
      case 'security_hardening':
        this.hardenSecurity(company, action.budget, action.targetProductId);
        break;
      case 'generate_compute':
        this.generateCompute(company, action.budget, _effects);
        break;
      case 'allocate_compute':
        this.allocateCompute(company, action);
        break;
      case 'allocate_cybersecurity':
        this.allocateCybersecurity(company, action);
        break;
      case 'ai_automation':
        this.automateAI(company, action.budget);
        break;
      case 'launch_consulting_practice':
        this.launchConsultingPractice(company, action.budget);
        break;
      case 'scout_acquisition':
        this.scoutAcquisition(company);
        break;
      case 'acquire_company':
        this.acquireCompany(company, action);
        break;
      case 'raise_capital':
        this.raiseCapital(company);
        break;
      case 'reduce_costs':
        this.reduceCosts(company);
        break;
      // --- ruthless.com-inspired new actions ---
      case 'build_building':
        this.buildNewBuilding(company, action);
        break;
      case 'industrial_espionage':
        this.runIndustrialEspionage(company, action);
        break;
      case 'exploit_stolen_asset':
        this.runExploitStolenAsset(company, action);
        break;
      case 'repatent_stolen_asset':
        this.runRepatentStolenAsset(company, action);
        break;
      case 'cyber_attack':
        this.runCyberAttack(company, action);
        break;
      case 'security_offline':
        this.runSecurityOffline(company, action);
        break;
      case 'sabotage_building':
        this.runSabotage(company, action);
        break;
      case 'defend_tile':
        this.runDefendTile(company, action);
        break;
      case 'security_online':
        this.runSecurityOnline(company, action);
        break;
      case 'legal_action':
        this.runLegalAction(company, action);
        break;
      case 'create_ideas':
        this.runCreateIdeas(company, action);
        break;
      case 'release_source':
        this.runReleaseSource(company, action);
        break;
      case 'sell_source':
        this.runSellSource(company, action);
        break;
      case 'pivot_product':
        this.runPivotProduct(company, action);
        break;
      case 'hire_ceo':
        this.runHireChief(company, action, 'ceo');
        break;
      case 'hire_coo':
        this.runHireChief(company, action, 'coo');
        break;
      case 'mass_layoff':
        this.runMassLayoff(company, action);
        break;
      case 'ceo_social':
        this.runCeoSocial(company, action);
        break;
      case 'public_tender_offer':
        this.runPublicTenderOffer(company, action);
        break;
      case 'auction_sell':
        this.runAuctionSell(company, action);
        break;
      case 'auction_bid':
        this.runAuctionBid(company, action);
        break;
      // --- CEO GDR: market-moving PR, training & firing ---
      case 'ceo_praise':
        this.runCeoPraise(company, action);
        break;
      case 'ceo_discredit':
        this.runCeoDiscredit(company, action);
        break;
      case 'train_ceo':
        this.runTrainChief(company, action);
        break;
      case 'fire_ceo':
        this.runFireChief(company, action);
        break;
      // --- Legal & Compliance ---
      case 'legal_sue':
        this.runLegalSue(company, action);
        break;
      case 'legal_patent':
        this.runLegalPatent(company, action);
        break;
      case 'legal_subpoena':
        this.runLegalSubpoena(company, action);
        break;
      case 'acquire_below_value':
        this.runAcquireBelowValue(company, action);
        break;
    }

    // metrics are recomputed once per turn in endTurn() (see recalcAllCompanies)
  }

  private buildDepartment(company: Company, action: TurnAction): void {
    const budget = action.budget;
    const level = Math.max(1, Math.floor(budget / 200000));
    // Player-chosen type if provided, else pick a department type the company
    // currently lacks or has weakest, so growth stays balanced.
    let type: DepartmentType;
    if (action.departmentType) {
      type = action.departmentType;
    } else {
      const owned = new Set(company.departments.map(d => d.type));
      const preferred: DepartmentType[] = ['product_rd', 'ai_data', 'cybersecurity', 'sales_marketing', 'consulting_services', 'acquisitions', 'legal_compliance', 'people_culture', 'finance_investor', 'dev_engineering', 'corporate_strategy'];
      const missing = preferred.filter(t => !owned.has(t));
      const pool = missing.length > 0 ? missing : preferred;
      type = this.rng.shuffle(pool).pop()!;
    }

    // The resolver already validated this exact destination. Never reroute a
    // department to a different building than the one selected by the player.
    const destination = findBuildingOnTile(company, action.targetTileId);
    if (!destination || getBuildingFreeSlots(destination) <= 0) return;
    const buildingId = destination.id;

    // T: duplicated departments (2 legal, 3 legal) stack — grant a corporate synergy bonus.
    const sameType = company.departments.filter(d => d.type === type).length;
    const stackBonus = 1 + sameType * 0.15; // each duplicate adds 15% effectiveness

    // T: DEV departments start with a vertical tech stack (CI/CD + futuristic).
    const techStack = type === 'dev_engineering'
      ? { cicd_github: 20, cloud_k8s: 15, cicd_argo: 5 }
      : undefined;

    // T: 1 product = 1 product — a department may own at most one product.
    const ownedProduct = company.products.find(p => !company.departments.some(d => d.productId === p.id));

    const dept: Department = {
      id: generateId.department(),
      type,
      level: Math.round(level * stackBonus),
      capacity: level * 10,
      efficiency: 0.7 * stackBonus,
      morale: 0.8,
      risk: 0.2,
      recurringCost: level * 50000,
      buildingId,
      techStack,
      productId: ownedProduct?.id,
    };
    company.departments.push(dept);
    if (buildingId) {
      const b = company.buildings.find(x => x.id === buildingId);
      b?.departmentIds.push(dept.id);
    }
  }

  private resolveDepartmentInitiative(
    company: Company,
    department: Department,
    budget: number,
    success: boolean,
    outcomeEffects: Record<string, number>,
  ): void {
    const profile = getDepartmentInitiative(department.type);
    const budgetScale = Math.min(3, Math.max(1, budget / DEPARTMENT_INITIATIVE_BASE_COST));
    const executionScale = success
      ? Math.min(1.25, 0.75 + department.level * 0.04 + department.efficiency * 0.08 + department.morale * 0.05)
      : 1 + department.risk * 0.5;
    this.applyDepartmentInitiativeEffects(
      company,
      department,
      success ? profile.success : profile.failure,
      budgetScale * executionScale,
      profile.productScope,
      outcomeEffects,
    );
    department.lastInitiativeTurn = this.state.turn;
  }

  private applyDepartmentInitiativeEffects(
    company: Company,
    department: Department,
    initiativeEffects: DepartmentInitiativeEffects,
    scale: number,
    productScope: 'linked' | 'portfolio',
    outcomeEffects: Record<string, number>,
  ): void {
    const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
    const scaled = (value?: number): number => (value ?? 0) * scale;
    const record = (key: string, amount: number): void => {
      if (amount) outcomeEffects[key] = (outcomeEffects[key] ?? 0) + amount;
    };

    const employeeMorale = scaled(initiativeEffects.employeeMorale);
    const employerBrand = scaled(initiativeEffects.employerBrand);
    const brandTrust = scaled(initiativeEffects.brandTrust);
    const innovation = scaled(initiativeEffects.innovation);
    const aiCapability = scaled(initiativeEffects.aiCapability);
    const consultingCapacity = scaled(initiativeEffects.consultingCapacity);
    const securityPosture = scaled(initiativeEffects.securityPosture);
    const computePoints = Math.round(scaled(initiativeEffects.computePoints));
    const computeInfrastructure = Math.round(scaled(initiativeEffects.computeInfrastructure));
    const cybersecurityPoints = Math.round(scaled(initiativeEffects.cybersecurityPoints));
    const legalPoints = Math.round(scaled(initiativeEffects.legalPoints));
    const debt = Math.round(scaled(initiativeEffects.debt));
    const cash = Math.round(scaled(initiativeEffects.cash));
    const scandal = scaled(initiativeEffects.scandal);

    company.employeeMorale = clamp(company.employeeMorale + employeeMorale, 0, 100);
    company.employerBrand = clamp(company.employerBrand + employerBrand, 0, 100);
    company.brandTrust = clamp(company.brandTrust + brandTrust, 0, 100);
    company.innovation = clamp(company.innovation + innovation, 0, 100);
    company.aiCapability = clamp(company.aiCapability + aiCapability, 0, 100);
    company.consultingCapacity = clamp(company.consultingCapacity + consultingCapacity, 0, 100);
    company.securityPosture = clamp(company.securityPosture + securityPosture, 0, 100);
    company.computePoints = clamp(company.computePoints + computePoints, 0, COMPUTE_POOL_CAP);
    company.computerPoints = company.computePoints;
    company.computeInfrastructure = clamp(company.computeInfrastructure + computeInfrastructure, 0, COMPUTE_INFRASTRUCTURE_CAP);
    company.cybersecurityPoints = clamp(company.cybersecurityPoints + cybersecurityPoints, 0, 500);
    company.legalPoints = Math.max(0, company.legalPoints + legalPoints);
    company.debt = Math.max(0, company.debt + debt);
    company.cash += cash;
    company.scandal = clamp(company.scandal + scandal, 0, 100);

    const departmentMorale = scaled(initiativeEffects.departmentMorale);
    const allDepartmentMorale = scaled(initiativeEffects.allDepartmentMorale);
    const departmentEfficiency = scaled(initiativeEffects.departmentEfficiency);
    const departmentRisk = scaled(initiativeEffects.departmentRisk);
    company.departments.forEach(candidate => {
      candidate.morale = clamp(candidate.morale + allDepartmentMorale, 0.1, 1);
    });
    department.morale = clamp(department.morale + departmentMorale, 0.1, 1);
    department.efficiency = clamp(department.efficiency + departmentEfficiency, 0.2, 1.25);
    department.risk = clamp(department.risk + departmentRisk, 0, 1);

    const linkedProduct = department.productId
      ? company.products.find(product => product.id === department.productId)
      : undefined;
    const products = productScope === 'portfolio'
      ? company.products
      : linkedProduct ? [linkedProduct] : company.products.slice(0, 1);
    products.forEach(product => {
      product.quality = clamp(product.quality + scaled(initiativeEffects.productQuality), 0, 100);
      product.marketFit = clamp(product.marketFit + scaled(initiativeEffects.productMarketFit), 0, 100);
      product.adopters = clamp(product.adopters + scaled(initiativeEffects.productAdopters), 0, 1);
      product.scalability = clamp(product.scalability + scaled(initiativeEffects.productScalability), 0, 100);
      product.technicalDebt = clamp(product.technicalDebt + scaled(initiativeEffects.productTechnicalDebt), 0, 100);
    });

    record('employeeMorale', employeeMorale);
    record('brandTrust', brandTrust);
    record('computePoints', computePoints);
    record('computeInfrastructure', computeInfrastructure);
    record('cybersecurityPoints', cybersecurityPoints);
    record('legalPoints', legalPoints);
    record('cash', cash);
    record('debt', debt);
    record('scandal', scandal);
    record('productMarketFit', scaled(initiativeEffects.productMarketFit) * products.length);
  }

  private findCommittedTrend(action: TurnAction): MarketTrend | undefined {
    if (!action.trendId) return undefined;
    return this.state.trends.find(trend => trend.id === action.trendId && trend.expiresTurn > this.state.turn)
      ?? [...this.state.trendHistory].reverse().find(entry =>
        entry.trend.id === action.trendId
        && entry.outcome === 'pursued'
        && (!entry.companyId || entry.companyId === action.companyId))?.trend;
  }

  private findInvestedSignal(action: TurnAction): WeakSignal | undefined {
    if (!action.weakSignalId) return undefined;
    return this.state.weakSignals.find(signal => signal.id === action.weakSignalId && signal.expiresTurn > this.state.turn);
  }

  private launchProduct(company: Company, action: TurnAction): void {
    // T: an R&D idea can seed the launch — it grants extra adopter momentum and
    // is consumed (moved out of the R&D Ideas list into production).
    const idea = action.ideaId
      ? company.ideas.find(i => i.id === action.ideaId)
      : undefined;
    const committedTrend = this.findCommittedTrend(action);
    const investedSignal = this.findInvestedSignal(action);
    const category: ProductCategory = (committedTrend?.category ?? investedSignal?.relatedCategory ?? idea?.category ?? action.productCategory) ?? this.rng.shuffle([
      'saas', 'ai', 'cybersecurity', 'consulting', 'managed_service', 'data_service',
      'platform_api', 'hybrid', 'fintech', 'cloud_infra', 'iot', 'blockchain',
      'healthtech', 'edtech', 'greentech', 'gaming', 'ecommerce', 'data_analytics',
      'robotics', 'biotech', 'quantum', 'ar_vr',
    ]).pop()! as ProductCategory;
    const name = action.productName?.trim() || `Product_${company.products.length + 1}`;

    // T5: riding an active global trend for this category grants a launch bonus.
    const trend = committedTrend ?? this.state.trends.find(t => t.category === category && t.expiresTurn > this.state.turn);
    const latestResolvedTrend = [...this.state.trendHistory].reverse().find(entry => entry.trend.category === category);
    const missedTrend = latestResolvedTrend?.outcome === 'missed'
      && latestResolvedTrend.trend.decisionDeadlineTurn < this.state.turn
      && (!trend || latestResolvedTrend.trend.appearedTurn >= trend.appearedTurn)
      ? latestResolvedTrend
      : undefined;
    const trendBonus = trend ? trend.strength : investedSignal ? investedSignal.confidence * 0.5 : 0;
    // An idea-backed launch rides the R&D push: more early adopters + quality lift.
    const ideaBonus = idea ? (idea.breakthrough ? 0.18 : 0.10) + idea.maturity / 400 : 0;

    const product: Product = {
      id: generateId.product(),
      companyId: company.id,
      name,
      category,
      maturity: 20 + Math.round(trendBonus * 15) + Math.round(ideaBonus * 40),
      quality: 50 + Math.round(trendBonus * 25) + (idea ? 8 : 0),
      security: category === 'cybersecurity' ? 80 : 40,
      scalability: category === 'saas' ? 80 : 50,
      marketFit: 40 + Math.round(trendBonus * 30) + (idea ? 8 : 0),
      price: 10000,
      operatingCost: 5000,
      computePoints: 0,
      lastComputeMultiplier: 1,
      computeAdvantage: 0,
      lastTurnRevenue: 0,
      lastTurnMargin: 0,
      technicalDebt: 10,
      trust: 50 + (idea ? 6 : 0),
      targetSegments: committedTrend
        ? [committedTrend.sector]
        : investedSignal
          ? [investedSignal.relatedSector]
          : action.targetSegments?.length
            ? action.targetSegments
            : trend
              ? [trend.sector]
              : ['enterprise_cluster', 'high_growth'],
      tileIds: [],
      // T: lifecycle bootstrapping — launches start at the early-adopter phase.
      lifecycleStage: 'early',
      version: 1,
      adopters: 0.02 + trendBonus * 0.05 + ideaBonus, // idea-backed launch seeds real adopters
      baseInstalled: 0,
      pivotCount: 0,
      ageTurns: 0,
      trendTiming: missedTrend ? 'late' : (trend || investedSignal) ? 'on_time' : 'none',
      espionageIntelId: idea?.espionageIntelId,
      stolenFromCompanyId: idea?.stolenFromCompanyId,
      repatented: idea?.repatented,
      legalExposureUntilTurn: idea?.stolenFromCompanyId ? this.state.turn + 2 : undefined,
      legalClaimResolved: idea?.repatented ? true : undefined,
    };
    if (missedTrend) {
      product.quality = Math.min(product.quality, 70);
      product.marketFit = Math.min(product.marketFit, 60);
      product.maturity = Math.min(product.maturity, 55);
      product.adopters = Math.min(product.adopters, 0.04);
    }
    company.products.push(product);
    if (product.espionageIntelId) {
      const intel = company.espionageIntel.find(candidate => candidate.id === product.espionageIntelId);
      if (intel) intel.derivedProductId = product.id;
    }
    // Keep product ownership spatially coherent: cyber incidents target the
    // building that actually hosts the R&D department responsible for it.
    const ownerDepartment = company.departments.find(department => department.type === 'product_rd' && !department.productId)
      ?? company.departments.find(department => department.type === 'product_rd');
    if (ownerDepartment && !ownerDepartment.productId) ownerDepartment.productId = product.id;
    const ownerBuilding = ownerDepartment?.buildingId
      ? company.buildings.find(building => building.id === ownerDepartment.buildingId)
      : company.buildings.find(building => building.isHQ);
    if (ownerBuilding && !ownerBuilding.productIds.includes(product.id)) ownerBuilding.productIds.push(product.id);

    // Consume the idea: it has been brought into production.
    if (idea) {
      company.ideas = company.ideas.filter(i => i.id !== idea.id);
      this.state.inventions = this.state.inventions.filter(i => i.id !== idea.id);
    }
    if (investedSignal) {
      this.state.weakSignals = this.state.weakSignals.filter(signal => signal.id !== investedSignal.id);
    }
  }

  private improveProduct(company: Company, _budget: number, targetProductId?: string): void {
    if (company.products.length === 0) return;
    const product = (targetProductId && company.products.find(p => p.id === targetProductId))
      || this.rng.shuffle([...company.products]).pop()!;
    const improvement = _budget / 100000;
    // Quality + market fit both climb with R&D investment (T: product lifecycle).
    product.quality = Math.min(100, product.quality + improvement * 5);
    product.marketFit = Math.min(100, product.marketFit + improvement * 4);
    product.technicalDebt = Math.max(0, product.technicalDebt - improvement * 2);
    // Better-engineered products are also a little more secure by default.
    product.security = Math.min(100, product.security + improvement * 1.5);
  }

  private expandMarket(company: Company, action: TurnAction): void {
    // Exploit a live trend: if the action targets a category that is currently
    // surging, aim at the trend's segment and get a stronger foothold + brand lift.
    const trend = action.productCategory
      ? this.state.trends.find(t => t.category === action.productCategory)
        ?? this.state.trendHistory.find(entry => entry.outcome === 'pursued' && entry.trend.id === action.trendId)?.trend
      : undefined;

    const uncontrolleds = Array.from(this.state.marketTiles.values()).filter(
      t => t.controllerId !== company.id
    );
    if (uncontrolleds.length === 0) return;

    let target = this.rng.shuffle(uncontrolleds).pop()!;
    let bonus = 1;
    if (trend) {
      const inSector = uncontrolleds.filter(t => t.segment === trend.sector);
      if (inSector.length > 0) {
        target = this.rng.shuffle(inSector).pop()!;
        bonus = 1 + trend.strength; // surge multiplier
        company.brandTrust = Math.min(100, company.brandTrust + trend.strength * 8);
        company.marketInfluence = Math.min(100, company.marketInfluence + trend.strength * 6);
      }
    }

    const strength = Math.min(0.5, (action.budget / 500000) * bonus);
    target.controlStrength += strength;

    if (target.controllerId) {
      target.challengerId = company.id;
    } else {
      target.controllerId = company.id;
      company.controlledTiles.push(target.id);
    }
  }

  private runMarketingCampaign(company: Company, _budget: number, targetProductId?: string): void {
    company.brandTrust = Math.min(100, company.brandTrust + _budget / 50000);
    company.marketInfluence = Math.min(100, company.marketInfluence + _budget / 100000);
    if (targetProductId) {
      const p = company.products.find(pr => pr.id === targetProductId);
      if (p) p.marketFit = Math.min(100, p.marketFit + _budget / 200000);
    }
  }

  private hireExecutive(company: Company, _budget: number): void {
    const roles = ['cto', 'ciso', 'cfo', 'cmo', 'coo', 'chief_ai_officer'];
    const role = this.rng.shuffle(roles).pop()!;

    company.executives.push({
      id: generateId.executive(),
      role: role as ExecutiveRole,
      level: 1,
      experience: 5,
      specialization: role,
      energy: 0.9,
      loyalty: 0.7,
      ambition: 0.5,
      reputation: 50,
      cost: 200000,
      traits: [],
      vulnerabilities: [],
    });
  }

  private hardenSecurity(company: Company, _budget: number, targetProductId?: string): void {
    // Corporate security posture always improves with the investment.
    company.securityPosture = Math.min(100, company.securityPosture + _budget / 10000);
    // T: product-level security hardening — harden a specific product or the whole portfolio.
    const products = targetProductId
      ? company.products.filter(p => p.id === targetProductId)
      : company.products;
    const perProduct = _budget / 60000;
    products.forEach(p => { p.security = Math.min(100, p.security + perProduct); });
  }

  private allocateCompute(company: Company, action: TurnAction): void {
    const product = action.targetProductId ? company.products.find(candidate => candidate.id === action.targetProductId) : undefined;
    const points = Math.floor(action.resourcePoints ?? 0);
    if (!product || points < 1 || points > company.computePoints) return;
    company.computePoints -= points;
    company.computerPoints = company.computePoints;
    product.computePoints = Math.min(100, product.computePoints + points);
  }

  private generateCompute(company: Company, budget: number, effects: Record<string, number>): void {
    const expansion = calculateComputeExpansion(company, budget);
    if (expansion.infrastructureGain <= 0) return;
    company.computeInfrastructure = Math.min(
      COMPUTE_INFRASTRUCTURE_CAP,
      company.computeInfrastructure + expansion.infrastructureGain,
    );
    company.computePoints = Math.min(COMPUTE_POOL_CAP, company.computePoints + expansion.immediatePoints);
    company.computerPoints = company.computePoints;
    effects.computeInfrastructure = expansion.infrastructureGain;
    effects.computePoints = expansion.immediatePoints;
  }

  private allocateCybersecurity(company: Company, action: TurnAction): void {
    const tile = action.targetTileId ? this.state.marketTiles.get(action.targetTileId) : undefined;
    const building = tile?.buildingId ? company.buildings.find(candidate => candidate.id === tile.buildingId) : undefined;
    const points = Math.floor(action.resourcePoints ?? 0);
    if (!building || points < 1 || points > company.cybersecurityPoints) return;
    company.cybersecurityPoints -= points;
    building.cybersecurityPoints = Math.min(100, building.cybersecurityPoints + points);
  }

  private automateAI(company: Company, _budget: number): void {
    company.aiCapability = Math.min(100, company.aiCapability + _budget / 20000);
    company.operatingCosts *= 0.95;
  }

  private launchConsultingPractice(company: Company, _budget: number): void {
    company.consultingCapacity = Math.min(100, company.consultingCapacity + _budget / 10000);
  }

  private scoutAcquisition(company: Company): void {
    // Surface 1-2 M&A opportunities from rival corps into the market briefing.
    const candidates = Array.from(this.state.companies.values())
      .filter(c => c.id !== company.id && c.isStartup !== true);
    this.rng.shuffle(candidates);
    const count = this.rng.nextInt(1, Math.min(2, candidates.length || 1));
    for (let i = 0; i < count; i++) {
      const target = candidates[i];
      if (!target) break;
      this.state.marketBriefing.maOpportunities.push({
        targetId: target.id,
        targetName: target.name,
        price: Math.max(1, Math.round(target.valuation * this.rng.nextFloat(0.8, 1.4))),
        revenue: Math.round(target.revenue),
        talent: target.executives.length,
        technology: Math.round(target.innovation),
        clients: target.controlledTiles.length,
        reputation: Math.round(target.brandTrust),
        cyberRisk: 100 - Math.round(target.securityPosture),
        techDebt: Math.round(target.products.reduce((s, p) => s + p.technicalDebt, 0) / (target.products.length || 1)),
        cultureFit: this.rng.nextInt(30, 90),
        integrationDifficulty: this.rng.nextInt(20, 80),
      });
    }
  }

  private acquireCompany(company: Company, action: TurnAction): void {
    const price = action.budget;
    if (price < 1000000) return;
    const target = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
    if (!target || target.id === company.id) return;

    const acquiredValue = target.valuation;
    const acquiredRevenue = target.revenue;
    const acquiredBuildings = [...target.buildings];
    const acquiredTileIds = new Set<TileId>([
      ...target.controlledTiles,
      ...acquiredBuildings.map(building => building.tileId),
    ]);
    const affectedSegments = [...new Set(
      [...acquiredTileIds]
        .map(tileId => this.state.marketTiles.get(tileId)?.segment)
        .filter((segment): segment is MarketSegment => Boolean(segment)),
    )];

    // Pay out.
    target.cash += Math.round(price * 0.6);
    // Inherit the acquired firm's revenue stream (drives valuation after recalc).
    company.revenue += acquiredRevenue;

    // Move every building exactly once. Departments and products housed by the
    // acquired corporation move with the real estate, avoiding duplicate owners
    // and orphaned building interiors after the tile changes colour.
    acquiredBuildings.forEach(building => {
      if (!company.buildings.some(candidate => candidate.id === building.id || candidate.tileId === building.tileId)) {
        building.ceoId = undefined;
        company.buildings.push(building);
      }
      const tile = this.state.marketTiles.get(building.tileId);
      if (tile) {
        tile.controllerId = company.id;
        tile.buildingId = building.id;
        tile.isStartupTile = false;
        tile.startupPotential = undefined;
      }
      if (!company.controlledTiles.includes(building.tileId)) company.controlledTiles.push(building.tileId);
    });
    target.buildings = [];

    target.departments.forEach(department => {
      department.executiveId = undefined;
      if (!company.departments.some(candidate => candidate.id === department.id)) company.departments.push(department);
    });
    target.departments = [];

    target.products.forEach(product => {
      product.companyId = company.id;
      if (!company.products.some(candidate => candidate.id === product.id)) company.products.push(product);
      this.state.products.set(product.id, product);
    });
    target.products = [];

    // Empty-shell startups and non-building territory are acquired too.
    acquiredTileIds.forEach(tid => {
      const t = this.state.marketTiles.get(tid);
      if (t && (t.controllerId === target.id || acquiredBuildings.some(building => building.tileId === tid))) {
        t.controllerId = company.id;
        t.isStartupTile = false;
        t.startupPotential = undefined;
        if (!company.controlledTiles.includes(tid)) company.controlledTiles.push(tid);
      }
    });
    target.controlledTiles = target.controlledTiles.filter(tileId => !acquiredTileIds.has(tileId));

    // Market-share / valuation impact (the player's quote moves up or down).
    const share = target.marketInfluence;
    company.marketInfluence = Math.min(100, company.marketInfluence + share * 0.8 + 3);
    company.valuation = Math.max(1, company.valuation + acquiredValue * 0.5);
    target.marketInfluence = Math.max(0, target.marketInfluence - share * 0.5);

    // Integration quality, profitability and deal premium influence investor
    // sentiment, but uncertainty remains: every completed acquisition can rally
    // or sell off. Acquisition-focused companies receive a modest integration edge.
    const targetQuality = (target.brandTrust + target.innovation + target.securityPosture) / 300;
    const priceRatio = price / Math.max(1, acquiredValue);
    const integrationEdge = company.archetype === 'acquisition_machine' ? 0.12 : 0;
    const profitabilityEdge = target.cashFlow >= 0 ? 0.08 : -0.08;
    const overpaymentPenalty = Math.max(0, priceRatio - 1) * 0.2;
    const positiveChance = Math.max(0.15, Math.min(0.85,
      0.45 + (targetQuality - 0.5) * 0.35 + integrationEdge + profitabilityEdge - overpaymentPenalty,
    ));
    const positive = this.rng.nextBoolean(positiveChance);
    const magnitude = this.rng.nextFloat(0.06, 0.18);
    this.pendingAcquisitionShocks.push({
      buyerId: company.id,
      targetId: target.id,
      targetName: target.name,
      segments: affectedSegments.length ? affectedSegments : ['open_market'],
      change: positive ? magnitude : -magnitude,
      acquiredValue,
    });

    // A successful company acquisition is a full absorption, not a repeatable
    // purchase of an empty shell: remove the former owner from the market.
    this.state.companies.delete(target.id);
    company.acquisitions = (company.acquisitions ?? 0) + 1;
    this.addNews(company.id, `${company.name} acquires ${target.name} for $${price.toLocaleString()} — ${acquiredBuildings.length} buildings change ownership.`);
  }

  /** Apply completed M&A sentiment after the standard valuation/influence pass. */
  private applyPendingAcquisitionShocks(): Pick<MarketBriefing, 'demandShifts' | 'globalEvents'> {
    const demandShifts: DemandShift[] = [];
    const globalEvents: GameEvent[] = [];

    this.pendingAcquisitionShocks.forEach(shock => {
      const buyer = this.state.companies.get(shock.buyerId);
      if (!buyer) return;

      const influenceDelta = shock.change * 20;
      const valuationDelta = shock.acquiredValue * shock.change;
      buyer.marketInfluence = Math.max(0, Math.min(100, buyer.marketInfluence + influenceDelta));
      buyer.valuation = Math.max(1, buyer.valuation + valuationDelta);
      buyer.brandTrust = Math.max(0, Math.min(100, buyer.brandTrust + shock.change * 12));

      this.state.companies.forEach(competitor => {
        if (competitor.id !== buyer.id && competitor.id !== shock.targetId) {
          competitor.marketInfluence = Math.max(0, Math.min(100, competitor.marketInfluence - shock.change * 3));
        }
      });

      const segmentSet = new Set(shock.segments);
      this.state.marketTiles.forEach(tile => {
        if (!segmentSet.has(tile.segment)) return;
        tile.demandLevel = Math.max(0, Math.min(2, tile.demandLevel * (1 + shock.change)));
        tile.growth = Math.max(-1, Math.min(1, tile.growth + shock.change * 0.25));
      });

      shock.segments.slice(0, 3).forEach(segment => demandShifts.push({
        segment,
        change: shock.change,
        reason: `${buyer.name} acquisition of ${shock.targetName}`,
      }));

      const rallied = shock.change > 0;
      const title = rallied ? 'Acquisition Rally' : 'Acquisition Backlash';
      const description = rallied
        ? `${buyer.name}'s acquisition of ${shock.targetName} wins investor confidence and lifts exposed markets.`
        : `${buyer.name}'s acquisition of ${shock.targetName} triggers integration fears and a market sell-off.`;
      globalEvents.push({
        id: generateId.event(),
        turn: this.state.turn,
        category: 'ma',
        kind: 'ma',
        title,
        description,
        impact: { marketInfluenceDelta: influenceDelta, valuationDelta, demandChange: shock.change },
        affectedCompanies: [buyer.id, shock.targetId],
        duration: 1,
        severity: rallied ? 'high' : 'critical',
      });
      this.state.alerts.push({
        id: generateId.action(),
        turn: this.state.turn,
        title,
        body: `${description} Market demand ${rallied ? 'rose' : 'fell'} ${(Math.abs(shock.change) * 100).toFixed(1)}%.`,
        importance: rallied ? 'major' : 'critical',
      });
      this.addNews(buyer.id, `${title}: ${description}`);
    });

    this.state.alerts = this.state.alerts.slice(-40);
    this.pendingAcquisitionShocks = [];
    return { demandShifts, globalEvents };
  }

  private raiseCapital(company: Company): void {
    const amount = company.valuation * 0.2;
    company.cash += amount;
    company.debt += amount * 0.1;
  }

  private reduceCosts(company: Company): void {
    company.operatingCosts *= 0.9;
    company.departments.forEach(d => {
      d.morale = Math.max(0.3, d.morale - 0.1);
      d.efficiency = Math.max(0.5, d.efficiency - 0.05);
    });
  }

  // ===================================================================
  // ruthless.com-inspired new actions
  // ===================================================================

  /** Build a new Building on a tile. Max 8 departments/building. makeHQ seats a new CEO. */
  private buildNewBuilding(company: Company, action: TurnAction): void {
    const tileId = action.targetTileId;
    if (!tileId) return;
    const tile = this.state.marketTiles.get(tileId);
    if (!tile) return;
    // A tile can only hold ONE building. If it already has one (yours or a
    // rival's) you cannot raise another on top of it — pick a different tile.
    if (tile.buildingId) return;
    const id = generateId.building();
    const isHQ = action.makeHQ === true || company.buildings.length === 0;
    const building: Building = {
      id,
      tileId,
      name: action.buildingName?.trim() || (isHQ ? 'HQ' : `BUILDING ${company.buildings.length + 1}`),
      departmentIds: [],
      productIds: [],
      firewall: isHQ ? 30 : 10,
      physicalSecurity: isHQ ? 40 : 15,
      cybersecurityPoints: 0,
      hushMoney: 0,
      isHQ,
      maxDepartments: 8,
    };
    if (isHQ) {
      // A new HQ must be staffed by a CEO via hire_ceo (HR-gated). Seat later.
      building.ceoId = undefined;
    }
    company.buildings.push(building);
    tile.buildingId = id;
    tile.controllerId = company.id;
    tile.controlStrength = Math.max(tile.controlStrength, 0.5);
    if (!company.controlledTiles.includes(tileId)) company.controlledTiles.push(tileId);
  }

  /** Industrial espionage secures a dossier that becomes actionable next turn. */
  private runIndustrialEspionage(company: Company, action: TurnAction): void {
    const target = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
    const department = action.targetDepartmentId ? target?.departments.find(candidate => candidate.id === action.targetDepartmentId) : undefined;
    if (!target || !department) return;
    const building = target.buildings.find(candidate => candidate.id === department.buildingId || candidate.departmentIds.includes(department.id));
    if (building && !this.state.revealedBuildings.includes(building.id)) this.state.revealedBuildings.push(building.id);
    department.efficiency = Math.max(0.3, department.efficiency - 0.08);
    department.morale = Math.max(0.2, department.morale - 0.05);
    department.disruptedUntilTurn = Math.max(department.disruptedUntilTurn ?? 0, this.state.turn + 1);

    const baseAmount = Math.max(6, Math.round(department.level * 5 + department.efficiency * 10));
    const relevantProductIds = new Set([
      ...(department.productId ? [department.productId] : []),
      ...(building?.productIds ?? []),
    ]);
    const sourceProduct = target.products.find(product => relevantProductIds.has(product.id)) ?? target.products[0];
    const sourceIdea = target.ideas[target.ideas.length - 1];
    const baseIntel: Omit<EspionageIntel, 'kind' | 'sourceName' | 'amount'> = {
      id: generateId.action(),
      ownerCompanyId: company.id,
      sourceCompanyId: target.id,
      sourceDepartmentId: department.id,
      sourceDepartmentType: department.type,
      stolenTurn: this.state.turn,
      availableTurn: this.state.turn + 1,
      expiresTurn: this.state.turn + 6,
    };
    let intel: EspionageIntel;

    if (department.type === 'ai_data' && target.computePoints > 0) {
      const amount = Math.min(baseAmount, target.computePoints);
      target.computePoints -= amount;
      target.computerPoints = target.computePoints;
      intel = { ...baseIntel, kind: 'compute', sourceName: 'Compute Capacity', amount };
    } else if (department.type === 'cybersecurity' && (target.cybersecurityPoints > 0 || (building?.cybersecurityPoints ?? 0) > 0)) {
      const corporateTake = Math.min(baseAmount, target.cybersecurityPoints);
      target.cybersecurityPoints -= corporateTake;
      const buildingTake = building ? Math.min(baseAmount - corporateTake, building.cybersecurityPoints) : 0;
      if (building) building.cybersecurityPoints -= buildingTake;
      intel = { ...baseIntel, kind: 'cybersecurity', sourceName: 'Cybersecurity Capacity', amount: corporateTake + buildingTake };
    } else if (department.type === 'product_rd' && sourceIdea) {
      intel = {
        ...baseIntel, kind: 'idea', sourceAssetId: sourceIdea.id, sourceName: sourceIdea.name,
        amount: Math.max(baseAmount, sourceIdea.maturity), category: sourceIdea.category,
        maturity: sourceIdea.maturity, breakthrough: sourceIdea.breakthrough,
      };
    } else if (sourceProduct && ['product_rd', 'dev_engineering', 'ai_data', 'consulting_services', 'sales_marketing'].includes(department.type)) {
      intel = {
        ...baseIntel, kind: 'product_blueprint', sourceAssetId: sourceProduct.id, sourceName: sourceProduct.name,
        amount: Math.max(baseAmount, Math.round((sourceProduct.quality + sourceProduct.marketFit) / 2)),
        category: sourceProduct.category, targetSegments: [...sourceProduct.targetSegments],
        quality: sourceProduct.quality, maturity: sourceProduct.maturity,
      };
    } else {
      intel = { ...baseIntel, kind: 'rd', sourceName: `${department.type.replaceAll('_', ' ')} R&D`, amount: baseAmount };
    }

    company.espionageIntel.push(intel);
    this.addNews(company.id, `${company.name} infiltrated ${target.name}'s ${department.type.replaceAll('_', ' ')} department and secured ${intel.sourceName}. The dossier unlocks on turn ${intel.availableTurn}.`);
    if (company.isPlayer) {
      this.state.alerts.push({
        id: generateId.event(), turn: this.state.turn, title: 'Espionage Asset Secured',
        body: `${intel.sourceName} stolen from ${target.name}. Use Exploit Stolen Asset from turn ${intel.availableTurn}.`,
        importance: 'major',
      });
    }
  }

  /** Convert one ready dossier into capacity, R&D, or a provenance-tracked idea. */
  private runExploitStolenAsset(company: Company, action: TurnAction): void {
    const intel = action.stolenAssetId
      ? company.espionageIntel.find(candidate => candidate.id === action.stolenAssetId)
      : undefined;
    if (!intel || intel.availableTurn > this.state.turn || intel.exploitedTurn || intel.expiresTurn < this.state.turn) return;

    if (intel.kind === 'compute') {
      company.computePoints = Math.min(500, company.computePoints + intel.amount);
      company.computerPoints = company.computePoints;
    } else if (intel.kind === 'cybersecurity') {
      company.cybersecurityPoints = Math.min(500, company.cybersecurityPoints + intel.amount);
    } else if (intel.kind === 'rd') {
      company.innovation = Math.min(100, company.innovation + intel.amount);
      company.productRd = Math.min(100, company.productRd + intel.amount * 0.6);
    } else {
      const idea: Idea = {
        id: generateId.trend(),
        name: `Reverse-Engineered ${intel.sourceName}`,
        category: intel.category ?? 'data_analytics',
        maturity: Math.max(20, Math.min(95, Math.round((intel.maturity ?? intel.quality ?? 50) * 0.75))),
        breakthrough: false,
        companyId: company.id,
        createdTurn: this.state.turn,
        espionageIntelId: intel.id,
        stolenFromCompanyId: intel.sourceCompanyId,
        repatented: Boolean(intel.repatentedTurn),
        espionageTargetSegments: intel.targetSegments ? [...intel.targetSegments] : undefined,
      };
      company.ideas.push(idea);
      this.state.inventions.push(idea);
      intel.derivedIdeaId = idea.id;
    }
    intel.exploitedTurn = this.state.turn;
    this.addNews(company.id, `${company.name} exploits stolen ${intel.sourceName} intelligence for a competitive advantage.`);
  }

  /** Legal can re-patent only espionage-derived ideas/product blueprints. */
  private runRepatentStolenAsset(company: Company, action: TurnAction): void {
    const intel = action.stolenAssetId
      ? company.espionageIntel.find(candidate => candidate.id === action.stolenAssetId)
      : undefined;
    if (!intel || (intel.kind !== 'idea' && intel.kind !== 'product_blueprint') || intel.repatentedTurn) return;
    if (!company.departments.some(department => department.type === 'legal_compliance')) return;

    intel.repatentedTurn = this.state.turn;
    company.legalPoints += Math.max(100, Math.round(action.budget / 1000));
    company.ideas.forEach(idea => {
      if (idea.espionageIntelId === intel.id) idea.repatented = true;
    });
    company.products.forEach(product => {
      if (product.espionageIntelId === intel.id) product.repatented = true;
    });
    this.addNews(company.id, `${company.name}'s Legal department re-patents ${intel.sourceName}, shielding derivative IP from the original owner.`);
  }

  /** Original owners may litigate once when an unprotected derivative launches. */
  private resolveEspionageLawsuits(newsItems: NewsItem[]): void {
    this.state.companies.forEach(owner => {
      owner.products.forEach(product => {
        if (!product.espionageIntelId || !product.stolenFromCompanyId || product.legalClaimResolved) return;
        if (product.repatented) {
          product.legalClaimResolved = true;
          newsItems.push(this.createNewsItem(
            this.state.turn, 'regulatory', 'Re-Patent Shield Holds',
            `${owner.name}'s protected ${product.name} derivative is insulated from an ownership claim.`,
            owner.id, 'minor',
          ));
          return;
        }
        if ((product.legalExposureUntilTurn ?? -1) < this.state.turn) {
          product.legalClaimResolved = true;
          return;
        }

        const victim = this.state.companies.get(product.stolenFromCompanyId);
        if (!victim) {
          product.legalClaimResolved = true;
          return;
        }
        const victimLegal = victim.departments.filter(department => department.type === 'legal_compliance');
        const victimLegalStrength = victimLegal.reduce((sum, department) => sum + department.level * department.efficiency, 0);
        const ownerLegalStrength = owner.departments
          .filter(department => department.type === 'legal_compliance')
          .reduce((sum, department) => sum + department.level * department.efficiency, 0);
        const filingChance = Math.max(0.2, Math.min(0.9, 0.3 + victimLegalStrength * 0.1 + product.marketFit / 500));
        product.legalClaimResolved = true;
        if (!this.rng.nextBoolean(filingChance)) return;

        const victimWins = this.rng.nextBoolean(Math.max(0.2, Math.min(0.9,
          0.55 + victimLegalStrength * 0.08 - ownerLegalStrength * 0.06,
        )));
        if (victimWins) {
          const damages = Math.round(150000 + product.quality * 2500 + product.marketFit * 1500);
          owner.cash -= damages;
          victim.cash += Math.round(damages * 0.6);
          owner.scandal = Math.min(100, owner.scandal + 8);
          owner.brandTrust = Math.max(0, owner.brandTrust - 6);
          product.marketFit = Math.max(0, product.marketFit - 15);
          product.trust = Math.max(0, product.trust - 12);
          const body = `${victim.name} proves ${product.name} was derived from stolen IP. ${owner.name} pays $${damages.toLocaleString()} and the product loses market trust.`;
          newsItems.push(this.createNewsItem(this.state.turn, 'regulatory', 'Industrial Espionage Lawsuit', body, owner.id, 'critical'));
          this.state.alerts.push({ id: generateId.event(), turn: this.state.turn, title: 'Industrial Espionage Lawsuit', body, importance: 'critical' });
        } else {
          const body = `${victim.name} files an IP claim against ${product.name}, but cannot prove ownership. ${owner.name} keeps the derivative on the market.`;
          newsItems.push(this.createNewsItem(this.state.turn, 'regulatory', 'Stolen-IP Claim Dismissed', body, owner.id, 'major'));
        }
      });
    });
  }

  /** Cyber attack: compute is the offensive resource; the building's assigned
   * cyber points absorb data/R&D loss before its firewall and research assets. */
  private runCyberAttack(company: Company, action: TurnAction): void {
    const target = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
    const tile = action.targetTileId ? this.state.marketTiles.get(action.targetTileId) : undefined;
    const building = tile?.buildingId ? target?.buildings.find(candidate => candidate.id === tile.buildingId) : undefined;
    if (!target || !tile || !building || tile.controllerId !== target.id) return;

    const spend = Math.max(1, Math.min(company.computePoints, Math.floor(action.resourcePoints ?? 20)));
    company.computePoints -= spend;
    company.computerPoints = company.computePoints;

    const assignedDefenseBefore = building.cybersecurityPoints;
    const defensiveStrength = building.firewall * 0.5 + assignedDefenseBefore + target.securityPosture * 0.25;
    const offensiveDepartments = company.departments.filter(department =>
      department.type === 'ai_data' || department.type === 'cybersecurity');
    const offensiveStrength = spend * 2 + company.aiCapability * 0.35
      + offensiveDepartments.reduce((sum, department) => sum + department.level * 3, 0);
    const absorbed = Math.min(building.cybersecurityPoints, Math.max(1, Math.ceil(offensiveStrength * 0.6)));
    building.cybersecurityPoints = Math.max(0, building.cybersecurityPoints - absorbed);
    building.firewall = Math.max(0, building.firewall - Math.max(4, Math.round((offensiveStrength - absorbed) / 5)));
    const breach = offensiveStrength > defensiveStrength;

    tile.pendingAction = { type: 'cyber_attack', byCompanyId: company.id, expiresTurn: this.state.turn + 1 };
    if (!breach) {
      company.scandal = Math.min(100, company.scandal + 5);
      this.addNews(target.id, `${target.name}'s cyber resilience contained an attack on ${building.name || 'a corporate building'}.`);
      return;
    }

    target.securityPosture = Math.max(0, target.securityPosture - 6);
    target.brandTrust = Math.max(0, target.brandTrust - 3);
    company.innovation = Math.min(100, company.innovation + 2);
    if (!this.state.revealedBuildings.includes(building.id)) this.state.revealedBuildings.push(building.id);

    const researchDepartments = target.departments.filter(department =>
      building.departmentIds.includes(department.id)
      && ['product_rd', 'ai_data', 'dev_engineering'].includes(department.type));
    const mitigation = Math.min(0.9, assignedDefenseBefore / Math.max(1, offensiveStrength));
    researchDepartments.forEach(department => {
      department.efficiency = Math.max(0.3, department.efficiency - 0.12 * (1 - mitigation));
      department.disruptedUntilTurn = Math.max(department.disruptedUntilTurn ?? 0, this.state.turn + 1);
    });
    const exposedProducts = building.productIds.length > 0
      ? target.products.filter(product => building.productIds.includes(product.id))
      : researchDepartments.length > 0 ? target.products : [];
    exposedProducts.forEach(product => {
      const computeLoss = Math.ceil(product.computePoints * 0.25 * (1 - mitigation));
      product.computePoints = Math.max(0, product.computePoints - computeLoss);
      product.trust = Math.max(0, product.trust - Math.ceil(8 * (1 - mitigation)));
    });

    const criticalExposure = building.cybersecurityPoints <= 0 && building.firewall <= 0;
    const exposedIdea = criticalExposure && researchDepartments.length > 0 && target.ideas.length > 0
      ? this.rng.shuffle([...target.ideas]).pop()
      : undefined;
    if (exposedIdea) {
      target.ideas = target.ideas.filter(idea => idea.id !== exposedIdea.id);
      if (this.rng.nextBoolean(0.5)) {
        const stolen = { ...exposedIdea, companyId: company.id };
        company.ideas.push(stolen);
        this.state.inventions = this.state.inventions.map(idea => idea.id === stolen.id ? stolen : idea);
        this.addNews(target.id, `CRITICAL BREACH: ${company.name} stole ${exposedIdea.name} from ${target.name}'s undefended R&D network.`);
      } else {
        this.state.inventions = this.state.inventions.filter(idea => idea.id !== exposedIdea.id);
        this.addNews(target.id, `CRITICAL DATA LOSS: ${exposedIdea.name} was permanently destroyed inside ${building.name || target.name}.`);
      }
    } else {
      target.ideas.forEach(idea => { idea.maturity = Math.max(0, idea.maturity - Math.ceil(12 * (1 - mitigation))); });
      this.addNews(target.id, `${company.name} breached ${building.name || target.name}; cyber resilience limited the R&D and data loss.`);
    }
  }

  /** Offline (physical) security: reinforce one owned building with guards and lockdown systems. */
  private runSecurityOffline(company: Company, action: TurnAction): void {
    const tile = action.targetTileId ? this.state.marketTiles.get(action.targetTileId) : undefined;
    const building = tile?.buildingId ? company.buildings.find(candidate => candidate.id === tile.buildingId) : undefined;
    if (!building) return;
    building.physicalSecurity = Math.min(100, building.physicalSecurity + action.budget / 5000);
    company.securityPosture = Math.min(100, company.securityPosture + action.budget / 20000);
    tile!.pendingAction = { type: 'security_offline', byCompanyId: company.id, expiresTurn: this.state.turn + 1 };
  }

  /** Sabotage: arson / physical sabotage — set a rival building on fire (heavy damage). */
  private runSabotage(company: Company, action: TurnAction): void {
    const tile = action.targetTileId ? this.state.marketTiles.get(action.targetTileId) : undefined;
    if (tile && tile.controllerId && tile.controllerId !== company.id) {
      const owner = this.state.companies.get(tile.controllerId);
      const building = owner?.buildings.find(b => b.tileId === tile.id);
      if (building) {
        const dmg = Math.round(action.budget / 6000);
        building.firewall = Math.max(0, building.firewall - dmg);
        building.physicalSecurity = Math.max(0, building.physicalSecurity - dmg);
        building.departmentIds.forEach(did => {
          const d = owner?.departments.find(x => x.id === did);
          if (d) { d.efficiency = Math.max(0.3, d.efficiency - 0.15); d.morale = Math.max(0.2, d.morale - 0.15); }
        });
        if (owner) {
          owner.securityPosture = Math.max(0, owner.securityPosture - 8);
          owner.brandTrust = Math.max(0, owner.brandTrust - 6);
        }
      }
      // Arson carries real scandal risk for the attacker.
      company.scandal = Math.min(100, company.scandal + 12);
      tile.pendingAction = { type: 'sabotage_building', byCompanyId: company.id, expiresTurn: this.state.turn + 1 };
      return;
    }
    // Non-tile sabotage: general unrest / unrest at the rival's HQ.
    const target = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
    if (target) {
      target.buildings.forEach(b => { b.physicalSecurity = Math.max(0, b.physicalSecurity - Math.round(action.budget / 10000)); });
      target.securityPosture = Math.max(0, target.securityPosture - 4);
      target.brandTrust = Math.max(0, target.brandTrust - 3);
      company.scandal = Math.min(100, company.scandal + 12);
    }
  }

  /** T7 — Defend Building: reinforce one player-owned structure. */
  private runDefendTile(company: Company, action: TurnAction): void {
    const tile = action.targetTileId ? this.state.marketTiles.get(action.targetTileId) : undefined;
    if (!tile || tile.controllerId !== company.id) return;
    const building = company.buildings.find(b => b.tileId === tile.id);
    if (!building) return;
    const boost = Math.min(40, Math.round(action.budget / 4000));
    building.firewall = Math.min(100, building.firewall + boost);
    building.physicalSecurity = Math.min(100, building.physicalSecurity + boost);
    company.securityPosture = Math.min(100, company.securityPosture + Math.round(boost / 2));
    tile.pendingAction = { type: 'defend_tile', byCompanyId: company.id, expiresTurn: this.state.turn + 1 };
  }

  /**
   * T7 — Auto-aggression: each AI corp, with probability scaled by its
   * aggression (voiceTone / archetype), launches a covert strike against a
   * random rival's building (cyber breach or physical sabotage).
   */
  private autoAggression(): void {
    const corps = [...this.state.companies.values()];
    corps.forEach(attacker => {
      if (attacker.isPlayer) return;
      const aggression = attacker.voiceTone === 'aggressive' ? 0.6
        : attacker.archetype === 'acquisition_machine' ? 0.5
        : attacker.archetype === 'security_fortress' ? 0.2 : 0.35;
      if (this.rng.nextFloat(0, 1) > aggression) return;
      const rivals = corps.filter(c => c.id !== attacker.id);
      if (rivals.length === 0) return;
      const target = this.rng.shuffle(rivals).pop()!;
      const building = this.rng.shuffle(target.buildings).pop();
      if (!building) return;
      // Covert aggression uses the same finite compute pool and resolver as a
      // planned order. No hidden +200 bonus and no bypass around cyber shields.
      if (attacker.computePoints < 1) return;
      this.runCyberAttack(attacker, {
        id: generateId.action(), companyId: attacker.id, type: 'cyber_attack',
        targetCompanyId: target.id, targetTileId: building.tileId,
        resourcePoints: Math.min(10, attacker.computePoints), budget: 0,
        priority: 0, status: 'planned',
      });
    });
  }

  /**
   * T7 — Shark market: corporations in crisis (negative cash, high scandal,
   * low valuation) get preyed upon — rivals auto-breach their buildings
   * and can steal a controlled tile. Ruthless.com's "sharks circle the wounded".
   */
  private applySharkMarket(): void {
    const corps = [...this.state.companies.values()];
    const inCrisis = corps.filter(c =>
      (c.cash < -200000 || c.scandal > 70) && c.valuation < 4000000);
    inCrisis.forEach(victim => {
      const predators = corps.filter(c => c.id !== victim.id);
      predators.forEach(shark => {
        const building = this.rng.shuffle(victim.buildings).pop();
        if (building) {
          building.firewall = Math.max(0, building.firewall - 12);
          if (!this.state.revealedBuildings.includes(building.id)) {
            this.state.revealedBuildings.push(building.id);
          }
        }
        // A shark may seize a weakly-held tile from the wounded corp.
        const tile = victim.controlledTiles
          .map(id => this.state.marketTiles.get(id))
          .filter((t): t is MarketTile => Boolean(t))
          .find(t => t.controlStrength < 0.25);
        if (tile) {
          tile.controllerId = shark.id;
          tile.controlStrength = Math.max(0.2, Math.min(1, tile.controlStrength));
          if (!shark.controlledTiles.includes(tile.id)) shark.controlledTiles.push(tile.id);
          victim.controlledTiles = victim.controlledTiles.filter(id => id !== tile.id);
        }
      });
    });
  }

  /** T9 — R&D: invent a new idea/technology. Breakthroughs can spark a market trend. */
  private runCreateIdeas(company: Company, action: TurnAction): void {
    // Capacity cap: a company may invent at most as many ideas this turn as it
    // has actual R&D departments. Tracked explicitly so it can
    // never be bypassed by queuing multiple create_ideas orders in one turn.
    const rdCount = company.departments.filter(d => d.type === 'product_rd').length;
    const created = this.ideasCreatedThisTurn.get(company.id) ?? 0;
    if (created >= rdCount) return; // no R&D capacity left this turn
    const cats: ProductCategory[] = ['fintech', 'cybersecurity', 'ai', 'cloud_infra', 'healthtech', 'greentech', 'data_analytics', 'blockchain', 'iot', 'biotech', 'quantum', 'ar_vr'];
    const category = action.productCategory ?? this.rng.shuffle(cats).pop()!;
    const researchPush = Math.min(100, 30 + action.budget / 12000 + company.innovation / 4);
    const breakthrough = this.rng.nextBoolean(0.25 + researchPush / 400);
    const idea: Idea = {
      id: generateId.trend(),
      name: `Idea: ${category.replace('_', ' ')}${breakthrough ? ' (Breakthrough)' : ''}`,
      category,
      maturity: Math.round(researchPush),
      breakthrough,
      companyId: company.id,
      createdTurn: this.state.turn,
    };
    company.ideas.push(idea);
    this.ideasCreatedThisTurn.set(company.id, created + 1);
    this.state.inventions = [...this.state.inventions, idea];
    company.innovation = Math.min(100, company.innovation + 4);
    // A breakthrough can ignite a brand-new global trend for this category (R&D pull).
    if (breakthrough && !this.state.trends.some(t => t.category === category)) {
      this.state.trends.push({
        id: generateId.trend(),
        title: `R&D Breakthrough: ${category.replace('_', ' ').toUpperCase()} demand ignites`,
        category,
        sector: this.rng.shuffle(['enterprise_cluster', 'innovation_hub', 'high_growth', 'strategic_account']).pop()! as MarketSegment,
        strength: this.rng.nextFloat(0.5, 0.85),
        expiresTurn: this.state.turn + this.rng.nextInt(4, 8),
        appearedTurn: this.state.turn,
        decisionDeadlineTurn: this.state.turn + 2,
        blurb: `${company.name} just broke ground on ${category.replace('_', ' ')} — the market is taking notice.`,
      });
    }
  }

  /** T9 — Open-source an idea: +awareness/trust globally, can mature a weak signal. */
  private runReleaseSource(company: Company, action: TurnAction): void {
    const idea = action.ideaId
      ? company.ideas.find(i => i.id === action.ideaId)
      : company.ideas[company.ideas.length - 1];
    company.brandTrust = Math.min(100, company.brandTrust + 8);
    company.marketInfluence = Math.min(100, company.marketInfluence + 4); // awareness
    if (idea) {
      // Releasing source can mature a weak signal into a real trend for that category.
      const signal = this.state.weakSignals.find(w => w.relatedCategory === idea.category && w.expiresTurn > this.state.turn);
      if (signal && this.rng.nextBoolean(0.6)) {
        this.state.trends.push({
          id: generateId.trend(),
          title: `Open-Source Wave: ${idea.category.replace('_', ' ').toUpperCase()} goes mainstream`,
          category: idea.category,
          sector: signal.relatedSector,
          strength: this.rng.nextFloat(0.45, 0.8),
          expiresTurn: this.state.turn + this.rng.nextInt(3, 7),
          appearedTurn: this.state.turn,
          decisionDeadlineTurn: this.state.turn + 2,
          blurb: `${company.name} open-sourced their ${idea.category.replace('_', ' ')} tech — adoption is snowballing.`,
        });
        this.state.weakSignals = this.state.weakSignals.filter(w => w.id !== signal.id);
      }
    }
  }

  /** T9 — Sell an idea's source code to a rival: +cash now, flips trend ownership/awareness. */
  private runSellSource(company: Company, action: TurnAction): void {
    const idea = action.ideaId
      ? company.ideas.find(i => i.id === action.ideaId)
      : company.ideas[company.ideas.length - 1];
    const buyer = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
    const price = idea ? Math.round(300000 + idea.maturity * 6000 + (idea.breakthrough ? 500000 : 0)) : 200000;
    company.cash += price;
    if (idea) {
      company.ideas = company.ideas.filter(i => i.id !== idea.id);
      this.state.inventions = this.state.inventions.filter(i => i.id !== idea.id);
      if (buyer) {
        buyer.ideas.push({ ...idea, id: generateId.trend(), companyId: buyer.id, createdTurn: this.state.turn });
        buyer.brandTrust = Math.min(100, buyer.brandTrust + 3);
        buyer.marketInfluence = Math.min(100, buyer.marketInfluence + 2); // buyer gains awareness
        // The trend (if any) now benefits the buyer's category presence.
        const t = this.state.trends.find(tr => tr.category === idea.category && tr.expiresTurn > this.state.turn);
        if (t) company.marketInfluence = Math.max(0, company.marketInfluence - 3);
      }
    }
  }

  /** T — Pivot a product: change scope with new features → relaunch as a fresh version. */
  private runPivotProduct(company: Company, action: TurnAction): void {
    const product = action.targetProductId
      ? company.products.find(p => p.id === action.targetProductId)
      : company.products[company.products.length - 1];
    if (!product) return;
    if (action.pivotCategory) product.category = action.pivotCategory;
    if (action.pivotSegments && action.pivotSegments.length) product.targetSegments = action.pivotSegments;
    product.pivotCount += 1;
    // A pivot is a scope change with new features: bump quality/innovation, reset to early phase.
    product.quality = Math.min(100, product.quality + 8);
    product.maturity = Math.min(100, product.maturity + 10);
    product.technicalDebt = Math.max(0, product.technicalDebt - 5);
    product.lifecycleStage = 'early';
    product.version += 1;
    product.adopters = Math.max(0.03, product.adopters * 0.6);
    company.innovation = Math.min(100, company.innovation + 4);
  }

  /**
   * T — Advance every product through its lifecycle each turn.
   * early → growth → mature → decline, with decline triggering a v(n+1) relaunch
   * (new version resets to early with a quality boost) per market-penetration logic.
   */
  private advanceProductLifecycles(): void {
    this.state.companies.forEach(c => {
      c.products.forEach(p => {
        p.ageTurns += 1;
        // Fidelizzati: a maintained, shipping product accumulates an installed base.
        if (p.lifecycleStage !== 'early') {
          p.baseInstalled = Math.min(100, p.baseInstalled + (p.marketFit / 100) * (p.lifecycleStage === 'mature' ? 4 : 2));
        }
        // Adopter growth depends on market fit + a live trend pull for the category.
        const liveTrend = this.state.trends.find(t => t.category === p.category && t.expiresTurn > this.state.turn);
        const trendPull = liveTrend ? liveTrend.strength : 0;
        const growth = (p.marketFit / 100) * 0.06 + trendPull * 0.04;
        p.adopters = Math.min(1, p.adopters + growth);

        // Phase transitions by age + adoption + upkeep.
        if (p.lifecycleStage === 'early' && (p.adopters > 0.15 || p.ageTurns > 4)) {
          p.lifecycleStage = 'growth';
        } else if (p.lifecycleStage === 'growth' && (p.adopters > 0.4 || p.ageTurns > 10)) {
          p.lifecycleStage = 'mature';
        } else if (p.lifecycleStage === 'mature') {
          // Decay triggers decline when neglected (debt piles up) or adopters erode.
          if (p.technicalDebt > 60 || p.adopters < 0.2 || p.ageTurns > 24) {
            p.lifecycleStage = 'decline';
          }
        } else if (p.lifecycleStage === 'decline') {
          // Decline plan: relaunch as next version (v2, v3, …) with a quality bump.
          if (p.version < 6) {
            p.version += 1;
            p.lifecycleStage = 'early';
            p.adopters = Math.max(0.04, p.adopters * 0.5);
            p.quality = Math.min(100, p.quality + 10);
            p.technicalDebt = Math.max(0, p.technicalDebt - 15);
            p.ageTurns = 0;
          }
        }
      });
    });
  }

  // ===================================================================
  // T — CEO GDR: market-moving PR, training, firing
  // ===================================================================

  /** CEO PR: publicly praise a rival — diplomatic market nudge (boosts their
   *  valuation/trust a touch and lifts overall market sentiment). Low risk. */
  private runCeoPraise(company: Company, action: TurnAction): void {
    const target = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
    if (!target || target.id === company.id) return;
    const lift = Math.round(action.budget / 50000) + 3;
    target.valuation = Math.max(0, target.valuation + lift * 40000);
    target.brandTrust = Math.min(100, target.brandTrust + lift);
    // Praising a competitor signals sector confidence — lifts the whole market read:
    // your own valuation ticks up (you're seen as a constructive sector leader) and
    // your market influence rises. This is the CEO "moving the market" globally.
    company.valuation = Math.max(1, company.valuation + lift * 15000);
    company.marketInfluence = Math.min(100, company.marketInfluence + 1);
    // T: market_savant (Charisma) CEOs move the market harder with PR.
    if (company.ceos[0]?.perks.includes('market_savant')) {
      company.valuation = Math.max(1, company.valuation + lift * 10000);
      company.marketInfluence = Math.min(100, company.marketInfluence + 1);
      target.brandTrust = Math.min(100, target.brandTrust + lift);
    }
    this.addNews(target.id, `${company.name}'s CEO publicly praises ${target.name} — markets read it as sector confidence.`);
    // T: CEO PR moves consume a special point.
    if (company.ceos[0]) company.ceos[0].specialPoints = Math.max(0, company.ceos[0].specialPoints - 1);
  }

  /** CEO PR: trash-talk / discredit a rival — dents their trust & valuation,
   *  but raises your scandal if caught (Luck/Perception soften the blow). */
  private runCeoDiscredit(company: Company, action: TurnAction): void {
    const target = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
    if (!target || target.id === company.id) return;
    const hit = Math.round(action.budget / 40000) + 5;
    target.brandTrust = Math.max(0, target.brandTrust - hit);
    target.valuation = Math.max(0, target.valuation - hit * 60000);
    target.marketInfluence = Math.max(0, target.marketInfluence - 2);
    // Global market read: aggressive PR is rewarded by speculators — your own
    // valuation edges up even as the rival's falls (you're seizing the narrative).
    company.valuation = Math.max(1, company.valuation + hit * 12000);
    // T: market_savant (Charisma) CEOs land harder hits AND move their own quote more.
    if (company.ceos[0]?.perks.includes('market_savant')) {
      target.valuation = Math.max(0, target.valuation - hit * 20000);
      company.valuation = Math.max(1, company.valuation + hit * 8000);
    }
    // Self-risk scales down with the CEO's Luck (Fallout-style soft bias).
    const luck = company.ceos[0]?.luck ?? 5;
    const caught = this.rng.nextBoolean(Math.max(0.05, 0.35 - luck / 40));
    if (caught) {
      let scandal = hit * 0.6;
      // T: iron_will (Luck) CEOs shrug off PR blowback.
      if (company.ceos[0]?.perks.includes('iron_will')) scandal *= 0.4;
      company.scandal = Math.min(100, company.scandal + scandal);
      this.addNews(company.id, `${company.name}'s CEO smear of ${target.name} backfires — scandal rises.`);
    } else {
      this.addNews(target.id, `${company.name}'s CEO publicly discredits ${target.name} — their reputation takes a hit.`);
    }
    // T: CEO PR moves consume a special point.
    if (company.ceos[0]) company.ceos[0].specialPoints = Math.max(0, company.ceos[0].specialPoints - 1);
  }

  /** Train a CEO's S.P.E.C.I.A.L. attribute — spends the action budget as training
   *  investment and bumps the chosen skill (capped at 10). */
  private runTrainChief(company: Company, action: TurnAction): void {
    if (!action.executiveId) return;
    const ceo = company.ceos.find(c => c.id === action.executiveId);
    if (!ceo) return;
    const skill = (action.tone as CEOSkill) || 'intelligence'; // reuse tone field to carry the skill key
    if (!ceo.skills[skill] && ceo.skills[skill] !== 0) ceo.skills[skill] = 5;
    const gain = Math.max(1, Math.round(action.budget / 200000));
    ceo.skills[skill] = Math.min(10, (ceo.skills[skill] ?? 5) + gain);
    ceo.trainedSkills = ceo.trainedSkills ?? {};
    ceo.trainedSkills[skill] = (ceo.trainedSkills[skill] ?? 0) + gain;
    // T: training is a special CEO move — consumes a special point.
    ceo.specialPoints = Math.max(0, ceo.specialPoints - 1);
  }

  /** Fire a seated CEO — frees the HQ, removes the +1 order grant, and (if it was
   *  the last CEO) the company loses the executive-order bonus. */
  private runFireChief(company: Company, action: TurnAction): void {
    if (!action.executiveId) return;
    const idx = company.ceos.findIndex(c => c.id === action.executiveId);
    if (idx < 0) return;
    const ceo = company.ceos[idx];
    const hq = company.buildings.find(b => b.id === ceo.hqBuildingId);
    if (hq) hq.ceoId = undefined;
    company.ceos.splice(idx, 1);
    company.executiveOrderLimit = Math.max(1, company.executiveOrderLimit - 1);
    company.cash += ceo.cost * 0.5; // severance recovered partially
  }

  // ===================================================================
  // T — Legal & Compliance (ruthless.com-inspired)
  // ===================================================================

  /** File a lawsuit against a rival: damages their valuation + trust, builds your
   *  legal points. Success scales with Legal dept + legalPoints vs their influence. */
  private runLegalSue(company: Company, action: TurnAction): void {
    const target = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
    if (!target || target.id === company.id) return;
    const hasLegal = company.departments.some(d => d.type === 'legal_compliance');
    if (!hasLegal) return;
    const success = this.rng.nextBoolean(0.55 + (company.legalPoints - target.marketInfluence) / 600);
    company.legalPoints += Math.round(action.budget / 1000);
    if (!success) { company.scandal = Math.min(100, company.scandal + 4); return; }
    const dmg = Math.round(action.budget / 3);
    target.valuation = Math.max(0, target.valuation - dmg);
    target.brandTrust = Math.max(0, target.brandTrust - 6);
    target.cash = Math.max(0, target.cash - dmg * 0.5);
    this.addNews(target.id, `${company.name} sues ${target.name} — court awards damages, reputation hit.`);
  }

  /** Lock a patent/tech to block a rival category — denies them a trend bonus and
   *  grants you a moat. Costs legal points. */
  private runLegalPatent(company: Company, action: TurnAction): void {
    const hasLegal = company.departments.some(d => d.type === 'legal_compliance');
    if (!hasLegal) return;
    company.legalPoints += Math.round(action.budget / 1500);
    company.innovation = Math.min(100, company.innovation + 3);
    const target = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
    if (target) target.innovation = Math.max(0, target.innovation - 3);
    this.addNews(company.id, `${company.name} locks a patent — competitors blocked from the space.`);
  }

  /** Subpoena a rival's data: intel gain (reveals a building) + compliance pressure
   *  (small valuation hit to them). */
  private runLegalSubpoena(company: Company, action: TurnAction): void {
    const target = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
    if (!target || target.id === company.id) return;
    const hasLegal = company.departments.some(d => d.type === 'legal_compliance');
    if (!hasLegal) return;
    company.legalPoints += Math.round(action.budget / 1200);
    const building = target.buildings[0];
    if (building && !this.state.revealedBuildings.includes(building.id)) {
      this.state.revealedBuildings.push(building.id);
    }
    target.valuation = Math.max(0, target.valuation - Math.round(action.budget / 5));
    this.addNews(target.id, `${company.name} subpoenas ${target.name} — data exposed under compliance order.`);
  }

  /** Buy a rival cheap — below their valuation — needs Finance & sufficient cash.
   *  Acquires the company outright when the offer clears their (discounted) price. */
  private runAcquireBelowValue(company: Company, action: TurnAction): void {
    const target = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
    if (!target || target.id === company.id) return;
    const hasFinance = company.departments.some(d => d.type === 'finance_investor' || d.type === 'corporate_strategy');
    if (!hasFinance) return;
    // "Below value": you pay less than their valuation (discount scales with budget).
    const price = action.budget;
    if (price < target.valuation * 0.6 || price >= target.valuation) return;
    // Absorb the rival: their cash, tech, products & tiles fold into yours.
    company.valuation += target.valuation * 0.6;
    company.cash += Math.round(target.cash * 0.4);
    company.innovation = Math.min(100, company.innovation + target.innovation * 0.2);
    company.products.push(...target.products.map(p => ({ ...p, companyId: company.id, id: generateId.product() })));
    target.products = [];
    target.controlledTiles.forEach(t => {
      const tile = this.state.marketTiles.get(t);
      if (tile) { tile.controllerId = company.id; if (!company.controlledTiles.includes(t)) company.controlledTiles.push(t); }
    });
    target.isPlayer = false;
    this.state.companies.delete(target.id);
    this.addNews(company.id, `${company.name} acquires ${target.name} below valuation for $${price.toLocaleString()} — bargain raid!`);
  }

  /** Online (cyber) defense: firewall, virus sweep, change passwords. */
  private runSecurityOnline(company: Company, action: TurnAction): void {
    company.cybersecurityPoints = Math.min(500, company.cybersecurityPoints + Math.round(action.budget / 10000));
    company.buildings.forEach(b => { b.firewall = Math.min(100, b.firewall + 8); });
    company.securityPosture = Math.min(100, company.securityPosture + action.budget / 12000);
  }

  /** T — Hire a CEO/COO to seat at an HQ building. Requires an HR (people_culture) dept. */
  private runHireChief(company: Company, action: TurnAction, role: 'ceo' | 'coo'): void {
    const hasHR = company.departments.some(d => d.type === 'people_culture');
    if (!hasHR) return; // HR-gated: no new exec without HR
    const hq = action.hqBuildingId
      ? company.buildings.find(b => b.id === action.hqBuildingId && b.isHQ)
      : company.buildings.find(b => b.isHQ && !b.ceoId);
    if (!hq) return;
    const chief: ChiefExecutive = {
      id: generateId.executive(),
      role,
      level: 1,
      experience: 5,
      specialization: role === 'ceo' ? 'chief_executive' : 'operations',
      energy: 0.9,
      loyalty: 0.9,
      ambition: 0.5,
      reputation: 55,
      cost: role === 'ceo' ? 500000 : 400000,
      traits: [],
      vulnerabilities: [],
      hqBuildingId: hq.id,
      xp: 0,
      perks: [],
      // T — GDR SPECIAL defaults for a hired chief (player may train later).
      skills: { analytics: 5, charisma: 5, resilience: 5, luck: 5, vision: 4, network: 4, strategy: 4, operations: 4 },
      luck: 5,
      ceoTraits: [role === 'ceo' ? 'initiative' : 'none'],
      specialPoints: 1,
      trainedSkills: {},
    };
    company.ceos.push(chief);
    hq.ceoId = chief.id;
    // Each CEO/COO grants +1 executive order capacity.
    company.executiveOrderLimit += 1;
  }

  /** T — Mass layoff: cuts costs now but crushes morale, employer brand & trust. */
  private runMassLayoff(company: Company, action: TurnAction): void {
    const cut = Math.max(1, Math.floor(action.budget / 50000));
    const fired = Math.min(cut, company.hrMetrics.headcount);
    company.hrMetrics.headcount = Math.max(0, company.hrMetrics.headcount - fired);
    company.hrMetrics.layoffsThisTurn += fired;
    company.operatingCosts = Math.max(0, Math.round(company.operatingCosts * 0.85));
    company.employeeMorale = Math.max(0, company.employeeMorale - fired * 1.5);
    company.employerBrand = Math.max(0, company.employerBrand - fired * 0.8);
    company.brandTrust = Math.max(0, company.brandTrust - fired * 0.5);
    company.scandal = Math.min(100, company.scandal + fired * 0.3);
  }

  /** Legal action: lawsuit / patent / dispute against a rival (or a rival tile). */
  private runLegalAction(company: Company, action: TurnAction): void {
    company.legalPoints += Math.round(action.budget / 1000);
    const tile = action.targetTileId ? this.state.marketTiles.get(action.targetTileId) : undefined;
    if (tile && tile.controllerId && tile.controllerId !== company.id) {
      const owner = this.state.companies.get(tile.controllerId);
      if (owner) {
        const win = this.rng.nextBoolean(0.5 + (company.legalPoints - owner.marketInfluence) / 500);
        if (win) { owner.marketInfluence = Math.max(0, owner.marketInfluence - 6); company.marketInfluence += 3; }
        else { owner.legalPoints += 200; }
      }
      tile.pendingAction = { type: 'legal_action', byCompanyId: company.id, expiresTurn: this.state.turn + 1 };
      return;
    }
    const target = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
    if (target) {
      const win = this.rng.nextBoolean(0.5 + (company.legalPoints - target.marketInfluence) / 500);
      if (win) {
        target.marketInfluence = Math.max(0, target.marketInfluence - 4);
        company.marketInfluence += 2;
      } else {
        target.legalPoints += 200;
      }
    }
  }

  /** CEO social post: tone + authenticity pledge. Aggressive/rebellious + fabricated
   *  hits harder but raises scandal risk. */
  private runCeoSocial(company: Company, action: TurnAction): void {
    company.voiceTone = action.tone ?? company.voiceTone ?? 'aggressive';
    company.campaignAuthenticity = action.authenticity ?? company.campaignAuthenticity ?? 'aspirational';
    const toneMul = (company.voiceTone === 'aggressive' || company.voiceTone === 'rebellious') ? 1.3 : 1.0;
    const authMul = company.campaignAuthenticity === 'verified' ? 0.8
      : company.campaignAuthenticity === 'fabricated' ? 1.4 : 1.1;
    const lift = (action.budget / 50000) * toneMul * authMul;
    company.brandTrust = Math.min(100, company.brandTrust + lift * 0.5);
    company.marketInfluence = Math.min(100, company.marketInfluence + lift * 0.4);
    if (company.campaignAuthenticity === 'fabricated') {
      company.scandal = Math.min(100, company.scandal + lift * 0.3);
    }
  }

  /** Public tender offer (OPA): acquire a rival building/company via payment. */
  private runPublicTenderOffer(company: Company, action: TurnAction): void {
    const target = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
    if (!target) return;
    const offer = action.offerPrice ?? action.budget;
    if (offer <= 0) return;
    // Auto-accept if offer >= 2x building worth (ruthless.com rule); else probabilistic.
    const worth = Math.max(500000, target.valuation * 0.15);
    const accept = offer >= worth * 2 || this.rng.nextBoolean(offer / (worth * 1.5));
    if (accept) {
      target.cash += offer;
      company.marketInfluence += 4;
      target.marketInfluence = Math.max(0, target.marketInfluence - 3);
      // fold target buildings into the bidder
      target.buildings.forEach(b => {
        if (!company.buildings.find(x => x.tileId === b.tileId)) company.buildings.push(b);
        const tile = this.state.marketTiles.get(b.tileId);
        if (tile) { tile.controllerId = company.id; tile.buildingId = b.id; }
        if (!company.controlledTiles.includes(b.tileId)) company.controlledTiles.push(b.tileId);
      });
      target.controlledTiles = target.controlledTiles.filter(id => !company.controlledTiles.includes(id));
    } else {
      company.scandal = Math.min(100, company.scandal + 2);
    }
  }

  /** List one of the company's assets (technology/patent/product/building/dept) on the auction house. */
  private runAuctionSell(company: Company, action: TurnAction): void {
    const assetId = action.targetId;
    if (!assetId) return;
    let kind: 'technology' | 'patent' | 'product' | 'building' | 'department' = 'product';
    let name = 'Asset';
    let base = 0;
    const prod = company.products.find(p => p.id === assetId);
    const bld = company.buildings.find(b => b.id === assetId);
    const dept = company.departments.find(d => d.id === assetId);
    if (prod) { kind = 'product'; name = prod.name; base = Math.round(prod.price * 6 + prod.quality * 5000); }
    else if (bld) { kind = 'building'; name = `Building @${bld.tileId}`; base = 750000; }
    else if (dept) { kind = 'department'; name = `${dept.type} L${dept.level}`; base = dept.level * 100000; }
    else { kind = 'technology'; name = 'Tech/Patent'; base = 300000; }
    this.state.auctionHouse.push({
      id: generateId.action(),
      sellerId: company.id,
      kind, assetId, name,
      basePrice: base,
      currentBid: 0,
      highestBidderId: null,
      expiresTurn: this.state.turn + 2,
    });
    // mark asset as listed
    if (prod) prod.upForAuction = true;
    if (bld) bld.upForAuction = true;
  }

  /** Place the player's bid on an existing listing (buy side). */
  private runAuctionBid(company: Company, action: TurnAction): void {
    if (!action.targetId) return;
    const listing = this.state.auctionHouse.find(l => l.id === action.targetId);
    if (!listing) return;
    const offer = action.budget;
    const base = listing.currentBid > 0 ? listing.currentBid : listing.basePrice;
    if (offer <= base) return;            // must beat the standing bid
    if (offer > company.cash) return;       // can't bid more than you have
    listing.currentBid = offer;
    listing.highestBidderId = company.id;
  }

  /**
   * Auction house resolution (req 2, AI side): rival corps bid on open listings
   * each turn and the highest bidder wins when the auction expires. Generates
   * news items so the player can follow the market.
   */
  private resolveAuctions(newsItems: NewsItem[]): void {
    const house = this.state.auctionHouse;
    if (house.length === 0) return;
    const survivors: AuctionListing[] = [];

    for (const listing of house) {
      const seller = this.state.companies.get(listing.sellerId);
      if (!seller) { survivors.push(listing); continue; }

      // rival corps may place a higher bid this turn
      const rivals = Array.from(this.state.companies.values())
        .filter(c => c.id !== listing.sellerId && c.cash > (listing.currentBid || listing.basePrice));
      const base = listing.currentBid > 0 ? listing.currentBid : listing.basePrice;
      const interested = rivals.filter(_c => this.rng.nextBoolean(0.5));
      for (const r of interested) {
        const bump = Math.round(base * this.rng.nextFloat(0.05, 0.35));
        const bid = base + bump;
        if (bid <= r.cash && bid > (listing.currentBid || 0)) {
          listing.currentBid = bid;
          listing.highestBidderId = r.id;
        }
      }

      if (this.state.turn >= listing.expiresTurn) {
        // close the auction
        if (listing.highestBidderId && listing.currentBid > 0) {
          const winner = this.state.companies.get(listing.highestBidderId);
          if (winner && winner.cash >= listing.currentBid) {
            winner.cash -= listing.currentBid;
            seller.cash += listing.currentBid;
            this.transferAsset(listing, winner);
            newsItems.push(this.createNewsItem(
              this.state.turn, 'ma',
              `Auction Won: ${listing.name}`,
              `${winner.name} acquired ${listing.name} for $${listing.currentBid.toLocaleString()}.`,
              winner.id, 'minor'
            ));
            continue; // listing consumed
          }
        }
        // no valid winner -> relist expired, moved to survivors without bid held
        // Startup shells that fail to attract a bid lose credibility (brand trust).
        if (seller.isStartup) {
          seller.brandTrust = Math.max(0, seller.brandTrust - 12);
          seller.marketInfluence = Math.max(0, seller.marketInfluence - 4);
          this.addNews(seller.id, `${seller.name}'s ${listing.name} went unsold at auction — credibility takes a hit.`);
        }
        survivors.push({ ...listing, currentBid: 0, highestBidderId: null });
      } else {
        survivors.push(listing);
      }
    }

    this.state.auctionHouse = survivors;
  }

  /** Move a listed asset from its seller into the winning company. */
  private transferAsset(listing: AuctionListing, winner: Company): void {
    const seller = this.state.companies.get(listing.sellerId);
    if (!seller) return;
    if (listing.kind === 'product') {
      const idx = seller.products.findIndex(p => p.id === listing.assetId);
      if (idx >= 0) { const [p] = seller.products.splice(idx, 1); if (p) { p.upForAuction = false; winner.products.push(p); } }
    } else if (listing.kind === 'building') {
      const idx = seller.buildings.findIndex(b => b.id === listing.assetId);
      if (idx >= 0) {
        const [b] = seller.buildings.splice(idx, 1);
        if (b) { b.upForAuction = false; winner.buildings.push(b); const t = this.state.marketTiles.get(b.tileId); if (t) { t.controllerId = winner.id; t.buildingId = b.id; } if (!winner.controlledTiles.includes(b.tileId)) winner.controlledTiles.push(b.tileId); }
      }
    } else if (listing.kind === 'department') {
      const idx = seller.departments.findIndex(d => d.id === listing.assetId);
      if (idx >= 0) {
        const [d] = seller.departments.splice(idx, 1);
        if (d) {
          d.buildingId = undefined;
          winner.departments.push(d);
          // drop reference from the seller's building that hosted it
          seller.buildings.forEach(b => {
            const di = b.departmentIds.indexOf(d.id);
            if (di >= 0) b.departmentIds.splice(di, 1);
          });
        }
      }
    } else {
      // technology / patent: give a one-off innovation + cash already transferred
      winner.innovation = Math.min(100, winner.innovation + 5);
    }
  }

  /**
   * Public success-estimate (req 4): returns 0..1 probability that a planned action
   * succeeds, grounded in the player's strategy profile + the competitive field.
   * Used by the UI to preview odds before committing an order.
   */
  estimateSuccess(action: TurnAction): number {
    const company = this.state.companies.get(action.companyId);
    if (!company) return 0;
    if (action.type === 'generate_compute' || action.type === 'allocate_compute' || action.type === 'allocate_cybersecurity') return 1;
    if (action.type === 'department_initiative') {
      const department = action.targetDepartmentId
        ? company.departments.find(candidate => candidate.id === action.targetDepartmentId)
        : undefined;
      if (!department || action.budget < DEPARTMENT_INITIATIVE_BASE_COST) return 0;
      const budgetConfidence = Math.min(0.15, Math.max(0, action.budget / DEPARTMENT_INITIATIVE_BASE_COST - 1) * 0.075);
      const chance = 0.45
        + (department.level - 1) * 0.05
        + (department.efficiency - 0.5) * 0.25
        + (department.morale - 0.5) * 0.2
        - department.risk * 0.25
        + (company.employeeMorale - 50) / 500
        + budgetConfidence;
      return Math.max(0.05, Math.min(0.97, Math.round(chance * 100) / 100));
    }
    let chance = 0.7;

    const relevantDept = company.departments.find(d => this.isDepartmentRelevant(d.type, action.type));
    if (relevantDept) {
      chance += (relevantDept.level - 1) * 0.05;
      chance += (relevantDept.efficiency - 0.5) * 0.2;
    }

    // strategy profile: how does the player tend to play? measure via budget allocation tilt.
    const tilt = this.strategyTilt(company.id);
    chance += tilt.combat * 0.05;   // leaning into offense boosts offensive actions
    chance += tilt.defense * 0.05;  // leaning into defense boosts defensive actions
    chance += tilt.growth * 0.05;   // leaning into growth boosts market/expansion

    // competitive field: stronger rivals / higher rival security lowers success.
    const rivals = Array.from(this.state.companies.values()).filter(c => c.id !== company.id);
    const avgRivalStrength = rivals.length
      ? rivals.reduce((s, c) => s + c.marketInfluence + c.securityPosture, 0) / rivals.length / 2
      : 0;
    const isOffensive = ['industrial_espionage', 'cyber_attack', 'legal_action', 'public_tender_offer', 'acquire_company'].includes(action.type);
    if (isOffensive) chance -= avgRivalStrength / 400;
    const target = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
    if (target) {
      if (action.type === 'cyber_attack') {
        const tile = action.targetTileId ? this.state.marketTiles.get(action.targetTileId) : undefined;
        const building = tile?.buildingId ? target.buildings.find(candidate => candidate.id === tile.buildingId) : undefined;
        chance -= target.securityPosture / 300;
        if (building) chance -= building.cybersecurityPoints / 250 + building.firewall / 500;
        chance += Math.min(0.2, (action.resourcePoints ?? 0) / 100);
      }
      if (action.type === 'industrial_espionage') chance -= target.securityPosture / 400;
      if (action.type === 'legal_action') chance += (company.legalPoints - target.marketInfluence) / 600;
      if (action.type === 'public_tender_offer') chance += (action.offerPrice ?? 0) / (target.valuation * 3);
    }

    // scandal erodes credibility -> social/legal actions suffer.
    if (action.type === 'ceo_social' || action.type === 'marketing_campaign') chance -= company.scandal / 300;

    const baseCost = this.getActionBaseCost(action.type);
    const budgetRatio = baseCost > 0 ? action.budget / baseCost : 1;
    chance += Math.min(0.2, (budgetRatio - 1) * 0.1);

    // T: Luck pillar — fortune softly biases every action's success (max +0.10).
    const luck = company.ceos[0]?.luck ?? 5;
    chance += luck / 100;

    if (action.type === 'launch_product' && action.productCategory) {
      const active = this.state.trends.find(trend => trend.category === action.productCategory);
      const latestResolved = [...this.state.trendHistory].reverse().find(entry => entry.trend.category === action.productCategory);
      const late = latestResolved?.outcome === 'missed'
        && latestResolved.trend.decisionDeadlineTurn < this.state.turn
        && (!active || latestResolved.trend.appearedTurn >= active.appearedTurn);
      if (late) chance = Math.min(chance, 0.7);
    }

    return Math.max(0.05, Math.min(0.97, Math.round(chance * 100) / 100));
  }

  /** Summarises how a company has been playing: offensive / defensive / growth tilt. */
  private strategyTilt(companyId: CompanyId): { combat: number; defense: number; growth: number } {
    const acts = this.state.actions.filter(a => a.companyId === companyId);
    if (acts.length === 0) return { combat: 0, defense: 0, growth: 0 };
    const combat = acts.filter(a => ['industrial_espionage', 'cyber_attack', 'legal_action', 'acquire_company', 'public_tender_offer'].includes(a.type)).length / acts.length;
    const defense = acts.filter(a => ['security_hardening', 'security_offline', 'security_online'].includes(a.type)).length / acts.length;
    const growth = acts.filter(a => ['expand_market', 'launch_product', 'improve_product', 'ai_automation', 'build_department', 'department_initiative'].includes(a.type)).length / acts.length;
    return { combat, defense, growth };
  }

  private recalculateCompanyMetrics(company: Company): void {
    // Market influence first (controlled territory + brand trust), used by product revenue.
    const influence = Math.min(100, company.controlledTiles.length * 2.5 + company.brandTrust * 0.5);
    company.marketInfluence = Math.max(0, influence);

    // Revenue from products: units sold scale with the company's market reach
    // (influence) and the product's market fit, priced at the product price.
    // T: modulated by the product lifecycle phase (early adopters → mature plateau → decline).
    const productRevenue = company.products.reduce((sum, p) => {
      const qualityMul = 0.4 + (p.quality / 100) * 0.6;
      const fitMul = 0.3 + (p.marketFit / 100) * 0.7;

      // --- Lifecycle phase multipliers ---
      let stageMul = 1;
      if (p.lifecycleStage === 'early') {
        // Early adopters only convert if there's a REAL market signal (live trend for this
        // category) — otherwise the market is skeptical and revenue stays tiny.
        const liveTrend = this.state.trends.find(t => t.category === p.category && t.expiresTurn > this.state.turn);
        const weakSignal = this.state.weakSignals.find(w => w.relatedCategory === p.category && w.expiresTurn > this.state.turn);
        stageMul = liveTrend ? 0.5 + liveTrend.strength * 0.8 : (weakSignal ? 0.25 : 0.08);
      } else if (p.lifecycleStage === 'growth') {
        // Fidelizzati: existing installed base repurchases a percentage each turn.
        stageMul = 1.0 + Math.min(0.8, p.baseInstalled / 100);
      } else if (p.lifecycleStage === 'mature') {
        // Mature: stable plateau IF maintained (quality high, technical debt low).
        const maintained = (p.quality / 100) * (1 - p.technicalDebt / 200);
        stageMul = 0.8 + maintained * 0.6;
      } else {
        // Decline: eroding demand.
        stageMul = 0.4;
      }

      // Blue-ocean bonus: no rival offers this category in the same segments → open space.
      const rivals = Array.from(this.state.companies.values()).filter(c => c.id !== company.id);
      const hasCompetitor = rivals.some(c => c.products.some(rp =>
        rp.category === p.category && rp.targetSegments.some(s => p.targetSegments.includes(s))));
      const blueOcean = hasCompetitor ? 1 : 1.25;

      const computePerformance = calculateProductComputePerformance(p, company.id, this.state.companies.values());
      const computeMultiplier = computePerformance.multiplier;
      p.lastComputeMultiplier = computeMultiplier;
      p.computeAdvantage = computePerformance.competitiveBonus;
      const penetration = p.adopters * p.version * blueOcean;
      const units = Math.max(0, (company.marketInfluence + p.marketFit) * 0.5 * penetration * stageMul);
      const revenue = units * p.price * qualityMul * fitMul * computeMultiplier;
      const computeCost = p.computePoints * 1000;
      p.lastTurnRevenue = Math.round(revenue);
      p.lastTurnMargin = revenue > 0
        ? Math.max(-1, Math.min(1, (revenue - p.operatingCost - computeCost) / revenue))
        : -1;
      return sum + revenue;
    }, 0);

    // Revenue from controlled market territory (resolved each turn in resolveMarket,
    // but reflected here so cashFlow tells the real story).
    const tileRevenue = company.controlledTiles.reduce((sum, tileId) => {
      const tile = this.state.marketTiles.get(tileId);
      return tile ? sum + tile.value * tile.controlStrength * 0.01 : sum;
    }, 0);

    const deptCost = company.departments.reduce((sum, d) => sum + d.recurringCost, 0);
    const productCost = company.products.reduce((sum, p) => sum + p.operatingCost + p.computePoints * 1000, 0);
    const computeInfrastructureCost = company.computeInfrastructure * COMPUTE_INFRASTRUCTURE_UPKEEP;

    let operatingCosts = Math.round(deptCost + productCost + computeInfrastructureCost);
    // CEO perks (GDR build): cost_cutter trims recurring costs; high_leverage
    // (Banker) adds extra drag.
    const perks = company.ceos[0]?.perks ?? [];
    if (perks.includes('cost_cutter')) operatingCosts = Math.round(operatingCosts * 0.9);
    if (perks.includes('high_leverage')) operatingCosts = Math.round(operatingCosts * 1.1);
    // T: talent_magnet (Endurance) lifts workforce morale & employer brand each turn.
    if (perks.includes('talent_magnet')) {
      company.employeeMorale = Math.min(100, company.employeeMorale + 2);
      company.employerBrand = Math.min(100, company.employerBrand + 1);
    }
    company.operatingCosts = operatingCosts;

    company.revenue = Math.round(productRevenue + tileRevenue);
    company.cashFlow = company.revenue - company.operatingCosts;
    company.valuation = Math.max(1, company.revenue * 4 + company.cash - company.debt);

    // fast_learner (Smart) CEO: +10% capability gain (experience compounds).
    if (perks.includes('fast_learner')) {
      company.innovation = Math.min(100, company.innovation * 1.1);
      company.aiCapability = Math.min(100, company.aiCapability * 1.1);
    }
  }

  private resolveMarket(): void {
    this.state.marketTiles.forEach(tile => {
      tile.value *= (1 + tile.growth * 0.1);
      tile.competitivePressure = Math.max(0, Math.min(1, tile.competitivePressure + this.rng.nextFloat(-0.05, 0.05)));
    });
  }

  private resolveFinancials(): void {
    this.state.companies.forEach(company => {
      company.cash += company.cashFlow;
      const perks = company.ceos[0]?.perks ?? [];
      // high_leverage (Banker): debt interest compounds 2x.
      const interestRate = perks.includes('high_leverage') ? 0.10 : 0.05;
      company.cash -= company.debt * interestRate;
      company.debt = Math.max(0, company.debt - company.cashFlow * 0.1);
      this.recalculateCompanyMetrics(company);

      // extra_order (Initiative): a free executive order every 3 turns.
      if (perks.includes('extra_order') && this.state.turn % 3 === 0) {
        company.executiveOrderLimit += 1;
      }

      // Bankruptcy: out of cash and unable to cover costs with valuation.
      if (company.cash < -500000 && company.debt > company.valuation && this.state.mode !== 'sandbox') {
        this.triggerDefeat(company.id, 'bankruptcy');
      }
    });
  }

  /** Renewable operational capacity. Departments create the pools; profitable
   * products compound assigned compute, while weak margins make it decay. */
  private resolveOperationalCapacity(): void {
    this.state.companies.forEach(company => {
      const activeDepartments = company.departments.filter(department =>
        !department.disruptedUntilTurn || department.disruptedUntilTurn < this.state.turn);
      const generatedCompute = calculateComputeGeneration(company, this.state.turn);
      const generatedCyber = activeDepartments.reduce((sum, department) =>
        department.type === 'cybersecurity'
          ? sum + Math.max(1, Math.round(8 * department.level * department.efficiency))
          : sum, 0);

      company.computePoints = Math.min(COMPUTE_POOL_CAP, company.computePoints + generatedCompute);
      company.lastComputeGenerated = generatedCompute;
      company.cybersecurityPoints = Math.min(500, company.cybersecurityPoints + generatedCyber);
      company.computerPoints = company.computePoints;

      company.products.forEach(product => {
        if (product.computePoints <= 0) return;
        if (product.lastTurnMargin >= 0.25) {
          const growthRate = Math.min(0.15, product.lastTurnMargin * 0.25);
          product.computePoints = Math.min(100, product.computePoints + Math.max(1, Math.floor(product.computePoints * growthRate)));
        } else if (product.lastTurnMargin < 0.05) {
          product.computePoints = Math.max(0, product.computePoints - Math.max(1, Math.ceil(product.computePoints * 0.1)));
        }
      });

      company.departments.forEach(department => {
        if (department.disruptedUntilTurn && department.disruptedUntilTurn < this.state.turn) {
          department.disruptedUntilTurn = undefined;
        }
      });
    });
  }

  private resolveRisks(_events: GameEvent[], _newsItems: NewsItem[]): void {
    this.state.companies.forEach(company => {
      const assignedCyber = company.buildings.reduce((sum, building) => sum + building.cybersecurityPoints, 0);
      const incidentChance = 0.1 * (1 - Math.min(0.8, assignedCyber / 200));
      if (company.securityPosture < 30 && this.rng.nextBoolean(incidentChance)) {
        this.triggerCyberIncident(company, _events, _newsItems);
      }
    });
  }

  private triggerCyberIncident(company: Company, events: GameEvent[], newsItems: NewsItem[]): void {
    const building = [...company.buildings].sort((a, b) => b.cybersecurityPoints - a.cybersecurityPoints)[0];
    const resilience = building
      ? Math.min(0.9, (building.cybersecurityPoints + building.firewall * 0.5) / 100)
      : 0;
    const impact = this.rng.nextFloat(0.1, 0.3) * (1 - resilience * 0.8);
    const cashLoss = company.cash * impact;
    company.cash -= cashLoss;
    company.brandTrust = Math.max(0, company.brandTrust - 20 * (1 - resilience));
    company.securityPosture = Math.max(10, company.securityPosture - 10 * (1 - resilience));
    if (building) {
      building.cybersecurityPoints = Math.max(0, building.cybersecurityPoints - Math.ceil(10 + impact * 20));
      const researchIds = new Set(building.departmentIds);
      company.departments.filter(department => researchIds.has(department.id) && ['product_rd', 'ai_data', 'dev_engineering'].includes(department.type)).forEach(department => {
        department.efficiency = Math.max(0.3, department.efficiency - 0.08 * (1 - resilience));
        department.disruptedUntilTurn = Math.max(department.disruptedUntilTurn ?? 0, this.state.turn + 1);
      });
      company.ideas.forEach(idea => { idea.maturity = Math.max(0, idea.maturity - Math.ceil(8 * (1 - resilience))); });
    }

    const event: GameEvent = {
      id: generateId.action(),
      turn: this.state.turn,
      category: 'cyber',
      title: 'Cybersecurity Incident',
      description: `${company.name} suffered a security breach${resilience > 0 ? '; assigned cyber capacity contained the loss' : ''}`,
      impact: { cash: -cashLoss, brandTrust: -20 * (1 - resilience), securityPosture: -10 * (1 - resilience) },
      affectedCompanies: [company.id],
      duration: 3,
      severity: 'high' as const,
    };
    events.push(event);

    newsItems.push(this.createNewsItem(
      this.state.turn,
      'cyber',
      'Security Breach Detected',
      `${company.name} experienced a cybersecurity incident. Financial and reputational damage assessed.`,
      company.id,
      'critical'
    ));
  }

  private triggerDefeat(companyId: CompanyId, _type: string): void {
    if (companyId === this.state.playerCompanyId) {
      this.state.isGameOver = true;
      this.state.victoryType = undefined;
    }
  }

  /** T — apply the CEO's executive-pillar modifiers to the company's GLOBAL
   *  metrics. This is what makes the GDR build matter for the whole economy,
   *  not just for the CEO's own action bonus.
   *  - vision        → marketInfluence (foresight / positioning)
   *  - charisma      → brandTrust (negotiation / PR gravity)
   *  - network       → marketInfluence (reach, partnerships)
   *  - strategy      → operating costs down (build efficiency / discipline)
   *  - operations    → operating costs down (execution / cost control)
   *  - resilience    → risk down (crisis survival)
   *  - analytics     → feeds computePowerScore (precision) — handled there
   *  - luck          → handled in event/crisis rolls
   *  Capped so a maxed pillar is strong but not game-breaking. */
  private applyCeoPillarMods(company: Company): void {
    const ceo = company.ceos[0];
    if (!ceo) return;
    const s = ceo.skills;
    const vision = s.vision ?? 0;
    const charisma = s.charisma ?? 0;
    const network = s.network ?? 0;
    const strategy = s.strategy ?? 0;
    const operations = s.operations ?? 0;
    const resilience = s.resilience ?? 0;

    // Market pull (vision + network), capped at +12 influence/turn.
    company.marketInfluence = Math.min(100, company.marketInfluence + (vision + network) * 0.6);
    // Brand gravity (charisma).
    company.brandTrust = Math.min(100, company.brandTrust + charisma * 0.4);
    // Operating-cost discipline: strategy + operations each shave up to 20% (cap 35%).
    const costMult = Math.max(0.65, 1 - (strategy + operations) * 0.02);
    company.operatingCosts = Math.round(company.operatingCosts * costMult);
    company.risk = Math.max(0, Math.min(1, company.risk - resilience * 0.01));
  }

  /** T — composite Company Power Score (0..100). Weighs the real levers the player
   *  can move through orders: relative market share, valuation, CEO executive
   *  pillars, active trends the company is positioned in, weak signals it has
   *  exploited via products, brand trust / security, and cash health. Pure
   *  end-turn idling cannot raise this — every term depends on actions or on
   *  assets gained through play. */
  private computePowerScore(company: Company): number {
    const all = Array.from(this.state.companies.values());
    const totalMI = all.reduce((s, c) => s + c.marketInfluence, 0) || 1;
    const shareRel = company.marketInfluence / totalMI; // 0..1 (relative, not absolute)
    const valuationScore = Math.max(0, Math.min(1, Math.log10(Math.max(1e6, company.valuation) / 1e6) / Math.log10(500)));

    const ceo = company.ceos[0];
    const skillKeys: CEOSkill[] = ['vision', 'network', 'analytics', 'charisma', 'strategy', 'operations', 'resilience'];
    const skillVals = [...skillKeys.map(k => ceo?.skills?.[k] ?? 0), ceo?.luck ?? 0];
    // Analytics (precision) is weighted 2x — it is the discipline that makes
    // every other pillar pay off. Luck still counts once.
    const analytics = ceo?.skills?.analytics ?? 0;
    const baseSum = skillVals.reduce((s, v) => s + v, 0);
    const ceoScore = (baseSum + analytics) / ((skillVals.length + 1) * 10); // 0..1

    const activeTrends = this.state.trends.filter(t => t.strength > 0);
    const ownedSegs = new Set(
      Array.from(this.state.marketTiles.values()).filter(t => t.controllerId === company.id).map(t => t.segment),
    );
    const trendHits = activeTrends.filter(t => ownedSegs.has(t.sector)).length;
    const trendScore = Math.min(1, trendHits / Math.max(1, activeTrends.length));

    const activeSignals = this.state.weakSignals.filter(w => w.expiresTurn > this.state.turn);
    const prodCats = new Set(company.products.map(p => p.category));
    const signalHits = activeSignals.filter(w => prodCats.has(w.relatedCategory)).length;
    const signalScore = Math.min(1, signalHits / Math.max(1, activeSignals.length));

    const trustSec = (company.brandTrust / 100) * 0.5 + (company.securityPosture / 100) * 0.5;
    const cashHealth = company.cash > 0 ? 1 : 0.4;

    const score =
      shareRel * 40 +
      valuationScore * 18 +
      ceoScore * 12 +
      trendScore * 10 +
      signalScore * 8 +
      trustSec * 10 +
      cashHealth * 2;
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  private checkVictoryConditions(): void {
    const player = this.state.companies.get(this.state.playerCompanyId);
    if (!player) return;
    const all = Array.from(this.state.companies.values());
    const totalMI = all.reduce((s, c) => s + c.marketInfluence, 0) || 1;
    const shareRel = player.marketInfluence / totalMI;
    const power = player.powerScore ?? this.computePowerScore(player);
    const scenarioConditionsMet = (): boolean => {
      const conditions = this.scenarioOpts?.winConditions ?? [];
      if (!conditions.length) return power >= 55 && shareRel >= 0.25 && player.cash > 0;
      const substantive = conditions.filter(condition => condition.kind !== 'turn_limit');
      if (!substantive.length) {
        const survival = conditions.find(condition => condition.kind === 'turn_limit');
        return survival?.kind === 'turn_limit' ? this.state.turn >= survival.turns && player.cash > 0 : false;
      }
      return substantive.every(condition => {
        if (condition.kind === 'tile_control') return player.controlledTiles.length >= condition.target;
        if (condition.kind === 'valuation') return player.valuation >= condition.target;
        if (condition.kind === 'market_share') return shareRel * 100 >= condition.target;
        if (condition.kind === 'eliminate') {
          if (condition.targetCompanyId) return !this.state.companies.has(condition.targetCompanyId);
          return all.filter(company => company.kind === 'rival').length === 0;
        }
        return true;
      });
    };

    if (this.state.mode === 'scenario' && scenarioConditionsMet()) {
      this.state.isGameOver = true;
      this.state.victoryType = 'market_dominance';
      return;
    }

    // Victory: real dominance — high composite power AND meaningful relative share
    // AND solvent. Idling (end-turn with no orders) leaves power far below 70 and
    // shareRel below 0.30, so it can never trigger this.
    if (this.state.mode !== 'campaign' && power >= 70 && shareRel >= 0.30 && player.cash > 0) {
      const alreadyRecorded = this.state.victoryMilestones.some(m => m.type === 'market_dominance');
      if (!alreadyRecorded) {
        this.state.victoryMilestones.push({
          id: generateId.event(), turn: this.state.turn, type: 'market_dominance',
          label: 'Market Dominance', powerScore: power, marketShare: shareRel,
          acknowledged: false,
        });
      }
      if (this.state.modeRules.victoryPolicy.kind === 'terminal') {
        this.state.isGameOver = true;
        this.state.victoryType = 'market_dominance';
      }
      return;
    }

    // Defeat: player went bankrupt (handled in resolveFinancials) or got wiped out.
    if (player.cash < -500000 && player.debt > player.valuation && this.state.mode !== 'sandbox') {
      this.state.isGameOver = true;
      this.state.victoryType = undefined;
      return;
    }

    // End of campaign: winner is the highest-power company, but only if it actually
    // achieved dominance (power >= 50). Below that, nobody "won" — idling loses.
    const turnPolicy = this.state.modeRules.turnPolicy;
    if (turnPolicy.kind === 'limited' && this.state.turn >= turnPolicy.maxTurns) {
      if (this.state.mode === 'scenario') {
        this.state.isGameOver = true;
        this.state.victoryType = scenarioConditionsMet() ? 'market_dominance' : undefined;
        return;
      }
      const ranked = [...all].sort((a, b) => (b.powerScore ?? 0) - (a.powerScore ?? 0));
      const leader = ranked[0];
      this.state.isGameOver = true;
      this.state.victoryType = (leader.id === this.state.playerCompanyId && (leader.powerScore ?? 0) >= 50)
        ? 'market_dominance'
        : undefined;
    }
  }

  private resolveCampaignTransition(): void {
    const definition = this.state.campaignDefinition;
    const run = this.state.campaignRun;
    if (this.state.mode !== 'campaign' || !definition || !run || run.completed) return;
    const player = this.state.companies.get(this.state.playerCompanyId);
    if (!player) return;
    const totalInfluence = Array.from(this.state.companies.values()).reduce((sum, company) => sum + company.marketInfluence, 0) || 1;
    const passes = (condition: import('../../types').CampaignCondition): boolean => {
      if (condition.kind === 'always') return true;
      const compare = (actual: number, value: number, operator: 'gte' | 'lte') => operator === 'gte' ? actual >= value : actual <= value;
      if (condition.kind === 'cash') return compare(player.cash, condition.value, condition.operator);
      if (condition.kind === 'debt') return compare(player.debt, condition.value, condition.operator);
      if (condition.kind === 'turn') return compare(this.state.turn, condition.value, condition.operator);
      if (condition.kind === 'market_share') return compare(player.marketInfluence / totalInfluence, condition.value, condition.operator);
      return player.ideas.some(idea => idea.id === condition.technologyId);
    };
    const edge = definition.edges.find(candidate => candidate.fromChapterId === run.currentChapterId && candidate.conditions.every(passes));
    if (!edge) return;
    edge.effects?.forEach(effect => {
      if (effect.kind === 'cash' && typeof effect.value === 'number') player.cash += effect.value;
      if (effect.kind === 'debt' && typeof effect.value === 'number') player.debt = Math.max(0, player.debt + effect.value);
      if (effect.kind === 'reputation' && typeof effect.value === 'number') player.brandTrust = Math.max(0, Math.min(100, player.brandTrust + effect.value));
    });
    run.currentChapterId = edge.toChapterId;
    if (!run.visitedChapterIds.includes(edge.toChapterId)) run.visitedChapterIds.push(edge.toChapterId);
    const chapter = definition.chapters.find(item => item.id === edge.toChapterId);
    if (chapter?.isFinal) {
      run.completed = true;
      this.state.isGameOver = true;
      this.state.victoryType = 'market_dominance';
    }
    this.addNews(player.id, `Campaign transition: ${chapter?.title ?? edge.label}`);
  }

  private generateMarketBriefing(): MarketBriefing {
    const demandShifts: DemandShift[] = [];
    const competitorMoves: CompetitorMove[] = [];
    const cyberAlerts: CyberAlert[] = [];

    const SEGMENTS = [
      'open_market', 'enterprise_cluster', 'public_sector', 'regulated_industry',
      'innovation_hub', 'price_sensitive', 'high_growth', 'legacy_market',
      'strategic_account', 'startup_zone',
    ] as const;

    SEGMENTS.forEach(segment => {
      if (this.rng.nextBoolean(0.3)) {
        demandShifts.push({
          segment,
          change: this.rng.nextFloat(-0.2, 0.3),
          reason: 'Market dynamics shift',
        });
      }
    });

    this.state.companies.forEach(c => {
      if (!c.isPlayer) {
        competitorMoves.push({
          companyId: c.id,
          action: this.rng.shuffle(['expand_market', 'launch_product', 'security_hardening']).pop()!,
          visibility: this.rng.nextFloat(0.3, 0.8),
        });
      }
    });

    if (this.rng.nextBoolean(0.2)) {
      cyberAlerts.push({
        severity: this.rng.shuffle(['low','medium','high','critical']).pop()! as 'low' | 'medium' | 'high' | 'critical',
        targetSegment: this.rng.shuffle(['open_market','enterprise_cluster','public_sector','regulated_industry','innovation_hub','price_sensitive','high_growth','legacy_market','strategic_account','startup_zone']).pop()! as MarketSegment,
        description: 'Increased threat activity detected',
        estimatedImpact: this.rng.nextFloat(0.1, 0.4),
      });
    }

    const globalEvents: GameEvent[] = [];

    // World market events — active only when Market Simulation is enabled.
    if (this.state.simulation.marketSimulation) {
      // Stock market swing — affects everyone's valuation/influence.
      if (this.rng.nextBoolean(0.35)) {
        const up = this.rng.nextBoolean(0.5);
        globalEvents.push({
          id: generateId.event(),
          turn: this.state.turn,
          category: 'financial',
          kind: up ? 'stock_surge' : 'stock_crash',
          title: up ? 'Bull Market Rally' : 'Market Correction',
          description: up
            ? 'Investor confidence surges — valuations and market reach climb across the board.'
            : 'A sharp sell-off hits the sector — influence and cash reserves contract.',
          impact: { marketInfluence: up ? 8 : -10, cash: up ? 200000 : -150000 },
          effects: {
            marketInfluenceDelta: up ? 8 : -10,
            cashDelta: up ? 200000 : -150000,
            scope: 'all',
          },
          affectedCompanies: [],
          duration: 1,
          severity: up ? 'high' : 'critical',
        });
      }
    }

    // Technology breakthrough — boosts AI/innovation for all (race to adopt).
    if (this.state.simulation.newTech && this.rng.nextBoolean(0.25)) {
      globalEvents.push({
        id: generateId.event(),
        turn: this.state.turn,
        category: 'product',
        kind: 'tech_breakthrough',
        title: 'Breakthrough Technology Emerges',
        description: 'A new platform shifts the competitive landscape. Early adopters leap ahead in AI and innovation.',
        impact: { aiCapability: 6, innovation: 5 },
        effects: { aiCapabilityDelta: 6, innovationDelta: 5, scope: 'all' },
        affectedCompanies: [],
        duration: 1,
        severity: 'high',
      });
    }

    // Cataclysms — only when the player enables them. The CEO's Luck pillar
    // (fortune) softly lowers the odds of a market-wide disaster striking.
    if (this.state.simulation.cataclysms) {
      const player = this.state.companies.get(this.state.playerCompanyId);
      const luck = player?.ceos[0]?.luck ?? 5;
      const odds = Math.max(0.04, 0.12 * (1 - luck / 100)); // luck 10 -> 0.108
      if (this.rng.nextBoolean(odds)) {
        const kinds = ['Cyber Blackout', 'Regulatory Crackdown', 'Supply Chain Collapse', 'Data Center Outage'];
        const name = this.rng.shuffle(kinds).pop()!;
        globalEvents.push({
          id: generateId.event(),
          turn: this.state.turn,
          category: 'cyber',
          kind: 'cataclysm',
          title: `Cataclysm: ${name}`,
          description: `${name} strikes the market — a random territory loses control, its buildings and teams take damage, and owners take a cash hit.`,
          impact: { control: -20, building: -20, cash: -250000 },
          effects: { tileDamage: 0.2, buildingDamage: 20, deptDamage: 0.15, cashDelta: -250000, scope: 'random_tile' },
          affectedCompanies: [],
          duration: 1,
          severity: 'critical',
        });
      }
    }

    return { demandShifts, globalEvents, competitorMoves, cyberAlerts, maOpportunities: [], clientRequests: [] };
  }

  /** Applies real effects of world events (stock swings, tech leaps, cataclysms) to the state. */
  private applyGlobalEvents(newsItems: NewsItem[]): void {
    const events = this.state.marketBriefing.globalEvents;
    for (const ev of events) {
      const fx = ev.effects;
      if (!fx) continue;
      const applyTo = (c: Company) => {
        if (fx.marketInfluenceDelta) c.marketInfluence = Math.max(0, Math.min(100, c.marketInfluence + fx.marketInfluenceDelta));
        if (fx.cashDelta) c.cash += fx.cashDelta;
        if (fx.aiCapabilityDelta) c.aiCapability = Math.max(0, Math.min(100, c.aiCapability + fx.aiCapabilityDelta));
        if (fx.innovationDelta) c.innovation = Math.max(0, Math.min(100, c.innovation + fx.innovationDelta));
        if (fx.securityDelta) c.securityPosture = Math.max(0, Math.min(100, c.securityPosture + fx.securityDelta));
        // T: market news move workforce morale (HR mechanic).
        if (fx.marketInfluenceDelta) c.employeeMorale = Math.max(0, Math.min(100, c.employeeMorale + fx.marketInfluenceDelta * 0.3));
        if (fx.tileDamage || fx.buildingDamage || fx.deptDamage) {
          const owned = c.controlledTiles.filter(t => this.state.marketTiles.has(t));
          if (owned.length) {
            const tile = this.state.marketTiles.get(this.rng.shuffle(owned).pop()!)!;
            if (fx.tileDamage) {
              tile.controlStrength = Math.max(0, tile.controlStrength - fx.tileDamage);
              if (tile.controlStrength <= 0.05) { tile.controllerId = undefined; tile.controlStrength = 0; c.controlledTiles = c.controlledTiles.filter(t => t !== tile.id); }
            }
            if (fx.buildingDamage) {
              const dmg = fx.buildingDamage;
              c.buildings.filter(b => b.tileId === tile.id).forEach(b => {
                b.firewall = Math.max(0, b.firewall - dmg);
                b.physicalSecurity = Math.max(0, b.physicalSecurity - dmg);
              });
            }
            if (fx.deptDamage) {
              const dmg = fx.deptDamage;
              c.departments.forEach(d => {
                d.morale = Math.max(0.2, d.morale - dmg);
                d.efficiency = Math.max(0.3, d.efficiency - dmg);
              });
            }
          }
        }
      };
      if (fx.scope === 'all') {
        this.state.companies.forEach(applyTo);
      } else if (fx.scope === 'player') {
        const p = this.state.companies.get(this.state.playerCompanyId); if (p) applyTo(p);
      } else if (fx.scope === 'rivals') {
        this.state.companies.forEach(c => { if (!c.isPlayer) applyTo(c); });
      } else if (fx.scope === 'random_tile') {
        // damage a random tile's owner (could be player or rival)
        const owners = Array.from(this.state.companies.values()).filter(c => c.controlledTiles.length > 0);
        if (owners.length) applyTo(this.rng.shuffle(owners).pop()!);
      }
      const imp: 'minor' | 'major' | 'critical' = ev.severity === 'critical' ? 'critical' : ev.severity === 'low' || ev.severity === 'medium' ? 'minor' : 'major';
      newsItems.push(this.createNewsItem(this.state.turn, ev.category, `${ev.title}: ${ev.description}`, '', undefined, imp));
    }
  }

  /** Generate `count` fresh global market trends (demanded category x sector). */
  private generateMarketTrends(count: number): MarketTrend[] {
    const t = this.state?.turn ?? 1;
    const cats: ProductCategory[] = ['fintech', 'cybersecurity', 'ai', 'cloud_infra', 'healthtech', 'greentech', 'data_analytics', 'blockchain', 'iot', 'biotech', 'quantum', 'ar_vr', 'gaming', 'ecommerce', 'robotics', 'edtech'];
    const segs: MarketSegment[] = ['enterprise_cluster', 'public_sector', 'regulated_industry', 'innovation_hub', 'high_growth', 'strategic_account', 'startup_zone', 'legacy_market'];
    const out: MarketTrend[] = [];
    for (let i = 0; i < count; i++) {
      const category = this.rng.shuffle(cats).pop()!;
      const sector = this.rng.shuffle(segs).pop()!;
      const strength = this.rng.nextFloat(0.4, 0.95);
      out.push({
        id: generateId.trend(),
        title: `Demand Surge: ${category.replace('_', ' ').toUpperCase()} for ${sector.replace('_', ' ')}`,
        category, sector,
        strength,
        expiresTurn: t + this.rng.nextInt(4, 9),
        appearedTurn: t,
        decisionDeadlineTurn: t + 2,
        blurb: `The market is pulling ${category.replace('_', ' ')} hard in the ${sector.replace('_', ' ')} segment. Ride it with a matching launch or campaign.`,
      });
    }
    return out;
  }

  /** Generate `count` weak signals (early hints of emerging demand). */
  private generateWeakSignals(count: number): WeakSignal[] {
    const t = this.state?.turn ?? 1;
    const cats: ProductCategory[] = ['fintech', 'cybersecurity', 'ai', 'cloud_infra', 'healthtech', 'greentech', 'data_analytics', 'blockchain', 'iot', 'biotech', 'quantum', 'ar_vr'];
    const sectors: MarketSegment[] = ['open_market', 'enterprise_cluster', 'public_sector', 'regulated_industry', 'innovation_hub', 'high_growth', 'strategic_account', 'startup_zone', 'legacy_market'];
    const hints = [
      'Whispers of a regulatory shift favouring',
      'A key client was spotted piloting',
      'Talent is quietly flowing toward',
      'A competitor acquisition hints at',
      'Early adopters are asking about',
    ];
    const out: WeakSignal[] = [];
    for (let i = 0; i < count; i++) {
      const relatedCategory = this.rng.shuffle(cats).pop()!;
      out.push({
        id: generateId.weak(),
        hint: `${this.rng.shuffle(hints).pop()} ${relatedCategory.replace('_', ' ')}…`,
        relatedCategory,
        relatedSector: this.rng.shuffle(sectors).pop()!,
        confidence: this.rng.nextFloat(0.25, 0.6),
        expiresTurn: t + this.rng.nextInt(3, 6),
      });
    }
    return out;
  }

  /** Refresh trends/signals each turn: drop expired, occasionally add new ones. */
  private refreshTrends(): void {
    const t = this.state.turn;
    const missed = this.state.trends.filter(tr => tr.decisionDeadlineTurn <= t || tr.expiresTurn <= t);
    if (missed.length) {
      this.state.trendHistory.push(...missed.map(trend => ({ trend, outcome: 'missed' as const, resolvedTurn: t })));
      this.state.trendHistory = this.state.trendHistory.slice(-40);
    }
    this.state.trends = this.state.trends.filter(tr => tr.decisionDeadlineTurn > t && tr.expiresTurn > t);
    this.state.weakSignals = this.state.weakSignals.filter(w => w.expiresTurn > t);
    // ~50% chance to spin up a new trend; ~60% for a weak signal each turn.
    if (this.rng.nextBoolean(0.5)) this.state.trends.push(...this.generateMarketTrends(1));
    if (this.rng.nextBoolean(0.6)) this.state.weakSignals.push(...this.generateWeakSignals(1));
  }

  /** Convenience: append a narrative news item directly to the live feed. */
  private addNews(companyId: CompanyId | undefined, headline: string): void {
    this.state.newsFeed = [
      ...this.state.newsFeed,
      this.createNewsItem(this.state.turn, 'reputation', headline, '', companyId, 'minor'),
    ].slice(-60);
  }

  private createNewsItem(
    turn: number,
    category: EventCategory,
    headline: string,
    body: string,
    companyId?: CompanyId,
    importance: 'minor' | 'major' | 'critical' = 'minor'
  ): NewsItem {
    return {
      id: generateId.action(),
      turn,
      category,
      headline,
      body,
      companyId,
      importance,
    };
  }
}
