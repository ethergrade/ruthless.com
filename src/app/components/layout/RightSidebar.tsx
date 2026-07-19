import React from 'react';
import type { GameState, MarketTrend, NewsItem } from '../../../types';
import { NewsPanel, TrendsPanel } from './BottomPanel';

interface RightSidebarProps {
  state: GameState | null;
  newsFeed: NewsItem[];
  onExploit: (trend: MarketTrend) => void;
}

/** Right-column rail: global market TRENDS (top) + live NEWS feed (bottom). */
export const RightSidebar: React.FC<RightSidebarProps> = ({ state, newsFeed, onExploit }) => {
  if (!state) return null;
  return (
    <aside className="right-sidebar">
      <section className="rs-section">
        <div className="rs-head">Market Trends</div>
        <div className="rs-body">
          <TrendsPanel trends={state.trends} trendHistory={state.trendHistory} weakSignals={state.weakSignals} currentTurn={state.turn} onExploit={onExploit} />
        </div>
      </section>
      <section className="rs-section rs-grow">
        <div className="rs-head">News Feed</div>
        <div className="rs-body">
          <NewsPanel news={newsFeed} />
        </div>
      </section>
    </aside>
  );
};
