import { describe, it, expect } from 'vitest';
import { TurnEngine } from './turn/turnEngine';
import type { TurnAction } from '../types';

function planPlayerAction(engine: TurnEngine, type: TurnAction['type'], budget: number): void {
  const state = engine.getState();
  state.actions.push({
    id: `test_${type}_${Math.random()}`,
    companyId: state.playerCompanyId,
    type,
    budget,
    priority: 1,
    status: 'planned',
  });
}

describe('TurnEngine construction', () => {
  it('constructs without throwing (regression: used to crash on generateMarketBriefing)', () => {
    expect(() => new TurnEngine(123)).not.toThrow();
  });

  it('produces a valid initial state', () => {
    const engine = new TurnEngine(123);
    const s = engine.getState();
    expect(s.companies.size).toBe(8);
    expect(s.marketTiles.size).toBe(81); // 9x9 region (radius 4 around origin) for the infinite map
    expect(s.turn).toBe(1);
    expect(s.playerCompanyId).toBeTruthy();
  });

  it('creates a real three-building player network for a new Scenario', () => {
    const engine = new TurnEngine(124);
    const state = engine.getState();
    const player = state.companies.get(state.playerCompanyId)!;
    expect(player.buildings).toHaveLength(3);
    expect(new Set(player.buildings.map(building => building.tileId)).size).toBe(3);
    const [hq, ...branches] = player.buildings;
    expect(hq.isHQ).toBe(true);
    expect(hq.name).toBe(`${player.name} Headquarters`);
    expect(hq.departmentIds).toEqual(player.departments.map(department => department.id));
    expect(player.departments.every(department => department.buildingId === hq.id)).toBe(true);
    expect(branches.map(building => building.departmentIds)).toEqual([[], []]);
    expect(branches.map(building => building.productIds)).toEqual([[], []]);
    player.buildings.forEach(building => {
      expect(state.marketTiles.get(building.tileId)?.buildingId).toBe(building.id);
      expect(state.marketTiles.get(building.tileId)?.controllerId).toBe(player.id);
    });
  });

  it('creates real starting buildings for rival corporations too', () => {
    const engine = new TurnEngine(125);
    const state = engine.getState();
    const rivals = [...state.companies.values()].filter(company => company.kind === 'rival');
    rivals.forEach(rival => {
      expect(rival.buildings).toHaveLength(rival.controlledTiles.length);
      expect(rival.buildings.every(building => state.marketTiles.get(building.tileId)?.buildingId === building.id)).toBe(true);
    });
  });
});

describe('Action application (regression: double-application)', () => {
  it('build_department creates exactly ONE department per action', () => {
    const engine = new TurnEngine(123);
    const id = engine.getState().playerCompanyId;
    const company = engine.getState().companies.get(id)!;
    const before = company.departments.length;
    const target = company.buildings.find(building => building.departmentIds.length + (building.isHQ ? 1 : 0) < building.maxDepartments)!;
    planPlayerAction(engine, 'build_department', 600000);
    engine.getState().actions.at(-1)!.targetTileId = target.tileId;
    engine.endTurn();
    const after = company.departments.length;
    expect(after - before).toBe(1);
    expect(target.departmentIds).toContain(company.departments.at(-1)!.id);
  });

  it('can build one department in each initially empty branch', () => {
    const engine = new TurnEngine(126);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    company.cash = 10_000_000;
    company.executiveOrderLimit = 5;
    const branches = company.buildings.filter(building => !building.isHQ);
    branches.forEach((building, index) => state.actions.push({
      id: `branch_department_${index}`, companyId: company.id, type: 'build_department',
      targetTileId: building.tileId, departmentType: index === 0 ? 'legal_compliance' : 'people_culture',
      budget: 500_000, priority: index + 1, status: 'planned',
    }));

    engine.endTurn();

    expect(branches[0].departmentIds).toHaveLength(1);
    expect(branches[1].departmentIds).toHaveLength(1);
    expect(company.departments.find(department => department.id === branches[0].departmentIds[0])?.buildingId).toBe(branches[0].id);
    expect(company.departments.find(department => department.id === branches[1].departmentIds[0])?.buildingId).toBe(branches[1].id);
  });

  it('rejects a selected building with no free department slots', () => {
    const engine = new TurnEngine(127);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    company.cash = 10_000_000;
    const branch = company.buildings.find(building => !building.isHQ)!;
    branch.departmentIds = Array.from({ length: branch.maxDepartments }, (_, index) => `occupied_${index}` as typeof branch.departmentIds[number]);
    state.actions.push({
      id: 'full_branch_department', companyId: company.id, type: 'build_department',
      targetTileId: branch.tileId, departmentType: 'legal_compliance', budget: 500_000,
      priority: 1, status: 'planned',
    });

    engine.endTurn();

    expect(state.actionHistory.find(action => action.id === 'full_branch_department')?.outcome?.message).toContain('no free department slots');
  });

  it('launch_product creates exactly ONE product per action', () => {
    const engine = new TurnEngine(456);
    const id = engine.getState().playerCompanyId;
    const before = engine.getState().companies.get(id)!.products.length;
    planPlayerAction(engine, 'launch_product', 300000);
    engine.endTurn();
    const after = engine.getState().companies.get(id)!.products.length;
    expect(after - before).toBe(1);
  });
});

