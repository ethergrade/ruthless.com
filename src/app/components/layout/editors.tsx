import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import type {
  ScenarioConfig, ScenarioWinCondition, CampaignConfig,
  CompanyArchetype, CEOTrait,
} from '../../../types';
import { ARCHETYPES_SIMPLE, CEOS_SIMPLE, genId } from '../../../data/editorsData';
import { useSettings } from '../../../store/settings';

/**
 * SCENARIO EDITOR — tactical, self-contained board setup.
 * No continuity: one board, win conditions, rivals, seed.
 */
export const ScenarioEditorModal: React.FC<{
  onStart: (cfg: ScenarioConfig) => void;
  onCancel: () => void;
}> = ({ onStart, onCancel }) => {
  const [name, setName] = useState('Skirmish');
  const [mapSize, setMapSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [aiRivals, setAiRivals] = useState(3);
  const [startCash, setStartCash] = useState(5000000);
  const [disasters, setDisasters] = useState(true);
  const [winKind, setWinKind] = useState<ScenarioWinCondition['kind']>('tile_control');
  const [winTarget, setWinTarget] = useState(5);
  const [seed, setSeed] = useState('');

  const winConditions: ScenarioWinCondition[] = [{ kind: winKind, target: winTarget } as ScenarioWinCondition];

  return (
    <Modal title="SCENARIO EDITOR" onClose={onCancel} size="md">
      <div className="editor-modal scenario-editor">
        <p className="editor-sub">Tactical sandbox — one board, win conditions, no carry-over.</p>
        <div className="form-group">
          <label>Scenario Name</label>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={28} />
        </div>
        <div className="form-group">
          <label>Map Size</label>
          <div className="seg-control">
            {(['small', 'medium', 'large'] as const).map(s => (
              <button key={s} className={`seg ${mapSize === s ? 'sel' : ''}`} onClick={() => setMapSize(s)}>
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label>AI Rivals: {aiRivals}</label>
          <input type="range" min={1} max={4} value={aiRivals} onChange={e => setAiRivals(parseInt(e.target.value))} />
        </div>
        <div className="form-group">
          <label>Player Start Cash</label>
          <input type="number" value={startCash} step={500000} onChange={e => setStartCash(Math.max(1000000, parseInt(e.target.value) || 0))} />
        </div>
        <div className="form-group row">
          <div>
            <label>Win Condition</label>
            <select value={winKind} onChange={e => setWinKind(e.target.value as ScenarioWinCondition['kind'])}>
              <option value="tile_control">Control N tiles</option>
              <option value="valuation">Reach $ valuation</option>
              <option value="market_share">Market share %</option>
              <option value="turn_limit">Survive N turns</option>
            </select>
          </div>
          <div>
            <label>Target</label>
            <input type="number" value={winTarget} onChange={e => setWinTarget(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
        </div>
        <div className="form-group">
          <label>Seed (optional)</label>
          <input value={seed} placeholder="random" maxLength={10} onChange={e => setSeed(e.target.value)} />
        </div>
        <label className="check-row">
          <input type="checkbox" checked={disasters} onChange={e => setDisasters(e.target.checked)} />
          Enable cataclysms &amp; market shocks
        </label>
        <div className="editor-actions">
          <button className="menu-btn ghost" onClick={onCancel}>CANCEL</button>
          <button className="menu-btn primary" onClick={() => onStart({
            id: genId('scn'),
            name: name.trim() || 'Skirmish',
            mapSize, aiRivals, startCash, disasters, winConditions,
            seed: seed ? parseInt(seed) : undefined,
          })}>PLAY SCENARIO ▶</button>
        </div>
      </div>
    </Modal>
  );
};

/**
 * CAMPAIGN EDITOR — narrative multi-chapter arc with a PERSISTENT player corp.
 * Defines the arc; chapter 1 starts immediately with your carried corporation.
 */
export const CampaignEditorModal: React.FC<{
  onStart: (cfg: CampaignConfig) => void;
  onCancel: () => void;
}> = ({ onStart, onCancel }) => {
  const [name, setName] = useState('Rise of the Shark');
  const [chapters, setChapters] = useState(3);
  const [corpName, setCorpName] = useState('MyCorp');
  const [archetype, setArchetype] = useState<CompanyArchetype>('hypergrowth_platform');
  const [ceoTrait, setCeoTrait] = useState<CEOTrait>('none');
  const [color, setColor] = useState('#00d4aa');
  const [aiDifficulty, setAiDifficulty] = useState<'docile' | 'aggressive' | 'ruthless'>('aggressive');
  const [intro, setIntro] = useState('A new player enters a market ruled by sharks. Build, betray, dominate.');

  return (
    <Modal title="CAMPAIGN EDITOR" onClose={onCancel} size="md">
      <div className="editor-modal campaign-editor">
        <p className="editor-sub">Narrative arc — your corporation persists across chapters. Chapter 1 starts now.</p>
        <div className="form-group">
          <label>Campaign Name</label>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={28} />
        </div>
        <div className="form-group">
          <label>Chapters: {chapters}</label>
          <input type="range" min={1} max={5} value={chapters} onChange={e => setChapters(parseInt(e.target.value))} />
        </div>
        <div className="form-group">
          <label>Story Hook (intro)</label>
          <textarea value={intro} rows={2} onChange={e => setIntro(e.target.value)} maxLength={200} />
        </div>

        <h4 className="editor-h4">Persistent Player Corporation</h4>
        <div className="form-group">
          <label>Corp Name</label>
          <input value={corpName} onChange={e => setCorpName(e.target.value)} maxLength={24} />
        </div>
        <div className="form-group">
          <label>Archetype</label>
          <select value={archetype} onChange={e => setArchetype(e.target.value as CompanyArchetype)}>
            {ARCHETYPES_SIMPLE.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>CEO Trait</label>
          <select value={ceoTrait} onChange={e => setCeoTrait(e.target.value as CEOTrait)}>
            {CEOS_SIMPLE.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group row">
          <div>
            <label>Corp Color</label>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} />
          </div>
          <div>
            <label>AI Difficulty</label>
            <select value={aiDifficulty} onChange={e => setAiDifficulty(e.target.value as 'docile' | 'aggressive' | 'ruthless')}>
              <option value="docile">Docile</option>
              <option value="aggressive">Aggressive</option>
              <option value="ruthless">Ruthless</option>
            </select>
          </div>
        </div>
        <div className="editor-actions">
          <button className="menu-btn ghost" onClick={onCancel}>CANCEL</button>
          <button className="menu-btn primary" onClick={() => {
            const { difficultyOverride } = useSettings.getState();
            const ch: CampaignConfig['chapters'] = [];
            for (let i = 0; i < chapters; i++) {
              ch.push({
                id: genId('ch'),
                title: `Chapter ${i + 1}`,
                aiDifficulty: difficultyOverride !== 'none' ? difficultyOverride : aiDifficulty,
                narrativeIntro: i === 0 ? intro : undefined,
                scenario: {
                  id: genId('scn'),
                  name: `${name} — Ch.${i + 1}`,
                  mapSize: i === 0 ? 'medium' : (i >= 3 ? 'large' : 'medium'),
                  aiRivals: Math.min(4, 2 + i),
                  startCash: 5000000 + i * 1000000,
                  disasters: true,
                  winConditions: [{ kind: 'tile_control', target: 4 + i * 2 }],
                },
              });
            }
            onStart({
              id: genId('cmp'),
              name: name.trim() || 'Campaign',
              chapters: ch,
              playerCorp: { name: corpName.trim() || 'MyCorp', archetype, ceoTrait, color },
              intro,
            });
          }}>START CAMPAIGN ▶</button>
        </div>
      </div>
    </Modal>
  );
};
