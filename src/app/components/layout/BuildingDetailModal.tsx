import React from 'react';
import { Modal } from '../ui/Modal';
import { useGameStore } from '../../../store/gameStore';
import { DepartmentCard } from './BottomPanel';
import type { TileId } from '../../../types';

/**
 * T — Building / Startup Detail (scelta A): opened by clicking a building or a
 * startup tile on the map.
 *  • Player buildings: show housed departments.
 *  • Rival buildings: CLASSIFIED until revealed via Espionage / Cyber breach
 *    (state.revealedBuildings) — OR if your CEO has the
 *    corporate_intelligence perk (passive read, no offensive action needed).
 *  • Startups (even empty shells): always buyable — you DON'T need espionage to
 *    acquire one. Buying folds its tile + building into your company and moves
 *    your market share / valuation.
 */
export const BuildingDetailModal: React.FC<{
  buildingId?: string;
  ownerCompanyId: string;
  tileId: TileId;
  onClose: () => void;
}> = ({ buildingId, ownerCompanyId, tileId, onClose }) => {
  const state = useGameStore(s => s.state);
  const addAction = useGameStore(s => s.addAction);
  const playerId = useGameStore(s => s.state?.playerCompanyId);
  if (!state) return null;

  const owner = state.companies.get(ownerCompanyId);
  const building = buildingId ? owner?.buildings.find(b => b.id === buildingId) : undefined;
  const tile = state.marketTiles.get(tileId);
  const isPlayer = ownerCompanyId === state.playerCompanyId;
  const isStartup = !!owner?.isStartup;
  // Passive rival intel: a CEO with the corporate_intelligence perk reads
  // rival interiors WITHOUT any offensive action (espionage / cyber breach).
  const playerCeo = state.companies.get(state.playerCompanyId)?.ceos[0];
  const ceoIntel = playerCeo?.perks.includes('corporate_intelligence') ?? false;
  const revealed = isPlayer || ceoIntel || (building ? state.revealedBuildings.includes(building.id) : false);

  if (!owner || !tile) {
    return <Modal title="BUILDING" onClose={onClose} size="md"><div className="empty-state">Not found.</div></Modal>;
  }

  const depts = (building?.departmentIds ?? [])
    .map(id => owner.departments.find(d => d.id === id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  // Acquisition price: empty shells are cheap; buildings cost more (ruthless.com rule).
  const price = isStartup
    ? (building ? 2_000_000 : 1_200_000)
    : Math.max(1_500_000, Math.round(owner.valuation * 0.15));

  const canAfford = playerId ? (state.companies.get(playerId)?.cash ?? 0) >= price : false;

  const buyStartup = () => {
    if (!playerId || !canAfford) return;
    addAction({
      companyId: playerId,
      type: 'acquire_company',
      budget: price,
      priority: 1,
      targetCompanyId: ownerCompanyId,
    });
    onClose();
  };

  return (
    <Modal
      title={`${isStartup ? '★ STARTUP' : building?.isHQ ? '⚑ HQ' : '⌂ BRANCH'} — ${owner.name}`}
      onClose={onClose}
      size="md"
    >
      <div className="building-detail">
        <div className="bd-meta">
          <span className="bd-chip">Tile {tileId}</span>
          {tile.startupPotential && <span className="bd-chip warn">Potential: {tile.startupPotential}</span>}
          {building ? (
            <>
              <span className="bd-chip">Firewall {building.firewall}</span>
              <span className="bd-chip">Physical {building.physicalSecurity}</span>
              <span className="bd-chip">{depts.length} dept{depts.length === 1 ? '' : 's'}</span>
            </>
          ) : <span className="bd-chip">No building yet</span>}
        </div>

        {/* Always-buyable startup flow (no espionage required). */}
        {isStartup && (
          <div className="startup-buy">
            {!revealed && !building && (
              <p className="bd-hint">Empty shell — you can buy it blind (no espionage needed). The interior is unknown until acquired.</p>
            )}
            {!revealed && building && (
              <p className="bd-hint">Interior hidden — you can still buy it blind. Run Espionage / Cyber to preview departments first.</p>
            )}
            {revealed && building && depts.length === 0 && (
              <p className="bd-hint">No departments housed here yet — yours to fill once acquired.</p>
            )}
            <button
              className="btn btn-primary"
              disabled={!canAfford}
              onClick={buyStartup}
              title={canAfford ? `Acquire for $${price.toLocaleString()}` : 'Not enough cash'}
            >
              Acquire Startup — ${price.toLocaleString()}
            </button>
            {!canAfford && <p className="bd-warn">Not enough cash.</p>}
          </div>
        )}

        {/* Interior view (player or revealed rival). */}
        {(!isStartup || revealed) && building && (
          <div className="bd-depts">
            {depts.length === 0
              ? <div className="empty-state">No departments housed here.</div>
              : <div className="departments-grid">{depts.map((d, i) => <DepartmentCard key={i} dept={d} />)}</div>}
          </div>
        )}

        {/* Rival building not yet revealed. */}
        {!isStartup && !revealed && building && (
          <div className="classified">
            <div className="classified-lock">🔒 CLASSIFIED</div>
            <p>This rival building's interior is hidden. Run <strong>Espionage</strong> or a <strong>Cyber Attack</strong> breach to reveal its departments.</p>
          </div>
        )}
      </div>
    </Modal>
  );
};
