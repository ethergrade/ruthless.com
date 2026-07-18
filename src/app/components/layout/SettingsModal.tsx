import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { useSettings, type GlobalDifficulty } from '../../../store/settings';

/**
 * T — Global Settings: a difficulty override (default none) plus separate
 * SFX / Music toggles + volumes. Persisted to localStorage via useSettings
 * and pushed to the AudioEngine on every change.
 */
export const SettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    difficultyOverride, sfxEnabled, musicEnabled, sfxVolume, musicVolume,
    setDifficultyOverride, setSfxEnabled, setMusicEnabled, setSfxVolume, setMusicVolume,
  } = useSettings();

  const [diff, setDiff] = useState<GlobalDifficulty>(difficultyOverride);
  const [sfx, setSfx] = useState(sfxEnabled);
  const [music, setMusic] = useState(musicEnabled);
  const [sv, setSv] = useState(sfxVolume);
  const [mv, setMv] = useState(musicVolume);

  const apply = () => {
    setDifficultyOverride(diff);
    setSfxEnabled(sfx);
    setMusicEnabled(music);
    setSfxVolume(sv);
    setMusicVolume(mv);
    onClose();
  };

  return (
    <Modal title="GLOBAL SETTINGS" onClose={onClose} size="md">
      <div className="editor-modal settings-modal">
        <h4 className="editor-h4">AI Difficulty Override</h4>
        <p className="editor-sub">Default: no override (each scenario/chapter keeps its own difficulty).</p>
        <div className="seg-control">
          {(['none', 'docile', 'aggressive', 'ruthless'] as GlobalDifficulty[]).map(d => (
            <button
              key={d}
              className={`seg-btn ${diff === d ? 'active' : ''}`}
              onClick={() => setDiff(d)}
            >
              {d === 'none' ? 'NONE' : d.toUpperCase()}
            </button>
          ))}
        </div>

        <h4 className="editor-h4">Audio</h4>
        <div className="settings-row">
          <label className="toggle-row">
            <input type="checkbox" checked={sfx} onChange={e => setSfx(e.target.checked)} />
            <span>Sound Effects</span>
          </label>
          <span className="settings-hint">default: ON</span>
        </div>
        {sfx && (
          <div className="settings-row">
            <label>Effects Volume</label>
            <input type="range" min={0} max={1} step={0.05} value={sv}
              onChange={e => setSv(parseFloat(e.target.value))} />
            <span className="settings-val">{Math.round(sv * 100)}%</span>
          </div>
        )}

        <div className="settings-row">
          <label className="toggle-row">
            <input type="checkbox" checked={music} onChange={e => setMusic(e.target.checked)} />
            <span>Music</span>
          </label>
          <span className="settings-hint">default: OFF</span>
        </div>
        {music && (
          <div className="settings-row">
            <label>Music Volume</label>
            <input type="range" min={0} max={1} step={0.05} value={mv}
              onChange={e => setMv(parseFloat(e.target.value))} />
            <span className="settings-val">{Math.round(mv * 100)}%</span>
          </div>
        )}

        <div className="editor-actions">
          <button className="menu-btn ghost" onClick={onClose}>CANCEL</button>
          <button className="menu-btn primary" onClick={apply}>APPLY ✔</button>
        </div>
      </div>
    </Modal>
  );
};
