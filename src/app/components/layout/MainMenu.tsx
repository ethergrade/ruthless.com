import React, { useState } from 'react';
import { useGameStore } from '../../../store/gameStore';
import { MiniDB } from '../../../data/db';
import { formatNumber } from '../../../utils/formatters';
import { Modal } from '../../components/ui/Modal';
import type { CompanyArchetype } from '../../../types';

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

export const MainMenu: React.FC<MainMenuProps> = ({ onStartGame, onLoadGame }) => {
  const { initializeGame } = useGameStore();
  const [selectedArchetype, setSelectedArchetype] = useState<CompanyArchetype>('hypergrowth_platform');
  const [companyName, setCompanyName] = useState('MyCorp');
  const [showNewGame, setShowNewGame] = useState(false);
  const [showLoadGame, setShowLoadGame] = useState(false);
  const [seed, setSeed] = useState('');

  const handleStart = () => {
    initializeGame(seed ? parseInt(seed) : undefined);
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
            <span className="btn-icon">▶</span>
            <span>NEW GAME</span>
          </button>
          <button className="menu-btn secondary" onClick={handleLoad}>
            <span className="btn-icon">📂</span>
            <span>LOAD GAME</span>
          </button>
          <button className="menu-btn secondary" onClick={() => setShowNewGame(true)}>
            <span className="btn-icon">🎮</span>
            <span>SCENARIO EDITOR</span>
          </button>
          <button className="menu-btn secondary" onClick={() => setShowNewGame(true)}>
            <span className="btn-icon">📚</span>
            <span>CAMPAIGN EDITOR</span>
          </button>
          <button className="menu-btn ghost" onClick={() => window.open('https://github.com', '_blank')}>
            <span className="btn-icon">📖</span>
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
    </div>
  );
};

const NewGameModal: React.FC<{
  companyName: string;
  setCompanyName: (name: string) => void;
  selectedArchetype: CompanyArchetype;
  setSelectedArchetype: (a: CompanyArchetype) => void;
  seed: string;
  setSeed: (s: string) => void;
  onStart: () => void;
  onCancel: () => void;
}> = ({ companyName, setCompanyName, selectedArchetype, setSelectedArchetype, seed, setSeed, onStart, onCancel }) => {
  const archetype = ARCHETYPES.find(a => a.id === selectedArchetype)!;

  return (
    <Modal title="NEW GAME SETUP" onClose={onCancel} size="lg">
      <div className="new-game-modal">
        <div className="setup-grid">
          <div className="setup-left">
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

            <div className="form-group">
              <label>Random Seed (optional)</label>
              <input
                type="text"
                value={seed}
                onChange={e => setSeed(e.target.value)}
                placeholder="Leave empty for random"
                maxLength={10}
              />
            </div>
          </div>

          <div className="setup-right">
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
