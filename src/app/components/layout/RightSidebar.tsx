import React from 'react';
import type { GameState, NewsItem } from '../../../types';
import { NewsPanel, TrendsPanel } from './BottomPanel';

interface RightSidebarProps {
  state: GameState | null;
  newsFeed: NewsItem[];
}

/** Right-column rail: global market TRENDS (top) + live NEWS feed (bottom). */
export const RightSidebar: React.FC<RightSidebarProps> = ({ state, newsFeed }) => {
  if (!state) return null;
  const onExploit = () => {
    // Surface the Orders tab so the player can act on the trend.
    const ev = new CustomEvent('open-orders-tab');
    window.dispatchEvent(ev);
  };
  return (
    <aside className="right-sidebar">
      <section className="rs-section">
        <div className="rs-head">Market Trends</div>
        <div className="rs-body">
          <TrendsPanel trends={state.trends} weakSignals={state.weakSignals} onExploit={onExploit} />
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