describe('Market influence responds to play', () => {
  it('market influence increases when the player expands market / captures tiles', () => {
    const engine = new TurnEngine(789);
    const id = engine.getState().playerCompanyId;
    const start = engine.getState().companies.get(id)!.marketInfluence;
    for (let i = 0; i < 5; i++) {
      planPlayerAction(engine, 'expand_market', 300000);
      engine.endTurn();
    }
    const end = engine.getState().companies.get(id)!.marketInfluence;
    expect(end).toBeGreaterThan(start);
  });
});

describe('Market briefing refreshes each turn', () => {
  it('is regenerated after endTurn', () => {
    const engine = new TurnEngine(99);
    const b1 = engine.getState().marketBriefing;
    engine.endTurn();
    const b2 = engine.getState().marketBriefing;
    expect(b1).not.toBe(b2);
  });
});

describe('Company acquisitions', () => {
  it('moves every acquired building and its operating assets to the buyer', () => {
    const engine = new TurnEngine(909);
    const state = engine.getState();
    const player = state.companies.get(state.playerCompanyId)!;
    const target = [...state.companies.values()].find(company => company.kind === 'rival')!;

    // Keep this integration test focused on the player's deal.
    state.companies.forEach(company => {
      if (!company.isPlayer) company.kind = 'startup';
    });
    const acquiredBuildingIds = target.buildings.map(building => building.id);
    const acquiredDepartmentIds = target.departments.map(department => department.id);
    const acquiredProductIds = target.products.map(product => product.id);
    const acquiredTileIds = target.buildings.map(building => building.tileId);
    const playerBuildingCount = player.buildings.length;

    player.cash = 10_000_000;
    target.valuation = 1_500_000;
    state.actions.push({
      id: 'acquire_all_buildings', companyId: player.id, type: 'acquire_company',
      targetCompanyId: target.id, budget: 1_200_000, priority: 1, status: 'planned',
    });

    engine.endTurn();

    expect(player.buildings).toHaveLength(playerBuildingCount + acquiredBuildingIds.length);
    expect(acquiredBuildingIds.every(id => player.buildings.some(building => building.id === id))).toBe(true);
    expect(acquiredDepartmentIds.every(id => player.departments.some(department => department.id === id))).toBe(true);
    expect(acquiredProductIds.every(id => player.products.some(product => product.id === id))).toBe(true);
    expect(acquiredProductIds.every(id => state.products.get(id)?.companyId === player.id)).toBe(true);
    expect(target.buildings).toHaveLength(0);
    expect(state.companies.has(target.id)).toBe(false);
    expect(player.acquisitions).toBeGreaterThanOrEqual(1);
    acquiredTileIds.forEach(tileId => {
      expect(state.marketTiles.get(tileId)?.controllerId).toBe(player.id);
      expect(player.controlledTiles).toContain(tileId);
      expect(target.controlledTiles).not.toContain(tileId);
    });
  });

  it('creates a visible positive or negative M&A shock after a successful deal', () => {
    const engine = new TurnEngine(910);
    const state = engine.getState();
    const player = state.companies.get(state.playerCompanyId)!;
    const target = [...state.companies.values()].find(company => company.kind === 'rival')!;
    state.companies.forEach(company => {
      if (!company.isPlayer) company.kind = 'startup';
    });

    player.cash = 10_000_000;
    target.valuation = 1_500_000;
    state.actions.push({
      id: 'acquisition_market_shock', companyId: player.id, type: 'acquire_company',
      targetCompanyId: target.id, budget: 1_200_000, priority: 1, status: 'planned',
    });

    engine.endTurn();

    const shift = state.marketBriefing.demandShifts.find(item => item.reason.includes(target.name));
    const event = state.marketBriefing.globalEvents.find(item =>
      item.kind === 'ma' && item.affectedCompanies.includes(target.id));
    expect(shift).toBeDefined();
    expect(Math.abs(shift!.change)).toBeGreaterThanOrEqual(0.06);
    expect(Math.abs(shift!.change)).toBeLessThanOrEqual(0.18);
    expect(event?.title).toBe(shift!.change > 0 ? 'Acquisition Rally' : 'Acquisition Backlash');
    expect(state.alerts.at(-1)?.body).toContain(target.name);
  });
});

