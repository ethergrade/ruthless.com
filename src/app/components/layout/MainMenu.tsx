import React, { useState } from 'react';
import { useGameStore } from '../../../store/gameStore';
import { MiniDB } from '../../../data/db';
import { ScenarioEditorModal, CampaignEditorModal } from './editors';
import type { ScenarioConfig, CampaignConfig } from '../../../types';
import { formatNumber } from '../../../utils/formatters';
import { Modal } from '../../components/ui/Modal';
import { Icon } from '../../components/ui/Icon';
import type { CompanyArchetype, CEOTrait } from '../../../types';

interface MainMenuProps {
  onStartGame: () => void;
  onLoadGame: () => void;
}

const ARCHETYPES: { id: CompanyArchetype; name: string; desc: string; color: string; stats: string[] }[] = [
  { id: 'hypergrowth_platform', name: 'Hypergrowth Platform', desc: 'Aggressive expansion, platform strategy, high burn', color: '#00d4aa', stats: ['+2 Executive Orders', '+50% Market Expand', '-30% Security', '-20% Trust'] },
  { id: 'security_fortress', name: 'Security Fortress', desc: 'Slow steady growth, high trust, regulated markets', color: '#007bff', stats: ['+40% Security', '+30% Trust', '-2 Executive Orders', '-50% Market Expand'] },
  { id: 'acquisition_machine', name: 'Acquisition Machine', desc: 'Roll-up strategy, integration risk, fast scale', color: '#ff6b35', stats: ['+3 Acquire Actions', '+50% Scout', '-30% Morale', '-20% Efficiency'] },
  { id: 'lean_specialist', name: 'Lean Specialist', desc: 'Niche dominance, high margins, vulnerable to scale', color: '#ffc107', stats: ['+40% Margins', '+30% Innovation', '-2 Executive Orders', '-40% Market Expand'] },
];

const CEOS: { id: CEOTrait; name: string; desc: string; stats: string[] }[] = [
  { id: 'banker', name: 'Hunt (Banker)', desc: 'Debt compounds 2x — high leverage, fragile if cash stalls', stats: ['-$2M Start Debt', '+10% Operating Costs', 'High Risk / High Reward'] },
  { id: 'smart', name: 'Jersild (Smart)', desc: 'Learns fast — capabilities compound +10% each turn', stats: ['+10% Innovation', '+10% AI Capability', 'Steady Edge'] },
  { id: 'initiative', name: 'Laingang (Initiative)', desc: 'Drives hard — a free expansion order every 3 turns', stats: ['+1 Free Order / 3T', 'Aggressive Growth', 'Expends Resources'] },
  { id: 'none', name: 'Balanced Operator', desc: 'No extreme trait — steady, predictable baseline', stats: ['Baseline', 'No Bonus / Penalty'] },
];

