import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  GameState, TurnAction, NewsItem, MarketBriefing, MarketTile,
  CompanyId, TileId, CompanyArchetype,
  CEOTrait, ScenarioConfig, AlertItem, CeoBuild, InitialBuildingSpec,
  GameMode, GameModeRules, SandboxCommand,
} from '../types';
import { TurnEngine } from '../simulation/turn/turnEngine';
import { MiniDB } from '../data/db';
import { generateId } from '../simulation/utils/ids';
import { audio } from '../audio/AudioEngine';
import { useSettings } from './settings';

interface GameStore {
  state: GameState | null;
  engine: TurnEngine | null;
  initialBuildings: InitialBuildingSpec[];
  selectedTileId: TileId | null;
  selectedCompanyId: CompanyId | null;
  ui: {
    activePanel: string | null;
    showActionModal: boolean;
    pendingAction: Partial<TurnAction> | null;
    notifications: string[];
  };

  initializeGame: (seed?: number, companyName?: string, archetype?: CompanyArchetype, color?: string, disasters?: boolean, ceoTrait?: CEOTrait, scenario?: ScenarioConfig, statOverrides?: Partial<Record<string, number>>, ceoBuild?: CeoBuild, sim?: { marketSimulation: boolean; cataclysms: boolean; newTech: boolean }, initialBuildings?: InitialBuildingSpec[], realMapPlacement?: boolean, mapSeed?: number, mode?: GameMode, modeRules?: Partial<GameModeRules>) => void;
  /** T: real-map placement — drop a player building on a real tile, or finish placement (spawn rivals). */
  placeBuilding: (spec: InitialBuildingSpec) => void;
  finishPlacement: () => void;
  /** T — infinite map: stream tiles around a grid cell on demand. */
  explore: (cx: number, cy: number, radius?: number) => void;
  setState: (state: GameState) => void;
  endTurn: () => void;
  addAction: (action: Omit<TurnAction, 'id' | 'status'>) => void;
  removeAction: (actionId: string) => void;
  selectTile: (tileId: TileId | null) => void;
  selectCompany: (companyId: CompanyId | null) => void;
  setActivePanel: (panel: string | null) => void;
  setShowActionModal: (show: boolean, action?: Partial<TurnAction>) => void;
  addNotification: (title: string, body: string, importance?: 'minor' | 'major' | 'critical') => void;
  dismissNotification: (index: number) => void;
  clearNotifications: () => void;
  addNewsItem: (item: NewsItem) => void;
  setMarketBriefing: (briefing: MarketBriefing) => void;
  loadGame: () => boolean;
  saveGame: (slot?: string) => boolean;
  loadSlot: (slot: string) => boolean;
  hasAutosave: () => boolean;
  estimateAction: (action: Omit<TurnAction, 'id' | 'status'>) => number;
  acknowledgeVictory: (milestoneId: string) => void;
  continueAfterVictory: () => void;
  retireRun: () => void;
  applySandboxCommand: (command: Omit<SandboxCommand, 'id' | 'createdAt'>) => void;
  undoSandboxCommand: () => void;
}

const initialUI = {
  activePanel: null,
  showActionModal: false,
  pendingAction: null,
  notifications: [],
};

