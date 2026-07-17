import React, { useState } from 'react';
import type { Company, TurnAction, MarketBriefing, DemandShift, CompetitorMove, CyberAlert, AuctionListing } from '../../../types';

interface SidebarProps {
  playerCompany: Company | undefined;
  companies: Company[];
  actions: TurnAction[];
  marketBriefing: MarketBriefing;
  auctionHouse: AuctionListing[];
  onBid: (listingId: string, amount: number) => void;

  onShowActionModal: () => void;
  onCompanySelect: (id: string | null) => void;
  selectedCompanyId: string | null;
  onQuickAction: (key: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  playerCompany,
  companies,
  actions,
  marketBriefing,
  auctionHouse,

  onShowActionModal,
  onCompanySelect,
  selectedCompanyId,
  onQuickAction,
  onBid,
}) => {
  const [bidding, setBidding] = useState<{ id: string; amount: number } | null>(null);
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
          <QuickAction icon="📊" label="Market Intel" onClick={() => onQuickAction('market')} />
          <QuickAction icon="🏢" label="Departments" onClick={() => onQuickAction('departments')} />
          <QuickAction icon="📦" label="Products" onClick={() => onQuickAction('products')} />
          <QuickAction icon="👥" label="Executives" onClick={() => onQuickAction('executives')} />
          <QuickAction icon="🔒" label="Security" onClick={() => onQuickAction('security')} />
          <QuickAction icon="🤖" label="AI & Data" onClick={() => onQuickAction('ai')} />
          <QuickAction icon="💰" label="Finance" onClick={() => onQuickAction('finance')} />
          <QuickAction icon="📰" label="News" onClick={() => onQuickAction('news')} />
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <h3>AUCTION HOUSE</h3>
          <span className="order-count">{auctionHouse.length}</span>
        </div>
        <div className="auction-list">
          {auctionHouse.length === 0 ? (
            <p className="empty-state">No assets listed</p>
          ) : (
            auctionHouse.map(a => {
              const bidder = a.highestBidderId ? companies.find(c => c.id === a.highestBidderId) : null;
              const minBid = (a.currentBid > 0 ? a.currentBid : a.basePrice) + 1;
              const isBidding = bidding?.id === a.id;
              return (
                <div key={a.id} className="auction-item">
                  <span className="auction-name">{a.name}</span>
                  <span className="auction-meta">
                    {a.kind} · {a.currentBid > 0 ? `$${a.currentBid.toLocaleString()}` : `$${a.basePrice.toLocaleString()}`}
                  </span>
                  {bidder && <span className="auction-bidder" style={{ color: bidder.color }}>↑ {bidder.name}</span>}
                  <span className="auction-expires">ends T{a.expiresTurn}</span>
                  {isBidding ? (
                    <div className="auction-bidrow">
                      <input
                        type="number"
                        className="auction-bidinput"
                        value={bidding.amount}
                        min={minBid}
                        onChange={(e) => {
                          const v = Math.max(minBid, parseInt(e.target.value) || minBid);
                          setBidding({ id: a.id, amount: v });
                        }}
                      />
                      <button className="btn btn-primary auction-bidbtn" onClick={() => { onBid(a.id, bidding.amount); setBidding(null); }}>
                        CONFIRM
                      </button>
                      <button className="btn btn-ghost auction-bidbtn" onClick={() => setBidding(null)}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button className="btn btn-secondary auction-bidbtn" onClick={() => setBidding({ id: a.id, amount: minBid })}>
                      BID
                    </button>
                  )}
                </div>
              );
            })
          )}
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
