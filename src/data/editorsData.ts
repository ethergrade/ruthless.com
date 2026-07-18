import type { CompanyArchetype, CEOTrait } from '../types';

export const ARCHETYPES_SIMPLE: { id: CompanyArchetype; name: string }[] = [
  { id: 'hypergrowth_platform', name: 'Hypergrowth Platform' },
  { id: 'security_fortress', name: 'Security Fortress' },
  { id: 'acquisition_machine', name: 'Acquisition Machine' },
  { id: 'lean_specialist', name: 'Lean Specialist' },
];

export const CEOS_SIMPLE: { id: CEOTrait; name: string }[] = [
  { id: 'none', name: 'Balanced Operator' },
  { id: 'banker', name: 'Hunt (Banker)' },
  { id: 'smart', name: 'Jersild (Smart)' },
  { id: 'initiative', name: 'Laingang (Initiative)' },
];

let _seq = 0;
export const genId = (prefix: string): string => `${prefix}_${Date.now().toString(36)}_${(_seq++).toString(36)}`;