export const MainMenu: React.FC<MainMenuProps> = ({ onStartGame, onLoadGame }) => {
  const { initializeGame } = useGameStore();
  const [selectedArchetype, setSelectedArchetype] = useState<CompanyArchetype>('hypergrowth_platform');
  const [companyName, setCompanyName] = useState('MyCorp');
  const [showNewGame, setShowNewGame] = useState(false);
  const [showLoadGame, setShowLoadGame] = useState(false);
  const [showScenario, setShowScenario] = useState(false);
  const [showCampaign, setShowCampaign] = useState(false);
  const [seed, setSeed] = useState('');
  const [selectedColor, setSelectedColor] = useState('#00d4aa');
  const [disasters, setDisasters] = useState(true);
  const [selectedCeo, setSelectedCeo] = useState<CEOTrait>('none');

  const handleStart = () => {
    try {
      initializeGame(
        seed ? parseInt(seed) : undefined,
        companyName.trim() || undefined,
        selectedArchetype,
        selectedColor,
        disasters,
        selectedCeo,
      );
    } catch (err) {
      // initializeGame shouldn't throw, but never block the modal from closing.
    }
    setShowNewGame(false);
    onStartGame();
  };

  const handleStartScenario = (cfg: ScenarioConfig) => {
    try {
      initializeGame(cfg.seed, cfg.name, undefined, undefined, cfg.disasters, undefined, cfg);
    } catch { /* never block */ }
    setShowScenario(false);
    onStartGame();
  };

  const handleStartCampaign = (cfg: CampaignConfig) => {
    // Launch chapter 1 immediately with the persistent player corporation.
    const ch1 = cfg.chapters[0];
    try {
      initializeGame(
        ch1.scenario.seed,
        cfg.playerCorp.name,
        cfg.playerCorp.archetype,
        cfg.playerCorp.color,
        ch1.scenario.disasters,
        cfg.playerCorp.ceoTrait,
        ch1.scenario,
      );
    } catch { /* never block */ }
    setShowCampaign(false);
    onStartGame();
  };
  const handleLoad = () => {
    const { loadGame } = useGameStore.getState();
    if (loadGame()) {
      onLoadGame();
    }
  };

  return (
    <div className="main-menu">
      <div className="menu-background">
        <div className="menu-particles" />
      </div>

      <div className="menu-container">
        <div className="menu-header">
          <h1 className="menu-title">STRATEGYLESS</h1>
          <p className="menu-tagline">Build the company. Control the market. Survive the system.</p>
        </div>

        <div className="menu-buttons">
          <button className="menu-btn primary" onClick={() => setShowNewGame(true)}>
            <span className="btn-icon"><Icon name="play" /></span>
            <span>NEW GAME</span>
          </button>
          <button className="menu-btn secondary" onClick={handleLoad}>
            <span className="btn-icon"><Icon name="folder" /></span>
            <span>LOAD GAME</span>
          </button>
          <button className="menu-btn secondary" onClick={() => setShowScenario(true)}>
            <span className="btn-icon"><Icon name="gamepad" /></span>
            <span>SCENARIO EDITOR</span>
          </button>
          <button className="menu-btn secondary" onClick={() => setShowCampaign(true)}>
            <span className="btn-icon"><Icon name="book" /></span>
            <span>CAMPAIGN EDITOR</span>
          </button>
          <button className="menu-btn ghost" onClick={() => window.open('https://github.com', '_blank')}>
            <span className="btn-icon"><Icon name="doc" /></span>
            <span>DOCUMENTATION</span>
          </button>
        </div>

        <div className="menu-footer">
          <p>v0.1.0-alpha | Turn-based corporate strategy</p>
        </div>
      </div>

      {showNewGame && (
        <NewGameModal
          companyName={companyName}
          setCompanyName={setCompanyName}
          selectedArchetype={selectedArchetype}
          setSelectedArchetype={setSelectedArchetype}
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
          disasters={disasters}
          setDisasters={setDisasters}
          selectedCeo={selectedCeo}
          setSelectedCeo={setSelectedCeo}
          seed={seed}
          setSeed={setSeed}
          onStart={handleStart}
          onCancel={() => setShowNewGame(false)}
        />
      )}

      {showLoadGame && (
        <LoadGameModal
          onLoaded={handleLoad}
          onCancel={() => setShowLoadGame(false)}
        />
      )}

      {showScenario && (
        <ScenarioEditorModal onStart={handleStartScenario} onCancel={() => setShowScenario(false)} />
      )}
      {showCampaign && (
        <CampaignEditorModal onStart={handleStartCampaign} onCancel={() => setShowCampaign(false)} />
      )}
    </div>
  );
};

