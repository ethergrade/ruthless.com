/* eslint-disable @typescript-eslint/no-explicit-any */
// Mini in-browser database for strategyless.
// Persists the full GameState (which contains ES Maps) to localStorage using
// Map-aware (de)serialization, so saves survive reloads without a backend.

import type { GameState } from '../types';
import { getIdCounterState, setIdCounterState, type IdCounterState } from '../simulation/utils/ids';

const PREFIX = 'strategyless:save:';
const AUTOSAVE_SLOT = 'auto';

interface SaveEnvelope {
  saveVersion: 2;
  savedAt: number;
  idState: IdCounterState;
  checksum: string;
  state: GameState;
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

const checksum = (value: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const serializeState = (state: GameState): string => {
  const stateJson = JSON.stringify(state, replacer);
  const envelope: SaveEnvelope = { saveVersion: 2, savedAt: Date.now(), idState: getIdCounterState(), checksum: checksum(stateJson), state };
  return JSON.stringify(envelope, replacer);
};

export const deserializeState = (json: string): GameState => {
  const parsed = JSON.parse(json, reviver) as SaveEnvelope | (GameState & { savedAt?: number });
  if ('saveVersion' in parsed && parsed.saveVersion === 2) {
    const stateJson = JSON.stringify(parsed.state, replacer);
    if (parsed.checksum !== checksum(stateJson)) throw new Error('Save checksum mismatch');
    setIdCounterState(parsed.idState);
    Object.defineProperty(parsed.state, 'savedAt', { value: parsed.savedAt, enumerable: false, configurable: true });
    return parsed.state;
  }
  return parsed as GameState;
};

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
      savedAt: (state as GameState & { savedAt?: number }).savedAt ?? Date.now(),
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
