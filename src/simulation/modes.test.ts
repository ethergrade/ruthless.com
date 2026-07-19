import { describe, expect, it } from 'vitest';
import { TurnEngine } from './turn/turnEngine';
import { createCampaignDefinition, validateCampaign } from '../data/campaigns';
import { deserializeState, serializeState } from '../data/db';
import { useGameStore } from '../store/gameStore';

describe('game mode policies', () => {
  it('keeps Free Game open-ended beyond legacy limits', () => {
    const engine = new TurnEngine(42, undefined, undefined, undefined, undefined, undefined, false, undefined, 'free_game');
    const state = engine.getState();
    expect(state.maxTurns).toBe(0);
    expect(state.modeRules.turnPolicy).toEqual({ kind: 'open' });
    const player = state.companies.get(state.playerCompanyId)!;
    player.cash = 1_000_000_000;
    player.debt = 0;
    for (let i = 0; i < 25; i++) engine.endTurn();
    expect(engine.getState().turn).toBe(26);
    expect(engine.getState().isGameOver).toBe(false);
  });

  it('limits only narrative scenarios by default', () => {
    const scenario = { id: 'rise', name: 'Rise of the Shark', mapSize: 'small' as const, aiRivals: 1, disasters: false, winConditions: [], startCash: 5_000_000 };
    const engine = new TurnEngine(4, undefined, scenario, undefined, undefined, undefined, false, undefined, 'scenario');
    expect(engine.getState().modeRules.turnPolicy).toEqual({ kind: 'limited', maxTurns: 12 });
  });

  it('does not finish live placement before three buildings', () => {
    const specs = [{ isHQ: true, deptTypes: [] }, { isHQ: false, deptTypes: [] }, { isHQ: false, deptTypes: [] }];
    const engine = new TurnEngine(8, undefined, undefined, undefined, undefined, specs, true, undefined, 'free_game');
    engine.finishPlacement();
    expect(engine.getState().phase).toBe('placement');
  });
});

describe('campaign and persistence contracts', () => {
  it('validates the default branching campaign', () => {
    expect(validateCampaign(createCampaignDefinition()).valid).toBe(true);
  });

  it('round-trips versioned saves with mode policy intact', () => {
    const state = new TurnEngine(12, undefined, undefined, undefined, undefined, undefined, false, undefined, 'sandbox').getState();
    const restored = deserializeState(serializeState(state));
    expect(restored.mode).toBe('sandbox');
    expect(restored.modeRules.victoryPolicy.kind).toBe('disabled');
    expect(restored.companies).toBeInstanceOf(Map);
  });
});

describe('sandbox audit commands', () => {
  it('undoes a God Mode mutation without adding a second audit entry', () => {
    const store = useGameStore.getState();
    store.initializeGame(77, 'Sandbox Corp', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, false, undefined, 'sandbox');
    const before = useGameStore.getState().state!;
    const playerId = before.playerCompanyId;
    const originalCash = before.companies.get(playerId)!.cash;
    useGameStore.getState().applySandboxCommand({ type: 'set_cash', companyId: playerId, value: 9_000_000 });
    expect(useGameStore.getState().state!.companies.get(playerId)!.cash).toBe(9_000_000);
    useGameStore.getState().undoSandboxCommand();
    expect(useGameStore.getState().state!.companies.get(playerId)!.cash).toBe(originalCash);
    expect(useGameStore.getState().state!.sandbox!.auditLog).toHaveLength(0);
  });
});
