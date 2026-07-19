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
});

describe('Action application (regression: double-application)', () => {
  it('build_department creates exactly ONE department per action', () => {
    const engine = new TurnEngine(123);
    const id = engine.getState().playerCompanyId;
    const before = engine.getState().companies.get(id)!.departments.length;
    planPlayerAction(engine, 'build_department', 600000);
    engine.endTurn();
    const after = engine.getState().companies.get(id)!.departments.length;
    expect(after - before).toBe(1);
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
