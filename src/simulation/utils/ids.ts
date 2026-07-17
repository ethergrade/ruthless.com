import type { CompanyId, TileId, ProductId, DepartmentId, ExecutiveId, ActionId } from '../../types';

let counters = {
  company: 0,
  tile: 0,
  product: 0,
  department: 0,
  executive: 0,
  action: 0,
  building: 0,
};

export const generateId = {
  company: (): CompanyId => `company_${++counters.company}` as CompanyId,
  tile: (): TileId => `tile_${++counters.tile}` as TileId,
  product: (): ProductId => `product_${++counters.product}` as ProductId,
  department: (): DepartmentId => `dept_${++counters.department}` as DepartmentId,
  executive: (): ExecutiveId => `exec_${++counters.executive}` as ExecutiveId,
  action: (): ActionId => `action_${++counters.action}` as ActionId,
  building: (): string => `bld_${++counters.building}`,
};

export const resetIdCounters = (): void => {
  counters = { company: 0, tile: 0, product: 0, department: 0, executive: 0, action: 0, building: 0 };
};
