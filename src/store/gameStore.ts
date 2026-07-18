import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  GameState, TurnAction, NewsItem, MarketBriefing,
  CompanyId, TileId, CompanyArchetype,
  CEOTrait, ScenarioConfig,
} from '../types';
import { TurnEngine } from '../simulation/turn/turnEngine';
import { MiniDB } from '../data/db';
import { generateId } from '../simulation/utils/ids';

interface GameStore {
  state: GameState | null;
  engine: TurnEngine | null;
  selectedTileId: TileId | null;
  selectedCompanyId: CompanyId | null;
  ui: {
    activePanel: string | null;
    showActionModal: boolean;
    pendingAction: Partial<TurnAction> | null;
    notifications: string[];
  };

  initializeGame: (seed?: number, companyName?: string, archetype?: CompanyArchetype, color?: string, disasters?: boolean, ceoTrait?: CEOTrait, scenario?: ScenarioConfig) => void;
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
      selectedTileId: null,
      selectedCompanyId: null,
      ui: initialUI,

      initializeGame: (seed?: number, companyName?: string, archetype?: CompanyArchetype, color?: string, disasters?: boolean, ceoTrait?: CEOTrait, scenario?: ScenarioConfig) => {
        const engine = new TurnEngine(seed, ceoTrait, scenario);
        const state = engine.getState();
        if (companyName?.trim() || archetype || color || disasters !== undefined) {
          const player = state.companies.get(state.playerCompanyId);
          if (player) {
            if (companyName?.trim()) player.name = companyName.trim();
            if (archetype) player.archetype = archetype;
            if (color) player.color = color;
            state.disastersEnabled = !!disasters;
            engine.setState(state);
          }
        }
        set({ state: engine.getState(), engine, selectedTileId: null, selectedCompanyId: state.playerCompanyId, ui: initialUI });
      },

      setState: (newState) => set({ state: newState }),

      endTurn: () => {
        const { engine, state } = get();
        if (!engine || !state) return;

        const result = engine.endTurn();
        set({ state: result.newState });

        // Persist progress automatically so the player never loses their game.
        MiniDB.autosave(result.newState);

        if (result.newsItems.length > 0) {
          result.newsItems.forEach(item => {
            if (item.importance === 'critical' || item.importance === 'major') {
              get().addNotification(item.headline, item.body, item.importance);
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
          const next = {
            ...prev.state,
            actions: [...prev.state.actions, { ...action, id: generateId.action(), status: 'planned' as const }],
          };
          get().engine?.setState(next);
          return { state: next };
        }),

      removeAction: (actionId) =>
        set((prev) => {
          if (!prev.state) return {};
          const next = {
            ...prev.state,
            actions: prev.state.actions.filter((a) => a.id !== actionId),
          };
          get().engine?.setState(next);
          return { state: next };
        }),

      selectTile: (tileId) => set({ selectedTileId: tileId, selectedCompanyId: null }),
      selectCompany: (companyId) => set({ selectedCompanyId: companyId, selectedTileId: null }),

      setActivePanel: (panel) => set((prev) => ({ ui: { ...prev.ui, activePanel: panel } })),
      setShowActionModal: (show, action) => set((prev) => ({ ui: { ...prev.ui, showActionModal: show, pendingAction: action || null } })),

      addNotification: (title, body, _importance = 'minor') =>
        set((prev) => ({
          ui: {
            ...prev.ui,
            notifications: [...prev.ui.notifications.slice(-9), `${title}: ${body}`],
          },
        })),

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
          const engine = new TurnEngine(state.seed);
          engine.setState(state);
          set({ state, engine, selectedTileId: null, selectedCompanyId: state.playerCompanyId, ui: initialUI });
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
        MiniDB.save(slot, state);
        get().addNotification('Game saved', '');
        return true;
      },

      loadSlot: (slot) => {
        const state = MiniDB.load(slot);
        if (!state) return false;
        try {
          const engine = new TurnEngine(state.seed);
          engine.setState(state);
          set({ state, engine, selectedTileId: null, selectedCompanyId: state.playerCompanyId, ui: initialUI });
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
    }),
    { name: 'strategyless-store' }
  )
);
