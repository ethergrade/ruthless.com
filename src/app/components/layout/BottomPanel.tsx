import React, { useState } from 'react';
import type { Company, NewsItem } from '../../../types';
import { formatNumber } from '../../../utils/formatters';

interface BottomPanelProps {
  state: any;
  playerCompany: Company | undefined;
  newsFeed: NewsItem[];
  notifications: string[];
  onDismissNotification: (index: number) => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  state,
  playerCompany,
  newsFeed,
  notifications,
  onDismissNotification,
}) => {
  const [activeTab, setActiveTab] = useState<'kpi' | 'departments' | 'products' | 'capabilities' | 'news'>('kpi');

  if (!state || !playerCompany) return null;

  return (
    <div className="bottom-panel">
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
        <button className={`tab ${activeTab === 'news' ? 'active' : ''}`} onClick={() => setActiveTab('news')}>
          News
        </button>
      </div>

      <div className="bottom-content">
        {activeTab === 'kpi' && <KPIPanel company={playerCompany} />}
        {activeTab === 'departments' && <DepartmentsPanel departments={playerCompany.departments} />}
        {activeTab === 'products' && <ProductsPanel products={playerCompany.products} />}
        {activeTab === 'capabilities' && <CapabilitiesPanel company={playerCompany} />}
        {activeTab === 'news' && <NewsPanel news={newsFeed} />}
      </div>

      {notifications.length > 0 && (
        <div className="notifications-bar">
          {notifications.map((msg, i) => (
            <div key={i} className="notification-item" onClick={() => onDismissNotification(i)}>
              {msg}
              <button className="dismiss-btn" onClick={e => { e.stopPropagation(); onDismissNotification(i); }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const KPIPanel: React.FC<{ company: Company }> = ({ company }) => {
  const kpis = [
    { label: 'Cash', value: company.cash, format: 'currency', trend: company.cashFlow },
    { label: 'Cash Flow', value: company.cashFlow, format: 'currency' },
    { label: 'Valuation', value: company.valuation, format: 'currency' },
    { label: 'Market Influence', value: company.marketInfluence, format: 'percent' },
    { label: 'Brand Trust', value: company.brandTrust, format: 'percent' },
    { label: 'Security Posture', value: company.securityPosture, format: 'percent' },
    { label: 'Innovation', value: company.innovation, format: 'percent' },
    { label: 'AI Capability', value: company.aiCapability, format: 'percent' },
    { label: 'Consulting', value: company.consultingCapacity, format: 'percent' },
    { label: 'Debt', value: company.debt, format: 'currency', trend: -company.debt },
    { label: 'Op. Costs', value: company.operatingCosts, format: 'currency' },
    { label: 'Revenue', value: company.revenue, format: 'currency' },
  ];

  return (
    <div className="kpi-grid">
      {kpis.map((kpi, i) => (
        <div key={i} className={`kpi-card ${kpi.value > 0 && kpi.format === 'currency' ? 'positive' : kpi.value < 0 && kpi.format === 'currency' ? 'negative' : ''}`}>
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
        </div>
      ))}
    </div>
  );
};

const DepartmentsPanel: React.FC<{ departments: any[] }> = ({ departments }) => (
  <div className="departments-grid">
    {departments.map((dept, i) => (
      <div key={i} className="dept-card">
        <div className="dept-header">
          <span className="dept-name">{dept.type.replace('_', ' ').replace(/\b\w/g,  (c: string) => c.toUpperCase())}</span>
          <span className="dept-level">Lv. {dept.level}</span>
        </div>
        <div className="dept-stats">
          <StatBar label="Capacity" value={dept.capacity} max={200} />
          <StatBar label="Efficiency" value={Math.round(dept.efficiency * 100)} max={100} />
          <StatBar label="Morale" value={Math.round(dept.morale * 100)} max={100} />
          <StatBar label="Risk" value={Math.round(dept.risk * 100)} max={100} inverted />
        </div>
        <div className="dept-cost">$${dept.recurringCost.toLocaleString()}/turn</div>
      </div>
    ))}
  </div>
);

const ProductsPanel: React.FC<{ products: any[] }> = ({ products }) => (
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

const CapabilitiesPanel: React.FC<{ company: Company }> = ({ company }) => (
  <div className="capabilities-grid">
    <CapabilityCard title="Security" value={company.securityPosture} icon="🔒" color="#ff4444" />
    <CapabilityCard title="AI" value={company.aiCapability} icon="🤖" color="#00d4aa" />
    <CapabilityCard title="Consulting" value={company.consultingCapacity} icon="👥" color="#ffc107" />
    <CapabilityCard title="Innovation" value={company.innovation} icon="💡" color="#e83e8c" />
    <CapabilityCard title="Trust" value={company.brandTrust} icon="🤝" color="#007bff" />
    <CapabilityCard title="Exec Orders" value={company.executiveOrderLimit * 33} max={100} icon="📋" color="#6f42c1" />
  </div>
);

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
      <span className="capability-icon" style={{ color }}>{icon}</span>
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