export const useGameStore = create<GameStore>()(
  devtools(
    (set, get) => ({
      state: null,
      engine: null,
      initialBuildings: [] as InitialBuildingSpec[],
      selectedTileId: null,
      selectedCompanyId: null,
      ui: initialUI,

      initializeGame: (seed?: number, companyName?: string, archetype?: CompanyArchetype, color?: string, disasters?: boolean, ceoTrait?: CEOTrait, scenario?: ScenarioConfig, statOverrides?: Partial<Record<string, number>>, ceoBuild?: CeoBuild, sim?: { marketSimulation: boolean; cataclysms: boolean; newTech: boolean }, initialBuildings?: InitialBuildingSpec[], realMapPlacement?: boolean, mapSeed?: number, mode?: GameMode, modeRules?: Partial<GameModeRules>) => {
        const engine = new TurnEngine(seed, ceoTrait, scenario, statOverrides, ceoBuild, initialBuildings, realMapPlacement, mapSeed, mode, modeRules);
        const state = engine.getState();
        if (companyName?.trim() || archetype || color || disasters !== undefined || sim) {
          const player = state.companies.get(state.playerCompanyId);
          if (player) {
            if (companyName?.trim()) player.name = companyName.trim();
            if (archetype) player.archetype = archetype;
            if (color) player.color = color;
            // T: granular simulation toggles (legacy `disasters` still maps to all-on).
            state.simulation = sim ?? (disasters !== undefined
              ? { marketSimulation: disasters, cataclysms: disasters, newTech: disasters }
              : { marketSimulation: false, cataclysms: false, newTech: false });
            engine.setState(state);
          }
        }
        set({ state: engine.getState(), engine, initialBuildings: initialBuildings ?? [], selectedTileId: null, selectedCompanyId: state.playerCompanyId, ui: initialUI });
      },

      placeBuilding: (spec: InitialBuildingSpec) => {
        const { engine, state } = get();
        if (!engine || !state || state.phase !== 'placement') return;
        engine.placePlayerBuilding(spec);
        set({ state: engine.getState() });
      },

      finishPlacement: () => {
        const { engine, state } = get();
        if (!engine || !state || state.phase !== 'placement') return;
        engine.finishPlacement();
        set({ state: engine.getState() });
      },

      // T — infinite map: stream tiles around a grid cell on demand (camera pan).
      explore: (cx: number, cy: number, radius = 10) => {
        const { engine, state } = get();
        if (!engine || !state) return;
        const fresh = engine.explore(cx, cy, radius);
        if (fresh.length) set({ state: engine.getState() });
      },

      setState: (newState) => set({ state: newState }),

      endTurn: () => {
        const { engine, state } = get();
        if (!engine || !state) return;

        const result = engine.endTurn();
        set({ state: result.newState });
        if (useSettings.getState().sfxEnabled) audio.sfx('endTurn');

        // Persist progress automatically so the player never loses their game.
        MiniDB.autosave(result.newState);

        if (result.newsItems.length > 0) {
          result.newsItems.forEach(item => {
            if (item.importance === 'critical' || item.importance === 'major') {
              get().addNotification(item.headline, item.body, item.importance);
              if (useSettings.getState().sfxEnabled) audio.sfx('newsAlert');
            }
          });
        }

        if (result.newState.isGameOver) {
          get().addNotification(result.newState.victoryType ? 'VICTORY!' : 'DEFEAT', '', 'critical');
        }
      },

      addAction: (action) =>
        set((prev) => {
          if (!prev.state) return {};
          const player = prev.state.companies.get(prev.state.playerCompanyId);
          const planned = prev.state.actions.filter(a => a.companyId === action.companyId && a.status === 'planned');
          if (!player || action.budget < 0 || action.budget > player.cash || planned.length >= player.executiveOrderLimit) return {};
          const pursuedTrend = action.trendId
            ? prev.state.trends.find(trend => trend.id === action.trendId)
            : undefined;
          if (action.trendId && !pursuedTrend) return {};
          const next = {
            ...prev.state,
            actions: [...prev.state.actions, { ...action, id: generateId.action(), status: 'planned' as const }],
            trends: pursuedTrend
              ? prev.state.trends.filter(trend => trend.id !== pursuedTrend.id)
              : prev.state.trends,
            trendHistory: pursuedTrend
              ? [...prev.state.trendHistory, {
                  trend: pursuedTrend,
                  outcome: 'pursued' as const,
                  resolvedTurn: prev.state.turn,
                  companyId: action.companyId,
                }].slice(-40)
              : prev.state.trendHistory,
          };
          get().engine?.setState(next);
          if (useSettings.getState().sfxEnabled) audio.sfx('orderPlaced');
          return { state: next };
        }),

      removeAction: (actionId) =>
        set((prev) => {
          if (!prev.state) return {};
          const removed = prev.state.actions.find(action => action.id === actionId && action.status === 'planned');
          const captured = removed?.trendId
            ? prev.state.trendHistory.find(entry => entry.trend.id === removed.trendId && entry.outcome === 'pursued')
            : undefined;
          const restoreTrend = captured && captured.trend.decisionDeadlineTurn >= prev.state.turn;
          const next = {
            ...prev.state,
            actions: prev.state.actions.filter((a) => a.id !== actionId),
            trends: restoreTrend && !prev.state.trends.some(trend => trend.id === captured.trend.id)
              ? [...prev.state.trends, captured.trend]
              : prev.state.trends,
            trendHistory: restoreTrend
              ? prev.state.trendHistory.filter(entry => entry !== captured)
              : prev.state.trendHistory,
          };
          get().engine?.setState(next);
          return { state: next };
        }),

      selectTile: (tileId) => set({ selectedTileId: tileId, selectedCompanyId: null }),
      selectCompany: (companyId) => set({ selectedCompanyId: companyId, selectedTileId: null }),

      setActivePanel: (panel) => set((prev) => ({ ui: { ...prev.ui, activePanel: panel } })),
      setShowActionModal: (show, action) => set((prev) => ({ ui: { ...prev.ui, showActionModal: show, pendingAction: action || null } })),

      addNotification: (title, body, importance = 'minor') =>
        set((prev) => {
          const toast = `${title}: ${body}`;
          const alert: AlertItem = {
            id: generateId.event(),
            turn: prev.state?.turn ?? 0,
            title, body,
            importance,
          };
          return {
            ui: {
              ...prev.ui,
              notifications: [...prev.ui.notifications.slice(-9), toast],
            },
            state: prev.state
              ? { ...prev.state, alerts: [...prev.state.alerts, alert].slice(-50) }
              : prev.state,
          };
        }),

      dismissNotification: (index) =>
        set((prev) => ({
          ui: {
            ...prev.ui,
            notifications: prev.ui.notifications.filter((_, i) => i !== index),
          },
        })),

      clearNotifications: () => set((prev) => ({ ui: { ...prev.ui, notifications: [] } })),

      addNewsItem: (item) =>
        set((prev) => ({
          state: prev.state
            ? {
                ...prev.state,
                newsFeed: [...prev.state.newsFeed.slice(-49), item],
              }
            : null,
        })),

      setMarketBriefing: (briefing) =>
        set((prev) => ({
          state: prev.state ? { ...prev.state, marketBriefing: briefing } : null,
        })),

      loadGame: () => {
        const state = MiniDB.loadAuto();
        if (!state) return false;
        try {
          const engine = new TurnEngine(state.seed, undefined, undefined, undefined, undefined, undefined, false, state.mapSeed);
          engine.setState(state);
          engine.rehydrateWorld(); // regenerate explored tiles from mapSeed, overlay saved diff
          set({ state: engine.getState(), engine, initialBuildings: get().initialBuildings, selectedTileId: null, selectedCompanyId: state.playerCompanyId, ui: initialUI });
          get().addNotification('Game loaded', '');
          return true;
        } catch {
          get().addNotification('Failed to load game', '', 'critical');
          return false;
        }
      },

      saveGame: (slot = 'manual') => {
        const { state } = get();
        if (!state) return false;
        // T: diff-serialize — keep only modified tiles + the full coord index; the
        // rest regenerate deterministically from mapSeed on load (light saves).
        const notable = new Map(state.marketTiles);
        const diffTiles = new Map<TileId, MarketTile>();
        notable.forEach((t) => { if (t.controllerId || t.isStartupTile || t.buildingId) diffTiles.set(t.id, t); });
        const diffState: GameState = { ...state, marketTiles: diffTiles, tileIndex: state.tileIndex };
        MiniDB.save(slot, diffState);
        get().addNotification('Game saved', '');
        return true;
      },

      loadSlot: (slot) => {
        const state = MiniDB.load(slot);
        if (!state) return false;
        try {
          const engine = new TurnEngine(state.seed, undefined, undefined, undefined, undefined, undefined, false, state.mapSeed);
          engine.setState(state);
          engine.rehydrateWorld(); // regenerate explored tiles from mapSeed, overlay saved diff
          set({ state: engine.getState(), engine, initialBuildings: get().initialBuildings, selectedTileId: null, selectedCompanyId: state.playerCompanyId, ui: initialUI });
          get().addNotification('Game loaded', '');
          return true;
        } catch {
          get().addNotification('Failed to load game', '', 'critical');
          return false;
        }
      },

      hasAutosave: () => MiniDB.loadAuto() !== null,

      estimateAction: (action) => {
        const { engine } = get();
        if (!engine) return 0;
        return engine.estimateSuccess({ ...action, id: 'preview', status: 'planned' });
      },

      acknowledgeVictory: (milestoneId) => set((prev) => {
        if (!prev.state) return {};
        const next = { ...prev.state, victoryMilestones: prev.state.victoryMilestones.map(m => m.id === milestoneId ? { ...m, acknowledged: true } : m) };
        prev.engine?.setState(next);
        return { state: next };
      }),

      continueAfterVictory: () => set((prev) => {
        if (!prev.state) return {};
        const next = {
          ...prev.state,
          isGameOver: false,
          victoryType: undefined,
          victoryMilestones: prev.state.victoryMilestones.map(m => ({ ...m, acknowledged: true })),
        };
        prev.engine?.setState(next);
        return { state: next };
      }),

      retireRun: () => set((prev) => {
        if (!prev.state) return {};
        const next = { ...prev.state, isGameOver: true };
        prev.engine?.setState(next);
        MiniDB.autosave(next);
        return { state: next };
      }),

      applySandboxCommand: (draft) => set((prev) => {
        const state = prev.state;
        if (!state || state.mode !== 'sandbox' || !state.sandbox) return {};
        const command: SandboxCommand = { ...draft, id: generateId.action(), createdAt: Date.now() };
        const company = state.companies.get(command.companyId ?? state.playerCompanyId);
        let previousValue: number | boolean | undefined;
        let description = command.type.replaceAll('_', ' ');
        const next = { ...state, companies: new Map(state.companies), sandbox: { ...state.sandbox, godModeUsed: true, auditLog: [...state.sandbox.auditLog] } };
        const target = company ? { ...company } : undefined;
        if (target) next.companies.set(target.id, target);
        const numeric = typeof command.value === 'number' ? command.value : 0;
        switch (command.type) {
          case 'set_cash': if (target) { previousValue = target.cash; target.cash = numeric; } break;
          case 'set_debt': if (target) { previousValue = target.debt; target.debt = numeric; } break;
          case 'set_reputation': if (target) { previousValue = target.brandTrust; target.brandTrust = numeric; } break;
          case 'set_influence': if (target) { previousValue = target.marketInfluence; target.marketInfluence = numeric; } break;
          case 'set_stock': if (target) { previousValue = target.valuation; target.valuation = numeric; description = 'set stock valuation'; } break;
          case 'set_morale': if (target) { previousValue = target.employeeMorale; target.employeeMorale = numeric; } break;
          case 'toggle_victory': previousValue = next.sandbox!.victoryEnabled; next.sandbox!.victoryEnabled = Boolean(command.value); next.modeRules = { ...next.modeRules, victoryPolicy: command.value ? { kind: 'milestone_continue' } : { kind: 'disabled' } }; break;
          case 'reveal_intelligence': previousValue = next.sandbox!.intelligenceRevealed; next.sandbox!.intelligenceRevealed = Boolean(command.value); break;
          case 'advance_turns': break;
        }
        next.modeRules = { ...next.modeRules, achievementsEnabled: false };
        next.sandbox!.auditLog.push({ command, previousValue, description });
        prev.engine?.setState(next);
        if (command.type === 'advance_turns') {
          const turns = Math.max(1, Math.min(25, numeric));
          let resolved: GameState = next;
          for (let i = 0; i < turns; i++) resolved = prev.engine!.endTurn().newState;
          return { state: resolved };
        }
        MiniDB.autosave(next);
        return { state: next };
      }),

      undoSandboxCommand: () => set((prev) => {
        const state = prev.state;
        const entry = state?.sandbox?.auditLog.at(-1);
        if (!state || !state.sandbox || !entry || entry.previousValue === undefined) return {};
        const next: GameState = { ...state, companies: new Map(state.companies), sandbox: { ...state.sandbox, auditLog: state.sandbox.auditLog.slice(0, -1) } };
        const company = state.companies.get(entry.command.companyId ?? state.playerCompanyId);
        const target = company ? { ...company } : undefined;
        if (target) next.companies.set(target.id, target);
        const previous = entry.previousValue;
        if (typeof previous === 'number' && target) {
          if (entry.command.type === 'set_cash') target.cash = previous;
          if (entry.command.type === 'set_debt') target.debt = previous;
          if (entry.command.type === 'set_stock') target.valuation = previous;
          if (entry.command.type === 'set_reputation') target.brandTrust = previous;
          if (entry.command.type === 'set_influence') target.marketInfluence = previous;
          if (entry.command.type === 'set_morale') target.employeeMorale = previous;
        }
        if (entry.command.type === 'toggle_victory') {
          next.sandbox!.victoryEnabled = Boolean(previous);
          next.modeRules = { ...next.modeRules, victoryPolicy: previous ? { kind: 'milestone_continue' } : { kind: 'disabled' } };
        }
        if (entry.command.type === 'reveal_intelligence') next.sandbox!.intelligenceRevealed = Boolean(previous);
        prev.engine?.setState(next);
        MiniDB.autosave(next);
        return { state: next };
      }),
    }),
    { name: 'strategyless-store' }
  )
);
