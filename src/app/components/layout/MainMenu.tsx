import React, { useState } from 'react';
import { useGameStore } from '../../../store/gameStore';
import { MiniDB } from '../../../data/db';
import { ScenarioEditorModal, CampaignEditorModal } from './editors';
import { SettingsModal } from './SettingsModal';
import type { ScenarioConfig, CampaignConfig, CEOSkill, CeoBuild, InitialBuildingSpec, DepartmentType } from '../../../types';
import { ARCHETYPE_STATS, CEO_TRAIT_DEFS, STAT_LABELS, PERK_LABELS, CEO_SKILLS, SPECIAL_LABELS, CEO_TOKEN_BUDGET, type CompanyStats } from '../../../data/archetypes';
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
  const [showSettings, setShowSettings] = useState(false);
  const [seed, setSeed] = useState('');
  const [selectedColor, setSelectedColor] = useState('#00d4aa');
  const [simulation, setSimulation] = useState({ marketSimulation: true, cataclysms: false, newTech: false });
  const [selectedCeo, setSelectedCeo] = useState<CEOTrait>('none');

  const handleStart = (statOverrides?: Partial<Record<string, number>>, ceoBuild?: CeoBuild, initialBuildings?: InitialBuildingSpec[]) => {
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
        initialBuildings,
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
  onStart: (statOverrides?: Partial<Record<string, number>>, ceoBuild?: CeoBuild, initialBuildings?: InitialBuildingSpec[]) => void;
  onCancel: () => void;
}> = ({ companyName, setCompanyName, selectedArchetype, setSelectedArchetype, selectedColor, setSelectedColor, simulation, setSimulation, selectedCeo, setSelectedCeo, seed, setSeed, onStart, onCancel }) => {
  const archetype = ARCHETYPES.find(a => a.id === selectedArchetype)!;
  const COLORS = ['#00d4aa', '#ff6b35', '#007bff', '#ffc107', '#e83e8c', '#6f42c1', '#20c997', '#fd7e14'];

  // T: point-buy token system for editable starting stats (GDR character build).
  const TOKEN_BUDGET = 100;
  const [statOverrides, setStatOverrides] = useState<Partial<Record<string, number>>>({});
  const usedTokens = Object.values(statOverrides).reduce<number>((s, v) => s + (v ?? 0), 0);
  const adjustStat = (key: string, delta: number) => {
    setStatOverrides(prev => {
      const cur = prev[key] ?? 0;
      const next = Math.max(-20, Math.min(40, cur + delta));
      const nextUsed = usedTokens - (cur ?? 0) + next;
      if (nextUsed > TOKEN_BUDGET) return prev; // would exceed budget
      const copy = { ...prev };
      if (next === 0) delete copy[key]; else copy[key] = next;
      return copy;
    });
  };

  // T — CEO GDR point-buy (Fallout S.P.E.C.I.A.L.). 20 tokens across traits + attributes.
  const CEO_TRAIT_COST = 4;
  const [ceoTraits, setCeoTraits] = useState<CEOTrait[]>(['none']);
  const [ceoSkills, setCeoSkills] = useState<Partial<Record<CEOSkill, number>>>({});
  const [ceoLuck, setCeoLuck] = useState<number>(0);
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
    Object.values(ceoSkills).reduce<number>((s, v) => s + (v ?? 0), 0) +
    ceoLuck;
  const ceoBuild: CeoBuild = {
    traits: ceoTraits,
    skills: ceoSkills,
    luck: ceoLuck,
    specialPoints: 1,
  };

  // T: New Game placement — player hand-places up to 3 buildings (1 HQ + others),
  // each with up to 3 departments, onto the starting market grid before rivals spawn.
  const GRID_W = 8;
  const GRID_H = 8;
  const DEPT_CHOICES: { value: DepartmentType; label: string }[] = [
    { value: 'product_rd', label: 'R&D' },
    { value: 'ai_data', label: 'AI' },
    { value: 'cybersecurity', label: 'Cyber' },
    { value: 'sales_marketing', label: 'Sales' },
    { value: 'consulting_services', label: 'Consulting' },
    { value: 'acquisitions', label: 'Acq' },
    { value: 'legal_compliance', label: 'Legal' },
    { value: 'people_culture', label: 'People' },
    { value: 'finance_investor', label: 'Finance' },
    { value: 'corporate_strategy', label: 'Strategy' },
    { value: 'dev_engineering', label: 'DEV' },
  ];
  const [empireSetup, setEmpireSetup] = useState<InitialBuildingSpec[]>([
    { isHQ: true, deptTypes: ['product_rd', 'sales_marketing'], slot: 27 },
    { isHQ: false, deptTypes: ['cybersecurity', 'legal_compliance'], slot: 28 },
  ]);
  // which building a grid slot is assigned to (slot -> building index), for highlighting
  const slotToBuilding = (slot: number) => empireSetup.findIndex(b => b.slot === slot);
  const toggleSlot = (slot: number) => {
    setEmpireSetup(prev => {
      const idx = prev.findIndex(b => b.slot === slot);
      if (idx >= 0) {
        // clicking an occupied slot removes that building
        const copy = prev.filter((_, i) => i !== idx);
        return copy.length ? copy : [{ isHQ: true, deptTypes: [], slot }];
      }
      if (prev.length >= 3) return prev; // max 3 buildings
      const isFirst = prev.length === 0;
      return [...prev, { isHQ: isFirst, deptTypes: [], slot }];
    });
  };
  const updateBuilding = (idx: number, patch: Partial<InitialBuildingSpec>) =>
    setEmpireSetup(prev => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  const toggleDept = (idx: number, dt: DepartmentType) =>
    setEmpireSetup(prev => prev.map((b, i) => {
      if (i !== idx) return b;
      const has = b.deptTypes.includes(dt);
      const next = has ? b.deptTypes.filter(d => d !== dt) : b.deptTypes.length < 3 ? [...b.deptTypes, dt] : b.deptTypes;
      return { ...b, deptTypes: next };
    }));

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

          {/* THIRD COLUMN: selected archetype preview (GDR build planner) */}
          <div className="setup-col preview-col">
            <div className="archetype-preview" style={{ borderColor: archetype.color }}>
              <h3>{archetype.name}</h3>
              <p>{archetype.desc}</p>

              <div className="preview-section-label">
                Initial Build Stats
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
                        <button type="button" className="bs-btn" disabled={usedTokens >= TOKEN_BUDGET && ov <= 0} onClick={() => adjustStat(k, -1)}>−</button>
                        <span className="bs-ov">{ov > 0 ? `+${ov}` : ov < 0 ? ov : '·'}</span>
                        <button type="button" className="bs-btn" disabled={usedTokens >= TOKEN_BUDGET && ov >= 0} onClick={() => adjustStat(k, +1)}>+</button>
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="preview-section-label">CEO Perks — {CEO_TRAIT_DEFS[selectedCeo].name}</div>
              <div className="preview-stats">
                {CEO_TRAIT_DEFS[selectedCeo].perks.length === 0 && (
                  <span className="stat">Baseline — no perks</span>
                )}
                {CEO_TRAIT_DEFS[selectedCeo].perks.map((p, i) => (
                  <span key={i} className="stat positive">{PERK_LABELS[p]}</span>
                ))}
              </div>
              <p className="ceo-blurb">{CEO_TRAIT_DEFS[selectedCeo].blurb}</p>

              {/* CEO GDR point-buy: 20 tokens across traits + S.P.E.C.I.A.L. + Luck */}
              <div className="preview-section-label">
                CEO Character Build (S.P.E.C.I.A.L.)
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
                {CEO_SKILLS.map(s => {
                  const v = ceoSkills[s] ?? 0;
                  return (
                    <div key={s} className="bs-row">
                      <span className="bs-label">{SPECIAL_LABELS[s]}</span>
                      <div className="bs-bar"><div className="bs-fill" style={{ width: `${v * 10}%` }} /></div>
                      <span className="bs-val">{v}</span>
                      <span className="bs-stepper">
                        <button type="button" className="bs-btn" disabled={v <= 0} onClick={() => adjustCeoSkill(s, -1)}>−</button>
                        <button type="button" className="bs-btn" disabled={usedCeoTokens >= CEO_TOKEN_BUDGET} onClick={() => adjustCeoSkill(s, +1)}>+</button>
                      </span>
                    </div>
                  );
                })}
                <div className="bs-row">
                  <span className="bs-label">L — Luck</span>
                  <div className="bs-bar"><div className="bs-fill luck" style={{ width: `${ceoLuck * 10}%` }} /></div>
                  <span className="bs-val">{ceoLuck}</span>
                  <span className="bs-stepper">
                    <button type="button" className="bs-btn" disabled={ceoLuck <= 0} onClick={() => setCeoLuck(Math.max(0, ceoLuck - 1))}>−</button>
                    <button type="button" className="bs-btn" disabled={usedCeoTokens >= CEO_TOKEN_BUDGET} onClick={() => setCeoLuck(Math.min(10, ceoLuck + 1))}>+</button>
                  </span>
                </div>
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

        {/* T: New Game placement — hand-place up to 3 buildings (1 HQ + others) on the grid */}
        <div className="empire-setup">
          <h3>EMPIRE SETUP — place your buildings</h3>
          <p className="setup-hint">Click grid cells to drop up to 3 buildings (1st = HQ). Each holds up to 3 departments. Rivals appear after you start.</p>
          <div className="empire-grid" style={{ gridTemplateColumns: `repeat(${GRID_W}, 1fr)` }}>
            {Array.from({ length: GRID_W * GRID_H }).map((_, slot) => {
              const bi = slotToBuilding(slot);
              return (
                <button
                  key={slot}
                  className={`grid-cell ${bi >= 0 ? (empireSetup[bi].isHQ ? 'hq' : 'bld') : ''}`}
                  disabled={bi < 0 && empireSetup.length >= 3}
                  onClick={() => toggleSlot(slot)}
                  title={bi >= 0 ? `${empireSetup[bi].isHQ ? 'HQ' : 'BUILDING'} (slot ${slot})` : 'Place building'}
                >
                  {bi >= 0 ? (empireSetup[bi].isHQ ? '⚑' : (bi + 1)) : ''}
                </button>
              );
            })}
          </div>

          <div className="empire-buildings">
            {empireSetup.map((b, idx) => (
              <div key={idx} className={`empire-bld ${b.isHQ ? 'hq' : ''}`}>
                <div className="eb-head">
                  <label className="eb-name">
                    {b.isHQ ? 'HQ' : `BUILDING ${idx + 1}`} name
                    <input
                      type="text"
                      value={b.name ?? ''}
                      maxLength={24}
                      placeholder={b.isHQ ? 'HQ' : `BUILDING ${idx + 1}`}
                      onChange={e => updateBuilding(idx, { name: e.target.value })}
                    />
                  </label>
                  {!b.isHQ && (
                    <button className="eb-rm" onClick={() => setEmpireSetup(prev => prev.filter((_, i) => i !== idx))}>remove</button>
                  )}
                </div>
                <div className="eb-depts">
                  {DEPT_CHOICES.map(dt => (
                    <button
                      key={dt.value}
                      className={`eb-dept ${b.deptTypes.includes(dt.value) ? 'on' : ''}`}
                      disabled={!b.deptTypes.includes(dt.value) && b.deptTypes.length >= 3}
                      onClick={() => toggleDept(idx, dt.value)}
                    >
                      {dt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onStart(statOverrides, ceoBuild, empireSetup)} disabled={!companyName.trim() || usedCeoTokens > CEO_TOKEN_BUDGET}>
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
