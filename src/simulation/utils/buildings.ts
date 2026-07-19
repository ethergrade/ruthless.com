import type { Building, Company, MarketTile, TileId } from '../../types';

export const getBuildingUsedSlots = (building: Building): number =>
  building.departmentIds.length + (building.isHQ ? 1 : 0);

export const getBuildingFreeSlots = (building: Building): number =>
  Math.max(0, building.maxDepartments - getBuildingUsedSlots(building));

export const getBuildingDisplayName = (company: Company, building: Building): string => {
  if (building.name?.trim()) return building.name.trim();
  const index = company.buildings.findIndex(candidate => candidate.id === building.id);
  return building.isHQ ? `${company.name} Headquarters` : `${company.name} Building ${Math.max(2, index + 1)}`;
};

export const findBuildingOnTile = (company: Company, tileId?: TileId): Building | undefined =>
  tileId ? company.buildings.find(building => building.tileId === tileId) : undefined;

export const getOwnedBuildingsWithCapacity = (company: Company): Building[] =>
  company.buildings.filter(building => getBuildingFreeSlots(building) > 0);

export const isOwnedBuildingTile = (company: Company, tile?: MarketTile): boolean => {
  if (!tile || tile.controllerId !== company.id || !tile.buildingId) return false;
  return company.buildings.some(building => building.id === tile.buildingId && building.tileId === tile.id);
};