describe('R&D idea capacity and global trend timing', () => {
  it('creates at most one idea per R&D department in the same turn', () => {
    const engine = new TurnEngine(2026);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    company.cash = 10_000_000;
    company.executiveOrderLimit = 5;
    company.departments = company.departments.filter(department => department.type !== 'product_rd');
    company.departments.push({
      id: 'rd_cap_test', type: 'product_rd', level: 1, capacity: 10,
      efficiency: 0.8, morale: 0.8, risk: 0.1, recurringCost: 1,
    });
    const before = company.ideas.length;
    planPlayerAction(engine, 'create_ideas', 400_000);
    planPlayerAction(engine, 'create_ideas', 400_000);

    engine.endTurn();

    expect(company.ideas.length - before).toBe(1);
    const ideaOrders = state.actionHistory.filter(action => action.type === 'create_ideas');
    expect(ideaOrders).toHaveLength(2);
    expect(ideaOrders.filter(action => action.status === 'failed')).toHaveLength(1);
    expect(ideaOrders.find(action => action.status === 'failed')?.outcome?.message).toContain('R&D capacity exhausted');
  });

  it('fades an ignored trend after its two-turn window and caps a late product', () => {
    const engine = new TurnEngine(77);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    company.cash = 50_000_000;
    company.executiveOrderLimit = 5;
    state.trends = [{
      id: 'trend_deadline_test', title: 'AI procurement wave', category: 'ai',
      sector: 'enterprise_cluster', strength: 0.95, appearedTurn: 1,
      decisionDeadlineTurn: 3, expiresTurn: 8, blurb: 'A short window.',
    }];
    state.trendHistory = [];

    engine.endTurn();
    engine.endTurn();
    engine.endTurn();

    expect(state.turn).toBe(4);
    expect(state.trends.some(trend => trend.id === 'trend_deadline_test')).toBe(false);
    expect(state.trendHistory.find(entry => entry.trend.id === 'trend_deadline_test')?.outcome).toBe('missed');
    state.trends = state.trends.filter(trend => trend.category !== 'ai');
    state.actions.push({
      id: 'late_launch', companyId: state.playerCompanyId, type: 'launch_product',
      productCategory: 'ai', productName: 'Late AI', budget: 300_000,
      priority: 1, status: 'planned',
    });

    engine.endTurn();

    const launched = company.products.find(product => product.name === 'Late AI')!;
    expect(launched.trendTiming).toBe('late');
    expect(launched.marketFit).toBeLessThanOrEqual(60);
    expect(launched.quality).toBeLessThanOrEqual(70);
  });
});

