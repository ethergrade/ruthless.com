import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { TurnEngine } from './turn/turnEngine';
import { Header } from '../app/components/layout/Header';
import { Sidebar } from '../app/components/layout/Sidebar';
import { BottomPanel } from '../app/components/layout/BottomPanel';
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
        newsFeed: [],
        notifications: [],
        onRebid: () => {},
        onDismissNotification: () => {},
      })
    );
    for (const tab of ['KPI', 'Departments', 'Products', 'Capabilities', 'Orders', 'News']) {
      expect(html).toContain(tab);
    }
    expect(html).toContain('class="bottom-panel"');
  });
});
