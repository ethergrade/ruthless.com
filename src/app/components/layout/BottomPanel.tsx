import React, { useState } from 'react';
import type { Company, NewsItem, Department, Product, TurnAction, GameState, MarketTrend, WeakSignal, AlertItem } from '../../../types';
import { Icon, IconName } from '../ui/Icon';

interface BottomPanelProps {
  state: GameState | null;
  playerCompany: Company | undefined;
  newsFeed: NewsItem[];
  defaultTab?: 'kpi' | 'departments' | 'products' | 'capabilities' | 'news' | 'orders' | 'trends';
  onEdit: (action: TurnAction) => void;
  height?: number;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  state,
  playerCompany,
  newsFeed,
  defaultTab = 'kpi',
  onEdit,
  height = 220,
}) => {
  const [activeTab, setActiveTab] = useState<'kpi' | 'departments' | 'products' | 'capabilities' | 'news' | 'orders' | 'trends'>(defaultTab);

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
        <button className={`tab ${activeTab === 'news' ? 'active' : ''}`} onClick={() => setActiveTab('news')}>
          News
        </button>
        <button className={`tab ${activeTab === 'trends' ? 'active' : ''}`} onClick={() => setActiveTab('trends')}>
          Trends
        </button>
      </div>

      <div className="bottom-content">
        {activeTab === 'kpi' && <KPIPanel company={playerCompany} history={state.kpiHistory} />}
        {activeTab === 'departments' && <DepartmentsPanel departments={playerCompany.departments} />}
        {activeTab === 'products' && <ProductsPanel products={playerCompany.products} />}
        {activeTab === 'capabilities' && <CapabilitiesPanel company={playerCompany} />}
        {activeTab === 'orders' && <OrdersPanel actions={state.actions.filter(a => a.companyId === state.playerCompanyId)} history={state.actionHistory.filter(a => a.companyId === state.playerCompanyId)} alerts={state.alerts} onEdit={onEdit} />}
        {activeTab === 'news' && <NewsPanel news={newsFeed} />}
        {activeTab === 'trends' && <TrendsPanel trends={state.trends} weakSignals={state.weakSignals} onExploit={(_c) => setActiveTab('orders')} />}
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

const DepartmentsPanel: React.FC<{ departments: Department[] }> = ({ departments }) => (
  <div className="departments-grid">
    {departments.map((dept, i) => (
      <div key={i} className="dept-card">
        <div className="dept-header">
          <span className="dept-name">{dept.type.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
          <span className="dept-level">Lv. {dept.level}</span>
        </div>
        <div className="dept-stats">
          <StatBar label="Capacity" value={dept.capacity} max={200} />
          <StatBar label="Efficiency" value={Math.round(dept.efficiency * 100)} max={100} />
          <StatBar label="Morale" value={Math.round(dept.morale * 100)} max={100} />
          <StatBar label="Risk" value={Math.round(dept.risk * 100)} max={100} inverted />
        </div>
        <div className="dept-cost">${dept.recurringCost.toLocaleString()}/turn</div>
      </div>
    ))}
  </div>
);

const ProductsPanel: React.FC<{ products: Product[] }> = ({ products }) => (
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
            <span>Cost: ${product.operatingCost.toLocaleString()}</span>
            <span>Margin: {(((product.price - product.operatingCost) / product.price) * 100).toFixed(0)}%</span>
          </div>
        </div>
      ))
    )}
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

const NewsPanel: React.FC<{ news: NewsItem[] }> = ({ news }) => (
  <div className="news-feed">
    {news.length === 0 ? (
      <div className="empty-state">No news this turn</div>
    ) : (
      news.slice(-10).reverse().map((item, i) => (
        <div key={i} className={`news-item ${item.importance}`}>
          <span className="news-turn">T{item.turn}</span>
          <span className="news-headline">{item.headline}</span>
          <span className="news-body">{item.body}</span>
          {item.companyId && <span className="news-company">{item.companyId}</span>}
        </div>
      ))
    )}
  </div>
);

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
const TrendsPanel: React.FC<{
  trends: MarketTrend[];
  weakSignals: WeakSignal[];
  onExploit: (category: string) => void;
}> = ({ trends, weakSignals, onExploit }) => {
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
              <span className="trend-exp">until T{t.expiresTurn}</span>
            </div>
            <button className="trend-exploit" onClick={() => onExploit(t.category)}>EXPLOIT ▶</button>
          </div>
        ))}
      </div>

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
              <span className="trend-exp">conf {(w.confidence * 100).toFixed(0)}% · until T{w.expiresTurn}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