const NewGameModal: React.FC<{
  companyName: string;
  setCompanyName: (name: string) => void;
  selectedArchetype: CompanyArchetype;
  setSelectedArchetype: (a: CompanyArchetype) => void;
  selectedColor: string;
  setSelectedColor: (c: string) => void;
  disasters: boolean;
  setDisasters: (d: boolean) => void;
  selectedCeo: CEOTrait;
  setSelectedCeo: (c: CEOTrait) => void;
  seed: string;
  setSeed: (s: string) => void;
  onStart: () => void;
  onCancel: () => void;
}> = ({ companyName, setCompanyName, selectedArchetype, setSelectedArchetype, selectedColor, setSelectedColor, disasters, setDisasters, selectedCeo, setSelectedCeo, seed, setSeed, onStart, onCancel }) => {
  const archetype = ARCHETYPES.find(a => a.id === selectedArchetype)!;
  const COLORS = ['#00d4aa', '#ff6b35', '#007bff', '#ffc107', '#e83e8c', '#6f42c1', '#20c997', '#fd7e14'];

  return (
    <Modal title="NEW GAME SETUP" onClose={onCancel} size="xxl">
      <div className="new-game-modal">
        <div className="setup-top">
          {/* LEFT COLUMN: company name + archetype */}
          <div className="setup-col">
            <div className="form-group">
              <label>Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Enter company name"
                maxLength={24}
              />
            </div>

            <div className="form-group">
              <label>Starting Archetype</label>
              <div className="archetype-selector">
                {ARCHETYPES.map(a => (
                  <button
                    key={a.id}
                    className={`archetype-card ${selectedArchetype === a.id ? 'selected' : ''}`}
                    onClick={() => setSelectedArchetype(a.id)}
                    style={{ borderColor: a.color }}
                  >
                    <div className="archetype-header" style={{ background: a.color }}>
                      <span className="archetype-name">{a.name}</span>
                    </div>
                    <p className="archetype-desc">{a.desc}</p>
                    <div className="archetype-stats">
                      {a.stats.map((s, i) => (
                        <span key={i} className={`stat ${s.startsWith('+') ? 'positive' : 'negative'}`}>{s}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: CEO trait + preview */}
          <div className="setup-col">
            <div className="form-group">
              <label>Starting CEO Trait</label>
              <div className="archetype-selector">
                {CEOS.map(c => (
                  <button
                    key={c.id}
                    className={`archetype-card ${selectedCeo === c.id ? 'selected' : ''}`}
                    onClick={() => setSelectedCeo(c.id)}
                    style={{ borderColor: selectedCeo === c.id ? '#00d4aa' : undefined }}
                  >
                    <div className="archetype-header" style={{ background: selectedCeo === c.id ? '#00d4aa' : '#2a2f3e' }}>
                      <span className="archetype-name">{c.name}</span>
                    </div>
                    <p className="archetype-desc">{c.desc}</p>
                    <div className="archetype-stats">
                      {c.stats.map((s, i) => (
                        <span key={i} className={`stat ${s.startsWith('+') ? 'positive' : s.startsWith('-') ? 'negative' : ''}`}>{s}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* THIRD COLUMN: selected archetype preview */}
          <div className="setup-col preview-col">
            <div className="archetype-preview" style={{ borderColor: archetype.color }}>
              <h3>{archetype.name}</h3>
              <p>{archetype.desc}</p>
              <div className="preview-stats">
                {archetype.stats.map((s, i) => (
                  <span key={i} className={`stat ${s.startsWith('+') ? 'positive' : 'negative'}`}>{s}</span>
                ))}
              </div>
              <div className="preview-note">
                <strong>Starting Resources:</strong>
                <ul>
                  <li>$5,000,000 Cash</li>
                  <li>3 Executive Orders/turn</li>
                  <li>3 Starting Departments</li>
                  <li>2 Starting Products</li>
                  <li>3 Starting Tiles</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* FULL-WIDTH BOTTOM ROW: seed + color + disasters */}
        <div className="setup-bottom">
          <div className="form-group seed-field">
            <label>Random Seed (optional)</label>
            <input
              type="text"
              value={seed}
              onChange={e => setSeed(e.target.value)}
              placeholder="Leave empty for random"
              maxLength={10}
            />
          </div>

          <div className="form-group">
            <label>Company Color</label>
            <div className="color-picker">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch ${selectedColor === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setSelectedColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <div className="form-group disasters-field">
            <label>Cataclismi (SimCity-like)</label>
            <label className="toggle-row">
              <input type="checkbox" checked={disasters} onChange={e => setDisasters(e.target.checked)} />
              <span>Abilita borse, nuove tecnologie e cataclismi di mercato</span>
            </label>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={onStart} disabled={!companyName.trim()}>
            START GAME
          </button>
        </div>
      </div>
    </Modal>
  );
};

export const SaveGameModal: React.FC<{ defaultName: string; onSave: (name: string) => void; onCancel: () => void }> = ({ defaultName, onSave, onCancel }) => {
  const [name, setName] = useState(defaultName || 'My Save');
  return (
    <Modal title="SAVE GAME" onClose={onCancel} size="md">
      <div className="save-game-modal">
        <div className="form-group">
          <label>Save Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter save name"
            maxLength={32}
            autoFocus
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(name.trim() || 'My Save')} disabled={!name.trim()}>
            SAVE
          </button>
        </div>
      </div>
    </Modal>
  );
};

const LoadGameModal: React.FC<{ onLoaded: () => void; onCancel: () => void }> = ({ onLoaded, onCancel }) => {
  const saves = MiniDB.list();

  const doLoad = (slot: string) => {
    const { loadSlot } = useGameStore.getState();
    if (loadSlot(slot)) onLoaded();
  };

  return (
    <Modal title="LOAD GAME" onClose={onCancel} size="md">
      <div className="load-game-modal">
        {saves.length === 0 ? (
          <p className="empty-state">No saved games found.</p>
        ) : (
          <div className="saves-list">
            {saves.map(save => (
              <button key={save.slot} className="save-item" onClick={() => doLoad(save.slot)}>
                <div className="save-info">
                  <span className="save-name">{save.slot === 'auto' ? 'Auto-save' : save.slot}</span>
                  <span className="save-company">{save.company}</span>
                </div>
                <div className="save-details">
                  <span>Turn {save.turn}</span>
                  <span>${formatNumber(save.cash)}</span>
                  <span>{new Date(save.savedAt).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
};
