import React, { useState } from 'react';
import { useGameStore } from './store/gameStore';
import { Header } from './app/components/layout/Header';
import { Sidebar } from './app/components/layout/Sidebar';
import { BottomPanel } from './app/components/layout/BottomPanel';
import { MarketMap } from './app/components/map/MarketMap';
import { MainMenu } from './app/components/layout/MainMenu';
import { Modal } from './app/components/ui/Modal';
import { NotificationToast } from './app/components/ui/NotificationToast';
import { formatNumber } from './utils/formatters';
import type { Company, Department, Product, Executive, EventOption, CompanyId, TileId, GameEvent, ActionType, MarketTile } from './types';
import './styles/globals.css';

const ACTION_LABELS: Record<string, string> = {
  build_department: 'Build Department',
  launch_product: 'Launch Product',
  improve_product: 'Improve Product',
  expand_market: 'Expand Market',
  marketing_campaign: 'Marketing Campaign',
  hire_executive: 'Hire Executive',
  security_hardening: 'Security Hardening',
  ai_automation: 'AI Automation',
  launch_consulting_practice: 'Launch Consulting',
  scout_acquisition: 'Scout Acquisition',
  acquire_company: 'Acquire Company',
  raise_capital: 'Raise Capital',
  reduce_costs: 'Reduce Costs',
};

