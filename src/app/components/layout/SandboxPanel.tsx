import React, { useState } from 'react';
import type { Company, SandboxCommandType } from '../../../types';
import { useGameStore } from '../../../store/gameStore';

const CONTROL_FIELDS: { type: SandboxCommandType; label: string; read: (company: Company) => number }[] = [
  { type: 'set_cash', label: 'Cash', read: company => company.cash },
  { type: 'set_debt', label: 'Debt', read: company => company.debt },
  { type: 'set_stock', label: 'Stock value', read: company => company.valuation },
  { type: 'set_reputation', label: 'Brand trust', read: company => company.brandTrust },
  { type: 'set_influence', label: 'Influence', read: company => company.marketInfluence },
  { type: 'set_morale', label: 'Morale', read: company => company.employeeMorale },
];

export const SandboxPanel: React.FC = () => {
  const { state, applySandboxCommand, undoSandboxCommand } = useGameStore();
  const [open, setOpen] = useState(false);
  const player = state?.companies.get(state.playerCompanyId ?? '');
  if (!state || state.mode !== 'sandbox' || !state.sandbox || !player) return null;

  return (
    <section className={`sandbox-console ${open ? 'open' : ''}`}>
      <button className="sandbox-trigger" onClick={() => setOpen(value => !value)}>{open ? 'CLOSE GOD MODE' : 'GOD MODE'}</button>
      {open && <div className="sandbox-body">
        <header><div><small>RUNTIME CONTROL</small><h2>Sandbox Console</h2></div><span>{state.sandbox.auditLog.length} mutation(s)</span></header>
        <div className="sandbox-fields">
          {CONTROL_FIELDS.map(field => <label key={field.type}>{field.label}
            <input key={`${field.type}-${Math.round(field.read(player))}`} type="number" defaultValue={Math.round(field.read(player))} onBlur={event => applySandboxCommand({ type: field.type, companyId: player.id, value: Number(event.target.value) })} />
          </label>)}
        </div>
        <div className="sandbox-toggles">
          <label><input type="checkbox" checked={state.sandbox.victoryEnabled} onChange={event => applySandboxCommand({ type: 'toggle_victory', value: event.target.checked })} /> Victory milestones</label>
          <label><input type="checkbox" checked={state.sandbox.intelligenceRevealed} onChange={event => applySandboxCommand({ type: 'reveal_intelligence', value: event.target.checked })} /> Reveal intelligence</label>
        </div>
        <div className="sandbox-actions">
          <button onClick={() => applySandboxCommand({ type: 'advance_turns', value: 1 })}>+1 TURN</button>
          <button onClick={() => applySandboxCommand({ type: 'advance_turns', value: 10 })}>+10 TURNS</button>
          <button onClick={undoSandboxCommand} disabled={!state.sandbox.auditLog.length}>UNDO</button>
        </div>
        <div className="sandbox-audit">
          {state.sandbox.auditLog.slice(-5).reverse().map(entry => <div key={entry.command.id}><time>{new Date(entry.command.createdAt).toLocaleTimeString()}</time><span>{entry.description}</span><b>{String(entry.command.value)}</b></div>)}
        </div>
        <p>God Mode mutations disable achievements and are recorded in the save.</p>
      </div>}
    </section>
  );
};
