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
  });
});
