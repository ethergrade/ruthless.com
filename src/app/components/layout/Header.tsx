import React from 'react';
import type { Company } from '../../../types';

interface HeaderProps {
  turn: number;
  maxTurns: number;
  playerCompany: Company | undefined;
  onEndTurn: () => void;
  onSave: () => void;
  isProcessing: boolean;
}

export const Header: React.FC<HeaderProps> = ({ turn, maxTurns, playerCompany, onEndTurn, onSave, isProcessing }) => {
  if (!playerCompany) return null;

  const alerts = [];
  if (playerCompany.securityPosture < 30) alerts.push({ type: 'critical', text: 'SECURITY CRITICAL' });
  if (playerCompany.cashFlow < -500000) alerts.push({ type: 'warning', text: 'NEGATIVE CASH FLOW' });
  if (playerCompany.brandTrust < 30) alerts.push({ type: 'warning', text: 'LOW TRUST' });
  if (playerCompany.debt > playerCompany.cash * 2) alerts.push({ type: 'warning', text: 'HIGH LEVERAGE' });

  return (
    <header className="game-header">
      <div className="header-left">
        <div className="game-title">
          <span className="title-main">STRATEGYLESS</span>
          <span className="title-tagline">Build the company. Control the market. Survive the system.</span>
        </div>
        <div className="company-name" style={{ borderColor: playerCompany.color }}>
          {playerCompany.name}
        </div>
      </div>

      <div className="header-center">
        <div className="turn-counter">
          <span className="turn-label">TURN</span>
          <span className="turn-value">{turn} / {maxTurns}</span>
        </div>
      </div>

      <div className="header-right">
        <div className="kpi-row">
          <KPIMini label="CASH" value={playerCompany.cash} format="currency" trend={playerCompany.cashFlow} />
          <KPIMini label="FLOW" value={playerCompany.cashFlow} format="currency" />
          <KPIMini label="VALUE" value={playerCompany.valuation} format="currency" />
          <KPIMini label="INFLUENCE" value={playerCompany.marketInfluence} format="percent" />
          <KPIMini label="TRUST" value={playerCompany.brandTrust} format="percent" />
          <KPIMini label="SECURITY" value={playerCompany.securityPosture} format="percent" />
        </div>

        {alerts.length > 0 && (
          <div className="alert-banner">
            {alerts.map((alert, i) => (
              <span key={i} className={`alert ${alert.type}`}>{alert.text}</span>
            ))}
          </div>
        )}

        <button
          className="btn btn-secondary end-turn-btn"
          onClick={onSave}
          disabled={isProcessing}
        >
          SAVE
        </button>

        <button
          className="btn btn-primary end-turn-btn"
          onClick={onEndTurn}
          disabled={isProcessing}
        >
          {isProcessing ? 'PROCESSING...' : 'END TURN'}
        </button>
      </div>
    </header>
  );
};

const KPIMini: React.FC<{ label: string; value: number; format: 'currency' | 'percent'; trend?: number }> = ({
  label,
  value,
  format,
  trend,
}) => {
  const isPositive = (trend ?? value) > 0;
  const isNegative = (trend ?? value) < 0;
  const formatted = format === 'currency'
    ? (value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value >= 1e3 ? `${(value / 1e3).toFixed(0)}K` : `$${value.toLocaleString()}`)
    : `${value.toFixed(1)}%`;

  return (
    <div className={`kpi-mini ${isPositive ? 'positive' : isNegative ? 'negative' : ''}`}>
      <span className="kpi-mini-label">{label}</span>
      <span className="kpi-mini-value">{formatted}</span>
      {trend !== undefined && (
        <span className={`kpi-trend ${trend > 0 ? 'up' : trend < 0 ? 'down' : ''}`}>
          {trend > 0 ? '▲' : trend < 0 ? '▼' : '●'}
        </span>
      )}
    </div>
  );
};
