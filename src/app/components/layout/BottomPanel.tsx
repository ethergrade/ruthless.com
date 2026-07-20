import React, { useEffect, useState } from 'react';
import type { Company, NewsItem, Department, Product, TurnAction, GameState, MarketTrend, TrendHistoryEntry, WeakSignal, AlertItem, Idea, Technology, Building, TileId, ActionType } from '../../../types';
import { TECHNOLOGIES, DEV_SKILLS } from '../../../data/technologies';
import { CEO_PILLARS, PILLAR_LABELS, PERK_LABELS, PERK_PILLAR_THRESHOLD, CEO_TRAIT_DEFS } from '../../../data/archetypes';
import { Icon, IconName } from '../ui/Icon';
import { useGameStore } from '../../../store/gameStore';
import { getBuildingDisplayName } from '../../../simulation/utils/buildings';

interface BottomPanelProps {
  state: GameState | null;
  playerCompany: Company | undefined;
  onEdit: (action: TurnAction) => void;
  height?: number;
  defaultTab?: 'kpi' | 'departments' | 'products' | 'capabilities' | 'orders' | 'trends' | 'tech' | 'workforce' | 'ceo';
  selectedTileId?: string | null;
  addAction?: (a: TurnAction) => void;
  onExploit?: (trend: MarketTrend) => void;
  onInvestSignal?: (signal: WeakSignal) => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  state,
  playerCompany,
  defaultTab = 'kpi',
  onEdit,
  height = 220,
  selectedTileId,
  addAction,
  onExploit = () => undefined,
  onInvestSignal = () => undefined,
}) => {
  const [activeTab, setActiveTab] = useState<'kpi' | 'departments' | 'products' | 'capabilities' | 'orders' | 'trends' | 'tech' | 'workforce' | 'ceo'>(defaultTab);

  useEffect(() => {
    if (!state || !selectedTileId) return;
    const tile = state.marketTiles.get(selectedTileId as TileId);
    if (tile?.controllerId === state.playerCompanyId && tile.buildingId) setActiveTab('departments');
  }, [selectedTileId, state]);

  if (!state || !playerCompany) return null;


  return (
    <div className="bottom-panel" style={{ height }}>
      <div className="bottom-tabs">
        <button className={`tab ${activeTab === 'kpi' ? 'active' : ''}`} onClick={() => setActiveTab('kpi')}>
          KPI
        </button>
        <button className={`tab ${activeTab === 'departments' ? 'active' : ''}`} onClick={() => setActiveTab('departments')}>
          Departments
        </button>
        <button className={`tab ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')}>
          Products
        </button>
        <button className={`tab ${activeTab === 'capabilities' ? 'active' : ''}`} onClick={() => setActiveTab('capabilities')}>
          Capabilities
        </button>
        <button className={`tab ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
          Orders
        </button>
        <button className={`tab ${activeTab === 'trends' ? 'active' : ''}`} onClick={() => setActiveTab('trends')}>
          Global Trends <span className="trend-live-count">{state.trends.length}</span>
        </button>
        <button className={`tab ${activeTab === 'tech' ? 'active' : ''}`} onClick={() => setActiveTab('tech')}>
          Tech Book
        </button>
        <button className={`tab ${activeTab === 'workforce' ? 'active' : ''}`} onClick={() => setActiveTab('workforce')}>
          Workforce
        </button>
        <button className={`tab ${activeTab === 'ceo' ? 'active' : ''}`} onClick={() => setActiveTab('ceo')}>
          CEO
        </button>
      </div>

      <div className="bottom-content">
        {activeTab === 'kpi' && <KPIPanel company={playerCompany} history={state.kpiHistory} />}
        {activeTab === 'departments' && <DepartmentsPanel
          state={state}
          departments={playerCompany.departments}
          buildings={playerCompany.buildings}
          playerCompanyId={playerCompany.id}
          selectedTileId={selectedTileId}
          addAction={addAction}
        />}
        {activeTab === 'products' && <ProductsPanel products={playerCompany.products} ideas={playerCompany.ideas} />}
        {activeTab === 'capabilities' && <CapabilitiesPanel company={playerCompany} />}
        {activeTab === 'orders' && <OrdersPanel actions={state.actions.filter(a => a.companyId === state.playerCompanyId)} history={state.actionHistory.filter(a => a.companyId === state.playerCompanyId)} alerts={state.alerts} onEdit={onEdit} />}
        {activeTab === 'trends' && <TrendsPanel trends={state.trends} trendHistory={state.trendHistory} weakSignals={state.weakSignals} currentTurn={state.turn} onExploit={onExploit} onInvestSignal={onInvestSignal} />}
        {activeTab === 'tech' && <TechnologyBookPanel technologies={TECHNOLOGIES} />}
        {activeTab === 'workforce' && <WorkforcePanel company={playerCompany} />}
        {activeTab === 'ceo' && <CeoPanel company={playerCompany} onEdit={onEdit} />}
    </div>
    </div>
  );
};

const KPIPanel: React.FC<{ company: Company; history: Record<string, number[]> }> = ({ company, history }) => {
  const kpis = [
    { key: 'cash', label: 'Cash', value: company.cash, format: 'currency', trend: company.cashFlow },
    { key: 'cashFlow', label: 'Cash Flow', value: company.cashFlow, format: 'currency' },
    { key: 'valuation', label: 'Valuation', value: company.valuation, format: 'currency' },
    { key: 'marketInfluence', label: 'Market Influence', value: company.marketInfluence, format: 'percent' },
    { key: 'brandTrust', label: 'Brand Trust', value: company.brandTrust, format: 'percent' },
    { key: 'securityPosture', label: 'Security Posture', value: company.securityPosture, format: 'percent' },
    { key: 'innovation', label: 'Innovation', value: company.innovation, format: 'percent' },
    { key: 'aiCapability', label: 'AI Capability', value: company.aiCapability, format: 'percent' },
    { key: 'revenue', label: 'Revenue', value: company.revenue, format: 'currency' },
    { key: 'debt', label: 'Debt', value: company.debt, format: 'currency', trend: -company.debt },
    { key: 'operatingCosts', label: 'Op. Costs', value: company.operatingCosts, format: 'currency' },
  ];

  return (
    <div className="kpi-grid">
      {kpis.map((kpi) => (
        <div key={kpi.key} className={`kpi-card ${kpi.value > 0 && kpi.format === 'currency' ? 'positive' : kpi.value < 0 && kpi.format === 'currency' ? 'negative' : ''}`}>
          <div className="kpi-card-label">{kpi.label}</div>
          <div className="kpi-card-value">
            {kpi.format === 'currency'
              ? (Math.abs(kpi.value) >= 1e6 ? `$${(kpi.value / 1e6).toFixed(2)}M` : Math.abs(kpi.value) >= 1e3 ? `$${(kpi.value / 1e3).toFixed(0)}K` : `$${kpi.value.toLocaleString()}`)
              : `${kpi.value.toFixed(1)}%`}
          </div>
          {kpi.trend !== undefined && (
            <div className={`kpi-trend ${kpi.trend > 0 ? 'up' : kpi.trend < 0 ? 'down' : ''}`}>
              {kpi.trend > 0 ? '▲' : kpi.trend < 0 ? '▼' : '●'} {kpi.trend > 0 ? '+' : ''}${(Math.abs(kpi.trend) / 1e3).toFixed(0)}K
            </div>
          )}
          {history[kpi.key] && history[kpi.key].length > 1 && <Sparkline data={history[kpi.key]} />}
        </div>
      ))}
    </div>
  );
};

const Sparkline: React.FC<{ data: number[] }> = ({ data }) => {
  const w = 80, h = 22, pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const up = data[data.length - 1] >= data[0];
  return (
    <svg className={`sparkline ${up ? 'up' : 'down'}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={up ? '#00d4aa' : '#ff6b6b'} strokeWidth="1.5" />
    </svg>
  );
};

const DepartmentsPanel: React.FC<{
  state: GameState | null;
  departments: Department[];
  buildings: Building[];
  playerCompanyId: string;
  selectedTileId?: string | null;
  addAction?: (a: TurnAction) => void;
}> = ({ state, departments, buildings, playerCompanyId, selectedTileId, addAction }) => {
  const [openId, setOpenId] = useState<string | null>(null);

  // T: a selected player tile auto-opens its building node (replaces the old
  // floating BuildingDetailModal — selection drives this tab, not a popup over the map).
  const selectedBuildingId = selectedTileId && state
    ? state.companies.get(playerCompanyId)?.buildings.find(b => b.tileId === (selectedTileId as TileId))?.id
    : undefined;
  const effectiveOpenId = selectedBuildingId ?? openId;

  // Rival Territory: when the player clicks a rival-controlled tile, surface that
  // rival's buildings below the player's own tree (option A: no modal, just a
  // lower section). Departments stay 🔒 CLASSIFIED unless revealed by espionage
  // or the CEO's corporate_intelligence perk.
  const selectedTile = selectedTileId && state ? state.marketTiles.get(selectedTileId as TileId) : undefined;
  const rivalId = selectedTile?.controllerId;
  const isRivalTile = Boolean(rivalId) && rivalId !== playerCompanyId;
  const rivalCompany = isRivalTile ? state?.companies.get(rivalId!) : undefined;
  const revealed = state?.revealedBuildings ?? [];
  const ceoIntel = (state?.companies.get(playerCompanyId)?.ceos ?? []).some(c => c.perks?.includes('corporate_intelligence'));
  const canSeeRivalDepts = revealed.length > 0 || ceoIntel;

  if (buildings.length === 0 && !isRivalTile) return <div className="empty-state">No buildings yet. Raise one from the ORDERS tab.</div>;
  return (
    <div className="building-tree">
      {buildings.map(b => {
        const owner = state?.companies.get(playerCompanyId);
        const buildingName = owner ? getBuildingDisplayName(owner, b) : (b.name || 'Building');
        const buildingTile = state?.marketTiles.get(b.tileId);
        const depts = b.departmentIds
          .map(id => departments.find(d => d.id === id))
          .filter((d): d is Department => Boolean(d));
        const isOpen = effectiveOpenId === b.id;
        return (
          <div key={b.id} className={`building-node ${b.isHQ ? 'hq' : ''} ${selectedTileId === b.tileId ? 'selected' : ''}`}>
            <button className="building-row" onClick={() => setOpenId(isOpen ? null : b.id)}>
              <span className="bu-caret">{isOpen ? '▾' : '▸'}</span>
              <span className="bu-name">{b.isHQ ? '⚑ ' : '⌂ '}{buildingName}</span>
              <span className="bu-seg">{buildingTile?.segment.replaceAll('_', ' ') || 'corporate site'}</span>
              <span className="bu-fw">FW {b.firewall}</span>
              <span className="bu-count">{depts.length}/{b.maxDepartments} dept{depts.length === 1 ? '' : 's'}</span>
            </button>
            {isOpen && (
              <div className="building-depts">
                {depts.length === 0
                  ? <div className="empty-state small">No Departments yet!</div>
                  : <div className="departments-grid">{depts.map((d, i) => <DepartmentCard key={i} dept={d} />)}</div>}
              </div>
            )}
          </div>
        );
      })}

      {isRivalTile && rivalCompany && (
        <div className="rival-territory">
          <div className="rt-header">
            <span className="rt-lock">🔒</span>
            <span className="rt-title">RIVAL TERRITORY — {rivalCompany.name}</span>
            <span className="rt-hint">{canSeeRivalDepts ? 'interior revealed' : 'interior CLASSIFIED — run Espionage / Cyber to reveal'}</span>
          </div>
          {rivalCompany.buildings.map(b => {
            const depts = b.departmentIds
              .map(id => rivalCompany.departments.find(d => d.id === id))
              .filter((d): d is Department => Boolean(d));
            const isRevealed = canSeeRivalDepts && (revealed.includes(b.id) || ceoIntel);
            const isOpen = effectiveOpenId === b.id;
            return (
              <div key={b.id} className="building-node rival">
                <button className="building-row" onClick={() => setOpenId(isOpen ? null : b.id)}>
                  <span className="bu-caret">{isOpen ? '▾' : '▸'}</span>
                  <span className="bu-name">{b.isHQ ? '⚑ HQ' : '⌂ Branch'}</span>
                  <span className="bu-seg">{b.tileId}</span>
                  <span className="bu-count">{depts.length} dept{depts.length === 1 ? '' : 's'}</span>
                </button>
                {isOpen && (
                  <div className="building-depts">
                    {!isRevealed
                      ? <div className="empty-state small locked">🔒 CLASSIFIED — {depts.length} department(s) hidden</div>
                      : depts.length === 0
                        ? <div className="empty-state small">No Departments yet!</div>
                        : <div className="departments-grid">{depts.map((d, i) => <DepartmentCard key={i} dept={d} />)}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* T: Startup tile selected — surfaces here (no floating modal). Buyable blind. */}
      {selectedTile && (() => {
        const startup = selectedTile.controllerId ? state?.companies.get(selectedTile.controllerId) : undefined;
        if (!startup?.isStartup) return null;
        const sb = startup.buildings.find(b => b.tileId === (selectedTileId as TileId));
        const sd = (sb?.departmentIds ?? []).map(id => startup.departments.find(d => d.id === id)).filter((d): d is Department => Boolean(d));
        const price = sb ? 2_000_000 : 1_200_000;
        const playerCash = state?.companies.get(playerCompanyId)?.cash ?? 0;
        const canAfford = playerCash >= price;
        const buyStartup = () => {
          if (!addAction || !canAfford) return;
          addAction({ companyId: playerCompanyId, type: 'acquire_company', budget: price, priority: 1, targetCompanyId: startup!.id } as TurnAction);
        };
        return (
          <div className="startup-section">
            <div className="rt-header">
              <span className="rt-lock">★</span>
              <span className="rt-title">STARTUP — {startup.name}</span>
              <span className="rt-hint">{sb ? `${sd.length} dept(s) housed` : 'empty shell — buy blind'}</span>
            </div>
            <div className="bd-meta">
              <span className="bd-chip">Tile {selectedTileId}</span>
              {sb && <><span className="bd-chip">Firewall {sb.firewall}</span><span className="bd-chip">Physical {sb.physicalSecurity}</span></>}
              {selectedTile.startupPotential && <span className="bd-chip warn">Potential: {selectedTile.startupPotential}</span>}
            </div>
            {sb && sd.length > 0 && <div className="departments-grid">{sd.map((d, i) => <DepartmentCard key={i} dept={d} />)}</div>}
            <button className="btn btn-primary startup-buy-btn" disabled={!canAfford} onClick={buyStartup} title={canAfford ? `Acquire for $${price.toLocaleString()}` : 'Not enough cash'}>
              Acquire Startup — ${price.toLocaleString()}
            </button>
            {!canAfford && <p className="bd-warn">Not enough cash.</p>}
          </div>
        );
      })()}
    </div>
  );
};

export const DepartmentCard: React.FC<{ dept: Department; stackCount?: number }> = ({ dept, stackCount = 1 }) => {
  const stack = stackCount > 1 ? ` ×${stackCount}` : '';
  return (
      <div className={`dept-card ${dept.type === 'dev_engineering' ? 'dev' : ''}`}>
        <div className="dept-header">
          <span className="dept-name">{dept.type.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}{stack}</span>
          <span className="dept-level">Lv. {dept.level}</span>
        </div>
        <div className="dept-stats">
          <StatBar label="Capacity" value={dept.capacity} max={200} />
          <StatBar label="Efficiency" value={Math.round(dept.efficiency * 100)} max={100} />
          <StatBar label="Morale" value={Math.round(dept.morale * 100)} max={100} />
          <StatBar label="Risk" value={Math.round(dept.risk * 100)} max={100} inverted />
        </div>
        {dept.productId && <div className="dept-product">1 product linked</div>}
        {dept.techStack && (
          <div className="dept-tech">
            {Object.entries(dept.techStack).map(([k, v]) => (
              <span key={k} className="tech-chip" title={k}>{k.replace('cicd_', '').replace('_', ' ')} {Math.round(v)}</span>
            ))}
          </div>
        )}
        <div className="dept-cost">${dept.recurringCost.toLocaleString()}/turn</div>
      </div>
  );
};

const ProductsPanel: React.FC<{ products: Product[]; ideas: Idea[] }> = ({ products, ideas }) => (
  <div className="products-grid">
    {products.length === 0 ? (
      <div className="empty-state">No products launched</div>
    ) : (
      products.map((product, i) => (
        <div key={i} className="product-card">
          <div className="product-header">
            <span className="product-name">{product.name}</span>
            <span className="product-category">{product.category.toUpperCase()}</span>
          </div>
          <div className="product-stats">
            <StatBar label="Quality" value={product.quality} max={100} />
            <StatBar label="Security" value={product.security} max={100} />
            <StatBar label="Market Fit" value={product.marketFit} max={100} />
            <StatBar label="Tech Debt" value={product.technicalDebt} max={100} inverted />
          </div>
          <div className="product-financials">
            <span>Price: ${product.price.toLocaleString()}</span>
            <span>Compute: {product.computePoints}</span>
            <span>Margin: {(product.lastTurnMargin * 100).toFixed(0)}%</span>
          </div>
          <div className="product-lifecycle">
            <span className={`lifecycle-badge ${product.lifecycleStage}`}>{product.lifecycleStage.toUpperCase()} · v{product.version}</span>
            <span className="lifecycle-adopters">adopters {(product.adopters * 100).toFixed(0)}%</span>
            {product.pivotCount > 0 && <span className="lifecycle-pivot">pivots {product.pivotCount}</span>}
            {product.espionageIntelId && <span className="lifecycle-pivot">{product.repatented ? 'RE-PATENTED IP' : 'STOLEN IP · LEGAL RISK'}</span>}
          </div>
        </div>
      ))
    )}
    <div className="ideas-section">
      <div className="orders-section-head">R&amp;D Ideas <span className="alerts-count">{ideas.length}</span></div>
      {ideas.length === 0 ? (
        <p className="trends-empty">No ideas invented yet — use “Create Ideas (R&D)”.</p>
      ) : (
        ideas.slice().reverse().map(idea => (
          <div key={idea.id} className={`idea-card ${idea.breakthrough ? 'breakthrough' : ''}`}>
            <span className="idea-name">{idea.name}</span>
            <span className="idea-meta">{idea.category.replace('_', ' ')} · maturity {idea.maturity}</span>
            {idea.espionageIntelId && <span className="idea-meta">{idea.repatented ? 're-patented stolen IP' : 'stolen IP · exposed to claims'}</span>}
          </div>
        ))
      )}
    </div>
  </div>
);

const CapabilitiesPanel: React.FC<{ company: Company }> = ({ company }) => {
  // Derive capabilities dynamically from the company's actual assets.
  const deptByType = new Map<string, number>();
  company.departments.forEach(d => {
    deptByType.set(d.type, Math.max(deptByType.get(d.type) ?? 0, d.level));
  });
  const avgProductQuality = company.products.length
    ? company.products.reduce((s, p) => s + p.quality, 0) / company.products.length
    : 0;
  const cards: { title: string; value: number; icon: string; color: string }[] = [
    { title: 'Security', value: company.securityPosture, icon: 'shield', color: '#ff4444' },
    { title: 'AI', value: company.aiCapability, icon: 'ai', color: '#00d4aa' },
    { title: 'Consulting', value: company.consultingCapacity, icon: 'consult', color: '#ffc107' },
    { title: 'Innovation', value: company.innovation, icon: 'bulb', color: '#e83e8c' },
    { title: 'Trust', value: company.brandTrust, icon: 'heart', color: '#007bff' },
    { title: 'Product Quality', value: avgProductQuality, icon: 'star', color: '#6f42c1' },
  ];
  return (
    <div className="capabilities-grid">
      {cards.map(c => (
        <CapabilityCard key={c.title} title={c.title} value={c.value} icon={c.icon} color={c.color} />
      ))}
      {Array.from(deptByType.entries()).map(([type, level]) => (
        <CapabilityCard
          key={type}
          title={type.replace('_', ' ')}
          value={level * 33}
          max={99}
          icon="dept"
          color="#20c997"
        />
      ))}
      {company.products.length === 0 && deptByType.size === 0 && (
        <div className="empty-state">No capabilities yet — build departments & launch products</div>
      )}
    </div>
  );
};

export const NewsPanel: React.FC<{ news: NewsItem[] }> = ({ news }) => {
  const companies = useGameStore(s => s.state?.companies);
  const companyName = (id?: string) => (id ? (companies?.get(id as never)?.name ?? id) : undefined);
  return (
  <div className="news-feed">
    {news.length === 0 ? (
      <div className="empty-state">No news this turn</div>
    ) : (
      news.slice(-10).reverse().map((item, i) => (
        <div key={i} className={`news-item ${item.importance}`}>
          <span className="news-turn">T{item.turn}</span>
          <span className="news-headline">{item.headline}</span>
          <span className="news-body">{item.body}</span>
          {item.companyId && <span className="news-company">{companyName(item.companyId)}</span>}
        </div>
      ))
    )}
  </div>
);
};

const OrdersPanel: React.FC<{
  actions: TurnAction[];
  history: TurnAction[];
  alerts: AlertItem[];
  onEdit: (action: TurnAction) => void;
}> = ({ actions, history, alerts, onEdit }) => {
  const label = (t: string) => t.replace(/_/g, ' ').replace(/\\b\\w/g, (c: string) => c.toUpperCase());
  if (actions.length === 0 && history.length === 0) {
    return (
      <div className="orders-list">
        <div className="empty-state">No orders yet</div>
        <div className="orders-section alerts-section">
          <div className="orders-section-head">Alerts <span className="alerts-count">{alerts.length}</span></div>
          {alerts.length === 0 && <p className="trends-empty">No alerts yet — major/critical events will surface here.</p>}
          {alerts.slice().reverse().map((al) => (
            <div key={al.id} className={`alert-row ${al.importance}`}>
              <span className="alert-turn">T{al.turn}</span>
              <span className="alert-importance">{al.importance}</span>
              <span className="alert-title">{al.title}</span>
              {al.body && <span className="alert-body">{al.body}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }
  // Group history by resolved turn for a compact "previous turns" view.
  const byTurn = new Map<number, TurnAction[]>();
  history.forEach(a => {
    const t = a.resolvedTurn ?? 0;
    if (!byTurn.has(t)) byTurn.set(t, []);
    byTurn.get(t)!.push(a);
  });
  const turns = Array.from(byTurn.keys()).sort((a, b) => b - a);
  return (
    <div className="orders-list">
      {actions.length > 0 && (
        <div className="orders-section">
          <div className="orders-section-head">Planned (this turn)</div>
          {actions.slice().reverse().map((a) => (
            <div key={a.id} className={`order-row ${a.status}`}>
              <span className="order-type">{label(a.type)}</span>
              <span className="order-budget">${a.budget.toLocaleString()}</span>
              <span className={`order-status ${a.status}`}><Icon name="clock" size={12} /> planned</span>
              {a.outcome?.message && <span className="order-msg">{a.outcome.message}</span>}
            </div>
          ))}
        </div>
      )}
      {turns.map((t) => (
        <div key={t} className="orders-section">
          <div className="orders-section-head">Turn {t}</div>
          {byTurn.get(t)!.map((a) => (
            <div key={a.id} className={`order-row ${a.status}`}>
              <span className="order-type">{label(a.type)}</span>
              <span className="order-budget">${a.budget.toLocaleString()}</span>
              <span className={`order-status ${a.status}`}>
                {a.status === 'resolved' ? <><Icon name="check" size={12} /> done</> : <><Icon name="cross" size={12} /> failed</>}
              </span>
              {a.outcome?.message && <span className="order-msg">{a.outcome.message}</span>}
              <button className="btn btn-ghost order-rebid" onClick={() => onEdit(a)}><Icon name="rerun" size={12} /> {a.status === 'failed' ? 'RE-BID' : 'REPLAY'}</button>
            </div>
          ))}
        </div>
      ))}
      <div className="orders-section alerts-section">
        <div className="orders-section-head">Alerts <span className="alerts-count">{alerts.length}</span></div>
        {alerts.length === 0 && <p className="trends-empty">No alerts yet — major/critical events will surface here.</p>}
        {alerts.slice().reverse().map((al) => (
          <div key={al.id} className={`alert-row ${al.importance}`}>
            <span className="alert-turn">T{al.turn}</span>
            <span className="alert-importance">{al.importance}</span>
            <span className="alert-title">{al.title}</span>
            {al.body && <span className="alert-body">{al.body}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

const StatBar: React.FC<{ label: string; value: number; max: number; inverted?: boolean }> = ({
  label, value, max, inverted,
}) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const isBad = inverted ? value > 50 : value < 50;
  return (
    <div className="stat-bar-row">
      <span className="stat-label">{label}</span>
      <div className="stat-bar-container">
        <div className={`stat-bar-fill ${isBad ? 'bad' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="stat-value">{value.toFixed(0)}</span>
    </div>
  );
};

const TechnologyBookPanel: React.FC<{ technologies: Technology[] }> = ({ technologies }) => (
  <div className="tech-book">
    <p className="tech-book-intro">The Technology Book — CI/CD &amp; cloud stacks you can master in DEV departments, plus ruthless.com&apos;s invented FUTURISTIC techs.</p>
    <div className="tech-grid">
      {technologies.map(t => (
        <div key={t.id} className={`tech-card ${t.invented ? 'futuristic' : ''} cat-${t.category}`}>
          <div className="tech-head">
            <span className="tech-name">{t.name}</span>
            <span className="tech-tier">T{t.tier}</span>
          </div>
          <span className="tech-cat">{t.category}{t.invented ? ' · invented' : ''}</span>
          <p className="tech-desc">{t.description}</p>
          <span className="tech-skill">skill: {DEV_SKILLS[t.skill] ?? t.skill}</span>
        </div>
      ))}
    </div>
  </div>
);

const WorkforcePanel: React.FC<{ company: Company }> = ({ company }) => {
  const moraleColor = company.employeeMorale > 60 ? '#00d4aa' : company.employeeMorale > 30 ? '#ffc107' : '#ff4d4f';
  return (
    <div className="workforce-panel">
      <div className="wf-grid">
        <StatBar label="Employee Morale" value={Math.round(company.employeeMorale)} max={100} />
        <StatBar label="Employer Brand" value={Math.round(company.employerBrand)} max={100} />
        <StatBar label="Work-Life Balance" value={Math.round(company.hrMetrics.workLifeBalance)} max={100} />
        <StatBar label="Internal Brand" value={Math.round(company.hrMetrics.internalBrand)} max={100} />
      </div>
      <div className="wf-stats">
        <span>Headcount: {company.hrMetrics.headcount}</span>
        <span>Layoffs this turn: {company.hrMetrics.layoffsThisTurn}</span>
        <span>Scandal: {Math.round(company.scandal)}</span>
        <span className="wf-morale" style={{ color: moraleColor }}>Morale: {Math.round(company.employeeMorale)}</span>
      </div>
      <div className="wf-ceos">
        <div className="orders-section-head">CEOs / HQ <span className="alerts-count">{company.ceos.length}</span></div>
        {company.ceos.length === 0 ? (
          <p className="trends-empty">No CEO seated. Build an HQ + hire a CEO (needs HR dept) to gain +1 order each.</p>
        ) : (
          company.ceos.map(c => (
            <div key={c.id} className="wf-ceo">
              <span className="wf-ceo-role">{c.role.toUpperCase()}</span>
              <span className="wf-ceo-xp">XP {c.xp} · lvl {company.ceoLevel}</span>
              {c.perks.includes('extra_order') && <span className="wf-perk">+order</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

  const CapabilityCard: React.FC<{ title: string; value: number; max?: number; icon: string; color: string }> = ({
    title, value, max = 100, icon, color,
  }) => {
    const pct = Math.min(100, (value / max) * 100);
    return (
      <div className="capability-card">
        <span className="capability-icon" style={{ color }}><Icon name={icon as IconName} size={18} /></span>
      <div className="capability-info">
        <span className="capability-title">{title}</span>
        <div className="capability-bar">
          <div className="capability-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
      <span className="capability-value">{value.toFixed(0)}</span>
    </div>
  );
};

/** T5 — Global market trends + weak signals. Exploit opens the Orders tab. */
const CeoPanel: React.FC<{ company: Company; onEdit: (a: TurnAction) => void }> = ({ company, onEdit }) => {
  if (company.ceos.length === 0) {
    return (
      <div className="ceo-panel">
        <div className="empty-state">No CEO seated. Build an HQ, add an HR department, then use <b>Hire CEO</b> from the ORDERS tab to seat one.</div>
      </div>
    );
  }
  return (
    <div className="ceo-panel">
      {company.ceos.map(c => {
        const skills = CEO_PILLARS.map(s => ({ key: s, label: PILLAR_LABELS[s], val: c.skills[s] ?? 0 }));
        return (
          <div key={c.id} className="ceo-card">
            <div className="ceo-head">
              <span className="ceo-role">{c.role.toUpperCase()}</span>
              <span className="ceo-xp">XP {c.xp} · lvl {company.ceoLevel} · {c.specialPoints} SP</span>
            </div>

            <div className="ceo-special">
              {skills.map(s => (
                <div key={s.key} className="special-row">
                  <span className="special-label">{s.label}</span>
                  <div className="special-bar"><div className="special-fill" style={{ width: `${s.val * 10}%` }} /></div>
                  <span className="special-val">{s.val}</span>
                </div>
              ))}
              <div className="special-row">
                <span className="special-label">L — Luck</span>
                <div className="special-bar"><div className="special-fill luck" style={{ width: `${c.luck * 10}%` }} /></div>
                <span className="special-val">{c.luck}</span>
              </div>
            </div>

            <div className="ceo-traits">
              {(c.ceoTraits ?? []).map(t => (
                <span key={t} className="trait-chip" title={CEO_TRAIT_DEFS[t]?.blurb}>{CEO_TRAIT_DEFS[t]?.name ?? t}</span>
              ))}
              {c.perks.map(p => (
                <span key={p} className="perk-chip" title={PERK_LABELS[p]}>{p.replace('_', ' ')}</span>
              ))}
              {/* T: lockable perks — show the path to earn them by growing an executive pillar */}
              {(Object.keys(PERK_PILLAR_THRESHOLD) as (keyof typeof PERK_PILLAR_THRESHOLD)[])
                .filter(pk => !c.perks.includes(pk))
                .map(pk => {
                  const t = PERK_PILLAR_THRESHOLD[pk]!;
                  const cur = c.skills[t.skill] ?? 0;
                  return (
                    <span key={pk} className="perk-chip locked" title={`${PERK_LABELS[pk]} — needs ${t.skill} ${t.min} (have ${cur})`}>
                      {pk.replace('_', ' ')} 🔒{cur}/{t.min}
                    </span>
                  );
                })}
            </div>

            <div className="ceo-actions">
              <button className="ceo-btn" onClick={() => onEdit({ ...blankAction(company.id, 'train_ceo'), executiveId: c.id })}>Train Pillar</button>
              <button className="ceo-btn danger" onClick={() => onEdit({ ...blankAction(company.id, 'hire_ceo') })}>Hire New CEO</button>
              <button className="ceo-btn danger" onClick={() => onEdit({ ...blankAction(company.id, 'hire_coo') })}>Hire COO</button>
              {company.ceos.length > 1 && (
                <button className="ceo-btn danger" onClick={() => onEdit({ ...blankAction(company.id, 'fire_ceo'), executiveId: c.id })}>Fire</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Minimal valid TurnAction draft for opening the composer pre-filled. */
function blankAction(companyId: string, type: ActionType): TurnAction {
  return {
    id: `draft_${type}_${Date.now()}`,
    companyId,
    type,
    budget: 0,
    status: 'planned',
    priority: 1,
  } as TurnAction;
}

export const TrendsPanel: React.FC<{
  trends: MarketTrend[];
  trendHistory?: TrendHistoryEntry[];
  weakSignals: WeakSignal[];
  currentTurn?: number;
  onExploit: (trend: MarketTrend) => void;
  onInvestSignal?: (signal: WeakSignal) => void;
}> = ({ trends, trendHistory = [], weakSignals, currentTurn = 1, onExploit, onInvestSignal = () => undefined }) => {
  return (
    <div className="trends-panel">
      <div className="trends-section">
        <div className="trends-section-head">
          <span>GLOBAL TRENDS</span>
          <span className="trends-count">{trends.length}</span>
        </div>
        {trends.length === 0 && <p className="trends-empty">No active trends — the market is flat. Watch for weak signals.</p>}
        {trends.map(t => (
          <div key={t.id} className="trend-card" style={{ borderLeftColor: '#00d4aa' }}>
            <div className="trend-top">
              <span className="trend-title">{t.title}</span>
              <span className="trend-strength">{(t.strength * 100).toFixed(0)}%</span>
            </div>
            <p className="trend-blurb">{t.blurb}</p>
            <div className="trend-meta">
              <span className="trend-tag cat">{t.category.replace('_', ' ')}</span>
              <span className="trend-tag sec">{t.sector.replace('_', ' ')}</span>
              <span className="trend-exp">EXPLOIT: {Math.max(0, t.decisionDeadlineTurn - currentTurn + 1)} turn{t.decisionDeadlineTurn - currentTurn === 0 ? '' : 's'} left</span>
            </div>
            <button className="trend-exploit" onClick={() => onExploit(t)}>EXPLOIT ▶</button>
          </div>
        ))}
      </div>

      {trendHistory.length > 0 && (
        <div className="trends-section trend-history">
          <div className="trends-section-head"><span>MARKET MEMORY</span><span className="trends-count">LAST 6</span></div>
          {trendHistory.slice(-6).reverse().map(entry => (
            <div key={`${entry.trend.id}_${entry.resolvedTurn}`} className={`trend-transition ${entry.outcome}`}>
              <span className="trend-transition-state">{entry.outcome === 'pursued' ? 'CAPTURED' : 'FADED'}</span>
              <strong>{entry.trend.title}</strong>
              <small>{entry.outcome === 'pursued' ? `Order committed on T${entry.resolvedTurn}` : `Window missed on T${entry.resolvedTurn} · late launches capped`}</small>
            </div>
          ))}
        </div>
      )}

      <div className="trends-section">
        <div className="trends-section-head">
          <span>WEAK SIGNALS</span>
          <span className="trends-count">{weakSignals.length}</span>
        </div>
        {weakSignals.length === 0 && <p className="trends-empty">No weak signals right now.</p>}
        {weakSignals.map(w => (
          <div key={w.id} className="trend-card weak" style={{ borderLeftColor: '#ffc107' }}>
            <p className="trend-blurb">{w.hint}</p>
            <div className="trend-meta">
              <span className="trend-tag cat">{w.relatedCategory.replace('_', ' ')}</span>
              <span className="trend-tag sec">{w.relatedSector.replace('_', ' ')}</span>
              <span className="trend-exp">conf {(w.confidence * 100).toFixed(0)}% · until T{w.expiresTurn}</span>
            </div>
            <button className="trend-exploit" onClick={() => onInvestSignal(w)}>INVEST ▶</button>
          </div>
        ))}
      </div>
    </div>
  );
};
