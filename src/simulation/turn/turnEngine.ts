import { createRNG } from '../utils/rng';
import type { MarketSegment,
  GameState,
  Company,
  MarketTile,
  Product,
  ProductCategory,
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
  EventCategory,
  AuctionListing,
} from '../../types';
import { generateId } from '../utils/ids';
import { createMarketMap } from '../factories/marketFactory';
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

  constructor(seed?: number) {
    this.rng = createRNG(seed);
    this.state = this.initializeGameState();
    this.state.marketBriefing = this.generateMarketBriefing();
  }

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
    const playerCompany = createCompany(this.rng, 'PlayerCorp', undefined, true);
    const aiCompanies = [
      createCompany(this.rng, 'NexusTech', 'hypergrowth_platform', false, 0),
      createCompany(this.rng, 'SentinelCyber', 'security_fortress', false, 1),
      createCompany(this.rng, 'ApexDigital', 'acquisition_machine', false, 2),
    ];

    const marketTiles = createMarketMap(this.rng, 8, 8);
    this.assignStartingTerritories(marketTiles, [playerCompany, ...aiCompanies]);

    const companies = new Map<CompanyId, Company>();
    [playerCompany, ...aiCompanies].forEach(c => companies.set(c.id, c));

    // Give each corporation a starting HQ Building on its first controlled tile.
    [playerCompany, ...aiCompanies].forEach(c => this.seedCompanyBuilding(c, marketTiles));

    // Spawn neutral "start-up" corporations sitting on random tiles that the
    // player (or AI) can acquire via payment / public tender offer.
    const startups = this.spawnStartups(marketTiles, 4);

    const products = new Map<ProductId, Product>();
    [...playerCompany.products, ...aiCompanies.flatMap(c => c.products), ...startups.flatMap(c => c.products)]
      .forEach(p => products.set(p.id, p));
    [...aiCompanies, ...startups].forEach(c => companies.set(c.id, c));

    return {
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
      isGameOver: false,
      seed: this.rng.getSeed(),
    };
  }

  /** Place an HQ building for a company on its first controlled tile. */
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
    });
    tile.buildingId = id;
  }

  /** Create neutral start-up corps on random unclaimed tiles. */
  private spawnStartups(tiles: Map<string, MarketTile>, count: number): Company[] {
    const free = Array.from(tiles.values()).filter(t => !t.controllerId);
    this.rng.shuffle(free);
    const startups: Company[] = [];
    for (let i = 0; i < count && free.length > 0; i++) {
      const tile = free.pop()!;
      const c = createCompany(this.rng, undefined, undefined, false, 3 + i);
      c.isStartup = true;
      c.name = generateCompanyName(this.rng.getSeed() + i * 13 + 1);
      c.cash = this.rng.nextInt(300000, 900000);
      c.marketInfluence = this.rng.nextInt(1, 4);
      tile.controllerId = c.id;
      tile.controlStrength = this.rng.nextFloat(0.5, 0.8);
      c.controlledTiles = [tile.id];
      const id = generateId.building();
      c.buildings.push({
        id, tileId: tile.id,
        departmentIds: c.departments.slice(0, 1).map(d => d.id),
        productIds: c.products.slice(0, 1).map(p => p.id),
        firewall: 10, physicalSecurity: 10, hushMoney: 0, isHQ: true,
      });
      tile.buildingId = id;
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

    this.processPlayerActions(events, newsItems);
    this.processAIActions(events, newsItems);
    this.resolveMarket();
    this.resolveFinancials();
    this.resolveRisks(events, newsItems);
    this.resolveAuctions(newsItems);
    this.state.marketBriefing = this.generateMarketBriefing();

    this.state.turn++;
    this.checkVictoryConditions();

    return {
      newState: this.state,
      events,
      newsItems,
      marketBriefing: this.state.marketBriefing,
    };
  }

  private processPlayerActions(events: GameEvent[], newsItems: NewsItem[]): void {
    const playerActions = this.state.actions.filter(
      a => a.companyId === this.state.playerCompanyId && a.status === 'planned'
    );

    playerActions.forEach(action => {
      const outcome = this.resolveAction(action);
      action.status = outcome.success ? 'resolved' : 'failed';
      action.outcome = outcome;

      if (outcome.success) {
        newsItems.push(this.createNewsItem(
          this.state.turn,
          'product',
          `Action Executed: ${action.type}`,
          outcome.message,
          this.state.playerCompanyId,
          'minor'
        ));
      } else {
        newsItems.push(this.createNewsItem(
          this.state.turn,
          'financial',
          `Action Failed: ${action.type}`,
          outcome.message,
          this.state.playerCompanyId,
          'major'
        ));
      }
    });

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
    const weights: Record<string, Record<ActionType, number>> = {
      hypergrowth_platform: {
        build_department: 20, launch_product: 25, improve_product: 15,
        expand_market: 20, marketing_campaign: 10, hire_executive: 5,
        security_hardening: 2, ai_automation: 3, launch_consulting_practice: 1,
        scout_acquisition: 5, acquire_company: 3, raise_capital: 10, reduce_costs: 1,
        build_building: 8, industrial_espionage: 4, cyber_attack: 3, security_offline: 2,
        security_online: 2, legal_action: 2, ceo_social: 6, public_tender_offer: 4, auction_sell: 3, end_turn: 0,
      },
      security_fortress: {
        build_department: 15, launch_product: 10, improve_product: 15,
        expand_market: 5, marketing_campaign: 5, hire_executive: 10,
        security_hardening: 25, ai_automation: 5, launch_consulting_practice: 5,
        scout_acquisition: 5, acquire_company: 2, raise_capital: 5, reduce_costs: 5,
        build_building: 5, industrial_espionage: 3, cyber_attack: 4, security_offline: 8,
        security_online: 10, legal_action: 6, ceo_social: 3, public_tender_offer: 2, auction_sell: 2, end_turn: 0,
      },
      acquisition_machine: {
        build_department: 10, launch_product: 10, improve_product: 10,
        expand_market: 10, marketing_campaign: 5, hire_executive: 10,
        security_hardening: 5, ai_automation: 5, launch_consulting_practice: 5,
        scout_acquisition: 20, acquire_company: 20, raise_capital: 10, reduce_costs: 5,
        build_building: 6, industrial_espionage: 4, cyber_attack: 3, security_offline: 3,
        security_online: 3, legal_action: 5, ceo_social: 4, public_tender_offer: 12, auction_sell: 4, end_turn: 0,
      },
      lean_specialist: {
        build_department: 10, launch_product: 15, improve_product: 20,
        expand_market: 10, marketing_campaign: 10, hire_executive: 10,
        security_hardening: 10, ai_automation: 10, launch_consulting_practice: 15,
        scout_acquisition: 2, acquire_company: 2, raise_capital: 5, reduce_costs: 10,
        build_building: 4, industrial_espionage: 5, cyber_attack: 4, security_offline: 4,
        security_online: 5, legal_action: 3, ceo_social: 8, public_tender_offer: 3, auction_sell: 3, end_turn: 0,
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
      security_online: 150000,
      legal_action: 250000,
      ceo_social: 100000,
      public_tender_offer: 1500000,
      auction_sell: 0,
      end_turn: 0,
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

    const successChance = this.calculateSuccessChance(action, company);
    const success = this.rng.nextBoolean(successChance);

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
      security_online: 150000,
      legal_action: 250000,
      ceo_social: 100000,
      public_tender_offer: 1500000,
      auction_sell: 0,
      end_turn: 0,
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
      security_online: ['cybersecurity', 'ai_data'],
      legal_action: ['legal_compliance', 'corporate_strategy'],
      ceo_social: ['sales_marketing', 'corporate_strategy'],
      public_tender_offer: ['acquisitions', 'finance_investor', 'legal_compliance'],
      auction_sell: ['finance_investor', 'corporate_strategy', 'acquisitions'],
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
        this.buildDepartment(company, action.budget);
        break;
      case 'launch_product':
        this.launchProduct(company, action.budget);
        break;
      case 'improve_product':
        this.improveProduct(company, action.budget);
        break;
      case 'expand_market':
        this.expandMarket(company, action.budget);
        break;
      case 'marketing_campaign':
        this.runMarketingCampaign(company, action.budget);
        break;
      case 'hire_executive':
        this.hireExecutive(company, action.budget);
        break;
      case 'security_hardening':
        this.hardenSecurity(company, action.budget);
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
        this.acquireCompany(company, action.budget);
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
      case 'security_online':
        this.runSecurityOnline(company, action);
        break;
      case 'legal_action':
        this.runLegalAction(company, action);
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
    }

    this.recalculateCompanyMetrics(company);
  }

  private buildDepartment(company: Company, _budget: number): void {
    const deptTypes = ['product_rd', 'ai_data', 'cybersecurity', 'consulting_services', 'sales_marketing', 'acquisitions'];
    const type = this.rng.shuffle(deptTypes).pop()!;
    const level = Math.max(1, Math.floor(_budget / 200000));

    company.departments.push({
      id: generateId.department(),
      type: type as DepartmentType,
      level,
      capacity: level * 10,
      efficiency: 0.7,
      morale: 0.8,
      risk: 0.2,
      recurringCost: level * 50000,
    });
  }

  private launchProduct(company: Company, _budget: number): void {
    const categories = ['saas', 'ai', 'cybersecurity', 'consulting', 'managed_service'];
    const category = this.rng.shuffle(categories).pop()!;
    const name = `Product_${company.products.length + 1}`;

    company.products.push({
      id: generateId.product(),
      companyId: company.id,
      name,
      category: category as ProductCategory,
      maturity: 20,
      quality: 50,
      security: category === 'cybersecurity' ? 80 : 40,
      scalability: category === 'saas' ? 80 : 50,
      marketFit: 40,
      price: 10000,
      operatingCost: 5000,
      technicalDebt: 10,
      trust: 50,
      targetSegments: ['enterprise_cluster', 'high_growth'],
      tileIds: [],
    });
  }

  private improveProduct(company: Company, _budget: number): void {
    if (company.products.length === 0) return;
    const product = this.rng.shuffle([...company.products]).pop()!;
    const improvement = _budget / 100000;
    product.quality = Math.min(100, product.quality + improvement * 5);
    product.marketFit = Math.min(100, product.marketFit + improvement * 3);
    product.technicalDebt = Math.max(0, product.technicalDebt - improvement * 2);
  }

  private expandMarket(company: Company, _budget: number): void {
    const uncontrolledTiles = Array.from(this.state.marketTiles.values()).filter(
      t => t.controllerId !== company.id
    );
    if (uncontrolledTiles.length === 0) return;

    const target = this.rng.shuffle(uncontrolledTiles).pop()!;
    const strength = Math.min(0.3, _budget / 500000);
    target.controlStrength += strength;

    if (target.controllerId) {
      target.challengerId = company.id;
    } else {
      target.controllerId = company.id;
      company.controlledTiles.push(target.id);
    }
  }

  private runMarketingCampaign(company: Company, _budget: number): void {
    company.brandTrust = Math.min(100, company.brandTrust + _budget / 50000);
    company.marketInfluence = Math.min(100, company.marketInfluence + _budget / 100000);
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

  private hardenSecurity(company: Company, _budget: number): void {
    company.securityPosture = Math.min(100, company.securityPosture + _budget / 10000);
  }

  private automateAI(company: Company, _budget: number): void {
    company.aiCapability = Math.min(100, company.aiCapability + _budget / 20000);
    company.operatingCosts *= 0.95;
  }

  private launchConsultingPractice(company: Company, _budget: number): void {
    company.consultingCapacity = Math.min(100, company.consultingCapacity + _budget / 10000);
  }

  private scoutAcquisition(_company: Company): void {
    // Add M&A opportunity to market briefing
  }

  private acquireCompany(company: Company, _budget: number): void {
    if (_budget < 1000000) return;
    company.cash -= _budget;
    company.marketInfluence += 5;
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

  /** Build a new Building on a tile (cost ~750k; attaches to nearest owned building). */
  private buildNewBuilding(company: Company, action: TurnAction): void {
    const tileId = action.targetTileId;
    if (!tileId) return;
    const tile = this.state.marketTiles.get(tileId);
    if (!tile) return;
    const id = generateId.building();
    const isHQ = company.buildings.length === 0;
    company.buildings.push({
      id,
      tileId,
      departmentIds: company.departments.slice(0, 1).map(d => d.id),
      productIds: company.products.slice(0, 1).map(p => p.id),
      firewall: isHQ ? 30 : 10,
      physicalSecurity: isHQ ? 40 : 15,
      hushMoney: 0,
      isHQ,
    });
    tile.buildingId = id;
    tile.controllerId = company.id;
    tile.controlStrength = Math.max(tile.controlStrength, 0.5);
    if (!company.controlledTiles.includes(tileId)) company.controlledTiles.push(tileId);
  }

  /** Industrial espionage: steal an idea / cash / evidence from a rival. */
  private runIndustrialEspionage(company: Company, action: TurnAction): void {
    const target = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
    if (!target) return;
    const success = this.rng.nextBoolean(0.6 - (target.securityPosture / 400));
    if (!success) { company.scandal = Math.min(100, company.scandal + 8); return; }
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

  /** Cyber attack: hack a rival (data run / virus / breach) using computer points. */
  private runCyberAttack(company: Company, action: TurnAction): void {
    const target = action.targetCompanyId ? this.state.companies.get(action.targetCompanyId) : undefined;
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

  /** Offline (physical) security: guards / lockdown / sabotage defense. */
  private runSecurityOffline(company: Company, action: TurnAction): void {
    company.securityPosture = Math.min(100, company.securityPosture + action.budget / 8000);
    company.buildings.forEach(b => { b.physicalSecurity = Math.min(100, b.physicalSecurity + 4); });
  }

  /** Online (cyber) defense: firewall, virus sweep, change passwords. */
  private runSecurityOnline(company: Company, action: TurnAction): void {
    company.computerPoints += Math.round(action.budget / 2000);
    company.buildings.forEach(b => { b.firewall = Math.min(100, b.firewall + 8); });
    company.securityPosture = Math.min(100, company.securityPosture + action.budget / 12000);
  }

  /** Legal action: lawsuit / patent / dispute against a rival. */
  private runLegalAction(company: Company, action: TurnAction): void {
    company.legalPoints += Math.round(action.budget / 1000);
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
      if (idx >= 0) { const [d] = seller.departments.splice(idx, 1); if (d) { d.buildingId = undefined; winner.departments.push(d); } }
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
    // Revenue from products scaled by how much market the company actually controls.
    // quality/marketFit drive a per-product multiplier; controlled tiles add share.
    const productRevenue = company.products.reduce((sum, p) => {
      const qualityMul = 0.4 + (p.quality / 100) * 0.6;
      const fitMul = 0.3 + (p.marketFit / 100) * 0.7;
      return sum + p.price * 4 * qualityMul * fitMul;
    }, 0);

    const deptCost = company.departments.reduce((sum, d) => sum + d.recurringCost, 0);

    company.revenue = productRevenue;
    company.operatingCosts = deptCost;
    company.cashFlow = company.revenue - company.operatingCosts;
    company.valuation = Math.max(1, company.revenue * 4 + company.cash - company.debt);

    // Market influence = controlled territory + brand trust, capped at 100.
    // Expressed as a 0..100 score (controlledTiles * 2.5 + brandTrust * 0.5).
    const influence = Math.min(100, company.controlledTiles.length * 2.5 + company.brandTrust * 0.5);
    company.marketInfluence = Math.max(0, influence);
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
      company.cash -= company.debt * 0.05;
      company.debt = Math.max(0, company.debt - company.cashFlow * 0.1);
      this.recalculateCompanyMetrics(company);

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

  private checkVictoryConditions(): void {
    const player = this.state.companies.get(this.state.playerCompanyId);
    if (!player) return;

    // Victory: dominant market share AND healthy trust AND solid security.
    if (player.marketInfluence >= 45 && player.brandTrust >= 60 && player.securityPosture >= 60) {
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

    // End of campaign: decide winner by market influence.
    if (this.state.turn >= this.state.maxTurns) {
      this.state.isGameOver = true;
      const leader = Array.from(this.state.companies.values()).sort(
        (a, b) => b.marketInfluence - a.marketInfluence
      )[0];
      this.state.victoryType = leader.id === this.state.playerCompanyId
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

    return { demandShifts, globalEvents: [], competitorMoves, cyberAlerts, maOpportunities: [], clientRequests: [] };
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
