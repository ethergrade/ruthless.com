import { createRNG } from '../utils/rng';
import type { MarketSegment,
  GameState,
  Company,
  MarketTile,
  Product,
  TurnAction,
  ActionType,
  GameEvent,
  NewsItem,
  MarketBriefing,
  DemandShift,
  CompetitorMove,
  CyberAlert,
  CompanyId,
  ProductId,
  ExecutiveId,
  ActionId,
  EventCategory,
} from '../../types';
import { generateId } from '../utils/ids';
import { createMarketMap } from '../factories/marketFactory';
import { createCompany } from '../factories/companyFactory';

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
  }

  getState(): GameState {
    return this.state;
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

    const products = new Map<ProductId, Product>();
    [...playerCompany.products, ...aiCompanies.flatMap(c => c.products)].forEach(p => products.set(p.id, p));

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
      marketBriefing: this.generateMarketBriefing(),
      isGameOver: false,
      seed: this.rng.getSeed(),
    };
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
    this.generateMarketBriefing();

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
        this.applyActionEffects(action);
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

  private processAIActions(events: GameEvent[], newsItems: NewsItem[]): void {
    const aiCompanies = Array.from(this.state.companies.values()).filter(c => !c.isPlayer);

    aiCompanies.forEach(company => {
      const actions = this.generateAIActions(company);
      actions.forEach(action => {
        const outcome = this.resolveAction(action);
        action.status = outcome.success ? 'resolved' : 'failed';
        action.outcome = outcome;

        if (outcome.success) {
          this.applyActionEffects(action);
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
        scout_acquisition: 5, acquire_company: 3, raise_capital: 10, reduce_costs: 1, end_turn: 0,
      },
      security_fortress: {
        build_department: 15, launch_product: 10, improve_product: 15,
        expand_market: 5, marketing_campaign: 5, hire_executive: 10,
        security_hardening: 25, ai_automation: 5, launch_consulting_practice: 5,
        scout_acquisition: 5, acquire_company: 2, raise_capital: 5, reduce_costs: 5, end_turn: 0,
      },
      acquisition_machine: {
        build_department: 10, launch_product: 10, improve_product: 10,
        expand_market: 10, marketing_campaign: 5, hire_executive: 10,
        security_hardening: 5, ai_automation: 5, launch_consulting_practice: 5,
        scout_acquisition: 20, acquire_company: 20, raise_capital: 10, reduce_costs: 5, end_turn: 0,
      },
      lean_specialist: {
        build_department: 10, launch_product: 15, improve_product: 20,
        expand_market: 10, marketing_campaign: 10, hire_executive: 10,
        security_hardening: 10, ai_automation: 10, launch_consulting_practice: 15,
        scout_acquisition: 2, acquire_company: 2, raise_capital: 5, reduce_costs: 10, end_turn: 0,
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
    }

    this.recalculateCompanyMetrics(company);
  }

  private buildDepartment(company: Company, _budget: number): void {
    const deptTypes = ['product_rd', 'ai_data', 'cybersecurity', 'consulting_services', 'sales_marketing', 'acquisitions'];
    const type = this.rng.shuffle(deptTypes).pop()!;
    const level = Math.max(1, Math.floor(_budget / 200000));

    company.departments.push({
      id: generateId.department(),
      type: type as any,
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
      category: category as any,
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
      role: role as any,
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

  private recalculateCompanyMetrics(company: Company): void {
    company.revenue = company.products.reduce((sum, p) => sum + p.price * p.marketFit / 100 * 100, 0);
    company.operatingCosts = company.departments.reduce((sum, d) => sum + d.recurringCost, 0);
    company.cashFlow = company.revenue - company.operatingCosts;
    company.valuation = Math.max(1, company.revenue * 5 + company.cash - company.debt);
    company.marketInfluence = Math.min(100, company.controlledTiles.length * 2 + company.brandTrust * 0.5);
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

      if (company.cash < -1000000 && company.debt > company.valuation) {
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

    if (player.marketInfluence >= 45 && player.brandTrust >= 70 && player.securityPosture >= 60) {
      this.state.isGameOver = true;
      this.state.victoryType = 'market_dominance';
    }

    if (this.state.turn >= this.state.maxTurns) {
      this.state.isGameOver = true;
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