describe('Compute and cybersecurity capacity', () => {
  it('migrates legacy computer points and initializes new product/building capacity fields', () => {
    const engine = new TurnEngine(600);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    company.computerPoints = 37;
    const legacyCompany = company as unknown as { computePoints?: number; cybersecurityPoints?: number };
    const legacyProduct = company.products[0] as unknown as { computePoints?: number; lastTurnRevenue?: number; lastTurnMargin?: number };
    const legacyBuilding = company.buildings[0] as unknown as { cybersecurityPoints?: number };
    delete legacyCompany.computePoints;
    delete legacyCompany.cybersecurityPoints;
    delete legacyProduct.computePoints;
    delete legacyProduct.lastTurnRevenue;
    delete legacyProduct.lastTurnMargin;
    delete legacyBuilding.cybersecurityPoints;

    engine.setState(state);

    expect(company.computePoints).toBe(37);
    expect(company.cybersecurityPoints).toBe(0);
    expect(company.products[0].computePoints).toBe(0);
    expect(company.buildings[0].cybersecurityPoints).toBe(0);
  });

  it('allocates compute to a product and compounds it only when the product has healthy margins', () => {
    const engine = new TurnEngine(601);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    state.companies = new Map([[company.id, company]]);
    company.cash = 10_000_000;
    company.computePoints = 20;
    company.computerPoints = 20;
    const hq = company.buildings.find(building => building.isHQ)!;
    const aiDepartment = {
      ...company.departments[0], id: 'ai_capacity_test', type: 'ai_data' as const,
      buildingId: hq.id, level: 1, efficiency: 1,
    };
    company.departments.push(aiDepartment);
    hq.departmentIds.push(aiDepartment.id);
    const product = company.products[0];
    product.lifecycleStage = 'mature';
    product.quality = 100;
    product.marketFit = 100;
    product.adopters = 0.8;
    product.price = 50_000;
    product.operatingCost = 1_000;
    state.actions.push({
      id: 'allocate_compute_test', companyId: company.id, type: 'allocate_compute',
      targetProductId: product.id, resourcePoints: 10, budget: 0,
      priority: 1, status: 'planned',
    });

    engine.endTurn();

    expect(product.lastTurnMargin).toBeGreaterThanOrEqual(0.25);
    expect(product.computePoints).toBeGreaterThan(10);
    expect(company.computePoints).toBeGreaterThan(10);
    expect(company.computerPoints).toBe(company.computePoints);
  });

  it('decays product compute when its operating margin cannot sustain the allocation', () => {
    const engine = new TurnEngine(602);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    state.companies = new Map([[company.id, company]]);
    const product = company.products[0];
    product.computePoints = 20;
    product.price = 1;
    product.operatingCost = 1_000_000;

    engine.endTurn();

    expect(product.lastTurnMargin).toBeLessThan(0.05);
    expect(product.computePoints).toBe(18);
  });

  it('assigns cybersecurity points to an owned building as a spendable resilience layer', () => {
    const engine = new TurnEngine(603);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    state.companies = new Map([[company.id, company]]);
    company.cybersecurityPoints = 20;
    const building = company.buildings[0];
    state.actions.push({
      id: 'allocate_cyber_test', companyId: company.id, type: 'allocate_cybersecurity',
      targetTileId: building.tileId, resourcePoints: 15, budget: 0,
      priority: 1, status: 'planned',
    });

    engine.endTurn();

    expect(building.cybersecurityPoints).toBe(15);
    expect(company.cybersecurityPoints).toBeGreaterThanOrEqual(5);
  });

  it('preserves R&D data when assigned cyber resilience contains the attack', () => {
    const engine = new TurnEngine(604);
    const state = engine.getState();
    const attacker = state.companies.get(state.playerCompanyId)!;
    const target = [...state.companies.values()].find(company => company.id !== attacker.id)!;
    const building = target.buildings[0];
    const idea = { id: 'shielded_idea', name: 'Shielded Research', category: 'ai' as const, maturity: 80, breakthrough: true, companyId: target.id, createdTurn: 1 };
    target.ideas = [idea];
    state.inventions.push(idea);
    building.cybersecurityPoints = 100;
    building.firewall = 100;
    target.securityPosture = 100;
    attacker.computePoints = 20;
    attacker.computerPoints = 20;
    const invoke = (engine as unknown as { runCyberAttack: (company: typeof attacker, action: TurnAction) => void }).runCyberAttack.bind(engine);

    invoke(attacker, {
      id: 'contained_attack', companyId: attacker.id, type: 'cyber_attack',
      targetCompanyId: target.id, targetTileId: building.tileId, resourcePoints: 10,
      budget: 250_000, priority: 1, status: 'planned',
    });

    expect(target.ideas).toContain(idea);
    expect(idea.maturity).toBe(80);
    expect(building.cybersecurityPoints).toBeLessThan(100);
  });

  it('permanently steals or destroys an idea when both cyber resilience and firewall reach zero', () => {
    const engine = new TurnEngine(605);
    const state = engine.getState();
    const attacker = state.companies.get(state.playerCompanyId)!;
    const target = [...state.companies.values()].find(company => company.id !== attacker.id)!;
    const building = target.buildings[0];
    const idea = { id: 'critical_idea', name: 'Critical Research', category: 'quantum' as const, maturity: 95, breakthrough: true, companyId: target.id, createdTurn: 1 };
    target.ideas = [idea];
    state.inventions.push(idea);
    building.cybersecurityPoints = 0;
    building.firewall = 0;
    target.securityPosture = 0;
    attacker.computePoints = 100;
    attacker.computerPoints = 100;
    attacker.aiCapability = 100;
    const invoke = (engine as unknown as { runCyberAttack: (company: typeof attacker, action: TurnAction) => void }).runCyberAttack.bind(engine);

    invoke(attacker, {
      id: 'critical_attack', companyId: attacker.id, type: 'cyber_attack',
      targetCompanyId: target.id, targetTileId: building.tileId, resourcePoints: 50,
      budget: 250_000, priority: 1, status: 'planned',
    });

    expect(target.ideas.some(candidate => candidate.id === idea.id)).toBe(false);
    const stolen = attacker.ideas.some(candidate => candidate.id === idea.id);
    const destroyed = !state.inventions.some(candidate => candidate.id === idea.id);
    expect(stolen || destroyed).toBe(true);
  });
});

