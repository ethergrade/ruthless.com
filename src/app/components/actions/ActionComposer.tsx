import React, { useEffect, useState } from 'react';
import type {
  ActionType, Company, CompanyId, MarketTile, ProductCategory,
  VoiceTone, CampaignAuthenticity, RuthlessDept, TileId, ProductId, DepartmentType,
  TurnAction, ExecutiveId,
} from '../../../types';
import {
  PRODUCT_CATEGORIES, SEGMENT_LABELS, VOICE_TONES, AUTHENTICITY_LEVELS,
  spinProductName,
} from '../../../data/generators';
import { CEO_PILLARS, PILLAR_LABELS } from '../../../data/archetypes';
import { findBuildingOnTile, getBuildingDisplayName, getBuildingFreeSlots, getBuildingUsedSlots, getOwnedBuildingsWithCapacity } from '../../../simulation/utils/buildings';

interface Props {
  playerCompany: Company;
  companies: Company[];
  tiles: MarketTile[];
  presetType?: ActionType | null;
  initialDraft?: import('../../../types').TurnAction | null;
  initialTileId?: string | null;
  onClose: () => void;
  onAdd: (action: Omit<import('../../../types').TurnAction, 'id' | 'status'>) => void;
  /** T: action targeting — request the map to enter pick-a-tile mode. */
  onRequestTargeting?: (ts: import('../../components/map/MarketMap').TargetingState | null) => void;
  /** T: currently active targeting (so the composer can show/clear it). */
  targeting?: import('../../components/map/MarketMap').TargetingState | null;
  /** Live success-estimate 0..1 for the currently configured action (req 4). */
  estimate?: (action: Omit<import('../../../types').TurnAction, 'id' | 'status'>) => number;
}

interface ActionDef {
  type: ActionType;
  label: string;
  group: string;
  baseCost: number;
  /** what extra inputs this action needs */
  needs?: ('targetCompany' | 'targetDept' | 'targetTile' | 'tone' | 'auth' | 'productEditor' | 'offer' | 'auctionAsset' | 'targetProduct' | 'departmentType' | 'targetIdea' | 'makeHQ' | 'hqBuilding' | 'targetExecutive')[];
  /** the player must own a department of this type to plan the action */
  requiresDept?: DepartmentType;
}

