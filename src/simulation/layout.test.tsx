import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { TurnEngine } from './turn/turnEngine';
import { Header } from '../app/components/layout/Header';
import { Sidebar } from '../app/components/layout/Sidebar';
import { BottomPanel } from '../app/components/layout/BottomPanel';
import { QuickActionPage, type QuickPage } from '../app/components/layout/QuickActionPage';
import { ActionComposer } from '../app/components/actions/ActionComposer';
import type { MarketBriefing } from '../types';

// renderToString exercises the component tree and throws on render crashes.
// No extra deps (uses react-dom/server, already installed).

const emptyBriefing: MarketBriefing = {
  demandShifts: [], globalEvents: [], competitorMoves: [],
  cyberAlerts: [], maOpportunities: [], clientRequests: [],
};

describe('Fase 2 — layout components render without crashing', () => {
  it('Header renders company name, turn counter and END TURN button', () => {
    const engine = new TurnEngine(2024);
    const state = engine.getState();
    const player = state.companies.get(state.playerCompanyId)!;
    const html = renderToString(
      createElement(Header, {
        turn: state.turn,
        maxTurns: state.maxTurns,
        playerCompany: player,
        onEndTurn: () => {},
        onSave: () => {},
        onLoad: () => {},
        onMainMenu: () => {},
        isProcessing: false,
        musicEnabled: false,
        onToggleMusic: () => {},
      })
    );
    expect(html).toContain(player.name);
    expect(html).toContain('END TURN');
    expect(html).toContain('class="game-header"');
  });

  it('Sidebar renders its four sections', () => {
    const engine = new TurnEngine(2024);
    const state = engine.getState();
    const companies = Array.from(state.companies.values());
    const html = renderToString(
      createElement(Sidebar, {
        playerCompany: companies[0],
        companies,
        actions: [] as import('../types').TurnAction[],
        marketBriefing: emptyBriefing,
        auctionHouse: [],
        onBid: () => {},
        onShowActionModal: () => {},
        onCompanySelect: () => {},
        selectedCompanyId: null,
        onQuickAction: () => {},
      })
    );
    expect(html).toContain('EXECUTIVE ORDERS');
    expect(html).toContain('COMPETITORS');
    expect(html).toContain('MARKET BRIEFING');
    expect(html).toContain('QUICK ACTIONS');
    expect(html).toContain('class="sidebar"');
  });

  it('BottomPanel renders all five tabs', () => {
    const engine = new TurnEngine(2024);
    const state = engine.getState();
    const player = state.companies.get(state.playerCompanyId)!;
    const html = renderToString(
      createElement(BottomPanel, {
        state,
        playerCompany: player,
        onEdit: () => {},
      })
    );
    for (const tab of ['KPI', 'Departments', 'Products', 'Capabilities', 'Orders', 'Global Trends', 'Tech Book', 'Workforce']) {
      expect(html).toContain(tab);
    }
    expect(html).toContain('class="bottom-panel"');
  });

  it('renders a dedicated, closable page for every Quick Action link', () => {
    const engine = new TurnEngine(2024);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    const pages: QuickPage[] = ['market', 'departments', 'products', 'executives', 'security', 'ai', 'finance', 'news'];
    for (const page of pages) {
      const html = renderToString(createElement(QuickActionPage, {
        page, state, company, onClose: () => {}, onPlan: () => {},
      }));
      expect(html).toContain('quick-page-close');
      expect(html).toContain('quick-page-stats');
    }
  });

  it('explains compute origin, generation, economics and the grid expansion order', () => {
    const engine = new TurnEngine(2026);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    const aiPage = renderToString(createElement(QuickActionPage, {
      page: 'ai', state, company, onClose: () => {}, onPlan: () => {},
    }));
    expect(aiPage).toContain('Why a reserve can exist');
    expect(aiPage).toContain('NEXT TURN');
    expect(aiPage).toContain('Expand compute grid');

    const hq = company.buildings.find(building => building.isHQ)!;
    company.departments.push({
      ...company.departments[0], id: 'ai_ui_test', type: 'ai_data', buildingId: hq.id,
    });
    const composer = renderToString(createElement(ActionComposer, {
      playerCompany: company,
      companies: [...state.companies.values()],
      tiles: [...state.marketTiles.values()],
      presetType: 'generate_compute',
      onClose: () => {},
      onAdd: () => {},
    }));
    expect(composer).toContain('Compute Grid Expansion');
    expect(composer).toContain('immediate reserve');
  });

  it('previews the selected department initiative with its upside and backfire', () => {
    const engine = new TurnEngine(2028);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    const composer = renderToString(createElement(ActionComposer, {
      playerCompany: company,
      companies: [...state.companies.values()],
      tiles: [...state.marketTiles.values()],
      presetType: 'department_initiative',
      onClose: () => {},
      onAdd: () => {},
    }));
    expect(composer).toContain('Moonshot Product Sprint');
    expect(composer).toContain('Innovation, product quality and market fit rise.');
    expect(composer).toContain('Crunch lowers morale');
    expect(composer).toContain('one initiative per turn');

    const departmentsPage = renderToString(createElement(QuickActionPage, {
      page: 'departments', state, company, onClose: () => {}, onPlan: () => {},
    }));
    expect(departmentsPage).toContain('Run department initiative');
    expect(departmentsPage).toContain('morale');
    expect(departmentsPage).toContain('risk');
  });

  it('shows all three friendly player buildings in Build Department', () => {
    const engine = new TurnEngine(2025);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    const html = renderToString(createElement(ActionComposer, {
      playerCompany: company,
      companies: [...state.companies.values()],
      tiles: [...state.marketTiles.values()],
      presetType: 'build_department',
      onClose: () => {},
      onAdd: () => {},
    }));
    expect(html).toContain(`${company.name} Headquarters`);
    expect(html).toContain(`${company.name} Building 2`);
    expect(html).toContain(`${company.name} Building 3`);
    expect(html).not.toContain('— select tile —');
    expect(html).toContain('Unlocks:');
    expect(html).toContain('Moonshot Product Sprint');
  });

  it('shows a trend-bound product category and sector and filters incompatible ideas', () => {
    const engine = new TurnEngine(2026);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    company.ideas.push(
      { id: 'bio_ui', name: 'Bio Signal Idea', category: 'biotech', maturity: 80, breakthrough: true, companyId: company.id, createdTurn: state.turn },
      { id: 'saas_ui', name: 'SaaS Other Idea', category: 'saas', maturity: 50, breakthrough: false, companyId: company.id, createdTurn: state.turn },
    );
    const html = renderToString(createElement(ActionComposer, {
      playerCompany: company,
      companies: [...state.companies.values()],
      tiles: [...state.marketTiles.values()],
      presetType: 'launch_product',
      initialDraft: {
        id: 'ui_exploit', companyId: company.id, type: 'launch_product', budget: 300_000,
        priority: 1, status: 'planned', trendId: 'bio_trend', productCategory: 'biotech',
        targetSegments: ['regulated_industry'],
      },
      onClose: () => {},
      onAdd: () => {},
    }));
    expect(html).toContain('locked by');
    expect(html).toContain('exploited trend');
    expect(html).toContain('value="biotech"');
    expect(html).toContain('Regulated Industry');
    expect(html).toContain('Bio Signal Idea');
    expect(html).not.toContain('SaaS Other Idea');
  });

  it('offers re-patent only for stolen ideas and product blueprints', () => {
    const engine = new TurnEngine(2027);
    const state = engine.getState();
    const company = state.companies.get(state.playerCompanyId)!;
    company.departments[0].type = 'legal_compliance';
    company.espionageIntel.push(
      {
        id: 'ui_stolen_ip', ownerCompanyId: company.id, sourceCompanyId: 'rival_ip',
        sourceDepartmentId: 'rival_rd', sourceDepartmentType: 'product_rd', kind: 'idea',
        sourceName: 'Quantum Formula', amount: 80, category: 'quantum', stolenTurn: 1,
        availableTurn: 2, expiresTurn: 8,
      },
      {
        id: 'ui_compute', ownerCompanyId: company.id, sourceCompanyId: 'rival_compute',
        sourceDepartmentId: 'rival_ai', sourceDepartmentType: 'ai_data', kind: 'compute',
        sourceName: 'Compute Capacity', amount: 20, stolenTurn: 1, availableTurn: 2, expiresTurn: 8,
      },
    );
    const html = renderToString(createElement(ActionComposer, {
      playerCompany: company,
      companies: [...state.companies.values()],
      tiles: [...state.marketTiles.values()],
      presetType: 'repatent_stolen_asset',
      currentTurn: 2,
      onClose: () => {},
      onAdd: () => {},
    }));
    expect(html).toContain('Re-Patent Stolen IP');
    expect(html).toContain('Quantum Formula');
    expect(html).not.toContain('value="ui_compute"');
    expect(html).toContain('applies only to IP obtained through Industrial Espionage');
  });
});
