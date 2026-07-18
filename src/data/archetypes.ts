import type { CompanyArchetype, CEOTrait, ChiefPerk } from '../types';

/**
 * T — GDR build planner for NEW GAME.
 * Every corporation is defined by a set of 0..100 capability metrics. The
 * chosen ARCHETYPE seeds the baseline "build", and the CEO TRAIT layers
 * perks/modifiers on top — classic strategy-game character creation.
 */
export interface CompanyStats {
  security: number;        // cyber/physical security posture
  ai: number;              // AI & data capability
  consulting: number;      // consulting / services capacity
  innovation: number;      // R&D innovation rate
  trust: number;           // brand trust / reputation
  productQuality: number;  // craftsmanship of shipped product
  productRd: number;       // Product R&D strength / pipeline
  salesMarketing: number;  // Sales & Marketing reach
}

export const ARCHETYPE_STATS: Record<CompanyArchetype, CompanyStats> = {
  // Lean Specialist — niche dominance, high margins, fragile at scale.
  lean_specialist: {
    security: 40, ai: 20, consulting: 10, innovation: 30,
    trust: 50, productQuality: 62, productRd: 66, salesMarketing: 33,
  },
  // Hypergrowth Platform — aggressive expansion, high burn.
  hypergrowth_platform: {
    security: 28, ai: 45, consulting: 18, innovation: 55,
    trust: 38, productQuality: 44, productRd: 58, salesMarketing: 70,
  },
  // Security Fortress — slow steady growth, high trust, regulated markets.
  security_fortress: {
    security: 80, ai: 35, consulting: 22, innovation: 40,
    trust: 80, productQuality: 58, productRd: 52, salesMarketing: 30,
  },
  // Acquisition Machine — roll-up strategy, fast scale, integration risk.
  acquisition_machine: {
    security: 45, ai: 30, consulting: 60, innovation: 35,
    trust: 45, productQuality: 48, productRd: 40, salesMarketing: 55,
  },
};

export interface CEOTraitDef {
  id: CEOTrait;
  name: string;
  blurb: string;
  /** Mechanical perks granted to the seated CEO at hire. */
  perks: ChiefPerk[];
  /** Additive modifiers applied to the company's starting stats. */
  statMods: Partial<CompanyStats>;
  /** Cash / debt adjustments at founding. */
  cashMod?: number;
  debtMod?: number;
  /** Flat operating-cost multiplier (e.g. 0.9 = -10%). */
  costMult?: number;
  tags: string[];
}

export const CEO_TRAIT_DEFS: Record<CEOTrait, CEOTraitDef> = {
  banker: {
    id: 'banker',
    name: 'Hunt (Banker)',
    blurb: 'Debt compounds 2x — high leverage, fragile if cash stalls.',
    perks: ['high_leverage'],
    statMods: { trust: -10 },
    cashMod: -2000000,
    debtMod: 4000000,
    costMult: 1.1,
    tags: ['High Risk / High Reward'],
  },
  smart: {
    id: 'smart',
    name: 'Jersild (Smart)',
    blurb: 'Learns fast — capabilities compound +10% each turn.',
    perks: ['fast_learner'],
    statMods: { innovation: 10, ai: 10 },
    tags: ['Steady Edge'],
  },
  initiative: {
    id: 'initiative',
    name: 'Laingang (Initiative)',
    blurb: 'Drives hard — a free expansion order every 3 turns.',
    perks: ['extra_order'],
    statMods: { salesMarketing: 8 },
    tags: ['Aggressive Growth', 'Expends Resources'],
  },
  none: {
    id: 'none',
    name: 'Balanced Operator',
    blurb: 'No extreme trait — steady, predictable baseline.',
    perks: [],
    statMods: {},
    tags: ['Baseline', 'No Bonus / Penalty'],
  },
};

/** Human-readable label for a stat key (used in the build planner UI). */
export const STAT_LABELS: Record<keyof CompanyStats, string> = {
  security: 'Cybersecurity',
  ai: 'AI',
  consulting: 'Consulting',
  innovation: 'Innovation',
  trust: 'Trust',
  productQuality: 'Product Quality',
  productRd: 'Product R&D',
  salesMarketing: 'Sales & Marketing',
};

/** Perk → short description for tooltips / preview. */
export const PERK_LABELS: Record<ChiefPerk, string> = {
  extra_order: '+1 Executive Order / 3 turns',
  fast_learner: '+10% capability gain per turn',
  high_leverage: 'Debt compounds 2x (fragile if cash stalls)',
  talent_magnet: '+workforce morale & employer brand',
  cost_cutter: '-10% operating costs',
  market_savant: '+brandTrust / influence on market moves',
  iron_will: '-scandal impact, +crisis resilience',
};