const ACTION_DEFS: ActionDef[] = [
  { type: 'build_department', label: 'Build Department', group: 'Corporate', baseCost: 500000, needs: ['targetTile', 'departmentType'] },
  { type: 'build_building', label: 'Build Building', group: 'Corporate', baseCost: 750000, needs: ['targetTile', 'makeHQ'] },
  { type: 'hire_ceo', label: 'Hire CEO (HQ)', group: 'Corporate', baseCost: 500000, needs: ['hqBuilding'] },
  { type: 'hire_coo', label: 'Hire COO (HQ)', group: 'Corporate', baseCost: 400000, needs: ['hqBuilding'] },
  { type: 'mass_layoff', label: 'Mass Layoff', group: 'Corporate', baseCost: 0, needs: ['targetTile'], requiresDept: 'people_culture' },
  { type: 'hire_executive', label: 'Hire Executive', group: 'Corporate', baseCost: 400000 },
  { type: 'raise_capital', label: 'Raise Capital', group: 'Corporate', baseCost: 0, requiresDept: 'finance_investor' },
  { type: 'reduce_costs', label: 'Reduce Costs', group: 'Corporate', baseCost: 0, requiresDept: 'finance_investor' },
  { type: 'launch_product', label: 'Launch Product', group: 'Product & R&D', baseCost: 300000, needs: ['productEditor', 'targetIdea'], requiresDept: 'product_rd' },
  { type: 'create_ideas', label: 'Create Ideas (R&D)', group: 'Product & R&D', baseCost: 400000, requiresDept: 'product_rd' },
  { type: 'release_source', label: 'Release Source Code', group: 'Product & R&D', baseCost: 0, needs: ['targetIdea'], requiresDept: 'dev_engineering' },
  { type: 'sell_source', label: 'Sell Source Code', group: 'Product & R&D', baseCost: 0, needs: ['targetIdea', 'targetCompany'], requiresDept: 'dev_engineering' },
  { type: 'pivot_product', label: 'Pivot Product', group: 'Product & R&D', baseCost: 250000, needs: ['targetProduct'], requiresDept: 'product_rd' },
  { type: 'improve_product', label: 'Improve Product', group: 'Product & R&D', baseCost: 100000, needs: ['targetProduct'], requiresDept: 'product_rd' },
  { type: 'ai_automation', label: 'AI Automation', group: 'Product & R&D', baseCost: 250000, requiresDept: 'ai_data' },
  { type: 'expand_market', label: 'Expand Market', group: 'Market & Sales', baseCost: 200000, requiresDept: 'sales_marketing' },
  { type: 'marketing_campaign', label: 'Marketing Campaign', group: 'Market & Sales', baseCost: 150000, needs: ['targetProduct', 'tone', 'auth'], requiresDept: 'sales_marketing' },
  { type: 'launch_consulting_practice', label: 'Consulting Practice', group: 'Market & Sales', baseCost: 150000, requiresDept: 'consulting_services' },
  { type: 'ceo_social', label: 'CEO Social Post', group: 'Market & Sales', baseCost: 100000, needs: ['tone', 'auth'] },
  { type: 'ceo_praise', label: 'CEO Praises Rival (PR)', group: 'Market & Sales', baseCost: 150000, needs: ['targetCompany'] },
  { type: 'ceo_discredit', label: 'CEO Discredits Rival (PR)', group: 'Market & Sales', baseCost: 150000, needs: ['targetCompany'] },
  { type: 'train_ceo', label: 'Train CEO (Pillar)', group: 'Corporate', baseCost: 300000, needs: ['targetExecutive', 'tone'] },
  { type: 'security_hardening', label: 'Security Hardening', group: 'Security & M&A', baseCost: 200000, needs: ['targetProduct'], requiresDept: 'cybersecurity' },
  { type: 'security_offline', label: 'Physical Security', group: 'Security & M&A', baseCost: 200000, needs: ['targetTile'], requiresDept: 'cybersecurity' },
  { type: 'sabotage_building', label: 'Sabotage Building', group: 'Security & M&A', baseCost: 300000, needs: ['targetTile'], requiresDept: 'cybersecurity' },
  { type: 'defend_tile', label: 'Defend Building', group: 'Security & M&A', baseCost: 150000, needs: ['targetTile'], requiresDept: 'cybersecurity' },
  { type: 'security_online', label: 'Cyber Defense', group: 'Security & M&A', baseCost: 150000, requiresDept: 'cybersecurity' },
  { type: 'industrial_espionage', label: 'Industrial Espionage', group: 'Security & M&A', baseCost: 200000, needs: ['targetCompany', 'targetDept'], requiresDept: 'cybersecurity' },
  { type: 'cyber_attack', label: 'Cyber Attack', group: 'Security & M&A', baseCost: 250000, needs: ['targetCompany', 'targetTile'], requiresDept: 'cybersecurity' },
  { type: 'legal_action', label: 'Legal Action', group: 'Security & M&A', baseCost: 250000, needs: ['targetCompany', 'targetTile'], requiresDept: 'legal_compliance' },
  { type: 'scout_acquisition', label: 'Scout Acquisition', group: 'Security & M&A', baseCost: 50000, requiresDept: 'acquisitions' },
  { type: 'acquire_company', label: 'Acquire Company', group: 'Security & M&A', baseCost: 2000000, needs: ['targetCompany'], requiresDept: 'acquisitions' },
  { type: 'acquire_below_value', label: 'Buy Below Valuation', group: 'Security & M&A', baseCost: 500000, needs: ['targetCompany'], requiresDept: 'finance_investor' },
  { type: 'public_tender_offer', label: 'Public Tender Offer (OPA)', group: 'Security & M&A', baseCost: 1500000, needs: ['targetCompany', 'offer'], requiresDept: 'acquisitions' },
  { type: 'auction_sell', label: 'List on Auction House', group: 'Security & M&A', baseCost: 0, needs: ['auctionAsset'] },
];

const DEPT_OPTIONS: { value: RuthlessDept; label: string }[] = [
  { value: 'rd', label: 'R&D' }, { value: 'product', label: 'Product' },
  { value: 'marketing', label: 'Marketing' }, { value: 'hr', label: 'HR' },
  { value: 'legal', label: 'Legal' }, { value: 'security', label: 'Security' },
  { value: 'computer_core', label: 'Computer Core' }, { value: 'admin', label: 'Admin' },
  { value: 'acquisitions', label: 'Acquisitions' },
];

const DEPARTMENT_TYPE_OPTIONS: { value: DepartmentType; label: string }[] = [
  { value: 'product_rd', label: 'Product R&D' },
  { value: 'ai_data', label: 'AI & Data' },
  { value: 'cybersecurity', label: 'Cybersecurity' },
  { value: 'sales_marketing', label: 'Sales & Marketing' },
  { value: 'consulting_services', label: 'Consulting Services' },
  { value: 'acquisitions', label: 'Acquisitions' },
  { value: 'legal_compliance', label: 'Legal & Compliance' },
  { value: 'people_culture', label: 'People & Culture' },
  { value: 'finance_investor', label: 'Finance & Investor' },
  { value: 'corporate_strategy', label: 'Corporate Strategy' },
  { value: 'dev_engineering', label: 'DEV Engineering' },
];

