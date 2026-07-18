import React, { useEffect, useState } from 'react';
import type {
  ActionType, Company, CompanyId, MarketTile, ProductCategory,
  VoiceTone, CampaignAuthenticity, RuthlessDept, TileId, ProductId,
} from '../../../types';
import {
  PRODUCT_CATEGORIES, SEGMENT_LABELS, VOICE_TONES, AUTHENTICITY_LEVELS,
  spinProductName,
} from '../../../data/generators';

interface Props {
  playerCompany: Company;
  companies: Company[];
  tiles: MarketTile[];
  presetType?: ActionType | null;
  initialDraft?: import('../../../types').TurnAction | null;
  onClose: () => void;
  onAdd: (action: Omit<import('../../../types').TurnAction, 'id' | 'status'>) => void;
  /** Live success-estimate 0..1 for the currently configured action (req 4). */
  estimate?: (action: Omit<import('../../../types').TurnAction, 'id' | 'status'>) => number;
}

interface ActionDef {
  type: ActionType;
  label: string;
  group: string;
  baseCost: number;
  /** what extra inputs this action needs */
  needs?: ('targetCompany' | 'targetDept' | 'targetTile' | 'tone' | 'auth' | 'productEditor' | 'offer' | 'auctionAsset' | 'targetProduct')[];
}

const ACTION_DEFS: ActionDef[] = [
  { type: 'build_department', label: 'Build Department', group: 'Corporate', baseCost: 500000 },
  { type: 'build_building', label: 'Build Building', group: 'Corporate', baseCost: 750000, needs: ['targetTile'] },
  { type: 'hire_executive', label: 'Hire Executive', group: 'Corporate', baseCost: 400000 },
  { type: 'raise_capital', label: 'Raise Capital', group: 'Corporate', baseCost: 0 },
  { type: 'reduce_costs', label: 'Reduce Costs', group: 'Corporate', baseCost: 0 },
  { type: 'launch_product', label: 'Launch Product', group: 'Product & R&D', baseCost: 300000, needs: ['productEditor'] },
  { type: 'improve_product', label: 'Improve Product', group: 'Product & R&D', baseCost: 100000, needs: ['targetProduct'] },
  { type: 'ai_automation', label: 'AI Automation', group: 'Product & R&D', baseCost: 250000 },
  { type: 'expand_market', label: 'Expand Market', group: 'Market & Sales', baseCost: 200000 },
  { type: 'marketing_campaign', label: 'Marketing Campaign', group: 'Market & Sales', baseCost: 150000, needs: ['targetProduct', 'tone', 'auth'] },
  { type: 'launch_consulting_practice', label: 'Consulting Practice', group: 'Market & Sales', baseCost: 150000 },
  { type: 'ceo_social', label: 'CEO Social Post', group: 'Market & Sales', baseCost: 100000, needs: ['tone', 'auth'] },
  { type: 'security_hardening', label: 'Security Hardening', group: 'Security & M&A', baseCost: 200000 },
  { type: 'security_offline', label: 'Physical Security', group: 'Security & M&A', baseCost: 200000, needs: ['targetTile'] },
  { type: 'security_online', label: 'Cyber Defense', group: 'Security & M&A', baseCost: 150000 },
  { type: 'industrial_espionage', label: 'Industrial Espionage', group: 'Security & M&A', baseCost: 200000, needs: ['targetCompany', 'targetDept'] },
  { type: 'cyber_attack', label: 'Cyber Attack', group: 'Security & M&A', baseCost: 250000, needs: ['targetCompany', 'targetTile'] },
  { type: 'legal_action', label: 'Legal Action', group: 'Security & M&A', baseCost: 250000, needs: ['targetCompany', 'targetTile'] },
  { type: 'scout_acquisition', label: 'Scout Acquisition', group: 'Security & M&A', baseCost: 50000 },
  { type: 'acquire_company', label: 'Acquire Company', group: 'Security & M&A', baseCost: 2000000, needs: ['targetCompany'] },
  { type: 'public_tender_offer', label: 'Public Tender Offer (OPA)', group: 'Security & M&A', baseCost: 1500000, needs: ['targetCompany', 'offer'] },
  { type: 'auction_sell', label: 'List on Auction House', group: 'Security & M&A', baseCost: 0, needs: ['auctionAsset'] },
];

