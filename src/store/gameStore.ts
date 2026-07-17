import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  GameState, TurnAction, NewsItem,
  CompanyId, TileId, ActionType
} from '../types';
import { TurnEngine } from '../simulation/turn/turnEngine';

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

  initializeGame: (seed?: number) => void;
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
  setMarketBriefing: (briefing: any) => void;
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

      initializeGame: (seed?: number) => {
        const engine = new TurnEngine(seed);
        const state = engine.getState();
        set({ state, engine, selectedTileId: null, selectedCompanyId: state.playerCompanyId, ui: initialUI });
      },

      setState: (newState) => set({ state: newState }),

      endTurn: () => {
        const { engine, state } = get();
        if (!engine || !state) return;

        const result = engine.endTurn();
        set({ state: result.newState });

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
        set((prev) => ({
          state: prev.state
            ? {
                ...prev.state,
                actions: [...prev.state.actions, { ...action, id: `action_${Date.now()}`, status: 'planned' }],
              }
            : null,
        })),

      removeAction: (actionId) =>
        set((prev) => ({
          state: prev.state
            ? {
                ...prev.state,
                actions: prev.state.actions.filter((a) => a.id !== actionId),
              }
            : null,
        })),

      selectTile: (tileId) => set({ selectedTileId: tileId, selectedCompanyId: null }),
      selectCompany: (companyId) => set({ selectedCompanyId: companyId, selectedTileId: null }),

      setActivePanel: (panel) => set((prev) => ({ ui: { ...prev.ui, activePanel: panel } })),
      setShowActionModal: (show, action) => set((prev) => ({ ui: { ...prev.ui, showActionModal: show, pendingAction: action || null } })),

      addNotification: (title, body, importance = 'minor') =>
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
    }),
    { name: 'strategyless-store' }
  )
);
