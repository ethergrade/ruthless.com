import { create } from 'zustand';
import { audio } from '../audio/AudioEngine';

export type GlobalDifficulty = 'none' | 'docile' | 'aggressive' | 'ruthless';

interface SettingsStore {
  /** Global AI difficulty override. 'none' = use per-scenario/chapter setting. */
  difficultyOverride: GlobalDifficulty;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  sfxVolume: number;   // 0..1
  musicVolume: number;  // 0..1
  setDifficultyOverride: (d: GlobalDifficulty) => void;
  setSfxEnabled: (v: boolean) => void;
  setMusicEnabled: (v: boolean) => void;
  setSfxVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
}

const KEY = 'strategyless.settings.v1';

const read = (): Omit<SettingsStore, 'setDifficultyOverride' | 'setSfxEnabled' | 'setMusicEnabled' | 'setSfxVolume' | 'setMusicVolume'> => {
  if (typeof window === 'undefined') {
    return { difficultyOverride: 'none', sfxEnabled: true, musicEnabled: false, sfxVolume: 0.5, musicVolume: 0.5 };
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaults;
};

const defaults = {
  difficultyOverride: 'none' as GlobalDifficulty,
  sfxEnabled: true,
  musicEnabled: false,
  sfxVolume: 0.5,
  musicVolume: 0.5,
};

export const useSettings = create<SettingsStore>()((set, get) => ({
  ...read(),
  setDifficultyOverride: (d) => { persist(set, get, { difficultyOverride: d }); },
  setSfxEnabled: (v) => { audio.setSfxEnabled(v); persist(set, get, { sfxEnabled: v }); },
  setMusicEnabled: (v) => { audio.setMusicEnabled(v); persist(set, get, { musicEnabled: v }); },
  setSfxVolume: (v) => {
    const clamped = Math.max(0, Math.min(1, v));
    audio.setSfxVolume(clamped);
    persist(set, get, { sfxVolume: clamped });
  },
  setMusicVolume: (v) => {
    const clamped = Math.max(0, Math.min(1, v));
    audio.setMusicVolume(clamped);
    persist(set, get, { musicVolume: clamped });
  },
}));

function persist(
  set: (partial: Partial<SettingsStore>) => void,
  get: () => SettingsStore,
  partial: Partial<SettingsStore>,
): void {
  set(partial);
  if (typeof window !== 'undefined') {
    const { difficultyOverride, sfxEnabled, musicEnabled, sfxVolume, musicVolume } = get();
    try {
      window.localStorage.setItem(KEY, JSON.stringify({
        difficultyOverride, sfxEnabled, musicEnabled, sfxVolume, musicVolume,
      }));
    } catch { /* ignore */ }
  }
}
