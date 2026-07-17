import { describe, it, expect } from 'vitest';
import { TurnEngine } from './turn/turnEngine';
import { MiniDB, serializeState, deserializeState } from '../data/db';

describe('Fase 3 — save/load survives Maps (mini-db)', () => {
  it('serialize -> deserialize preserves companies Map and tiles', () => {
    const engine = new TurnEngine(31337);
    const original = engine.getState();
    const json = serializeState(original);
    const restored = deserializeState(json);

    expect(restored.companies instanceof Map).toBe(true);
    expect(restored.marketTiles instanceof Map).toBe(true);
    expect(restored.companies.size).toBe(original.companies.size);
    expect(restored.marketTiles.size).toBe(original.marketTiles.size);
    expect(restored.companies.get(original.playerCompanyId)?.name).toBe(
      original.companies.get(original.playerCompanyId)?.name
    );
  });

  it('MiniDB autosave/load round-trips a played game', () => {
    const engine = new TurnEngine(4242);
    // play a few turns
    for (let i = 0; i < 3; i++) engine.endTurn();
    const before = engine.getState();
    MiniDB.autosave(before);

    const loaded = MiniDB.loadAuto();
    expect(loaded).not.toBeNull();
    expect(loaded!.turn).toBe(before.turn);
    expect(loaded!.companies.size).toBe(before.companies.size);

    // continue from loaded state
    const reloadedEngine = new TurnEngine(loaded!.seed);
    reloadedEngine.setState(loaded!);
    reloadedEngine.endTurn();
    expect(reloadedEngine.getState().turn).toBe(before.turn + 1);
  });
});

describe('Fase 3 — economy is balanced (no idle runaway)', () => {
  it('idle player does NOT balloon to tens of millions', () => {
    const engine = new TurnEngine(7);
    const id = engine.getState().playerCompanyId;
    for (let i = 0; i < 10; i++) engine.endTurn();
    const cash = engine.getState().companies.get(id)!.cash;
    // starting cash is 5,000,000; idle play should not multiply it grossly
    expect(cash).toBeLessThan(20_000_000);
  });

  it('market influence responds to expanding the market', () => {
    const engine = new TurnEngine(909);
    const id = engine.getState().playerCompanyId;
    const start = engine.getState().companies.get(id)!.marketInfluence;
    for (let i = 0; i < 6; i++) {
      engine.getState().actions.push({
        id: `e${i}`, companyId: id, type: 'expand_market', budget: 300000, priority: 1, status: 'planned',
      });
      engine.endTurn();
    }
    const end = engine.getState().companies.get(id)!.marketInfluence;
    expect(end).toBeGreaterThan(start);
  });
});