describe('Building placement', () => {
  it('builds only on an empty legal tile and creates an empty building', () => {
    const engine = new TurnEngine(404);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    company.cash = 10_000_000;
    const tile = [...state.marketTiles.values()].find(candidate => !candidate.controllerId && !candidate.buildingId)!;
    state.actions.push({
      id: 'empty_building', companyId: company.id, type: 'build_building',
      targetTileId: tile.id, buildingName: 'EMPTY TOWER', budget: 750_000,
      priority: 1, status: 'planned',
    });

    engine.endTurn();

    const building = company.buildings.find(candidate => candidate.name === 'EMPTY TOWER')!;
    expect(building.tileId).toBe(tile.id);
    expect(building.departmentIds).toEqual([]);
    expect(building.productIds).toEqual([]);
  });

  it('rejects an occupied tile before creating a building', () => {
    const engine = new TurnEngine(405);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    company.cash = 10_000_000;
    const occupied = [...state.marketTiles.values()].find(tile => Boolean(tile.buildingId))!;
    const before = company.buildings.length;
    state.actions.push({
      id: 'occupied_building', companyId: company.id, type: 'build_building',
      targetTileId: occupied.id, budget: 750_000, priority: 1, status: 'planned',
    });

    engine.endTurn();

    expect(company.buildings).toHaveLength(before);
    expect(state.actionHistory.find(action => action.id === 'occupied_building')?.outcome?.message).toContain('Tile occupied');
  });
});

describe('Physical Security targeting', () => {
  it('reinforces only the selected player-owned building', () => {
    const engine = new TurnEngine(510);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    company.cash = 10_000_000;
    const target = company.buildings[0];
    const untouched = company.buildings[1];
    target.physicalSecurity = 10;
    if (untouched) untouched.physicalSecurity = 10;
    state.actions.push({
      id: 'physical_defense', companyId: company.id, type: 'security_offline',
      targetTileId: target.tileId, budget: 200_000, priority: 1, status: 'planned',
    });

    engine.endTurn();

    expect(target.physicalSecurity).toBeGreaterThan(10);
    if (untouched) expect(untouched.physicalSecurity).toBe(10);
  });

  it('rejects a rival building as a Physical Security target', () => {
    const engine = new TurnEngine(511);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    company.cash = 10_000_000;
    const rival = [...state.companies.values()].find(candidate => candidate.id !== company.id && candidate.buildings.length > 0)!;
    const target = rival.buildings[0];
    const before = target.physicalSecurity;
    state.actions.push({
      id: 'invalid_physical_defense', companyId: company.id, type: 'security_offline',
      targetTileId: target.tileId, budget: 200_000, priority: 1, status: 'planned',
    });

    engine.endTurn();

    expect(target.physicalSecurity).toBe(before);
    expect(state.actionHistory.find(action => action.id === 'invalid_physical_defense')?.outcome?.message).toContain('must target one of your buildings');
  });
});

