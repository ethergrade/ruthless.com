import { createRNG } from '../utils/rng';
import { ACTION_SPECIAL_PILLAR, unlockPerksForCeo, PERK_LABELS } from '../../data/archetypes';
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
} from '../../types';
import { generateId } from '../utils/ids';
import { createMarketMap, generateChunk, buildTileIndex, createTile } from '../factories/marketFactory';
import { createCompany } from '../factories/companyFactory';
import { generateCompanyName } from '../../data/generators';

export interface TurnResult {
  newState: GameState;
  events: GameEvent[];
  newsItems: NewsItem[];
  marketBriefing: MarketBriefing;
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
  ) {
    this.rng = createRNG(seed);
    if (ceoTrait) this.ceoTrait = ceoTrait;
    if (scenario) this.scenarioOpts = scenario;
    this.statOverrides = statOverrides;
    this.ceoBuild = ceoBuild;
    this.initialBuildings = initialBuildings;
    this.realMapPlacement = realMapPlacement;
    this.mapSeed = mapSeed ?? seed ?? 1;
    this.state = this.initializeGameState();
    this.state.marketBriefing = this.generateMarketBriefing();
  }

  /** T — deterministic world seed (infinite map). */
  private mapSeed: number;

  getState(): GameState {
    return this.state;
  }

  // Replace the entire state (used by load/save). Restores RNG continuity
  // from the saved seed so subsequent turns stay deterministic per save.
  setState(state: GameState): void {
    this.state = state;
    this.rng.setSeed(state.seed);
  }

  getRNG(): ReturnType<typeof createRNG> {
    return this.rng;
  }

  private initializeGameState(): GameState {
    const so = this.scenarioOpts;
    const mapDims: Record<string, [number, number]> = { small: [6, 6], medium: [8, 8], large: [10, 10] };
    const [mw, mh] = so ? (mapDims[so.mapSize] ?? [8, 8]) : [8, 8];
    const rivalCount = so ? Math.max(1, Math.min(4, so.aiRivals)) : 3;
    const rivalDefs: [string, CompanyArchetype][] = [
      ['NexusTech', 'hypergrowth_platform'],
      ['SentinelCyber', 'security_fortress'],
      ['ApexDigital', 'acquisition_machine'],
      ['Vertex Dynamics', 'lean_specialist'],
    ];
    const aiCompanies = rivalDefs.slice(0, rivalCount).map(([name, arch], i) =>
      createCompany(this.rng, name, arch, false, i, undefined, undefined, undefined, 'rival'));

    const playerCompany = createCompany(this.rng, 'PlayerCorp', undefined, true, 0, this.ceoTrait, this.statOverrides, this.ceoBuild);
    if (so?.startCash) playerCompany.cash = so.startCash;
    playerCompany.ceoBuild = this.ceoBuild;
    const marketTiles = createMarketMap(this.rng, mw, mh, this.mapSeed);
    const tileIndex = buildTileIndex(marketTiles);
    this.assignStartingTerritories(marketTiles, [playerCompany, ...aiCompanies]);

    const companies = new Map<CompanyId, Company>();
    [playerCompany, ...aiCompanies].forEach(c => companies.set(c.id, c));

    // Give each corporation a starting HQ Building on its first controlled tile.
    // In real-map placement mode the player drops their own buildings live on the
    // board, so we seed only the rivals/startups here (they stay hidden until the
    // player finishes placement and the phase flips to 'playing').
    if (this.initialBuildings && this.initialBuildings.length > 0) {
      this.seedPlayerBuildings(playerCompany, marketTiles, this.initialBuildings);
    } else if (this.realMapPlacement) {
      aiCompanies.forEach(c => this.seedCompanyBuilding(c, marketTiles));
    } else {
      [playerCompany, ...aiCompanies].forEach(c => this.seedCompanyBuilding(c, marketTiles));
    }

    // Spawn neutral "start-up" corporations sitting on random tiles that the
    // player (or AI) can acquire via payment / public tender offer.
    const startups = this.spawnStartups(marketTiles, 4);

    const products = new Map<ProductId, Product>();
    [...playerCompany.products, ...aiCompanies.flatMap(c => c.products), ...startups.flatMap(c => c.products)]
      .forEach(p => products.set(p.id, p));
    [...aiCompanies, ...startups].forEach(c => companies.set(c.id, c));

    const result: GameState = {
      turn: 1,
      maxTurns: 20,
      playerCompanyId: playerCompany.id,
      companies,
      marketTiles,
      products,
      actions: [],
      events: [],
      newsFeed: [],
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

  /** T — infinite map: lazily stream a square region of tiles around (cx,cy) so the
   *  world extends on demand. Deterministic: same coords + mapSeed => same tiles.
   *  Returns the list of freshly generated tile ids (for UI/invalidation). */
  ensureRegion(cx: number, cy: number, radius = 8): TileId[] {
    generateChunk(this.mapSeed, this.state.marketTiles, this.state.tileIndex, cx, cy, radius);
    const fresh: TileId[] = [];
    this.state.marketTiles.forEach(t => { if ((t.x - cx) ** 2 + (t.y - cy) ** 2 <= radius * radius && !this.knownTiles.has(t.id)) { fresh.push(t.id); } });
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
  private seedCompanyBuilding(company: Company, tiles: Map<string, MarketTile>): void {
    const tileId = company.controlledTiles[0];
    if (!tileId) return;
    const tile = tiles.get(tileId);
    if (!tile) return;
    const id = generateId.building();
    company.buildings.push({
      id,
      tileId,
      departmentIds: company.departments.slice(0, 2).map(d => d.id),
      productIds: company.products.slice(0, 1).map(p => p.id),
      firewall: company.archetype === 'security_fortress' ? 40 : 20,
      physicalSecurity: 30,
      hushMoney: 0,
      isHQ: true,
      ceoId: company.ceos[0]?.id,
      maxDepartments: 8,
    });
    tile.buildingId = id;
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
    const deptTypes = spec.deptTypes.slice(0, 3);
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
      hushMoney: 0, isHQ, ceoId: isHQ ? player.ceos[0]?.id : undefined, maxDepartments: 8,
    });
    tile.buildingId = id;
    if (!tile.controllerId) tile.controllerId = player.id;
    if (!player.controlledTiles.includes(tile.id)) player.controlledTiles.push(tile.id);
    state.pendingBuildings.push({ ...spec, isHQ, tileId: tile.id });
  }

  /** T: finish the real-map placement — rivals/startups become visible, game begins. */
  finishPlacement(): void {
    if (this.state.phase !== 'placement') return;
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
          id, tileId: tile.id,
          departmentIds: c.departments.slice(0, 1).map(d => d.id),
          productIds: c.products.slice(0, 1).map(p => p.id),
          firewall: 10, physicalSecurity: 10, hushMoney: 0, isHQ: true,
          maxDepartments: 8,
        });
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
    const unassignedTiles = Array.from(tiles.values());
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
    const events: GameEvent[] = [];
    const newsItems: NewsItem[] = [];
    this.ideasCreatedThisTurn.clear(); // reset per-turn R&D idea capacity

    this.processPlayerActions(events, newsItems);
    this.processAIActions(events, newsItems);
    this.resolveAuctions(newsItems);
    this.resolveMarket();
    this.resolveFinancials();
    this.resolveRisks(events, newsItems);
    this.autoAggression();
    this.applySharkMarket();
    this.applyGlobalEvents(newsItems);
    // Expire in-progress tile action markers.
    this.state.marketTiles.forEach(t => {
      if (t.pendingAction && t.pendingAction.expiresTurn <= this.state.turn) t.pendingAction = undefined;
    });
    Array.from(this.state.companies.values()).forEach(c => this.recalculateCompanyMetrics(c));
    this.state.marketBriefing = this.generateMarketBriefing();
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
      const agility = p0.ceos[0].skills.agility ?? 5;
      p0.ceos[0].specialPoints = 1 + Math.floor(agility / 4); // 1..3
    }
    // CEO gains experience over time (drives Initiative bonus scaling).
    if (this.state.turn % 4 === 0) {
      const p = this.state.companies.get(this.state.playerCompanyId);
      if (p) p.ceoLevel += 1;
    }
    // T: recompute composite power score for every company (drives victory + UI).
    this.state.companies.forEach(c => { c.powerScore = this.computePowerScore(c); });
    this.checkVictoryConditions();

    // Persist this turn's news into the feed (P3: news must actually appear).
    this.state.newsFeed = [...this.state.newsFeed, ...newsItems].slice(-60);

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
          const pillar = ACTION_SPECIAL_PILLAR[action.type];
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
    const aiCompanies = Array.from(this.state.companies.values()).filter(c => !c.isPlayer);

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

      actions.push(action);
    }

    return actions;
  }

  private selectAIAction(archetype: string, _company: Company): ActionType | null {
    const weights: Record<string, Partial<Record<ActionType, number>>> = {
      hypergrowth_platform: {
        build_department: 20, launch_product: 25, improve_product: 15,
        expand_market: 20, marketing_campaign: 10, hire_executive: 5,
        security_hardening: 2, ai_automation: 3, launch_consulting_practice: 1,
        scout_acquisition: 5, acquire_company: 3, raise_capital: 10, reduce_costs: 1,
        build_building: 8, industrial_espionage: 4, cyber_attack: 3, security_offline: 2,
        security_online: 2, legal_action: 2, ceo_social: 6, public_tender_offer: 4, auction_sell: 3, end_turn: 0, auction_bid: 0,
      },
      security_fortress: {
        build_department: 15, launch_product: 10, improve_product: 15,
        expand_market: 5, marketing_campaign: 5, hire_executive: 10,
        security_hardening: 25, ai_automation: 5, launch_consulting_practice: 5,
        scout_acquisition: 5, acquire_company: 2, raise_capital: 5, reduce_costs: 5,
        build_building: 5, industrial_espionage: 3, cyber_attack: 4, security_offline: 8,
        security_online: 10, legal_action: 6, ceo_social: 3, public_tender_offer: 2, auction_sell: 2, end_turn: 0, auction_bid: 0,
      },
      acquisition_machine: {
        build_department: 10, launch_product: 10, improve_product: 10,
        expand_market: 10, marketing_campaign: 5, hire_executive: 10,
        security_hardening: 5, ai_automation: 5, launch_consulting_practice: 5,
        scout_acquisition: 20, acquire_company: 20, raise_capital: 10, reduce_costs: 5,
        build_building: 6, industrial_espionage: 4, cyber_attack: 3, security_offline: 3,
        security_online: 3, legal_action: 5, ceo_social: 4, public_tender_offer: 12, auction_sell: 4, end_turn: 0, auction_bid: 0,
      },
      lean_specialist: {
        build_department: 10, launch_product: 15, improve_product: 20,
        expand_market: 10, marketing_campaign: 10, hire_executive: 10,
        security_hardening: 10, ai_automation: 10, launch_consulting_practice: 15,
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
      security_hardening: 200000,
      ai_automation: 250000,
      launch_consulting_practice: 150000,
      scout_acquisition: 50000,
      acquire_company: 2000000,
      raise_capital: 0,
      reduce_costs: 0,
      build_building: 750000,
      industrial_espionage: 200000,
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
    return Math.round(base * variance * (company.cash / 1000000));
  }

  private resolveAction(action: TurnAction): { success: boolean; message: string; effects: Record<string, number>; risksTriggered: string[] } {
    const company = this.state.companies.get(action.companyId);
    if (!company) return { success: false, message: 'Company not found', effects: {}, risksTriggered: [] };

    if (action.budget > company.cash * 0.5) {
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
    const alwaysSucceed = ['launch_product', 'build_department', 'build_building', 'hire_executive', 'hire_ceo', 'hire_coo', 'mass_layoff', 'raise_capital', 'reduce_costs', 'ai_automation', 'launch_consulting_practice', 'acquire_company', 'acquire_below_value'];
    const successChance = this.calculateSuccessChance(action, company);
    const success = alwaysSucceed.includes(action.type) || this.rng.nextBoolean(successChance);

    const effects: Record<string, number> = {};
    const risks: string[] = [];

    if (success) {
      this.applyActionEffectsToCompany(action, company, effects);
    } else {
      effects.cash = -action.budget * 0.1;
      risks.push('execution_failure');
    }

    return {
      success,
      message: success ? 'Action completed successfully' : 'Action failed to achieve objectives',
      effects,
      risksTriggered: risks,
    };
  }

  private calculateSuccessChance(action: TurnAction, company: Company): number {
    let chance = 0.7;

    const relevantDept = company.departments.find(d => this.isDepartmentRelevant(d.type, action.type));
    if (relevantDept) {
      chance += (relevantDept.level - 1) * 0.05;
      chance += (relevantDept.efficiency - 0.5) * 0.2;
    }

    if (action.executiveId) {
      const exec = company.executives.find(e => e.id === action.executiveId);
      if (exec) {
        chance += (exec.level - 1) * 0.03;
        chance += (exec.energy - 0.5) * 0.1;
        if (exec.traits.includes('crisis_leader') && action.type === 'security_hardening') chance += 0.1;
        if (exec.traits.includes('deal_maker') && action.type === 'acquire_company') chance += 0.15;
        if (exec.traits.includes('growth_hacker') && action.type === 'expand_market') chance += 0.1;
      }
    }

    const budgetRatio = action.budget / this.getActionBaseCost(action.type);
    chance += Math.min(0.2, (budgetRatio - 1) * 0.1);

    return Math.max(0.1, Math.min(0.95, chance));
  }

  private getActionBaseCost(actionType: ActionType): number {
    const costs: Record<ActionType, number> = {
      build_department: 500000,
      launch_product: 300000,
      improve_product: 100000,
      expand_market: 200000,
      marketing_campaign: 150000,
      hire_executive: 400000,
      security_hardening: 200000,
      ai_automation: 250000,
      launch_consulting_practice: 150000,
      scout_acquisition: 50000,
      acquire_company: 2000000,
      raise_capital: 0,
      reduce_costs: 0,
      build_building: 750000,
      industrial_espionage: 200000,
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
      security_hardening: ['cybersecurity', 'ai_data'],
      ai_automation: ['ai_data', 'product_rd'],
      launch_consulting_practice: ['consulting_services', 'sales_marketing'],
      scout_acquisition: ['acquisitions', 'finance_investor'],
      acquire_company: ['acquisitions', 'finance_investor', 'legal_compliance'],
      raise_capital: ['finance_investor', 'corporate_strategy'],
      reduce_costs: ['finance_investor', 'people_culture'],
      build_building: ['corporate_strategy', 'finance_investor'],
      industrial_espionage: ['cybersecurity', 'product_rd', 'ai_data'],
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
    company.cash -= action.budget;

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
      case 'security_hardening':
        this.hardenSecurity(company, action.budget, action.targetProductId);
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

    // Place the department inside a player-owned building on the chosen tile.
    let buildingId: string | undefined;
    if (action.targetTileId) {
      const b = company.buildings.find(b => b.tileId === action.targetTileId);
      if (b) buildingId = b.id;
    }
    // T: enforce the ruthless.com rule — max 8 departments per building. The HQ
    // itself occupies 1 slot, so an HQ can hold at most 7 real departments.
    const slotCount = (b: Building) => b.departmentIds.length + (b.isHQ ? 1 : 0);
    if (buildingId) {
      const b = company.buildings.find(x => x.id === buildingId);
      if (b && slotCount(b) >= b.maxDepartments) {
        // Find any building with capacity, else bail (player must build a new building).
        const room = company.buildings.find(x => slotCount(x) < x.maxDepartments);
        if (!room) return;
        buildingId = room.id;
      }
    } else {
      const room = company.buildings.find(x => slotCount(x) < x.maxDepartments);
      if (room) buildingId = room.id;
    }

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

  private launchProduct(company: Company, action: TurnAction): void {
    // T: an R&D idea can seed the launch — it grants extra adopter momentum and
    // is consumed (moved out of the R&D Ideas list into production).
    const idea = action.ideaId
      ? company.ideas.find(i => i.id === action.ideaId)
      : undefined;
    const category: ProductCategory = (action.productCategory ?? idea?.category) ?? this.rng.shuffle([
      'saas', 'ai', 'cybersecurity', 'consulting', 'managed_service', 'data_service',
      'platform_api', 'hybrid', 'fintech', 'cloud_infra', 'iot', 'blockchain',
      'healthtech', 'edtech', 'greentech', 'gaming', 'ecommerce', 'data_analytics',
      'robotics', 'biotech', 'quantum', 'ar_vr',
    ]).pop()! as ProductCategory;
    const name = action.productName?.trim() || `Product_${company.products.length + 1}`;

    // T5: riding an active global trend for this category grants a launch bonus.
    const trend = this.state.trends.find(t => t.category === category && t.expiresTurn > this.state.turn);
    const trendBonus = trend ? trend.strength : 0;
    // An idea-backed launch rides the R&D push: more early adopters + quality lift.
    const ideaBonus = idea ? (idea.breakthrough ? 0.18 : 0.10) + idea.maturity / 400 : 0;

    company.products.push({
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
      technicalDebt: 10,
      trust: 50 + (idea ? 6 : 0),
      targetSegments: trend ? [trend.sector] : ['enterprise_cluster', 'high_growth'],
      tileIds: [],
      // T: lifecycle bootstrapping — launches start at the early-adopter phase.
      lifecycleStage: 'early',
      version: 1,
      adopters: 0.02 + trendBonus * 0.05 + ideaBonus, // idea-backed launch seeds real adopters
      baseInstalled: 0,
      pivotCount: 0,
      ageTurns: 0,
    });

    // Consume the idea: it has been brought into production.
    if (idea) {
      company.ideas = company.ideas.filter(i => i.id !== idea.id);
      this.state.inventions = this.state.inventions.filter(i => i.id !== idea.id);
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
    if (!target) return;
    if (price > company.cash) return;

    // Pay out.
    company.cash -= price;
    target.cash += Math.round(price * 0.6);
    // Inherit the acquired firm's revenue stream (drives valuation after recalc).
    company.revenue += target.revenue;
    // Fold target buildings + their tiles into the buyer (acquire tile + building).
    target.buildings.forEach(b => {
      if (!company.buildings.find(x => x.tileId === b.tileId)) {
        company.buildings.push(b);
        const t = this.state.marketTiles.get(b.tileId);
        if (t) { t.controllerId = company.id; t.buildingId = b.id; t.isStartupTile = false; t.startupPotential = undefined; }
        if (!company.controlledTiles.includes(b.tileId)) company.controlledTiles.push(b.tileId);
      }
    });
    // Empty-shell startups: still grab the tile (no building to move).
    target.controlledTiles.forEach(tid => {
      const t = this.state.marketTiles.get(tid);
      if (t && t.controllerId === target.id && !company.controlledTiles.includes(tid)) {
        t.controllerId = company.id;
        t.isStartupTile = false;
        t.startupPotential = undefined;
        company.controlledTiles.push(tid);
      }
    });
    // Market-share / valuation impact (the player's quote moves up or down).
    const share = target.marketInfluence;
    company.marketInfluence = Math.min(100, company.marketInfluence + share * 0.8 + 3);
    company.valuation = Math.max(1, company.valuation + target.valuation * 0.5);
    target.marketInfluence = Math.max(0, target.marketInfluence - share * 0.5);
    // Acquired startup's fate: absorbed (removed) once bought out.
    if (target.isStartup) {
      this.state.companies.delete(target.id);
      company.acquisitions = (company.acquisitions ?? 0) + 1;
    }

    this.addNews(company.id, `${company.name} acquires ${target.name} for $${price.toLocaleString()} — market share shifts.`);
    this.state.marketBriefing.globalEvents.push({
      id: generateId.action(),
      turn: this.state.turn,
      category: 'ma',
      kind: 'ma',
      title: 'Acquisition',
      description: `${company.name} acquires ${target.name} ($${price.toLocaleString()}).`,
      impact: { marketInfluenceDelta: share * 0.8 + 3 },
      affectedCompanies: [company.id, target.id],
      duration: 1,
      severity: 'high',
    });
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
      departmentIds: company.departments.slice(0, 1).map(d => d.id),
      productIds: company.products.slice(0, 1).map(p => p.id),
      firewall: isHQ ? 30 : 10,
      physicalSecurity: isHQ ? 40 : 15,
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

  /** Industrial espionage: steal an idea / cash / evidence from a rival. */
  private runIndustrialEspionage(company: Company, action: TurnAction): void {
    // T: a player may scope the interior of a specific competitor building by
    // picking its tile. The target company is taken from the tile if given.
    const tile = action.targetTileId ? this.state.marketTiles.get(action.targetTileId) : undefined;
    let target = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
    if (!target && tile && tile.controllerId && tile.controllerId !== company.id) {
      target = this.state.companies.get(tile.controllerId);
    }
    if (!target) return;
    const success = this.rng.nextBoolean(0.6 - (target.securityPosture / 400));
    if (!success) { company.scandal = Math.min(100, company.scandal + 8); return; }
    // Tile-scoped: discover the interior of the rival building on that tile.
    if (tile && tile.controllerId && tile.controllerId !== company.id) {
      const owner = this.state.companies.get(tile.controllerId);
      const building = owner?.buildings.find(b => b.tileId === tile.id);
      if (building && !this.state.revealedBuildings.includes(building.id)) {
        this.state.revealedBuildings.push(building.id);
        const deptCount = building.departmentIds.length;
        this.addNews(company.id, `${company.name} scopes the interior of ${owner!.name}'s tile ${building.tileId.replace('tile_', '').toUpperCase()} — ${deptCount} department${deptCount === 1 ? '' : 's'} exposed.`);
      }
    }
    switch (action.targetDept) {
      case 'rd':
      case 'product': {
        // steal an idea -> boost innovation + spawn a product insight
        company.innovation = Math.min(100, company.innovation + 6);
        const p = target.products[0];
        if (p) company.products.push({ ...p, id: generateId.product(), companyId: company.id, name: `${p.name} Clone`, tileIds: [] });
        break;
      }
      case 'marketing':
      case 'hr': {
        company.cash += Math.round(action.budget * 0.5);
        target.cash -= Math.round(action.budget * 0.3);
        break;
      }
      default:
        company.cash += Math.round(action.budget * 0.3);
    }
  }

  /** Cyber attack: hack a rival (data run / virus / breach) using computer points. Can target a rival tile. */
  private runCyberAttack(company: Company, action: TurnAction): void {
    const target = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
    const tile = action.targetTileId ? this.state.marketTiles.get(action.targetTileId) : undefined;
    // Tile-targeted attack: hit the building sitting on an enemy-owned tile.
    if (tile && tile.controllerId && tile.controllerId !== company.id) {
      const owner = this.state.companies.get(tile.controllerId);
      const building = owner?.buildings.find(b => b.tileId === tile.id);
      if (building) {
        const spend = Math.min(company.computerPoints, Math.max(100, Math.round(action.budget / 1000)));
        company.computerPoints -= spend;
        const breach = spend > building.firewall;
        if (breach) {
          building.firewall = Math.max(0, building.firewall - 25);
          building.physicalSecurity = Math.max(0, building.physicalSecurity - 10);
          if (owner) { owner.securityPosture = Math.max(0, owner.securityPosture - 4); owner.brandTrust = Math.max(0, owner.brandTrust - 2); }
          company.innovation = Math.min(100, company.innovation + 2);
          // Breach reveals the building interior (departments) to the attacker.
          if (!this.state.revealedBuildings.includes(building.id)) {
            this.state.revealedBuildings.push(building.id);
          }
        } else {
          company.scandal = Math.min(100, company.scandal + 5);
        }
      }
      tile.pendingAction = { type: 'cyber_attack', byCompanyId: company.id, expiresTurn: this.state.turn + 1 };
      return;
    }
    if (!target) return;
    const spend = Math.min(company.computerPoints, Math.max(100, Math.round(action.budget / 1000)));
    company.computerPoints -= spend;
    const breach = spend > target.buildings.reduce((s, b) => s + b.firewall, 0);
    if (breach) {
      target.securityPosture = Math.max(0, target.securityPosture - 6);
      target.brandTrust = Math.max(0, target.brandTrust - 3);
      company.innovation = Math.min(100, company.innovation + 2);
    } else {
      company.scandal = Math.min(100, company.scandal + 5);
    }
  }

  /** Offline (physical) security: guards / lockdown / sabotage defense — or a raid on a rival tile. */
  private runSecurityOffline(company: Company, action: TurnAction): void {
    const tile = action.targetTileId ? this.state.marketTiles.get(action.targetTileId) : undefined;
    if (tile && tile.controllerId && tile.controllerId !== company.id) {
      // Offensive physical raid: degrade an enemy building's physical security.
      const owner = this.state.companies.get(tile.controllerId);
      const building = owner?.buildings.find(b => b.tileId === tile.id);
      if (building) {
        building.physicalSecurity = Math.max(0, building.physicalSecurity - Math.round(action.budget / 8000));
        if (owner) owner.securityPosture = Math.max(0, owner.securityPosture - 2);
      }
      tile.pendingAction = { type: 'security_offline', byCompanyId: company.id, expiresTurn: this.state.turn + 1 };
      return;
    }
    company.securityPosture = Math.min(100, company.securityPosture + action.budget / 8000);
    company.buildings.forEach(b => { b.physicalSecurity = Math.min(100, b.physicalSecurity + 4); });
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

  /** T7 — Defend Tile: reinforce a player-owned building's firewall + physical. */
  private runDefendTile(company: Company, action: TurnAction): void {
    const tile = action.targetTileId ? this.state.marketTiles.get(action.targetTileId) : undefined;
    if (!tile || tile.controllerId !== company.id) return;
    const building = company.buildings.find(b => b.tileId === tile.id);
    if (!building) return;
    const boost = Math.min(40, Math.round(action.budget / 4000));
    building.firewall = Math.min(100, building.firewall + boost);
    building.physicalSecurity = Math.min(100, building.physicalSecurity + boost);
    company.securityPosture = Math.min(100, company.securityPosture + Math.round(boost / 2));
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
      // Spend computer/legal points as the covert weapon.
      const spend = Math.min(attacker.computerPoints + 200, 300);
      attacker.computerPoints = Math.max(0, attacker.computerPoints - spend);
      const breached = spend > building.firewall;
      if (breached) {
        building.firewall = Math.max(0, building.firewall - 18);
        building.physicalSecurity = Math.max(0, building.physicalSecurity - 8);
        target.securityPosture = Math.max(0, target.securityPosture - 3);
        attacker.innovation = Math.min(100, attacker.innovation + 1);
        if (!this.state.revealedBuildings.includes(building.id)) {
          this.state.revealedBuildings.push(building.id);
        }
      }
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
          .find(t => t!.controlStrength < 25);
        if (tile) {
          tile.controllerId = shark.id;
          tile.controlStrength = Math.max(20, tile.controlStrength - 10);
          shark.controlledTiles.push(tile.id);
          victim.controlledTiles = victim.controlledTiles.filter(id => id !== tile.id);
        }
      });
    });
  }

  /** T9 — R&D: invent a new idea/technology. Breakthroughs can spark a market trend. */
  private runCreateIdeas(company: Company, action: TurnAction): void {
    // Capacity cap: a company may invent at most as many ideas this turn as it
    // has R&D departments (product_rd or ai_data). Tracked explicitly so it can
    // never be bypassed by queuing multiple create_ideas orders in one turn.
    const rdCount = company.departments.filter(d => d.type === 'product_rd' || d.type === 'ai_data').length;
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
          sector: this.rng.shuffle(['open_market', 'startup_zone', 'high_growth', 'innovation_hub']).pop()! as MarketSegment,
          strength: this.rng.nextFloat(0.45, 0.8),
          expiresTurn: this.state.turn + this.rng.nextInt(3, 7),
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
    company.cash -= Math.round(action.budget * 0.5); // training has an opportunity cost
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
    const price = Math.max(1, Math.round(target.valuation * (0.6 + this.rng.nextFloat(0, 0.3))));
    if (company.cash < price) return; // cannot afford even the discount
    company.cash -= price;
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
    company.computerPoints += Math.round(action.budget / 2000);
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
      skills: { intelligence: 5, charisma: 5, endurance: 5, luck: 5, strength: 4, perception: 4, agility: 4 },
      luck: 5,
      ceoTraits: [role === 'ceo' ? 'initiative' : 'none'],
      specialPoints: 1,
      trainedSkills: {},
    };
    company.ceos.push(chief);
    hq.ceoId = chief.id;
    company.cash -= chief.cost;
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
    if (offer <= 0 || offer > company.cash) return;
    // Auto-accept if offer >= 2x building worth (ruthless.com rule); else probabilistic.
    const worth = Math.max(500000, target.valuation * 0.15);
    const accept = offer >= worth * 2 || this.rng.nextBoolean(offer / (worth * 1.5));
    if (accept) {
      company.cash -= offer;
      target.cash += offer;
      company.marketInfluence += 4;
      target.marketInfluence = Math.max(0, target.marketInfluence - 3);
      // fold target buildings into the bidder
      target.buildings.forEach(b => {
        b.tileId && company.controlledTiles.includes(b.tileId);
        if (!company.buildings.find(x => x.tileId === b.tileId)) company.buildings.push(b);
      });
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
      if (action.type === 'cyber_attack') chance -= target.securityPosture / 300;
      if (action.type === 'industrial_espionage') chance -= target.securityPosture / 400;
      if (action.type === 'legal_action') chance += (company.legalPoints - target.marketInfluence) / 600;
      if (action.type === 'public_tender_offer') chance += (action.offerPrice ?? 0) / (target.valuation * 3);
    }

    // scandal erodes credibility -> social/legal actions suffer.
    if (action.type === 'ceo_social' || action.type === 'marketing_campaign') chance -= company.scandal / 300;

    const budgetRatio = action.budget / this.getActionBaseCost(action.type);
    chance += Math.min(0.2, (budgetRatio - 1) * 0.1);

    return Math.max(0.05, Math.min(0.97, Math.round(chance * 100) / 100));
  }

  /** Summarises how a company has been playing: offensive / defensive / growth tilt. */
  private strategyTilt(companyId: CompanyId): { combat: number; defense: number; growth: number } {
    const acts = this.state.actions.filter(a => a.companyId === companyId);
    if (acts.length === 0) return { combat: 0, defense: 0, growth: 0 };
    const combat = acts.filter(a => ['industrial_espionage', 'cyber_attack', 'legal_action', 'acquire_company', 'public_tender_offer'].includes(a.type)).length / acts.length;
    const defense = acts.filter(a => ['security_hardening', 'security_offline', 'security_online'].includes(a.type)).length / acts.length;
    const growth = acts.filter(a => ['expand_market', 'launch_product', 'improve_product', 'ai_automation', 'build_department'].includes(a.type)).length / acts.length;
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

      const penetration = p.adopters * p.version * blueOcean;
      const units = Math.max(0, (company.marketInfluence + p.marketFit) * 0.5 * penetration * stageMul);
      return sum + units * p.price * qualityMul * fitMul;
    }, 0);

    // Revenue from controlled market territory (resolved each turn in resolveMarket,
    // but reflected here so cashFlow tells the real story).
    const tileRevenue = company.controlledTiles.reduce((sum, tileId) => {
      const tile = this.state.marketTiles.get(tileId);
      return tile ? sum + tile.value * tile.controlStrength * 0.01 : sum;
    }, 0);

    const deptCost = company.departments.reduce((sum, d) => sum + d.recurringCost, 0);
    const productCost = company.products.reduce((sum, p) => sum + p.operatingCost, 0);

    let operatingCosts = Math.round(deptCost + productCost);
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
      if (tile.controllerId) {
        const controller = this.state.companies.get(tile.controllerId);
        if (controller) {
          const revenue = tile.value * tile.controlStrength * 0.01;
          controller.cash += revenue;
        }
      }

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
      if (company.cash < -500000 && company.debt > company.valuation) {
        this.triggerDefeat(company.id, 'bankruptcy');
      }
    });
  }

  private resolveRisks(_events: GameEvent[], _newsItems: NewsItem[]): void {
    this.state.companies.forEach(company => {
      if (company.securityPosture < 30 && this.rng.nextBoolean(0.1)) {
        this.triggerCyberIncident(company, _events, _newsItems);
      }
    });
  }

  private triggerCyberIncident(company: Company, events: GameEvent[], newsItems: NewsItem[]): void {
    const impact = this.rng.nextFloat(0.1, 0.3);
    company.cash *= (1 - impact);
    company.brandTrust = Math.max(0, company.brandTrust - 20);
    company.securityPosture = Math.max(10, company.securityPosture - 10);

    const event: GameEvent = {
      id: generateId.action(),
      turn: this.state.turn,
      category: 'cyber',
      title: 'Cybersecurity Incident',
      description: `${company.name} suffered a security breach`,
      impact: { cash: -company.cash * impact, brandTrust: -20, securityPosture: -10 },
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

  /** T — composite Company Power Score (0..100). Weighs the real levers the player
   *  can move through orders: relative market share, valuation, CEO S.P.E.C.I.A.L.,
   *  active trends the company is positioned in, weak signals it has exploited via
   *  products, brand trust / security, and cash health. Pure end-turn idling cannot
   *  raise this — every term depends on actions or on assets gained through play. */
  private computePowerScore(company: Company): number {
    const all = Array.from(this.state.companies.values());
    const totalMI = all.reduce((s, c) => s + c.marketInfluence, 0) || 1;
    const shareRel = company.marketInfluence / totalMI; // 0..1 (relative, not absolute)
    const valuationScore = Math.max(0, Math.min(1, Math.log10(Math.max(1e6, company.valuation) / 1e6) / Math.log10(500)));

    const ceo = company.ceos[0];
    const skillKeys: CEOSkill[] = ['strength', 'perception', 'endurance', 'charisma', 'intelligence', 'agility'];
    const skillVals = [...skillKeys.map(k => ceo?.skills?.[k] ?? 0), ceo?.luck ?? 0];
    const ceoScore = skillVals.reduce((s, v) => s + v, 0) / (skillVals.length * 10); // 0..1

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

    // Victory: real dominance — high composite power AND meaningful relative share
    // AND solvent. Idling (end-turn with no orders) leaves power far below 70 and
    // shareRel below 0.30, so it can never trigger this.
    if (power >= 70 && shareRel >= 0.30 && player.cash > 0) {
      this.state.isGameOver = true;
      this.state.victoryType = 'market_dominance';
      return;
    }

    // Defeat: player went bankrupt (handled in resolveFinancials) or got wiped out.
    if (player.cash < -500000 && player.debt > player.valuation) {
      this.state.isGameOver = true;
      this.state.victoryType = undefined;
      return;
    }

    // End of campaign: winner is the highest-power company, but only if it actually
    // achieved dominance (power >= 50). Below that, nobody "won" — idling loses.
    if (this.state.turn >= this.state.maxTurns) {
      const ranked = [...all].sort((a, b) => (b.powerScore ?? 0) - (a.powerScore ?? 0));
      const leader = ranked[0];
      this.state.isGameOver = true;
      this.state.victoryType = (leader.id === this.state.playerCompanyId && (leader.powerScore ?? 0) >= 50)
        ? 'market_dominance'
        : undefined;
    }
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

    // Cataclysms — only when the player enables them.
    if (this.state.simulation.cataclysms) {
      // Cataclysm — disaster hitting a random owned tile (control loss + building/dept damage + cash hit).
      if (this.rng.nextBoolean(0.12)) {
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
        blurb: `The market is pulling ${category.replace('_', ' ')} hard in the ${sector.replace('_', ' ')} segment. Ride it with a matching launch or campaign.`,
      });
    }
    return out;
  }

  /** Generate `count` weak signals (early hints of emerging demand). */
  private generateWeakSignals(count: number): WeakSignal[] {
    const t = this.state?.turn ?? 1;
    const cats: ProductCategory[] = ['fintech', 'cybersecurity', 'ai', 'cloud_infra', 'healthtech', 'greentech', 'data_analytics', 'blockchain', 'iot', 'biotech', 'quantum', 'ar_vr'];
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
        confidence: this.rng.nextFloat(0.25, 0.6),
        expiresTurn: t + this.rng.nextInt(3, 6),
      });
    }
    return out;
  }

  /** Refresh trends/signals each turn: drop expired, occasionally add new ones. */
  private refreshTrends(): void {
    const t = this.state.turn;
    this.state.trends = this.state.trends.filter(tr => tr.expiresTurn > t);
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
