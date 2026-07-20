import type { CompanyArchetype, CEOTrait, ChiefPerk, CEOSkill } from '../types';

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

/** T — Organization perks granted to the company by its chosen ARCHETYPE
 *  (distinct from the CEO's own trait perks; shown separately in New Game). */
export const ARCHETYPE_PERKS: Record<CompanyArchetype, ChiefPerk[]> = {
  lean_specialist: ['cost_cutter'],
  hypergrowth_platform: ['market_savant'],
  security_fortress: ['iron_will'],
  acquisition_machine: ['talent_magnet'],
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
    blurb: 'Learns fast — capabilities compound +10% each turn. Reads rivals without spying.',
    perks: ['fast_learner', 'corporate_intelligence'],
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

/** T: CEO attributes re-themed for ruthless.com — corporate/executive pillars
 * (replaces the Fallout S.P.E.C.I.A.L. clone). 0..10 each. Luck stays
 * as the wildcrd slot. */
export const CEO_PILLARS: CEOSkill[] = [
  'vision', 'network', 'analytics', 'charisma', 'strategy', 'operations', 'resilience', 'luck',
];

/** Human-readable labels for the executive pillars. */
export const PILLAR_LABELS: Record<CEOSkill, string> = {
  vision: 'V — Vision',
  network: 'N — Network',
  analytics: 'A — Analytics',
  charisma: 'C — Charisma',
  strategy: 'S — Strategy',
  operations: 'O — Operations',
  resilience: 'R — Resilience',
  luck: 'L — Luck',
};

/** Token budget for the New Game CEO point-buy. */
export const CEO_TOKEN_BUDGET = 20;

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
  corporate_intelligence: 'Reads rival interiors without espionage / cyber',
};

/**
 * T: each successful action trains the CEO's relevant executive pillar.
 * The pillar a CEO grows depends on WHAT they did — cyber sharpens Network,
 * PR sharpens Charisma, R&D sharpens Analytics, etc. Organic byproduct of play.
 */
export const ACTION_PILLAR: Partial<Record<string, CEOSkill>> = {
  cyber_attack: 'network', industrial_espionage: 'network', build_building: 'strategy',
  exploit_stolen_asset: 'analytics', repatent_stolen_asset: 'analytics',
  build_department: 'strategy', defend_tile: 'strategy', mass_layoff: 'strategy',
  launch_product: 'analytics', pivot_product: 'analytics', release_source: 'analytics',
  allocate_compute: 'analytics', allocate_cybersecurity: 'resilience',
  build_ai: 'analytics', ai_automation: 'analytics',
  ceo_praise: 'charisma', ceo_discredit: 'charisma', run_pr_campaign: 'charisma',
  social_media_push: 'charisma', public_tender_offer: 'charisma',
  acquire_company: 'charisma', acquire_below_value: 'charisma',
  raise_capital: 'analytics', reduce_costs: 'analytics',
  legal_sue: 'analytics', legal_patent: 'analytics', legal_subpoena: 'analytics',
  hire_executive: 'charisma', hire_ceo: 'charisma', hire_coo: 'charisma', fire_ceo: 'charisma',
  train_ceo: 'resilience', scout_acquisition: 'vision', expand_market: 'resilience',
  research_push: 'analytics', product_improve: 'analytics',
  // Luck is nudged by anything risky; handled separately in the engine.
};

/**
 * T: perks unlocked by executive pillar thresholds (in addition to trait-granted
 * perks). A CEO who builds a high-Vision reputation earns market_savant;
 * a lucky one earns iron_will, etc. Every perk earnable in-game.
 */
export const PERK_PILLAR_THRESHOLD: Partial<Record<ChiefPerk, { skill: CEOSkill; min: number }>> = {
  corporate_intelligence: { skill: 'analytics', min: 7 },
  market_savant: { skill: 'charisma', min: 7 },
  iron_will: { skill: 'luck', min: 7 },
  talent_magnet: { skill: 'resilience', min: 7 },
  fast_learner: { skill: 'analytics', min: 6 },
  cost_cutter: { skill: 'strategy', min: 6 },
  high_leverage: { skill: 'strategy', min: 5 },
};

/** T: grant any threshold perks the CEO now qualifies for (idempotent). */
export function unlockPerksForCeo(ceo: { skills: Partial<Record<CEOSkill, number>>; perks: ChiefPerk[] }): ChiefPerk[] {
  const fresh: ChiefPerk[] = [];
  (Object.keys(PERK_PILLAR_THRESHOLD) as ChiefPerk[]).forEach(pk => {
    const t = PERK_PILLAR_THRESHOLD[pk]!;
    const v = ceo.skills[t.skill] ?? 0;
    if (v >= t.min && !ceo.perks.includes(pk)) { ceo.perks.push(pk); fresh.push(pk); }
  });
  return fresh;
}