export const ActionComposer: React.FC<Props> = ({
  playerCompany, companies, tiles, presetType, initialDraft, initialTileId, onClose, onAdd, estimate, onRequestTargeting, targeting,
}) => {
  const groups = Array.from(new Set(ACTION_DEFS.map(a => a.group)));
  const ownedDeptTypes = new Set<DepartmentType>(playerCompany.departments.map(d => d.type));
  const DEPT_LABELS: Record<DepartmentType, string> =
    Object.fromEntries(DEPARTMENT_TYPE_OPTIONS.map(o => [o.value, o.label])) as Record<DepartmentType, string>;
  const [type, setType] = useState<ActionType>(presetType ?? 'build_department');
  const [, setGroup] = useState<string>(
    ACTION_DEFS.find(a => a.type === (presetType ?? 'build_department'))?.group ?? groups[0]
  );
  const def = ACTION_DEFS.find(a => a.type === type)!;
  const maxBudget = Math.floor(playerCompany.cash * 0.5);
  const [budget, setBudget] = useState<number>(Math.min(def.baseCost, maxBudget) || 0);

  const [targetCompanyId, setTargetCompanyId] = useState<CompanyId | ''>('');
  const [targetDept, setTargetDept] = useState<RuthlessDept>('rd');
  const [targetDepartmentId, setTargetDepartmentId] = useState<string>('');
  const [targetTileId, setTargetTileId] = useState<TileId | ''>('');
  const [tone, setTone] = useState<VoiceTone>(playerCompany.voiceTone ?? 'aggressive');
  const [auth, setAuth] = useState<CampaignAuthenticity>(playerCompany.campaignAuthenticity ?? 'aspirational');
  const [auctionAssetId, setAuctionAssetId] = useState<string>('');
  const [targetProductId, setTargetProductId] = useState<ProductId | ''>('');
  const [ideaId, setIdeaId] = useState<string>('');
  const [deptType, setDeptType] = useState<DepartmentType>('product_rd');
  const [makeHQ, setMakeHQ] = useState<boolean>(false);
  const [hqBuildingId, setHqBuildingId] = useState<string>('');
  const [buildingName, setBuildingName] = useState<string>('');
  const [targetExecutiveId, setTargetExecutiveId] = useState<ExecutiveId | ''>('');

  // product editor state
  const [productName, setProductName] = useState<string>('');
  const [productCategory, setProductCategory] = useState<ProductCategory>('saas');
  const [spinSeed] = useState<number>(Math.floor(Math.random() * 100000));

  // Pre-fill from a previous order so the player can tweak & re-plan it (req P2).
  // Also pre-select the canvas tile the player clicked (build actions), so the flow
  // "click a free tile → Build Building" just works.
  useEffect(() => {
    if (initialTileId && (presetType === 'build_department' || presetType === 'build_building')) {
      setTargetTileId(initialTileId as TileId);
    }
    if (!initialDraft) return;
    setType(initialDraft.type);
    setBudget(initialDraft.budget);
    setTargetCompanyId(initialDraft.targetCompanyId ?? '');
    setTargetDepartmentId(initialDraft.targetDepartmentId ?? '');
    setTargetTileId(initialDraft.targetTileId ?? (initialTileId || ''));
    setTargetProductId(initialDraft.targetProductId ?? '');
    setTone(initialDraft.tone ?? (playerCompany.voiceTone ?? 'aggressive'));
    setAuth(initialDraft.authenticity ?? (playerCompany.campaignAuthenticity ?? 'aspirational'));
    if (initialDraft.type === 'launch_product') {
      setProductName(initialDraft.productName ?? '');
      setProductCategory((initialDraft.productCategory as ProductCategory) ?? 'saas');
    }
    if (initialDraft.type === 'expand_market' && initialDraft.productCategory) {
      setProductCategory(initialDraft.productCategory);
    }
    if (initialDraft.departmentType) setDeptType(initialDraft.departmentType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDraft]);

  const rivals = companies.filter(c => c.id !== playerCompany.id);
  // Build actions only allow the player's own controlled tiles (req T3).
  const needs = def.needs ?? [];
  const chosenTile = targetTileId ? tiles.find(tile => tile.id === targetTileId) : undefined;
  const chosenTileValid = !needs.includes('targetTile') || Boolean(chosenTile && (
    type === 'build_department'
      ? chosenTile.controllerId === playerCompany.id && Boolean(findBuildingOnTile(playerCompany, chosenTile.id) && getBuildingFreeSlots(findBuildingOnTile(playerCompany, chosenTile.id)!) > 0)
    : type === 'build_building'
      ? !chosenTile.buildingId && (!chosenTile.controllerId || chosenTile.controllerId === playerCompany.id)
      : type === 'security_offline'
        ? chosenTile.controllerId === playerCompany.id && Boolean(chosenTile.buildingId)
      : type === 'sabotage_building'
        ? chosenTile.controllerId !== playerCompany.id && Boolean(chosenTile.controllerId && chosenTile.buildingId)
      : type === 'defend_tile'
        ? chosenTile.controllerId === playerCompany.id && Boolean(chosenTile.buildingId)
      : type === 'cyber_attack'
        ? chosenTile.controllerId === targetCompanyId && Boolean(chosenTile.buildingId)
      : true
  ));
  const requiredTargetsValid =
    (!needs.includes('targetCompany') || !!targetCompanyId) && chosenTileValid &&
    (!needs.includes('targetDept') || (type === 'industrial_espionage' ? !!targetDepartmentId : !!targetDept)) &&
    (!needs.includes('targetProduct') || !!targetProductId) &&
    (!needs.includes('targetIdea') || !!ideaId) &&
    (!needs.includes('targetExecutive') || !!targetExecutiveId) &&
    (!needs.includes('hqBuilding') || !!hqBuildingId) &&
    (type !== 'launch_product' || !!productName.trim()) &&
    (type !== 'auction_sell' || !!auctionAssetId);
  const canSubmit = requiredTargetsValid && budget >= def.baseCost && budget <= maxBudget;

  // live success estimate (req 4)
  const draft: Omit<import('../../../types').TurnAction, 'id' | 'status'> = {
    type,
    companyId: playerCompany.id,
    budget,
    priority: 1,
    targetCompanyId: targetCompanyId || undefined,
    targetDept: needs.includes('targetDept') ? targetDept : undefined,
    targetDepartmentId: type === 'industrial_espionage' ? targetDepartmentId || undefined : undefined,
    targetTileId: targetTileId || undefined,
    tone: needs.includes('tone') ? tone : undefined,
    authenticity: needs.includes('auth') ? auth : undefined,
    targetProductId: needs.includes('targetProduct') ? targetProductId || undefined : undefined,
    departmentType: needs.includes('departmentType') ? deptType : undefined,
    productName: type === 'launch_product' ? productName : undefined,
    productCategory: (type === 'launch_product' || type === 'expand_market') ? productCategory : undefined,
    offerPrice: type === 'public_tender_offer' ? budget : undefined,
    targetId: type === 'auction_sell' ? auctionAssetId || undefined : undefined,
    ideaId: needs.includes('targetIdea') ? ideaId || undefined : undefined,
    buildingName: type === 'build_building' ? buildingName.trim() || undefined : undefined,
    hqBuildingId: needs.includes('hqBuilding') ? hqBuildingId || undefined : undefined,
    executiveId: needs.includes('targetExecutive') ? targetExecutiveId || undefined : undefined,
    trendId: initialDraft?.trendId,
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
      targetDepartmentId: type === 'industrial_espionage' ? targetDepartmentId || undefined : undefined,
      targetTileId: targetTileId || undefined,
      tone: needs.includes('tone') ? tone : undefined,
      authenticity: needs.includes('auth') ? auth : undefined,
      targetProductId: needs.includes('targetProduct') ? targetProductId || undefined : undefined,
      departmentType: needs.includes('departmentType') ? deptType : undefined,
      productName: type === 'launch_product' ? productName : undefined,
      productCategory: (type === 'launch_product' || type === 'expand_market') ? productCategory : undefined,
      offerPrice: type === 'public_tender_offer' ? budget : undefined,
      targetId: type === 'auction_sell' ? auctionAssetId || undefined : undefined,
      ideaId: needs.includes('targetIdea') ? ideaId || undefined : undefined,
      makeHQ: needs.includes('makeHQ') ? makeHQ : undefined,
      buildingName: type === 'build_building' ? buildingName.trim() || undefined : undefined,
      hqBuildingId: needs.includes('hqBuilding') ? hqBuildingId || undefined : undefined,
      executiveId: needs.includes('targetExecutive') ? targetExecutiveId || undefined : undefined,
      trendId: initialDraft?.trendId,
    });
    onClose();
  };

  const selectType = (t: ActionType) => {
    onRequestTargeting?.(null);
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
              {ACTION_DEFS.filter(a => a.group === g).map(a => {
                const locked = a.requiresDept && !ownedDeptTypes.has(a.requiresDept);
                return (
                <button
                  key={a.type}
                  className={`ac-btn ${type === a.type ? 'selected' : ''}${locked ? ' locked' : ''}`}
                  disabled={locked}
                  title={locked ? `Requires ${DEPT_LABELS[a.requiresDept!]} department` : undefined}
                  onClick={() => !locked && selectType(a.type)}
                >
                  <span>{a.label}</span>
                  {a.baseCost > 0 && <span className="ac-cost">${a.baseCost.toLocaleString()}</span>}
                  {locked && <span className="ac-lock">🔒</span>}
                </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="ac-config">
        {/* target company */}
        {needs.includes('targetCompany') && (
          <div className="ac-field">
            <label>Target Corporation</label>
            <select value={targetCompanyId} onChange={e => {
              setTargetCompanyId(e.target.value);
              if (type === 'industrial_espionage') setTargetDepartmentId('');
              if (type === 'cyber_attack') setTargetTileId('');
            }}>
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
            <label>{type === 'industrial_espionage' ? 'Opponent Department' : 'Target Department'}</label>
            {type === 'industrial_espionage' ? (() => {
              const target = companies.find(company => company.id === targetCompanyId);
              const mapDept = (departmentType: DepartmentType): RuthlessDept => ({
                product_rd: 'rd', ai_data: 'computer_core', cybersecurity: 'security', sales_marketing: 'marketing',
                consulting_services: 'product', acquisitions: 'acquisitions', legal_compliance: 'legal',
                people_culture: 'hr', finance_investor: 'admin', dev_engineering: 'computer_core', corporate_strategy: 'admin',
              }[departmentType] as RuthlessDept);
              return <>
                <select value={targetDepartmentId} disabled={!target} onChange={e => {
                  setTargetDepartmentId(e.target.value);
                  const department = target?.departments.find(candidate => candidate.id === e.target.value);
                  if (department) setTargetDept(mapDept(department.type));
                }}>
                  <option value="">{target ? '— select an opponent department —' : '— choose a corporation first —'}</option>
                  {target?.departments.map(department => (
                    <option key={department.id} value={department.id}>
                      {department.type.replaceAll('_', ' ')} · level {department.level} · efficiency {(department.efficiency * 100).toFixed(0)}%
                    </option>
                  ))}
                </select>
                <span className="ac-hint">The order targets this exact department inside {target?.name || 'the selected corporation'}; no market tile is required.</span>
              </>;
            })() : (
              <select value={targetDept} onChange={e => setTargetDept(e.target.value as RuthlessDept)}>
                {DEPT_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            )}
          </div>
        )}

        {/* target tile for building / department / espionage / cyber / sabotage */}
        {needs.includes('targetTile') && (() => {
          const isOwn = type === 'build_department';
          const isSeize = type === 'build_building';
          const isPhysicalDefense = type === 'security_offline';
          const isSabotage = type === 'sabotage_building';
          const isDefendBuilding = type === 'defend_tile';
          const isCyberAttack = type === 'cyber_attack';
          const isOffensive = ['industrial_espionage', 'cyber_attack', 'sabotage_building', 'legal_action'].includes(type);
          const slotCount = getBuildingUsedSlots;
          const validTile = (t: MarketTile): boolean => {
            // T: build_department targets one of the player's tiles — a building tile
            // (to add a dept to an existing building) or an empty owned tile.
            if (isOwn) {
              const building = findBuildingOnTile(playerCompany, t.id);
              return Boolean(building && t.controllerId === playerCompany.id && slotCount(building) < building.maxDepartments);
            }
            if (isPhysicalDefense) return t.controllerId === playerCompany.id && Boolean(t.buildingId);
            if (isSabotage) return Boolean(t.buildingId && t.controllerId && t.controllerId !== playerCompany.id);
            if (isDefendBuilding) return t.controllerId === playerCompany.id && Boolean(t.buildingId);
            if (isCyberAttack) return Boolean(targetCompanyId && t.buildingId && t.controllerId === targetCompanyId);
            if (isOffensive) return !!t.controllerId && t.controllerId !== playerCompany.id;
            if (isSeize) return !t.buildingId && (!t.controllerId || t.controllerId === playerCompany.id);
            return true;
          };
          // T: building picker — choose an existing building with free slots.
          const ownBuildings = isOwn
            ? getOwnedBuildingsWithCapacity(playerCompany)
                .sort((a, b) => (a.isHQ ? -1 : 0) - (b.isHQ ? -1 : 0))
            : [];
          const selectedBuilding = isOwn && targetTileId
            ? findBuildingOnTile(playerCompany, targetTileId)
            : undefined;
          const friendlyBuildingName = (building: typeof playerCompany.buildings[number]) => getBuildingDisplayName(playerCompany, building);
          const buildingDirectory = companies.flatMap(company => company.buildings.map(building => ({
            company,
            building,
            tile: tiles.find(tile => tile.id === building.tileId),
          }))).filter(entry => Boolean(entry.tile));
          const opponentBuildings = buildingDirectory.filter(entry => entry.company.id !== playerCompany.id);
          const playerBuildings = buildingDirectory.filter(entry => entry.company.id === playerCompany.id);
          const cyberTargetBuildings = buildingDirectory.filter(entry => entry.company.id === targetCompanyId);
          const selectedDirectoryEntry = targetTileId
            ? buildingDirectory.find(entry => entry.building.tileId === targetTileId)
            : undefined;
          const hint = isOwn
            ? 'Pick one of YOUR buildings (or click it on the map) to house the new department'
            : isPhysicalDefense
              ? 'Pick one of YOUR buildings to reinforce its physical security'
            : isSabotage
              ? 'Pick an OPPONENT BUILDING — corporation and building names are shown in the selector'
            : isDefendBuilding
              ? 'Pick one of YOUR BUILDINGS to reinforce firewall and physical security'
            : isCyberAttack
              ? `Pick a building belonging to ${companies.find(company => company.id === targetCompanyId)?.name || 'the selected target corporation'}`
            : isOffensive
              ? 'Click a RIVAL-controlled tile to target'
              : isSeize
                ? 'Click an EMPTY neutral or owned tile to place an empty building'
                : 'Click a tile on the map';
          const startTargeting = () => onRequestTargeting?.({
            isValid: validTile,
            onPick: (tid) => {
              setTargetTileId(tid);
              const t = tiles.find(x => x.id === tid);
              if (t?.controllerId && t.controllerId !== playerCompany.id) setTargetCompanyId(t.controllerId);
              onRequestTargeting?.(null);
            },
            hint: `🎯 ${hint}`,
          });
          return (
            <div className="ac-field">
              {isOwn && (
                <div className="ac-building-choice">
                  <label>Choose one of your buildings</label>
                  <div className="ac-tile-pick">
                    <select value={selectedBuilding?.id ?? ''} onChange={e => {
                      const b = playerCompany.buildings.find(x => x.id === e.target.value);
                      setTargetTileId(b?.tileId ?? '');
                    }}>
                      <option value="">— select building —</option>
                      {ownBuildings.map(b => {
                        const tile = tiles.find(candidate => candidate.id === b.tileId);
                        const used = slotCount(b);
                        return <option key={b.id} value={b.id}>
                          {friendlyBuildingName(b)}{b.isHQ ? ' · HQ' : ''} · {b.maxDepartments - used} free · {tile?.segment.replaceAll('_', ' ') || 'corporate site'}
                        </option>;
                      })}
                    </select>
                    <button type="button" className={`btn btn-secondary ac-pick-btn ${targeting ? 'active' : ''}`} onClick={() => targeting ? onRequestTargeting?.(null) : startTargeting()}>
                      {targeting ? 'Cancel pick' : 'Pick building on map'}
                    </button>
                  </div>
                  {selectedBuilding && <div className="ac-tile-chosen">Destination: <b>{friendlyBuildingName(selectedBuilding)}</b> · {slotCount(selectedBuilding)}/{selectedBuilding.maxDepartments} slots used</div>}
                </div>
              )}
              {!isOwn && <>
              <label>{isSabotage ? 'Sabotage Target Building'
                : isDefendBuilding ? 'Building to Defend'
                : isCyberAttack ? 'Target Corporation Building'
                : isOffensive ? 'Target Tile (rival building / territory)'
                : isPhysicalDefense ? 'Your Building'
                : isOwn ? 'Building Tile'
                : isSeize ? 'Build On Tile (empty neutral / owned)' : 'Target Tile'}</label>
              <div className="ac-tile-pick">
                <select value={targetTileId} onChange={e => {
                  const tid = e.target.value as TileId | '';
                  setTargetTileId(tid);
                  const t = tiles.find(x => x.id === tid);
                  if (t?.controllerId && t.controllerId !== playerCompany.id) setTargetCompanyId(t.controllerId);
                }}>
                  <option value="">{isSabotage ? '— select an opponent building —' : isDefendBuilding ? '— select one of your buildings —' : isCyberAttack ? '— select a building of the target corporation —' : '— select tile —'}</option>
                  {isSabotage ? <>
                    <optgroup label="OPPONENT BUILDINGS — VALID TARGETS">
                      {opponentBuildings.map(({ company, building }) => (
                        <option key={building.id} value={building.tileId}>
                          {company.name} — {building.name || (building.isHQ ? 'HQ' : 'Unnamed Building')} · security {building.physicalSecurity.toFixed(0)}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="YOUR BUILDINGS — CANNOT SABOTAGE">
                      {playerBuildings.map(({ company, building }) => (
                        <option key={building.id} value={building.tileId} disabled>
                          {company.name} — {building.name || (building.isHQ ? 'HQ' : 'Unnamed Building')} · YOURS
                        </option>
                      ))}
                    </optgroup>
                  </> : isDefendBuilding ? (
                    <optgroup label="YOUR BUILDINGS — DEFENSIVE TARGETS">
                      {playerBuildings.map(({ building }) => (
                        <option key={building.id} value={building.tileId}>
                          {building.name || (building.isHQ ? 'HQ' : 'Unnamed Building')} · firewall {building.firewall.toFixed(0)} · physical {building.physicalSecurity.toFixed(0)}
                        </option>
                      ))}
                    </optgroup>
                  ) : isCyberAttack ? (
                    <optgroup label={`${companies.find(company => company.id === targetCompanyId)?.name || 'TARGET CORPORATION'} — BUILDINGS`}>
                      {cyberTargetBuildings.map(({ company, building }) => (
                        <option key={building.id} value={building.tileId}>
                          {company.name} — {building.name || (building.isHQ ? 'HQ' : 'Unnamed Building')} · firewall {building.firewall.toFixed(0)} · physical {building.physicalSecurity.toFixed(0)}
                        </option>
                      ))}
                    </optgroup>
                  ) : tiles.filter(validTile).map(t => (
                    <option key={t.id} value={t.id}>
                      {t.id.replace('tile_', '').toUpperCase()} · {SEGMENT_LABELS[t.segment]}{t.controllerId && t.controllerId !== playerCompany.id ? ' · (rival)' : t.controllerId === playerCompany.id ? ' · (yours)' : ' · (free)'}
                    </option>
                  ))}
                </select>
                <button type="button" className={`btn btn-secondary ac-pick-btn ${targeting ? 'active' : ''}`} onClick={() => targeting ? onRequestTargeting?.(null) : startTargeting()}>
                  {targeting ? 'Cancel pick' : 'Pick on map'}
                </button>
              </div>
              {targetTileId && (
                <div className="ac-tile-chosen">Selected: <b>{(isSabotage || isDefendBuilding || isCyberAttack) && selectedDirectoryEntry
                  ? `${selectedDirectoryEntry.company.name} — ${selectedDirectoryEntry.building.name || 'Building'}`
                  : targetTileId.replace('tile_', '').toUpperCase()}</b></div>
              )}
              {isSabotage && <span className="ac-hint">Your buildings remain visible for orientation but are disabled. Map pick highlights only opponent buildings.</span>}
              {isDefendBuilding && <span className="ac-hint">The order reinforces only the selected building. Empty territory cannot be defended with this action.</span>}
              {isCyberAttack && <span className="ac-hint">Every listed structure is a building of the selected target corporation. Tile identifiers are intentionally hidden.</span>}
              </>}
              {isSeize && <span className="ac-hint">New buildings open with 0 departments and 0 products. Staff them with later orders.</span>}
            </div>
          );
        })()}

        {/* department type to build */}
        {needs.includes('departmentType') && (
          <div className="ac-field">
            <label>Department Type</label>
            <select value={deptType} onChange={e => setDeptType(e.target.value as DepartmentType)}>
              {DEPARTMENT_TYPE_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        )}

        {/* CEO to train (executive pillar) */}
        {needs.includes('targetExecutive') && (
          <div className="ac-field">
            <label>CEO to Train</label>
            <select value={targetExecutiveId} onChange={e => setTargetExecutiveId(e.target.value as ExecutiveId)}>
              <option value="">— select CEO —</option>
              {playerCompany.ceos.map(c => (
                <option key={c.id} value={c.id}>{c.role.toUpperCase()} · XP {c.xp}</option>
              ))}
            </select>
          </div>
        )}

        {/* Executive pillar picker (reuses the tone field as the pillar key) */}
        {needs.includes('tone') && type === 'train_ceo' && (
          <div className="ac-field">
            <label>Executive Pillar to Train</label>
            <select value={tone} onChange={e => setTone(e.target.value as VoiceTone)}>
              {CEO_PILLARS.map(s => (
                <option key={s} value={s}>{PILLAR_LABELS[s]}</option>
              ))}
            </select>
          </div>
        )}

        {/* target category for market expansion (EXPLOIT a trend) */}
        {type === 'expand_market' && (
          <div className="ac-field">
            <label>Target Category <span className="ac-hint">(exploits the trending demand)</span></label>
            <select value={productCategory} onChange={e => setProductCategory(e.target.value as ProductCategory)}>
              {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
          </div>
        )}

        {/* make-HQ toggle for building (multi-HQ corps) */}
        {needs.includes('makeHQ') && (
          <div className="ac-field ac-check">
            <label>
              <input type="checkbox" checked={makeHQ} onChange={e => setMakeHQ(e.target.checked)} />
              Make this an HQ (needs HR dept + Hire CEO after)
            </label>
          </div>
        )}

        {/* building name (build_building only) — player names their tower */}
        {type === 'build_building' && (
          <div className="ac-field">
            <label>Building Name <span className="ac-hint">(optional — e.g. "BUILDING 1")</span></label>
            <input
              type="text"
              value={buildingName}
              maxLength={24}
              placeholder={`BUILDING ${playerCompany.buildings.length + 1}`}
              onChange={e => setBuildingName(e.target.value)}
            />
          </div>
        )}

        {/* HQ building picker for hiring CEO/COO */}
        {needs.includes('hqBuilding') && (
          <div className="ac-field">
            <label>HQ Building</label>
            {playerCompany.buildings.filter(b => b.isHQ).length === 0 ? (
              <p className="ac-hint">No HQ buildings yet — build one with “Make HQ”.</p>
            ) : (
              <select value={hqBuildingId} onChange={e => setHqBuildingId(e.target.value)}>
                <option value="">Select HQ…</option>
                {playerCompany.buildings.filter(b => b.isHQ).map(b => (
                  <option key={b.id} value={b.id}>{b.isHQ ? 'HQ ' : 'Bld '} · {b.tileId}{b.ceoId ? ' (staffed)' : ' (needs CEO)'}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* idea picker (T9: release / sell source code) */}
        {needs.includes('targetIdea') && (
          <div className="ac-field">
            <label>Idea / Technology</label>
            {playerCompany.ideas.length === 0 ? (
              <p className="ac-hint">No ideas yet — use “Create Ideas (R&D)” first.</p>
            ) : (
              <select value={ideaId} onChange={e => setIdeaId(e.target.value)}>
                <option value="">Select an idea…</option>
                {playerCompany.ideas.map(i => (
                  <option key={i.id} value={i.id}>{i.name} · {i.category.replace('_', ' ')}</option>
                ))}
              </select>
            )}
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
            <button
              type="button"
              className="ac-max-btn"
              title="Set budget to the minimum needed for ~95% success"
              onClick={() => {
                if (!estimate) return;
                let best = maxBudget;
                for (let b = def.baseCost; b <= maxBudget; b += 50000) {
                  const pct = estimate({ ...draft, budget: b } as Omit<TurnAction, 'id' | 'status'>);
                  if (pct >= 0.95) { best = b; break; }
                }
                setBudget(best);
              }}
            >MAX SUCCESS ⚡</button>
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

        {/* T: Acquire offer slider — the offer controls acceptance (risk). The target
            only accepts at/above a valuation-based floor; show the live status. */}
        {type === 'acquire_company' && targetCompanyId && (() => {
          const tgt = playerCompany.id !== targetCompanyId ? companies.find(c => c.id === targetCompanyId) : undefined;
          if (!tgt) return null;
          const minAccept = Math.round(tgt.valuation * (tgt.isStartup ? 0.6 : 0.8));
          const maxOffer = Math.min(maxBudget, Math.round(tgt.valuation * 2));
          const accepted = budget >= minAccept;
          return (
            <div className="ac-field">
              <label>Acquisition Offer</label>
              <div className="ac-budget">
                <input
                  type="number"
                  value={budget}
                  onChange={e => setBudget(Math.max(0, Math.min(maxOffer, parseInt(e.target.value) || 0)))}
                  min={minAccept}
                  max={maxOffer}
                  step={50000}
                />
                <span>/ ${maxOffer.toLocaleString()} max</span>
              </div>
              <input
                type="range"
                value={Math.min(budget, maxOffer)}
                onChange={e => setBudget(parseInt(e.target.value))}
                min={minAccept}
                max={maxOffer}
                step={50000}
              />
              <div className={`ac-offer-status ${accepted ? 'ok' : 'bad'}`}>
                {accepted
                  ? `✓ Deal accepted — offering $${budget.toLocaleString()} (${Math.round((budget / tgt.valuation) * 100)}% of $${tgt.valuation.toLocaleString()} valuation)`
                  : `✗ Offer rejected — minimum acceptable $${minAccept.toLocaleString()} (${Math.round((minAccept / tgt.valuation) * 100)}% of valuation)`}
              </div>
            </div>
          );
        })()}
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
