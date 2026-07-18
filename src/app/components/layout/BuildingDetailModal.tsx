import React from 'react';
import { Modal } from '../ui/Modal';
import { useGameStore } from '../../../store/gameStore';
import { DepartmentCard } from './BottomPanel';

/**
 * T — Building Detail (scelta A): opened by clicking a building on the map.
 * Player buildings show their housed departments. Rival buildings are
 * CLASSIFIED until revealed via a successful Espionage / Cyber breach
 * (state.revealedBuildings).
 */
export const BuildingDetailModal: React.FC<{
  buildingId: string;
  ownerCompanyId: string;
  onClose: () => void;
}> = ({ buildingId, ownerCompanyId, onClose }) => {
  const state = useGameStore(s => s.state);
  if (!state) return null;

  const owner = state.companies.get(ownerCompanyId);
  const building = owner?.buildings.find(b => b.id === buildingId);
  const isPlayer = ownerCompanyId === state.playerCompanyId;
  const revealed = isPlayer || state.revealedBuildings.includes(buildingId);

  if (!building || !owner) {
    return <Modal title="BUILDING" onClose={onClose} size="md"><div className="empty-state">Building not found.</div></Modal>;
  }

  const depts = building.departmentIds
    .map(id => owner.departments.find(d => d.id === id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  return (
    <Modal
      title={`${building.isHQ ? '⚑ HQ' : '⌂ BRANCH'} — ${owner.name}`}
      onClose={onClose}
      size="md"
    >
      <div className="building-detail">
        <div className="bd-meta">
          <span className="bd-chip">Tile {building.tileId}</span>
          <span className="bd-chip">Firewall {building.firewall}</span>
          <span className="bd-chip">Physical {building.physicalSecurity}</span>
          {building.hushMoney > 0 && <span className="bd-chip warn">Hush ${building.hushMoney}/t</span>}
          <span className="bd-chip">{depts.length} dept{depts.length === 1 ? '' : 's'}</span>
        </div>

        {!revealed ? (
          <div className="classified">
            <div className="classified-lock">🔒 CLASSIFIED</div>
            <p>This rival building's interior is hidden. Run <strong>Espionage</strong> or a <strong>Cyber Attack</strong> breach to reveal its departments.</p>
          </div>
        ) : (
          <div className="bd-depts">
            {depts.length === 0
              ? <div className="empty-state">No departments housed here.</div>
              : <div className="departments-grid">
                  {depts.map((d, i) => <DepartmentCard key={i} dept={d} />)}
                </div>}
          </div>
        )}
      </div>
    </Modal>
  );
};