describe('Sabotage Building targeting', () => {
  it('rejects the player own building as a sabotage target', () => {
    const engine = new TurnEngine(610);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    company.cash = 10_000_000;
    const ownBuilding = company.buildings[0];
    state.actions.push({
      id: 'self_sabotage', companyId: company.id, type: 'sabotage_building',
      targetTileId: ownBuilding.tileId, budget: 300_000, priority: 1, status: 'planned',
    });

    engine.endTurn();

    expect(state.actionHistory.find(action => action.id === 'self_sabotage')?.outcome?.message).toContain('opponent building');
  });

  it('rejects rival territory when no actual building is present', () => {
    const engine = new TurnEngine(611);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    company.cash = 10_000_000;
    const rivalTerritory = [...state.marketTiles.values()].find(tile => tile.controllerId && tile.controllerId !== company.id && !tile.buildingId)!;
    state.actions.push({
      id: 'empty_tile_sabotage', companyId: company.id, type: 'sabotage_building',
      targetTileId: rivalTerritory.id, budget: 300_000, priority: 1, status: 'planned',
    });

    engine.endTurn();

    expect(state.actionHistory.find(action => action.id === 'empty_tile_sabotage')?.outcome?.message).toContain('opponent building');
  });
});

describe('Defend Building targeting', () => {
  it('reinforces a selected owned building', () => {
    const engine = new TurnEngine(710);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    company.cash = 10_000_000;
    const building = company.buildings[0];
    building.firewall = 10;
    building.physicalSecurity = 10;
    state.actions.push({
      id: 'defend_building', companyId: company.id, type: 'defend_tile',
      targetTileId: building.tileId, budget: 150_000, priority: 1, status: 'planned',
    });

    engine.endTurn();

    expect(state.actionHistory.find(action => action.id === 'defend_building')?.status).toBe('resolved');
    expect(building.firewall).toBeGreaterThan(10);
    expect(building.physicalSecurity).toBeGreaterThan(10);
  });

  it('rejects owned territory without a building', () => {
    const engine = new TurnEngine(711);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    company.cash = 10_000_000;
    const emptyOwnedTile = state.marketTiles.get(company.controlledTiles[0])!;
    emptyOwnedTile.buildingId = undefined;
    state.actions.push({
      id: 'defend_empty_tile', companyId: company.id, type: 'defend_tile',
      targetTileId: emptyOwnedTile.id, budget: 150_000, priority: 1, status: 'planned',
    });

    engine.endTurn();

    expect(state.actionHistory.find(action => action.id === 'defend_empty_tile')?.outcome?.message).toContain('one of your buildings');
  });
});

describe('Industrial Espionage targeting', () => {
  it('requires an exact department belonging to the selected opponent', () => {
    const engine = new TurnEngine(810);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    company.cash = 10_000_000;
    const opponent = [...state.companies.values()].find(candidate => candidate.id !== company.id)!;
    state.actions.push({
      id: 'wrong_spy_department', companyId: company.id, type: 'industrial_espionage',
      targetCompanyId: opponent.id, targetDepartmentId: company.departments[0].id,
      budget: 200_000, priority: 1, status: 'planned',
    });

    engine.endTurn();

    expect(state.actionHistory.find(action => action.id === 'wrong_spy_department')?.outcome?.message).toContain('belonging to the opponent');
  });
});

describe('Cyber Attack targeting', () => {
  it('requires a building belonging to the selected target corporation', () => {
    const engine = new TurnEngine(910);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    company.cash = 10_000_000;
    const rivals = [...state.companies.values()].filter(candidate => candidate.id !== company.id && candidate.buildings.length > 0);
    const target = rivals[0];
    const otherCorporationBuilding = rivals[1].buildings[0];
    state.actions.push({
      id: 'mismatched_cyber_building', companyId: company.id, type: 'cyber_attack',
      targetCompanyId: target.id, targetTileId: otherCorporationBuilding.tileId,
      budget: 250_000, priority: 1, status: 'planned',
    });

    engine.endTurn();

    expect(state.actionHistory.find(action => action.id === 'mismatched_cyber_building')?.outcome?.message).toContain('belonging to the target corporation');
  });
});