const DEPT_OPTIONS: { value: RuthlessDept; label: string }[] = [
  { value: 'rd', label: 'R&D' }, { value: 'product', label: 'Product' },
  { value: 'marketing', label: 'Marketing' }, { value: 'hr', label: 'HR' },
  { value: 'legal', label: 'Legal' }, { value: 'security', label: 'Security' },
  { value: 'computer_core', label: 'Computer Core' }, { value: 'admin', label: 'Admin' },
  { value: 'acquisitions', label: 'Acquisitions' },
];

export const ActionComposer: React.FC<Props> = ({
  playerCompany, companies, tiles, presetType, initialDraft, onClose, onAdd, estimate,
}) => {
  const groups = Array.from(new Set(ACTION_DEFS.map(a => a.group)));
  const [type, setType] = useState<ActionType>(presetType ?? 'build_department');
  const [, setGroup] = useState<string>(
    ACTION_DEFS.find(a => a.type === (presetType ?? 'build_department'))?.group ?? groups[0]
  );
  const def = ACTION_DEFS.find(a => a.type === type)!;
  const maxBudget = Math.floor(playerCompany.cash * 0.5);
  const [budget, setBudget] = useState<number>(Math.min(def.baseCost, maxBudget) || 0);

  const [targetCompanyId, setTargetCompanyId] = useState<CompanyId | ''>('');
  const [targetDept, setTargetDept] = useState<RuthlessDept>('rd');
  const [targetTileId, setTargetTileId] = useState<TileId | ''>('');
  const [tone, setTone] = useState<VoiceTone>(playerCompany.voiceTone ?? 'aggressive');
  const [auth, setAuth] = useState<CampaignAuthenticity>(playerCompany.campaignAuthenticity ?? 'aspirational');
  const [auctionAssetId, setAuctionAssetId] = useState<string>('');
  const [targetProductId, setTargetProductId] = useState<ProductId | ''>('');

  // product editor state
  const [productName, setProductName] = useState<string>('');
  const [productCategory, setProductCategory] = useState<ProductCategory>('saas');
  const [spinSeed] = useState<number>(Math.floor(Math.random() * 100000));

  // Pre-fill from a previous order so the player can tweak & re-plan it (req P2).
  useEffect(() => {
    if (!initialDraft) return;
    setType(initialDraft.type);
    setBudget(initialDraft.budget);
    setTargetCompanyId(initialDraft.targetCompanyId ?? '');
    setTargetTileId(initialDraft.targetTileId ?? '');
    setTargetProductId(initialDraft.targetProductId ?? '');
    setTone(initialDraft.tone ?? (playerCompany.voiceTone ?? 'aggressive'));
    setAuth(initialDraft.authenticity ?? (playerCompany.campaignAuthenticity ?? 'aspirational'));
    if (initialDraft.type === 'launch_product') {
      setProductName(initialDraft.productName ?? '');
      setProductCategory((initialDraft.productCategory as ProductCategory) ?? 'saas');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDraft]);

  const rivals = companies.filter(c => c.id !== playerCompany.id);
  const needs = def.needs ?? [];
  const canSubmit = budget > 0 || def.baseCost === 0 ||
    (type === 'launch_product' && !!productName) ||
    (type === 'auction_sell' && !!auctionAssetId);

  // live success estimate (req 4)
  const draft: Omit<import('../../../types').TurnAction, 'id' | 'status'> = {
    type,
    companyId: playerCompany.id,
    budget,
    priority: 1,
    targetCompanyId: targetCompanyId || undefined,
    targetDept: needs.includes('targetDept') ? targetDept : undefined,
    targetTileId: targetTileId || undefined,
    tone: needs.includes('tone') ? tone : undefined,
    authenticity: needs.includes('auth') ? auth : undefined,
    targetProductId: needs.includes('targetProduct') ? targetProductId || undefined : undefined,
    productName: type === 'launch_product' ? productName : undefined,
    productCategory: type === 'launch_product' ? productCategory : undefined,
    offerPrice: type === 'public_tender_offer' ? budget : undefined,
    targetId: type === 'auction_sell' ? auctionAssetId || undefined : undefined,
  };
  const successPct = estimate ? Math.round(estimate(draft) * 100) : null;

  const submit = () => {
    onAdd({
      type,
      companyId: playerCompany.id,
      budget,
      priority: 1,
      targetCompanyId: targetCompanyId || undefined,
      targetDept: needs.includes('targetDept') ? targetDept : undefined,
      targetTileId: targetTileId || undefined,
      tone: needs.includes('tone') ? tone : undefined,
      authenticity: needs.includes('auth') ? auth : undefined,
      targetProductId: needs.includes('targetProduct') ? targetProductId || undefined : undefined,
      productName: type === 'launch_product' ? productName : undefined,
      productCategory: type === 'launch_product' ? productCategory : undefined,
      offerPrice: type === 'public_tender_offer' ? budget : undefined,
      targetId: type === 'auction_sell' ? auctionAssetId || undefined : undefined,
    });
    onClose();
  };

  const selectType = (t: ActionType) => {
    setType(t);
    const d = ACTION_DEFS.find(a => a.type === t)!;
    setGroup(d.group);
    setBudget(Math.min(d.baseCost, maxBudget) || 0);
  };

  return (
    <div className="action-composer">
      <div className="ac-groups">
        {groups.map(g => (
          <div key={g} className="ac-group">
            <h4>{g}</h4>
            <div className="ac-buttons">
              {ACTION_DEFS.filter(a => a.group === g).map(a => (
                <button
                  key={a.type}
                  className={`ac-btn ${type === a.type ? 'selected' : ''}`}
                  onClick={() => selectType(a.type)}
                >
                  <span>{a.label}</span>
                  {a.baseCost > 0 && <span className="ac-cost">${a.baseCost.toLocaleString()}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="ac-config">
        {/* target company */}
        {needs.includes('targetCompany') && (
          <div className="ac-field">
            <label>Target Corporation</label>
            <select value={targetCompanyId} onChange={e => setTargetCompanyId(e.target.value)}>
              <option value="">— select rival —</option>
              {rivals.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.isStartup ? ' (start-up)' : ''} · ${c.cash.toLocaleString()}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* target dept for espionage */}
        {needs.includes('targetDept') && (
          <div className="ac-field">
            <label>Target Department</label>
            <select value={targetDept} onChange={e => setTargetDept(e.target.value as RuthlessDept)}>
              {DEPT_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        )}

        {/* target tile for building */}
        {needs.includes('targetTile') && (
          <div className="ac-field">
            <label>Build On Tile</label>
            <select value={targetTileId} onChange={e => setTargetTileId(e.target.value)}>
              <option value="">— select tile —</option>
              {tiles.map(t => (
                <option key={t.id} value={t.id}>
                  {t.id.replace('tile_', '').toUpperCase()} · {SEGMENT_LABELS[t.segment]}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* CEO tone + authenticity */}
        {(needs.includes('tone') || needs.includes('auth')) && (
          <div className="ac-field">
            <label>CEO Voice Tone</label>
            <div className="ac-chips">
              {VOICE_TONES.map(v => (
                <button
                  key={v.value}
                  className={`ac-chip ${tone === v.value ? 'selected' : ''}`}
                  onClick={() => setTone(v.value)}
                  title={v.blurb}
                >{v.label}</button>
              ))}
            </div>
          </div>
        )}
        {needs.includes('auth') && (
          <div className="ac-field">
            <label>Campaign Authenticity</label>
            <div className="ac-chips">
              {AUTHENTICITY_LEVELS.map(a => (
                <button
                  key={a.value}
                  className={`ac-chip ${auth === a.value ? 'selected' : ''}`}
                  onClick={() => setAuth(a.value)}
                  title={a.blurb}
                >{a.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* product editor */}
        {needs.includes('productEditor') && (
          <div className="ac-field">
            <label>Product Name <span className="ac-hint">(editable)</span></label>
            <div className="ac-name-row">
              <input value={productName} onChange={e => setProductName(e.target.value)} />
              <button
                className="ac-spin"
                onClick={() => setProductName(spinProductName(spinSeed, productCategory, Math.floor(Math.random() * 999)))}
                title="Surprise me"
              >⟳</button>
            </div>
            <label>Sector / Category</label>
            <select value={productCategory} onChange={e => setProductCategory(e.target.value as ProductCategory)}>
              {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
          </div>
        )}

        {/* target product for improve / marketing */}
        {needs.includes('targetProduct') && (
          <div className="ac-field">
            <label>Target Product</label>
            <select value={targetProductId} onChange={e => setTargetProductId(e.target.value as ProductId)}>
              <option value="">— select product —</option>
              {playerCompany.products.map(p => (
                <option key={p.id} value={p.id}>{p.name} · {p.category.toUpperCase()}</option>
              ))}
            </select>
          </div>
        )}

        {/* OPA offer */}
        {needs.includes('offer') && (
          <div className="ac-field ac-warn">
            ⚠ Public tender: you offer cash to buy the rival's buildings. Auto-accepted if ≥ 2× worth;
            otherwise a probability roll. Higher bid = better odds.
          </div>
        )}

        {/* auction asset selector (req 2) */}
        {needs.includes('auctionAsset') && (
          <div className="ac-field">
            <label>Asset to Auction</label>
            <select value={auctionAssetId} onChange={e => setAuctionAssetId(e.target.value)}>
              <option value="">— select asset —</option>
              <optgroup label="Products">
                {playerCompany.products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                ))}
              </optgroup>
              <optgroup label="Buildings">
                {playerCompany.buildings.map(b => (
                  <option key={b.id} value={b.id}>Building @ {b.tileId.replace('tile_', '').toUpperCase()}</option>
                ))}
              </optgroup>
              <optgroup label="Departments">
                {playerCompany.departments.map(d => (
                  <option key={d.id} value={d.id}>{d.type.replace('_', ' ')} L{d.level}</option>
                ))}
              </optgroup>
            </select>
            <span className="ac-hint">Tech / patents are auto-valued at $300k.</span>
          </div>
        )}

        {/* live success estimate (req 4) */}
        {successPct !== null && (
          <div className={`ac-estimate ${successPct >= 60 ? 'good' : successPct >= 35 ? 'mid' : 'low'}`}>
            <span className="ac-estimate-label">EST. SUCCESS</span>
            <span className="ac-estimate-val">{successPct}%</span>
            <div className="ac-estimate-bar"><div style={{ width: `${successPct}%` }} /></div>
          </div>
        )}

        {/* budget */}
        <div className="ac-field">
          <label>Budget Allocation</label>
          <div className="ac-budget">
            <input
              type="number"
              value={budget}
              onChange={e => setBudget(Math.max(0, Math.min(maxBudget, parseInt(e.target.value) || 0)))}
              min={0}
              max={maxBudget}
              step={50000}
            />
            <span>/ ${maxBudget.toLocaleString()} max</span>
          </div>
          <input
            type="range"
            value={budget}
            onChange={e => setBudget(parseInt(e.target.value))}
            min={0}
            max={maxBudget}
            step={50000}
          />
        </div>
      </div>

      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={!canSubmit}>
          Add Order
        </button>
      </div>
    </div>
  );
};
