import React from 'react';
import type { ActionType, Company, GameState } from '../../../types';
import { COMPUTE_INFRASTRUCTURE_UPKEEP, calculateComputeGeneration } from '../../../simulation/utils/compute';
import { getDepartmentInitiative } from '../../../data/departmentInitiatives';

type QuickPage = 'market' | 'departments' | 'products' | 'executives' | 'security' | 'ai' | 'finance' | 'news';

interface Props {
  page: QuickPage;
  state: GameState;
  company: Company;
  onClose: () => void;
  onPlan: (action: ActionType) => void;
}

const PAGE_META: Record<QuickPage, { eyebrow: string; title: string; description: string; actions: { type: ActionType; label: string }[] }> = {
  market: { eyebrow: 'LIVE MARKET INTELLIGENCE', title: 'Market Intel', description: 'Demand, competition and exploitable pressure across the current turn.', actions: [{ type: 'expand_market', label: 'Expand market' }, { type: 'marketing_campaign', label: 'Launch campaign' }] },
  departments: { eyebrow: 'CORPORATE NETWORK', title: 'Departments', description: 'Run specialized initiatives whose upside and risk depend on team health.', actions: [{ type: 'department_initiative', label: 'Run department initiative' }, { type: 'build_department', label: 'Build department' }, { type: 'build_building', label: 'Raise building' }] },
  products: { eyebrow: 'PRODUCT WAR ROOM', title: 'Products', description: 'Ideas, launches and live product performance.', actions: [{ type: 'create_ideas', label: 'Create R&D idea' }, { type: 'launch_product', label: 'Launch product' }, { type: 'improve_product', label: 'Improve product' }] },
  executives: { eyebrow: 'EXECUTIVE OFFICE', title: 'Executives', description: 'Leadership capacity, energy and corporate command.', actions: [{ type: 'hire_executive', label: 'Hire executive' }, { type: 'train_ceo', label: 'Train CEO' }, { type: 'ceo_praise', label: 'Praise executive' }] },
  security: { eyebrow: 'SECURITY OPERATIONS', title: 'Security', description: 'Spendable resilience protects buildings, data and R&D assets.', actions: [{ type: 'allocate_cybersecurity', label: 'Allocate cyber points' }, { type: 'security_hardening', label: 'Harden security' }, { type: 'security_offline', label: 'Offline defense' }, { type: 'security_online', label: 'Generate cyber capacity' }] },
  ai: { eyebrow: 'AI & DATA COMMAND', title: 'AI & Data', description: 'Generate compute, assign it to profitable products and outperform direct rivals.', actions: [{ type: 'generate_compute', label: 'Expand compute grid' }, { type: 'allocate_compute', label: 'Allocate compute' }, { type: 'ai_automation', label: 'Deploy automation' }] },
  finance: { eyebrow: 'CASH FLOW CONTROL', title: 'Finance', description: 'Liquidity, leverage and capital operations.', actions: [{ type: 'raise_capital', label: 'Raise capital' }, { type: 'reduce_costs', label: 'Reduce costs' }, { type: 'scout_acquisition', label: 'Scout acquisition' }] },
  news: { eyebrow: 'HEADLINES / REAL TIME', title: 'Newsroom', description: 'All market stories and consequences recorded by the turn resolver.', actions: [] },
};

const money = (value: number) => `$${Math.round(value).toLocaleString()}`;

