import React, { useState } from 'react';
import { useGameStore } from '../../../store/gameStore';
import { MiniDB } from '../../../data/db';
import { ScenarioEditorModal, CampaignEditorModal } from './editors';
import { SettingsModal } from './SettingsModal';
import type { ScenarioConfig, CampaignConfig, CEOSkill, CeoBuild, InitialBuildingSpec, DepartmentType } from '../../../types';
import { ARCHETYPE_STATS, CEO_TRAIT_DEFS, STAT_LABELS, PERK_LABELS, CEO_PILLARS, PILLAR_LABELS, CEO_TOKEN_BUDGET, ARCHETYPE_PERKS, type CompanyStats } from '../../../data/archetypes';
import { formatNumber } from '../../../utils/formatters';
import { Modal } from '../../components/ui/Modal';
import { Icon } from '../../components/ui/Icon';
import type { CompanyArchetype, CEOTrait } from '../../../types';

// T: New Game — player pre-distributes up to 8 departments across 3 starting buildings.
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
  const [showSettings, setShowSettings] = useState(false);
  const [seed, setSeed] = useState('');
  const [selectedColor, setSelectedColor] = useState('#00d4aa');
  const [simulation, setSimulation] = useState({ marketSimulation: true, cataclysms: false, newTech: false });
  const [selectedCeo, setSelectedCeo] = useState<CEOTrait>('none');

  const handleStart = (statOverrides?: Partial<Record<string, number>>, ceoBuild?: CeoBuild, _initialBuildings?: InitialBuildingSpec[], realMapPlacement = true) => {
    try {
      initializeGame(
        seed ? parseInt(seed) : undefined,
        companyName.trim() || undefined,
        selectedArchetype,
        selectedColor,
        undefined,
        selectedCeo,
        undefined,
        statOverrides,
        ceoBuild,
        simulation,
        _initialBuildings,
        realMapPlacement, // T: player drops buildings live on the board
      );
    } catch (err) {
      // initializeGame shouldn't throw, but never block the modal from closing.
    }
    setShowNewGame(false);
    onStartGame();
  };

  const handleStartScenario = (cfg: ScenarioConfig) => {
    try {
      initializeGame(cfg.seed, cfg.name, undefined, undefined, undefined, undefined, cfg, undefined, undefined,
        cfg.simulation ?? { marketSimulation: true, cataclysms: false, newTech: false });
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
          <button className="menu-btn ghost" onClick={() => setShowSettings(true)}>
            <span className="btn-icon"><Icon name="gear" /></span>
            <span>GLOBAL SETTINGS</span>
          </button>
          <button className="menu-btn ghost" onClick={() => window.open('https://github.com/ethergrade/ruthless.com', '_blank')}>
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
          simulation={simulation}
          setSimulation={setSimulation}
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
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
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
  simulation: { marketSimulation: boolean; cataclysms: boolean; newTech: boolean };
  setSimulation: (s: { marketSimulation: boolean; cataclysms: boolean; newTech: boolean }) => void;
  selectedCeo: CEOTrait;
  setSelectedCeo: (c: CEOTrait) => void;
  seed: string;
  setSeed: (s: string) => void;
  onStart: (statOverrides?: Partial<Record<string, number>>, ceoBuild?: CeoBuild, initialBuildings?: InitialBuildingSpec[], realMapPlacement?: boolean) => void;
  onCancel: () => void;
}> = ({ companyName, setCompanyName, selectedArchetype, setSelectedArchetype, selectedColor, setSelectedColor, simulation, setSimulation, selectedCeo, setSelectedCeo, seed, setSeed, onStart, onCancel }) => {
  const archetype = ARCHETYPES.find(a => a.id === selectedArchetype)!;
  const COLORS = ['#00d4aa', '#ff6b35', '#007bff', '#ffc107', '#e83e8c', '#6f42c1', '#20c997', '#fd7e14'];

  // T: point-buy token system for editable starting stats (GDR character build).
  // The ONLY hard limit is the 100-token pool — no per-trait ceiling, so the
  // player can sink everything into one stat if they want to specialize.
  const TOKEN_BUDGET = 100;
  const [statOverrides, setStatOverrides] = useState<Partial<Record<string, number>>>({});
  const usedTokens = Object.values(statOverrides).reduce<number>((s, v) => s + (v ?? 0), 0);
  const adjustStat = (key: string, delta: number) => {
    setStatOverrides(prev => {
      const cur = prev[key] ?? 0;
      const next = Math.max(-20, Math.min(100, cur + delta));
      // T: compute the spend from the CURRENT (prev) state, not the stale
      // closure `usedTokens` — otherwise rapid clicks bypass the 100 budget.
      const curUsed = Object.values(prev).reduce<number>((s, v) => s + (v ?? 0), 0);
      const nextUsed = curUsed - (cur ?? 0) + next;
      if (nextUsed > TOKEN_BUDGET) return prev; // would exceed budget
      const copy = { ...prev };
      if (next === 0) delete copy[key]; else copy[key] = next;
      return copy;
    });
  };

  // T — CEO GDR point-buy (executive pillars). 20 tokens across traits + attributes.
  const CEO_TRAIT_COST = 4;
  const [ceoTraits, setCeoTraits] = useState<CEOTrait[]>(['none']);
  const [ceoSkills, setCeoSkills] = useState<Partial<Record<CEOSkill, number>>>({});
  const toggleCeoTrait = (t: CEOTrait) => {
    setCeoTraits(prev => {
      if (t === 'none') return ['none'];
      const without = prev.filter(x => x !== 'none' && x !== t);
      return prev.includes(t) ? without : [...without, t];
    });
  };
  const adjustCeoSkill = (s: CEOSkill, delta: number) => {
    setCeoSkills(prev => {
      const cur = prev[s] ?? 0;
      const next = Math.max(0, Math.min(10, cur + delta));
      const copy = { ...prev };
      if (next === 0) delete copy[s]; else copy[s] = next;
      return copy;
    });
  };
  const usedCeoTokens =
    ceoTraits.filter(t => t !== 'none').length * CEO_TRAIT_COST +
    Object.values(ceoSkills).reduce<number>((s, v) => s + (v ?? 0), 0);
  const ceoBuild: CeoBuild = {
    traits: ceoTraits,
    skills: ceoSkills,
    luck: ceoSkills.luck ?? 0,
    specialPoints: 1,
  };

  // T: New Game — player pre-distributes up to 8 departments across 3 starting
  // buildings (HQ + 2 branches). Dropped live on the board during placement.
  const [initialBuildings, setInitialBuildings] = useState<InitialBuildingSpec[]>([
    { isHQ: true, deptTypes: [] },
    { isHQ: false, deptTypes: [] },
    { isHQ: false, deptTypes: [] },
  ]);
  const MAX_DEPTS = 8;
  const toggleDept = (bIdx: number, dt: DepartmentType) => {
    setInitialBuildings(prev => {
      const total = prev.reduce((s, b) => s + b.deptTypes.length, 0);
      const next = prev.map(b => ({ ...b, deptTypes: [...b.deptTypes] }));
      const list = next[bIdx].deptTypes;
      const at = list.indexOf(dt);
      if (at >= 0) list.splice(at, 1);
      else if (total < MAX_DEPTS) list.push(dt);
      return next;
    });
  };

  return (
    <Modal title="NEW GAME SETUP" onClose={onCancel} size="xxl">
      <div className="new-game-modal">
        <div className="setup-name-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Enter company name"
              maxLength={24}
            />
          </div>
        </div>
        <div className="setup-top">
          {/* COLUMN 1: archetype choice + corporation traits underneath */}
          <div className="setup-col">
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

            <div className="setup-details" style={{ borderColor: archetype.color }}>
              <div className="preview-section-label">
                Corporation Traits
                <span className={`token-budget ${usedTokens >= TOKEN_BUDGET ? 'full' : ''}`}>
                  {TOKEN_BUDGET - usedTokens} / {TOKEN_BUDGET} tokens
                </span>
              </div>
              <div className="build-stats">
                {(Object.keys(STAT_LABELS) as (keyof CompanyStats)[]).map(k => {
                  const base = ARCHETYPE_STATS[selectedArchetype][k];
                  const ov = statOverrides[k] ?? 0;
                  const v = Math.max(0, Math.min(100, base + ov));
                  const tone = v >= 60 ? 'high' : v >= 35 ? 'mid' : 'low';
                  return (
                    <div key={k} className="build-stat">
                      <span className="bs-label">{STAT_LABELS[k]}</span>
                      <span className={`bs-bar bs-${tone}`} style={{ width: `${v}%` }} />
                      <span className="bs-val">{v}</span>
                      <span className="bs-stepper">
                        <button type="button" className="bs-btn" disabled={ov <= -20} onClick={() => adjustStat(k, -1)}>−</button>
                        <span className="bs-ov">{ov > 0 ? `+${ov}` : ov < 0 ? ov : '·'}</span>
                        <button type="button" className="bs-btn" disabled={usedTokens >= TOKEN_BUDGET} onClick={() => adjustStat(k, +1)}>+</button>
                      </span>
                    </div>
                  );
                })}
              </div>

          </div>

          </div>

          {/* COLUMN 2: CEO trait choice + GDR CEO build underneath */}
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

            <div className="setup-details" style={{ borderColor: '#00d4aa' }}>
              <div className="preview-section-label">CEO Perks — {CEO_TRAIT_DEFS[selectedCeo].name}</div>
              <div className="preview-stats">
                {CEO_TRAIT_DEFS[selectedCeo].perks.length === 0 && (
                  <span className="stat">Baseline — no perks</span>
                )}
                {CEO_TRAIT_DEFS[selectedCeo].perks.map((p, i) => (
                  <span key={i} className="stat ceo">{PERK_LABELS[p]}</span>
                ))}
              </div>
              <p className="ceo-blurb">{CEO_TRAIT_DEFS[selectedCeo].blurb}</p>

              <div className="preview-section-label">
                CEO Character Build (Executive Pillars)
                <span className={`token-budget ${usedCeoTokens > CEO_TOKEN_BUDGET ? 'full' : ''}`}>
                  {CEO_TOKEN_BUDGET - usedCeoTokens} / {CEO_TOKEN_BUDGET} tokens
                </span>
              </div>

              <div className="ceo-traits-buy">
                {(['banker', 'smart', 'initiative', 'none'] as CEOTrait[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`trait-buy ${ceoTraits.includes(t) ? 'on' : ''}`}
                    onClick={() => toggleCeoTrait(t)}
                    disabled={t !== 'none' && usedCeoTokens >= CEO_TOKEN_BUDGET && !ceoTraits.includes(t)}
                  >
                    {CEO_TRAIT_DEFS[t].name}
                    <span className="trait-cost">{t === 'none' ? 'free' : `$${CEO_TRAIT_COST}`}</span>
                  </button>
                ))}
              </div>

              <div className="ceo-special-buy">
                {CEO_PILLARS.map(s => {
                  const v = ceoSkills[s] ?? 0;
                  return (
                    <div key={s} className="bs-row">
                      <span className="bs-label">{PILLAR_LABELS[s]}</span>
                      <div className="bs-bar"><div className="bs-fill" style={{ width: `${v * 10}%` }} /></div>
                      <span className="bs-val">{v}</span>
                      <span className="bs-stepper">
                        <button type="button" className="bs-btn" disabled={v <= 0} onClick={() => adjustCeoSkill(s, -1)}>−</button>
                        <button type="button" className="bs-btn" disabled={usedCeoTokens >= CEO_TOKEN_BUDGET} onClick={() => adjustCeoSkill(s, +1)}>+</button>
                      </span>
                    </div>
                  );
                })}
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

        {/* LOWER ROW: Starting Buildings (pre-distributed depts) + Organization Perks, side by side */}
        <div className="setup-lower">
          <div className="setup-col">
            <div className="setup-details" style={{ borderColor: archetype.color }}>
              {/* T: New Game — pre-distribute up to 8 departments across 3 starting buildings */}
              <div className="preview-section-label">
                Starting Buildings — drop on map later
                <span className={`token-budget ${initialBuildings.reduce((s, b) => s + b.deptTypes.length, 0) >= MAX_DEPTS ? 'full' : ''}`}>
                  {MAX_DEPTS - initialBuildings.reduce((s, b) => s + b.deptTypes.length, 0)} / {MAX_DEPTS} departments
                </span>
              </div>
              <div className="setup-buildings">
                {initialBuildings.map((b, bi) => (
                  <div key={bi} className={`setup-building ${b.isHQ ? 'hq' : ''}`}>
                    <div className="sb-head">
                      <span className="sb-name">{b.isHQ ? 'HQ' : `Building ${bi + 1}`}</span>
                      <span className="sb-count">{b.deptTypes.length} dept{b.deptTypes.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="sb-depts">
                      {(['product_rd', 'ai_data', 'cybersecurity', 'sales_marketing', 'consulting_services', 'acquisitions', 'legal_compliance', 'people_culture', 'finance_investor', 'corporate_strategy', 'dev_engineering'] as DepartmentType[]).map(dt => {
                        const on = b.deptTypes.includes(dt);
                        return (
                          <button
                            key={dt}
                            type="button"
                            className={`sb-dept ${on ? 'on' : ''}`}
                            disabled={!on && initialBuildings.reduce((s, b) => s + b.deptTypes.length, 0) >= MAX_DEPTS}
                            onClick={() => toggleDept(bi, dt)}
                          >
                            {dt.replace('_', ' ')}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="setup-col">
            <div className="setup-details" style={{ borderColor: archetype.color }}>
              <div className="preview-section-label">Organization Perks — {archetype.name}</div>
              <div className="preview-stats">
                {ARCHETYPE_PERKS[selectedArchetype].length === 0 && (
                  <span className="stat">Baseline — no perks</span>
                )}
                {ARCHETYPE_PERKS[selectedArchetype].map((p, i) => (
                  <span key={i} className="stat org">{PERK_LABELS[p]}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* FULL-WIDTH BOTTOM ROW: seed + color + world simulation */}
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

          <div className="form-group sim-field">
            <label>World Simulation</label>
            <div className="toggle-stack">
              <label className="toggle-row">
                <input type="checkbox" checked={simulation.marketSimulation} onChange={e => setSimulation({ ...simulation, marketSimulation: e.target.checked })} />
                <span>Market Simulation</span>
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={simulation.cataclysms} onChange={e => setSimulation({ ...simulation, cataclysms: e.target.checked })} />
                <span>Cataclysms</span>
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={simulation.newTech} onChange={e => setSimulation({ ...simulation, newTech: e.target.checked })} />
                <span>New Technologies</span>
              </label>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onStart(statOverrides, ceoBuild, initialBuildings)} disabled={!companyName.trim() || usedCeoTokens > CEO_TOKEN_BUDGET}>
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
