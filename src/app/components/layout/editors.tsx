import React, { useMemo, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import type {
  ScenarioConfig, ScenarioWinCondition, CampaignConfig,
  CompanyArchetype, CEOTrait,
  CampaignDefinition, CampaignChapter,
} from '../../../types';
import { genId } from '../../../data/editorsData';
import { CampaignLibrary, createCampaignDefinition, validateCampaign } from '../../../data/campaigns';

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
          <input type="range" min={1} max={7} value={aiRivals} onChange={e => setAiRivals(parseInt(e.target.value))} />
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
  const [campaign, setCampaign] = useState<CampaignDefinition>(() => CampaignLibrary.save(CampaignLibrary.list()[0] ?? createCampaignDefinition()));
  const [selectedId, setSelectedId] = useState(campaign.entryChapterId);
  const [message, setMessage] = useState('Autosave ready.');
  const [corpName, setCorpName] = useState('PTO Industries');
  const [archetype] = useState<CompanyArchetype>('hypergrowth_platform');
  const [ceoTrait] = useState<CEOTrait>('initiative');
  const [color] = useState('#00c8df');
  const selected = campaign.chapters.find(ch => ch.id === selectedId) ?? campaign.chapters[0];
  const validation = useMemo(() => validateCampaign(campaign), [campaign]);

  const commit = (next: CampaignDefinition, note = 'Campaign autosaved.') => {
    const saved = CampaignLibrary.save(next);
    setCampaign(saved);
    setMessage(note);
  };
  const updateSelected = (patch: Partial<CampaignChapter>) => {
    commit({ ...campaign, chapters: campaign.chapters.map(ch => ch.id === selected.id ? { ...ch, ...patch } : ch) });
  };
  const addChapter = () => {
    const id = genId('chapter');
    const chapter: CampaignChapter = {
      id, title: `Chapter ${campaign.chapters.length + 1}`, aiDifficulty: 'aggressive', narrativeBeats: [],
      scenario: { id: genId('scn'), name: `Market ${campaign.chapters.length + 1}`, mapSize: 'medium', aiRivals: 3, startCash: 5_000_000, disasters: true, winConditions: [] },
    };
    commit({ ...campaign, chapters: [...campaign.chapters, chapter] }, 'Chapter created.');
    setSelectedId(id);
  };
  const connectTo = (toChapterId: string) => {
    if (!selected || toChapterId === selected.id) return;
    commit({ ...campaign, edges: [...campaign.edges, { id: genId('edge'), fromChapterId: selected.id, toChapterId, label: 'Continue', conditions: [{ kind: 'always' }] }] }, 'Transition created.');
  };
  const exportJson = () => {
    const blob = new Blob([CampaignLibrary.export(campaign)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href; anchor.download = `${campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.strategyless.json`; anchor.click();
    URL.revokeObjectURL(href);
  };
  const importJson = async (file?: File) => {
    if (!file) return;
    try {
      const imported = CampaignLibrary.import(await file.text());
      setCampaign(imported); setSelectedId(imported.entryChapterId); setMessage('Import validated and saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Import failed.'); }
  };

  const play = () => {
    if (!validation.valid || !campaign.chapters.length) { setMessage('Resolve validation errors before playtest.'); return; }
    const cfg: CampaignConfig = {
      id: campaign.id, name: campaign.name, intro: campaign.description,
      chapters: campaign.chapters,
      playerCorp: { name: corpName, archetype, ceoTrait, color },
      definition: campaign,
    };
    onStart(cfg);
  };

  return (
    <Modal title="CAMPAIGN EDITOR / NARRATIVE NETWORK" onClose={onCancel} size="xxl">
      <div className="campaign-workbench">
        <div className="campaign-toolbar">
          <button onClick={() => { const fresh = createCampaignDefinition(); commit(fresh, 'New campaign created.'); setSelectedId(fresh.entryChapterId); }}>NEW CAMPAIGN</button>
          <button onClick={addChapter}>ADD CHAPTER</button>
          <label className="campaign-file">IMPORT JSON<input type="file" accept="application/json,.json" onChange={e => void importJson(e.target.files?.[0])} /></label>
          <button onClick={exportJson}>EXPORT JSON</button>
          <button onClick={() => setMessage(validation.valid ? 'Validation passed.' : validation.errors.join(' '))}>VALIDATE</button>
          <button className="primary" onClick={play}>PLAYTEST</button>
        </div>
        <aside className="campaign-outline">
          <span className="workbench-kicker">OUTLINE</span>
          <input value={campaign.name} onChange={e => commit({ ...campaign, name: e.target.value })} aria-label="Campaign name" />
          <textarea value={campaign.description} onChange={e => commit({ ...campaign, description: e.target.value })} rows={3} aria-label="Campaign description" />
          <nav>
            {campaign.chapters.map((chapter, index) => (
              <button key={chapter.id} className={chapter.id === selected.id ? 'active' : ''} onClick={() => setSelectedId(chapter.id)}>
                <span>{String(index + 1).padStart(2, '0')}</span>{chapter.title}{chapter.isFinal ? ' / FINAL' : ''}
              </button>
            ))}
          </nav>
          <div className="campaign-library-count">{CampaignLibrary.list().length} local campaign(s)</div>
        </aside>
        <section className="campaign-graph" aria-label="Campaign graph">
          <div className="graph-grid" />
          {campaign.chapters.map((chapter, index) => (
            <button key={chapter.id} className={`chapter-node ${chapter.id === selected.id ? 'selected' : ''} ${chapter.isFinal ? 'final' : ''}`} onClick={() => setSelectedId(chapter.id)}>
              <small>NODE {String(index + 1).padStart(2, '0')}</small>
              <strong>{chapter.title}</strong>
              <span>{chapter.turnLimit ? `${chapter.turnLimit} turns` : 'open turns'} · {chapter.scenario.aiRivals} rivals</span>
              <em>{campaign.edges.filter(edge => edge.fromChapterId === chapter.id).length} exit(s)</em>
            </button>
          ))}
        </section>
        <aside className="campaign-inspector">
          <span className="workbench-kicker">CHAPTER INSPECTOR</span>
          <label>Title<input value={selected.title} onChange={e => updateSelected({ title: e.target.value })} /></label>
          <label>Briefing<textarea rows={4} value={selected.narrativeIntro ?? ''} onChange={e => updateSelected({ narrativeIntro: e.target.value })} /></label>
          <div className="inspector-pair">
            <label>Turn limit<input type="number" min={0} value={selected.turnLimit ?? 0} onChange={e => updateSelected({ turnLimit: Number(e.target.value) || undefined })} /></label>
            <label>Board<select value={selected.scenario.mapSize} onChange={e => updateSelected({ scenario: { ...selected.scenario, mapSize: e.target.value as 'small' | 'medium' | 'large' } })}><option>small</option><option>medium</option><option>large</option></select></label>
          </div>
          <div className="campaign-ai-control">
            <div className="campaign-control-head">
              <span>AI RIVALS</span>
              <output aria-live="polite" aria-label={`${selected.scenario.aiRivals} AI rivals`}>{selected.scenario.aiRivals}</output>
            </div>
            <div className="campaign-slider-row">
              <button type="button" aria-label="Remove one AI rival" disabled={selected.scenario.aiRivals <= 1} onClick={() => updateSelected({ scenario: { ...selected.scenario, aiRivals: Math.max(1, selected.scenario.aiRivals - 1) } })}>−</button>
              <input aria-label="AI rivals" type="range" min={1} max={7} step={1} value={selected.scenario.aiRivals} onChange={e => updateSelected({ scenario: { ...selected.scenario, aiRivals: Number(e.target.value) } })} />
              <button type="button" aria-label="Add one AI rival" disabled={selected.scenario.aiRivals >= 7} onClick={() => updateSelected({ scenario: { ...selected.scenario, aiRivals: Math.min(7, selected.scenario.aiRivals + 1) } })}>+</button>
            </div>
            <div className="campaign-range-scale" aria-hidden="true">{[1, 2, 3, 4, 5, 6, 7].map(value => <span key={value} className={value === selected.scenario.aiRivals ? 'active' : ''}>{value}</span>)}</div>
            <label className="campaign-inspector-check">
              <input type="checkbox" checked={!!selected.isFinal} onChange={e => updateSelected({ isFinal: e.target.checked })} />
              <span><strong>Final chapter</strong><small>End the campaign when this node resolves.</small></span>
            </label>
          </div>
          <label>Connect to<select defaultValue="" onChange={e => { connectTo(e.target.value); e.currentTarget.value = ''; }}><option value="">Add transition…</option>{campaign.chapters.filter(ch => ch.id !== selected.id).map(ch => <option key={ch.id} value={ch.id}>{ch.title}</option>)}</select></label>
          <div className="edge-list">{campaign.edges.filter(edge => edge.fromChapterId === selected.id).map(edge => <div key={edge.id}><strong>{edge.label}</strong><span>→ {campaign.chapters.find(ch => ch.id === edge.toChapterId)?.title}</span></div>)}</div>
          <label>Playtest corporation<input value={corpName} onChange={e => setCorpName(e.target.value)} /></label>
        </aside>
        <footer className={`campaign-console ${validation.valid ? 'valid' : 'invalid'}`}>
          <strong>{validation.valid ? 'VALID' : `${validation.errors.length} ERROR(S)`}</strong>
          <span>{message}</span>
          <span>{validation.warnings.join(' ')}</span>
          <button onClick={onCancel}>CLOSE</button>
        </footer>
      </div>
    </Modal>
  );
};