export const QuickActionPage: React.FC<Props> = ({ page, state, company, onClose, onPlan }) => {
  const meta = PAGE_META[page];
  const rdCount = company.departments.filter(department => department.type === 'product_rd').length;
  const assignedCompute = company.products.reduce((sum, product) => sum + product.computePoints, 0);
  const nextComputeGeneration = calculateComputeGeneration(company, state.turn);
  const cards = page === 'market' ? [
    ['ACTIVE TRENDS', state.trends.length], ['CONTROLLED TILES', company.controlledTiles.length], ['MARKET INFLUENCE', `${company.marketInfluence.toFixed(0)}%`],
  ] : page === 'departments' ? [
    ['BUILDINGS', company.buildings.length], ['DEPARTMENTS', company.departments.length], ['FREE SLOTS', company.buildings.reduce((sum, building) => sum + Math.max(0, building.maxDepartments - building.departmentIds.length), 0)],
  ] : page === 'products' ? [
    ['LIVE PRODUCTS', company.products.length], ['R&D IDEAS', company.ideas.length], ['IDEAS / TURN', rdCount],
  ] : page === 'executives' ? [
    ['EXECUTIVES', company.executives.length], ['ORDER LIMIT', company.executiveOrderLimit], ['CEO LEVEL', company.ceoLevel],
  ] : page === 'security' ? [
    ['POSTURE', `${company.securityPosture.toFixed(0)}%`], ['CYBER POOL', company.cybersecurityPoints], ['ASSIGNED', company.buildings.reduce((sum, building) => sum + building.cybersecurityPoints, 0)],
  ] : page === 'ai' ? [
    ['RESERVE', company.computePoints], ['NEXT TURN', `+${nextComputeGeneration}`], ['GRID', `${company.computeInfrastructure}/100`], ['ASSIGNED', assignedCompute],
  ] : page === 'finance' ? [
    ['CASH', money(company.cash)], ['CASH FLOW', money(company.cashFlow)], ['DEBT', money(company.debt)],
  ] : [
    ['STORIES', state.newsFeed.length], ['TURN', state.turn], ['CRITICAL', state.newsFeed.filter(item => item.importance === 'critical').length],
  ];

  return (
    <section className="quick-page" role="dialog" aria-modal="true" aria-label={meta.title}>
      <header className="quick-page-head">
        <div><small>{meta.eyebrow}</small><h2>{meta.title}</h2><p>{meta.description}</p></div>
        <button className="quick-page-close" onClick={onClose} aria-label="Close and return to market canvas">×</button>
      </header>
      <div className="quick-page-stats">{cards.map(([label, value]) => <div key={String(label)}><small>{label}</small><strong>{value}</strong></div>)}</div>

      {page === 'news' ? (
        <div className="quick-news-list">
          {state.newsFeed.length === 0 && <div className="quick-page-empty">No resolved stories yet. Advance the turn to open the news cycle.</div>}
          {state.newsFeed.slice().reverse().map(item => (
            <article key={item.id} className={item.importance}>
              <time>TURN {item.turn} · {item.category.toUpperCase()}</time><h3>{item.headline}</h3><p>{item.body || 'The event has been recorded in the corporate timeline.'}</p>
            </article>
          ))}
        </div>
      ) : page === 'market' ? (
        <div className="quick-page-list">{state.trends.map(trend => <article key={trend.id}><strong>{trend.title}</strong><span>{trend.category.replace('_', ' ')} · {(trend.strength * 100).toFixed(0)}% · deadline T{trend.decisionDeadlineTurn}</span></article>)}</div>
      ) : page === 'products' || page === 'ai' ? (
        <div className="quick-page-list">
          {page === 'ai' && <>
            <article><strong>How you generate it</strong><span>AI & Data produces 8 × level × efficiency each turn; DEV adds 3 × level × efficiency. Expand Compute Grid for immediate points and a permanent output multiplier.</span></article>
            <article><strong>Why a reserve can exist</strong><span>Unused renewable generation accumulates here every turn. A newly founded company also receives 20 commissioning points for each starting AI & Data department; acquired and stolen compute enters the same reserve.</span></article>
            <article><strong>Economics</strong><span>Grid upkeep {money(company.computeInfrastructure * COMPUTE_INFRASTRUCTURE_UPKEEP)}/turn · assigned compute costs $1,000/point/turn. Profitable products compound it; weak-margin products lose it.</span></article>
          </>}
          {company.products.map(product => <article key={product.id}><strong>{product.name}</strong><span>{product.category.replace('_', ' ')} · compute {product.computePoints} · throughput +{Math.max(0, (product.lastComputeMultiplier - 1) * 100).toFixed(0)}% · rival edge +{(product.computeAdvantage * 100).toFixed(0)}% · margin {(product.lastTurnMargin * 100).toFixed(0)}% · revenue {money(product.lastTurnRevenue)}{product.trendTiming === 'late' ? ' · LATE' : ''}</span></article>)}
        </div>
      ) : page === 'security' ? (
        <div className="quick-page-list">{company.buildings.map(building => <article key={building.id}><strong>{building.name || (building.isHQ ? 'Headquarters' : 'Building')}</strong><span>cyber {building.cybersecurityPoints} · firewall {building.firewall.toFixed(0)} · {building.departmentIds.length} departments</span></article>)}</div>
      ) : page === 'departments' ? (
        <div className="quick-page-list">{company.departments.map(department => <article key={department.id}><strong>{department.type.replaceAll('_', ' ')}</strong><span>{getDepartmentInitiative(department.type).label} · LVL {department.level} · efficiency {(department.efficiency * 100).toFixed(0)}% · morale {(department.morale * 100).toFixed(0)}% · risk {(department.risk * 100).toFixed(0)}%</span></article>)}</div>
      ) : (
        <div className="quick-page-list"><article><strong>{meta.title} operational console</strong><span>Metrics are live for turn {state.turn}. Choose an operation below to create a validated executive order.</span></article></div>
      )}

      {meta.actions.length > 0 && <footer className="quick-page-actions">{meta.actions.map(action => <button key={action.type} onClick={() => onPlan(action.type)}>{action.label} <span>→</span></button>)}</footer>}
    </section>
  );
};

export type { QuickPage };
