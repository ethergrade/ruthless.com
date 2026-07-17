/* eslint-disable @typescript-eslint/no-explicit-any */
// Mini in-browser database for strategyless.
// Persists the full GameState (which contains ES Maps) to localStorage using
// Map-aware (de)serialization, so saves survive reloads without a backend.

import type { GameState } from '../types';

const PREFIX = 'strategyless:save:';
const AUTOSAVE_SLOT = 'auto';

interface SavedGame extends GameState {
  savedAt: number;
}

// Convert Maps to a tagged plain-object form so JSON.stringify keeps them.
const replacer = (_key: string, value: unknown): unknown => {
  if (value instanceof Map) {
    return { __type: 'Map', entries: Array.from(value.entries()) };
  }
  return value;
};

// Revive tagged objects back into real Maps.
const reviver = (_key: string, value: any): any => {
  if (value && value.__type === 'Map') {
    return new Map(value.entries);
  }
  return value;
};

export const serializeState = (state: GameState): string =>
  JSON.stringify({ ...state, savedAt: Date.now() } as SavedGame, replacer);

export const deserializeState = (json: string): GameState =>
  JSON.parse(json, reviver) as GameState;

// In-memory fallback so the module never throws in non-browser (SSR/test) envs.
const memoryStore = new Map<string, string>();
const getStorage = (): Storage => {
  if (typeof localStorage !== 'undefined') return localStorage;
  return {
    getItem: (k: string) => (memoryStore.has(k) ? memoryStore.get(k)! : null),
    setItem: (k: string, v: string) => void memoryStore.set(k, v),
    removeItem: (k: string) => void memoryStore.delete(k),
    clear: () => memoryStore.clear(),
    key: (i: number) => Array.from(memoryStore.keys())[i] ?? null,
    get length() {
      return memoryStore.size;
    },
  } as Storage;
};

export interface SaveMeta {
  slot: string;
  company: string;
  turn: number;
  cash: number;
  savedAt: number;
}

export const MiniDB = {
  save(slot: string, state: GameState): void {
    getStorage().setItem(PREFIX + slot, serializeState(state));
  },

  load(slot: string): GameState | null {
    const raw = getStorage().getItem(PREFIX + slot);
    if (!raw) return null;
    try {
      return deserializeState(raw);
    } catch {
      return null;
    }
  },

  autosave(state: GameState): void {
    this.save(AUTOSAVE_SLOT, state);
  },

  loadAuto(): GameState | null {
    return this.load(AUTOSAVE_SLOT);
  },

  meta(slot: string): SaveMeta | null {
    const state = this.load(slot);
    if (!state) return null;
    const player = state.companies.get(state.playerCompanyId);
    return {
      slot,
      company: player?.name ?? 'Unknown',
      turn: state.turn,
      cash: player?.cash ?? 0,
      savedAt: (state as SavedGame).savedAt ?? Date.now(),
    };
  },

  list(): SaveMeta[] {
    const storage = getStorage();
    const slots: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(PREFIX)) slots.push(key.slice(PREFIX.length));
    }
    return slots
      .map((s) => this.meta(s))
      .filter((m): m is SaveMeta => m !== null)
      .sort((a, b) => b.savedAt - a.savedAt);
  },

  remove(slot: string): void {
    getStorage().removeItem(PREFIX + slot);
  },
};
