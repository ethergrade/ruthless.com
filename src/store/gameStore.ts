import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  GameState, TurnAction, NewsItem, MarketBriefing, MarketTile,
  CompanyId, TileId, CompanyArchetype,
  CEOTrait, ScenarioConfig, AlertItem, CeoBuild, InitialBuildingSpec,
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

  initializeGame: (seed?: number, companyName?: string, archetype?: CompanyArchetype, color?: string, disasters?: boolean, ceoTrait?: CEOTrait, scenario?: ScenarioConfig, statOverrides?: Partial<Record<string, number>>, ceoBuild?: CeoBuild, sim?: { marketSimulation: boolean; cataclysms: boolean; newTech: boolean }, initialBuildings?: InitialBuildingSpec[], realMapPlacement?: boolean, mapSeed?: number) => void;
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

      initializeGame: (seed?: number, companyName?: string, archetype?: CompanyArchetype, color?: string, disasters?: boolean, ceoTrait?: CEOTrait, scenario?: ScenarioConfig, statOverrides?: Partial<Record<string, number>>, ceoBuild?: CeoBuild, sim?: { marketSimulation: boolean; cataclysms: boolean; newTech: boolean }, initialBuildings?: InitialBuildingSpec[], realMapPlacement?: boolean, mapSeed?: number) => {
        const engine = new TurnEngine(seed, ceoTrait, scenario, statOverrides, ceoBuild, initialBuildings, realMapPlacement, mapSeed);
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
          const next = {
            ...prev.state,
            actions: [...prev.state.actions, { ...action, id: generateId.action(), status: 'planned' as const }],
          };
          get().engine?.setState(next);
          if (useSettings.getState().sfxEnabled) audio.sfx('orderPlaced');
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
    }),
    { name: 'strategyless-store' }
  )
);
