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
