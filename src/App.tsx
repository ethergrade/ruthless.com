import React, { useState, useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { useSettings } from './store/settings';
import { Header } from './app/components/layout/Header';
import { Sidebar } from './app/components/layout/Sidebar';
import { BottomPanel } from './app/components/layout/BottomPanel';
import { RightSidebar } from './app/components/layout/RightSidebar';
import { MarketMap } from './app/components/map/MarketMap';
import { MainMenu, SaveGameModal } from './app/components/layout/MainMenu';
import { Modal } from './app/components/ui/Modal';
import { NotificationToast } from './app/components/ui/NotificationToast';
import { ActionComposer } from './app/components/actions/ActionComposer';
import { formatNumber } from './utils/formatters';
import { audio } from './audio/AudioEngine';
import type { Company, Department, Product, Executive, EventOption, CompanyId, TileId, GameEvent, ActionType, MarketTile, DepartmentType } from './types';
import './styles/globals.css';
import './styles/layout.css';
import './styles/composer.css';

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
    setActivePanel,
    dismissNotification,
    saveGame,
    loadGame,
    estimateAction,
    placeBuilding,
    finishPlacement,
    explore,
  } = useGameStore();
  const { musicEnabled, setMusicEnabled } = useSettings();

  // Push persisted audio settings into the engine on mount so volumes/toggles
  // stay in sync (the engine is the single source of truth for Web Audio).
  useEffect(() => {
    const s = useSettings.getState();
    audio.setSfxEnabled(s.sfxEnabled);
    audio.setSfxVolume(s.sfxVolume);
    audio.setMusicVolume(s.musicVolume);
    audio.setMusicEnabled(s.musicEnabled);
  }, []);

  const [isProcessing, setIsProcessing] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [presetActionType, setPresetActionType] = useState<ActionType | null>(null);
  const [editDraft, setEditDraft] = useState<import('./types').TurnAction | null>(null);
  // T: action targeting — pick a tile directly from the board.
  const [targeting, setTargeting] = useState<import('./app/components/map/MarketMap').TargetingState | null>(null);
  const [bottomH, setBottomH] = useState(240);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState<{ event: GameEvent | null; open: boolean }>({ event: null, open: false });
  const [showMainMenu, setShowMainMenu] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  // T: real-map placement scratch state (depts for the next building to drop).
  const [placementDepts, setPlacementDepts] = useState<DepartmentType[]>([]);

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

  const handleSave = () => setShowSaveModal(true);
  const handleLoad = () => {
    if (loadGame()) setActivePanel(null);
  };
  const handleMainMenu = () => {
    // persist progress, then return to the main menu without losing the game
    if (state) saveGame();
    setShowMainMenu(true);
  };

  // Open the composer pre-filled with a previous order so the player can tweak
  // it (e.g. pick a different target product) and re-plan it.
  const handleEdit = (action: import('./types').TurnAction) => {
    setPresetActionType(action.type);
    setEditDraft(action);
    setShowActionModal(true);
  };

  const handleBid = (listingId: string, amount: number) => {
    if (!state) return;
    addAction({ type: 'auction_bid', companyId: state.playerCompanyId, budget: amount, priority: 1, targetId: listingId });
  };

  const handleAddAction = (action: Omit<import('./types').TurnAction, 'id' | 'status'>) => {
    addAction(action);
    setShowActionModal(false);
    setPresetActionType(null);
  };

  /** Quick Actions open the composer pre-set to the relevant action group. */
  const quickActionPreset: Record<string, string | null> = {
    'market': 'expand_market',
    'departments': 'build_department',
    'products': 'launch_product',
    'executives': 'hire_executive',
    'security': 'security_hardening',
    'ai': 'ai_automation',
    'finance': 'raise_capital',
    'news': null,
  };
  const handleQuickAction = (key: string) => {
    if (key === 'news') { setActivePanel('news'); return; }
    const preset = (quickActionPreset[key] ?? null) as ActionType | null;
    setPresetActionType(preset);
    setShowActionModal(true);
  };

  /** EXPLOIT a live trend: open the Orders composer pre-filled to expand into
   *  the trending category (surge bonus applied by the engine on resolve). */
  const handleExploit = (category: string) => {
    const cat = category as import('./types').ProductCategory;
    setPresetActionType('expand_market');
    setEditDraft({
      id: `exploit_${cat}_${Date.now()}`,
      companyId: state!.playerCompanyId,
      type: 'expand_market',
      budget: 200000,
      priority: 1,
      status: 'planned',
      productCategory: cat,
    } as import('./types').TurnAction);
    if (useSettings.getState().sfxEnabled) audio.sfx('exploit');
    setShowActionModal(true);
  };

  const handleTileSelect = (tileId: TileId | null) => {
    selectTile(tileId);
    // T: no floating modal — selection drives the DEPARTMENTS tab (player building
    // auto-expands; rival/startup tiles surface a section there). Keeps the map view clean.
    if (!tileId || !state) return;
    const tile = state.marketTiles.get(tileId);
    if (!tile?.controllerId) return;
    const owner = state.companies.get(tile.controllerId);
    // Rival companies still open the company snapshot modal (lightweight, not a building modal).
    if (owner && !owner.isStartup && tile.controllerId !== state.playerCompanyId) {
      selectCompany(tile.controllerId);
      setShowCompanyModal(true);
    }
  };

  const handleCompanySelect = (companyId: CompanyId | null) => {
    if (companyId && companyId !== selectedCompanyId) {
      setShowCompanyModal(true);
    }
    selectCompany(companyId);
  };

  // T: real-map placement — drop the next building (HQ if first) with the chosen
  // departments on the clicked tile, then reset the dept picker for the next one.
  const handlePlaceTile = (tileId: string) => {
    if (!state || state.phase !== 'placement') return;
    const isHQ = state.pendingBuildings.length === 0;
    placeBuilding({ tileId, isHQ, deptTypes: placementDepts.slice(0, 3) });
    setPlacementDepts([]);
    if (useSettings.getState().sfxEnabled) audio.sfx('exploit');
  };

  const handleFinishPlacement = () => {
    finishPlacement();
  };

  const handleStartGame = () => {
    audio.unlock(); // first user gesture → create + resume the AudioContext
    setShowMainMenu(false);
  };

  // Drag the bottom panel to resize the canvas vs. panel split (req P4).
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const vh = window.innerHeight;
      const next = Math.max(140, Math.min(vh * 0.65, vh - ev.clientY));
      setBottomH(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
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
        onSave={handleSave}
        onLoad={handleLoad}
        onMainMenu={handleMainMenu}
        isProcessing={isProcessing}
        musicEnabled={musicEnabled}
        onToggleMusic={() => setMusicEnabled(!musicEnabled)}
      />

      <div className="main-layout">
        <Sidebar
          playerCompany={playerCompany}
          companies={state ? Array.from(state.companies.values()) : []}
          actions={state?.actions.filter(a => a.companyId === state.playerCompanyId && a.status === 'planned') || []}
          marketBriefing={state?.marketBriefing || { demandShifts: [], competitorMoves: [], cyberAlerts: [], globalEvents: [], maOpportunities: [], clientRequests: [] }}
          auctionHouse={state ? Array.from(state.auctionHouse) : []}
          onBid={handleBid}

          onShowActionModal={() => setShowActionModal(true)}
          onCompanySelect={handleCompanySelect}
          selectedCompanyId={selectedCompanyId}
          onQuickAction={handleQuickAction}
        />

        <main className="map-container">
          <MarketMap
            state={state}
            selectedTileId={selectedTileId}
            onTileSelect={handleTileSelect}
            onPlaceTile={state?.phase === 'placement' ? handlePlaceTile : undefined}
            targeting={targeting}
            onExplore={explore}
          />
          <SelectedTilePanel
            tile={state && selectedTileId ? state.marketTiles.get(selectedTileId) || null : null}
            controller={state && selectedTileId ? (state.marketTiles.get(selectedTileId)?.controllerId
              ? state.companies.get(state.marketTiles.get(selectedTileId)!.controllerId!) || null
              : null) : null}
            onClose={() => selectTile(null)}
          />
        </main>

        {/* T: real-map placement overlay — pick departments, drop buildings on the
            live board, then finish to spawn rivals. */}
        {state?.phase === 'placement' && (
          <div className="placement-overlay">
            <div className="placement-panel">
              <h2>EMPIRE SETUP — drop your buildings</h2>
              <p className="placement-hint">
                Click a free tile to place {state.pendingBuildings.length === 0 ? 'your HQ' : 'a building'}.
                Max 3 buildings, 1 HQ, up to 3 departments each. Rivals appear after you finish.
              </p>
              <div className="placement-depts">
                {(['product_rd', 'ai_data', 'cybersecurity', 'sales_marketing', 'consulting_services', 'acquisitions', 'legal_compliance', 'people_culture', 'finance_investor', 'corporate_strategy', 'dev_engineering'] as DepartmentType[]).map(dt => {
                  const on = placementDepts.includes(dt);
                  return (
                    <button
                      key={dt}
                      className={`eb-dept ${on ? 'on' : ''}`}
                      disabled={!on && placementDepts.length >= 3}
                      onClick={() => setPlacementDepts(prev => on ? prev.filter(d => d !== dt) : prev.length < 3 ? [...prev, dt] : prev)}
                    >
                      {dt.replace('_', ' ')}
                    </button>
                  );
                })}
              </div>
              <div className="placement-status">
                <span>Buildings placed: {state.pendingBuildings.length} / 3</span>
                <span>Next: {state.pendingBuildings.length === 0 ? 'HQ' : 'Branch'}</span>
                <span>Departments: {placementDepts.length} / 3</span>
              </div>
              <button className="btn btn-primary placement-done" onClick={handleFinishPlacement} disabled={state.pendingBuildings.length === 0}>
                DONE — SPAWN RIVALS
              </button>
            </div>
          </div>
        )}

        <RightSidebar
          state={state}
          newsFeed={state?.newsFeed || []}
          onExploit={handleExploit}
        />
      </div>

      <div className="panel-resizer" onPointerDown={startResize} role="separator" aria-label="Resize panel" />

      <BottomPanel
        key={state?.turn ?? 0}
        defaultTab="orders"
        height={bottomH}
        state={state}
        playerCompany={playerCompany}
        selectedTileId={selectedTileId}
        addAction={addAction}
        onEdit={handleEdit}
      />

      {showActionModal && playerCompany && state && (
        <Modal title="Plan Executive Order" onClose={() => { setShowActionModal(false); setEditDraft(null); }} size="xl">
          <ActionComposer
            playerCompany={playerCompany}
            companies={Array.from(state.companies.values())}
            tiles={Array.from(state.marketTiles.values())}
            presetType={presetActionType}
            initialDraft={editDraft}
            initialTileId={selectedTileId ?? undefined}
            onClose={() => { setShowActionModal(false); setEditDraft(null); }}
            onAdd={handleAddAction}
            estimate={estimateAction}
            onRequestTargeting={setTargeting}
            targeting={targeting}
          />
        </Modal>
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

      {showSaveModal && (
        <SaveGameModal
          defaultName={playerCompany?.name ? `Save ${playerCompany.name}` : 'My Save'}
          onSave={(name) => { saveGame(name); setShowSaveModal(false); }}
          onCancel={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}

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
      {tile.pendingAction && (
        <div className="tile-action-pending">
          <span className="tap-icon">!</span>
          {tile.pendingAction.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} in corso
          (turno {tile.pendingAction.expiresTurn})
        </div>
      )}
    </div>
  );
};
