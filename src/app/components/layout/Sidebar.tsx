import React from 'react';
import { useGameStore } from '../../../store/gameStore';
import type { Company, TurnAction, MarketBriefing, DemandShift, CompetitorMove, CyberAlert } from '../../../types';

interface SidebarProps {
  playerCompany: Company | undefined;
  companies: Company[];
  actions: TurnAction[];
  marketBriefing: MarketBriefing;
  
  onShowActionModal: () => void;
  onCompanySelect: (id: string | null) => void;
  selectedCompanyId: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  playerCompany,
  companies,
  actions,
  marketBriefing,
  
  onShowActionModal,
  onCompanySelect,
  selectedCompanyId,
}) => {
  const { setActivePanel } = useGameStore();

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <h3>EXECUTIVE ORDERS</h3>
          <span className="order-count">{actions.length} / {playerCompany?.executiveOrderLimit || 3}</span>
        </div>
        <div className="actions-list">
          {actions.length === 0 ? (
            <p className="empty-state">No actions planned</p>
          ) : (
            actions.map(action => (
              <ActionItem key={action.id} action={action} />
            ))
          )}
        </div>
        <button className="btn btn-primary btn-full" onClick={onShowActionModal}>
          + ADD ORDER
        </button>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <h3>COMPETITORS</h3>
        </div>
        <div className="competitors-list">
          {companies.filter(c => !c.isPlayer).map(company => (
            <CompetitorItem
              key={company.id}
              company={company}
              isSelected={selectedCompanyId === company.id}
              onClick={() => onCompanySelect(selectedCompanyId === company.id ? null : company.id)}
            />
          ))}
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <h3>MARKET BRIEFING</h3>
        </div>
        <div className="briefing-items">
          {marketBriefing.demandShifts?.slice(0, 3).map((shift, i) => (
            <BriefingItem key={i} shift={shift} />
          ))}
          {marketBriefing.competitorMoves?.slice(0, 2).map((move, i) => (
            <BriefingItem key={i} move={move} />
          ))}
          {marketBriefing.cyberAlerts?.slice(0, 1).map((alert, i) => (
            <BriefingItem key={i} alert={alert} />
          ))}
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <h3>QUICK ACTIONS</h3>
        </div>
        <div className="quick-actions">
          <QuickAction icon="📊" label="Market Intel" onClick={() => setActivePanel('market')} />
          <QuickAction icon="🏢" label="Departments" onClick={() => setActivePanel('departments')} />
          <QuickAction icon="📦" label="Products" onClick={() => setActivePanel('products')} />
          <QuickAction icon="👥" label="Executives" onClick={() => setActivePanel('executives')} />
          <QuickAction icon="🔒" label="Security" onClick={() => setActivePanel('security')} />
          <QuickAction icon="🤖" label="AI & Data" onClick={() => setActivePanel('ai')} />
          <QuickAction icon="💰" label="Finance" onClick={() => setActivePanel('finance')} />
          <QuickAction icon="📰" label="News" onClick={() => setActivePanel('news')} />
        </div>
      </div>
    </aside>
  );
};

const ActionItem: React.FC<{ action: TurnAction }> = ({ action }) => (
  <div className="action-item">
    <span className="action-type">{action.type.replace('_', ' ').toUpperCase()}</span>
    <span className="action-budget">${action.budget.toLocaleString()}</span>
  </div>
);

const CompetitorItem: React.FC<{ company: Company; isSelected: boolean; onClick: () => void }> = ({
  company,
  isSelected,
  onClick,
}) => (
  <button
    className={`competitor-item ${isSelected ? 'selected' : ''}`}
    onClick={onClick}
    style={{ borderLeftColor: company.color }}
  >
    <div className="competitor-info">
      <span className="competitor-name">{company.name}</span>
      <span className="competitor-archetype">{company.archetype?.replace('_', ' ')}</span>
    </div>
    <div className="competitor-stats">
      <span>${company.cash.toLocaleString()}</span>
      <span>{company.marketInfluence.toFixed(1)}%</span>
    </div>
  </button>
);

const BriefingItem: React.FC<{ shift?: DemandShift; move?: CompetitorMove; alert?: CyberAlert }> = ({ shift, move, alert }) => {
  if (shift) {
    return (
      <div className={`briefing-item demand ${shift.change > 0 ? 'positive' : 'negative'}`}>
        <span className="briefing-icon">📈</span>
        <div>
          <span>{shift.segment.replace('_', ' ')}</span>
          <span className="briefing-value">{shift.change > 0 ? '+' : ''}{(shift.change * 100).toFixed(1)}%</span>
        </div>
      </div>
    );
  }
  if (move) {
    return (
      <div className="briefing-item competitor">
        <span className="briefing-icon">🏢</span>
        <div>
          <span>Competitor: {move.action.replace('_', ' ')}</span>
          <span className="briefing-visibility">Visibility: {Math.round(move.visibility * 100)}%</span>
        </div>
      </div>
    );
  }
  if (alert) {
    return (
      <div className={`briefing-item cyber severity-${alert.severity}`}>
        <span className="briefing-icon">⚠️</span>
        <div>
          <span>Cyber: {alert.targetSegment.replace('_', ' ')}</span>
          <span className="briefing-value">{alert.severity.toUpperCase()}</span>
        </div>
      </div>
    );
  }
  return null;
};

const QuickAction: React.FC<{ icon: string; label: string; onClick: () => void }> = ({
  icon,
  label,
  onClick,
}) => (
  <button className="quick-action-btn" onClick={onClick}>
    <span>{icon}</span>
    <span>{label}</span>
  </button>
);