function App() {
  const {
    state,
    selectedTileId,
    selectedCompanyId,
    ui,
    endTurn,
    addAction,
    selectTile,
    selectCompany,
    dismissNotification,
    saveGame,
  } = useGameStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState<{ event: GameEvent | null; open: boolean }>({ event: null, open: false });
  const [showMainMenu, setShowMainMenu] = useState(true);

  const playerCompany = state?.companies.get(state.playerCompanyId);

  const handleEndTurn = async () => {
    if (!state || isProcessing) return;
    setIsProcessing(true);
    try {
      endTurn();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddAction = (type: string, budget: number) => {
    addAction({ type: type as ActionType, companyId: state!.playerCompanyId, budget, priority: 1 });
    setShowActionModal(false);
  };

  const handleTileSelect = (tileId: TileId | null) => {
    selectTile(tileId);
  };

  const handleCompanySelect = (companyId: CompanyId | null) => {
    if (companyId && companyId !== selectedCompanyId) {
      setShowCompanyModal(true);
    }
    selectCompany(companyId);
  };

  const handleStartGame = () => {
    setShowMainMenu(false);
  };

  if (showMainMenu) {
    return (
      <div className="app">
        <MainMenu onStartGame={handleStartGame} onLoadGame={handleStartGame} />
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        turn={state?.turn || 1}
        maxTurns={state?.maxTurns || 20}
        playerCompany={playerCompany}
        onEndTurn={handleEndTurn}
        onSave={() => saveGame()}
        isProcessing={isProcessing}
      />

      <div className="main-layout">
        <Sidebar
          playerCompany={playerCompany}
          companies={state ? Array.from(state.companies.values()) : []}
          actions={state?.actions.filter(a => a.companyId === state.playerCompanyId && a.status === 'planned') || []}
          marketBriefing={state?.marketBriefing || { demandShifts: [], competitorMoves: [], cyberAlerts: [], globalEvents: [], maOpportunities: [], clientRequests: [] }}
          
          onShowActionModal={() => setShowActionModal(true)}
          onCompanySelect={handleCompanySelect}
          selectedCompanyId={selectedCompanyId}
        />

        <main className="map-container">
          <MarketMap
            state={state}
            selectedTileId={selectedTileId}
            onTileSelect={handleTileSelect}
          />
          <SelectedTilePanel
            tile={state && selectedTileId ? state.marketTiles.get(selectedTileId) || null : null}
            controller={state && selectedTileId ? (state.marketTiles.get(selectedTileId)?.controllerId
              ? state.companies.get(state.marketTiles.get(selectedTileId)!.controllerId!) || null
              : null) : null}
            onClose={() => selectTile(null)}
          />
        </main>
      </div>

      <BottomPanel
        state={state}
        playerCompany={playerCompany}
        newsFeed={state?.newsFeed || []}
        notifications={ui.notifications}
        onDismissNotification={dismissNotification}
      />

      {showActionModal && playerCompany && (
        <ActionModal
          playerCompany={playerCompany}
          onClose={() => setShowActionModal(false)}
          onAddAction={handleAddAction}
        />
      )}

      {showCompanyModal && selectedCompanyId && state && (
        <CompanyModal
          company={state.companies.get(selectedCompanyId)!}
          onClose={() => setShowCompanyModal(false)}
        />
      )}

      {showEventModal.open && showEventModal.event && (
        <EventModal
          event={showEventModal.event}
          onClose={() => setShowEventModal({ event: null, open: false })}
        />
      )}

      <NotificationToast
        notifications={ui.notifications}
        onDismiss={dismissNotification}
      />
    </div>
  );
}

interface ActionModalProps {
  playerCompany: Company;
  onClose: () => void;
  onAddAction: (type: string, budget: number) => void;
}

const ActionModal: React.FC<ActionModalProps> = ({ playerCompany, onClose, onAddAction }) => {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [budget, setBudget] = useState(0);

  const availableCash = playerCompany?.cash || 0;
  const maxBudget = Math.floor(availableCash * 0.5);

  const actionGroups = [
    { label: 'Corporate', actions: ['build_department', 'hire_executive', 'raise_capital', 'reduce_costs'] as string[] },
    { label: 'Product & R&D', actions: ['launch_product', 'improve_product', 'ai_automation'] as string[] },
    { label: 'Market & Sales', actions: ['expand_market', 'marketing_campaign', 'launch_consulting_practice'] as string[] },
    { label: 'Security & M&A', actions: ['security_hardening', 'scout_acquisition', 'acquire_company'] as string[] },
  ];

  const getActionCost = (type: string): number => {
    const costs: Record<string, number> = {
      build_department: 500000,
      launch_product: 300000,
      improve_product: 100000,
      expand_market: 200000,
      marketing_campaign: 150000,
      hire_executive: 400000,
      security_hardening: 200000,
      ai_automation: 250000,
      launch_consulting_practice: 150000,
      scout_acquisition: 50000,
      acquire_company: 2000000,
      raise_capital: 0,
      reduce_costs: 0,
      end_turn: 0,
    };
    return costs[type] || 100000;
  };

  const handleSubmit = () => {
    if (selectedAction && budget > 0) {
      onAddAction(selectedAction, budget);
    }
    onClose();
  };

  return (
    <Modal title="Plan Executive Order" onClose={onClose} size="lg">
      <div className="action-modal">
        <div className="action-groups">
          {actionGroups.map(group => (
            <div key={group.label} className="action-group">
              <h4>{group.label}</h4>
              <div className="action-buttons">
                {group.actions.map(action => (
                  <button
                    key={action}
                    className={`action-btn ${selectedAction === action ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedAction(action);
                      setBudget(getActionCost(action));
                    }}
                    disabled={getActionCost(action) > maxBudget && action !== 'raise_capital' && action !== 'reduce_costs'}
                  >
                    <span className="action-label">{ACTION_LABELS[action] || action}</span>
                    <span className="action-cost">${getActionCost(action).toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {selectedAction && (
          <div className="budget-selector">
            <label>Budget Allocation</label>
            <div className="budget-input">
              <input
                type="number"
                value={budget}
                onChange={e => setBudget(Math.max(0, Math.min(maxBudget, parseInt(e.target.value) || 0)))}
                min={0}
                max={maxBudget}
                step={10000}
              />
              <span>/ ${maxBudget.toLocaleString()} max</span>
            </div>
            <div className="budget-slider">
              <input
                type="range"
                value={budget}
                onChange={e => setBudget(parseInt(e.target.value))}
                min={0}
                max={maxBudget}
                step={10000}
              />
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!selectedAction || budget <= 0}>
            Add Order
          </button>
        </div>
      </div>
    </Modal>
  );
};

interface CompanyModalProps {
  company: Company;
  onClose: () => void;
}

const CompanyModal: React.FC<CompanyModalProps> = ({ company, onClose }) => (
  <Modal title={company.name} onClose={onClose} size="lg">
    <div className="company-modal">
      <div className="company-header">
        <div className="company-color-indicator" style={{ background: company.color }} />
        <div className="company-info">
          <span className="company-archetype">{company.archetype?.replace('_', ' ')}</span>
          <div className="company-stats">
            <span>Cash: ${formatNumber(company.cash)}</span>
            <span>Valuation: ${formatNumber(company.valuation)}</span>
            <span>Influence: ${formatNumber(company.marketInfluence)}%</span>
          </div>
        </div>
      </div>

      <div className="company-sections">
        <div className="company-section">
          <h4>Departments</h4>
          {company.departments.map((d: Department) => (
            <div key={d.id} className="dept-item">
              <span>{d.type.replace('_', ' ')}</span>
              <span>Lv.{d.level}</span>
            </div>
          ))}
        </div>

        <div className="company-section">
          <h4>Products</h4>
          {company.products.map((p: Product) => (
            <div key={p.id} className="product-item">
              <span>{p.name} ({p.category})</span>
              <span>Quality: {p.quality}</span>
            </div>
          ))}
        </div>

        <div className="company-section">
          <h4>Executives</h4>
          {company.executives.map((e: Executive) => (
            <div key={e.id} className="exec-item">
              <span>{e.role.toUpperCase()}: {e.specialization}</span>
              <span>Lv.{e.level}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </Modal>
);

interface EventModalProps {
  event: GameEvent;
  onClose: () => void;
}

const EventModal: React.FC<EventModalProps> = ({ event, onClose }) => (
  <Modal title={event.title} onClose={onClose} size="md">
    <div className="event-modal">
      <div className={`event-severity event-severity-${event.severity}`}>
        {event.severity.toUpperCase()}
      </div>
      <p className="event-description">{event.description}</p>
      
      <div className="event-impact">
        <h5>Impact</h5>
        {Object.entries(event.impact || {}).map(([key, value]) => (
          <div key={key} className="impact-row">
            <span>{key.replace('_', ' ')}</span>
            <span className={(value as number) >= 0 ? 'positive' : 'negative'}>
              {(value as number) >= 0 ? '+' : ''}{value}
            </span>
          </div>
        ))}
      </div>

      {event.options && event.options.length > 0 && (
        <div className="event-options">
          <h5>Response Options</h5>
          {event.options.map((option: EventOption) => (
            <button key={option.id} className="option-btn">
              <span>{option.label}</span>
              <span>Cost: ${option.cost.toLocaleString()} | Risk: {Math.round(option.risk * 100)}%</span>
            </button>
          ))}
        </div>
      )}
    </div>
  </Modal>
);

export default App;

interface SelectedTilePanelProps {
  tile: MarketTile | null;
  controller: Company | null;
  onClose: () => void;
}

const SelectedTilePanel: React.FC<SelectedTilePanelProps> = ({ tile, controller, onClose }) => {
  if (!tile) return null;
  const stat = (label: string, value: string) => (
    <div className="tile-stat">
      <span className="tile-stat-label">{label}</span>
      <span className="tile-stat-value">{value}</span>
    </div>
  );
  return (
    <div className="selected-tile-panel">
      <div className="selected-tile-head">
        <span className="selected-tile-id">{tile.id.replace('tile_', '').toUpperCase()}</span>
        <button className="selected-tile-close" onClick={onClose}>×</button>
      </div>
      <div className="selected-tile-segment">{tile.segment.replace('_', ' ')}</div>
      {stat('Value', `$${formatNumber(tile.value)}`)}
      {stat('Growth', `${(tile.growth * 100).toFixed(1)}%`)}
      {stat('Risk', `${(tile.risk * 100).toFixed(0)}%`)}
      {stat('Control', `${(tile.controlStrength * 100).toFixed(0)}%`)}
      {stat('Regulation', `${(tile.regulation * 100).toFixed(0)}%`)}
      {controller && (
        <div className="selected-tile-owner" style={{ borderColor: controller.color }}>
          <span className="company-color-indicator" style={{ background: controller.color }} />
          {controller.name}
        </div>
      )}
    </div>
  );
};
