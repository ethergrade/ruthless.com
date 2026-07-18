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

/** Fallout-style S.P.E.C.I.A.L. skill keys (0..10). */
export const CEO_SKILLS: CEOSkill[] = [
  'strength', 'perception', 'endurance', 'charisma', 'intelligence', 'agility', 'luck',
];

/** Human-readable labels for the S.P.E.C.I.A.L. attributes. */
export const SPECIAL_LABELS: Record<CEOSkill, string> = {
  strength: 'S — Strength',
  perception: 'P — Perception',
  endurance: 'E — Endurance',
  charisma: 'C — Charisma',
  intelligence: 'I — Intelligence',
  agility: 'A — Agility',
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
 * T: each successful action trains the CEO's relevant S.P.E.C.I.A.L. pillar.
 * The pillar a CEO grows depends on WHAT they did — combat sharpens Perception,
 * PR sharpens Charisma, R&D sharpens Intelligence, etc. This makes the GDR
 * attributes an organic byproduct of play, not just a New Game point-buy.
 */
export const ACTION_SPECIAL_PILLAR: Partial<Record<string, CEOSkill>> = {
  cyber_attack: 'perception', industrial_espionage: 'perception', build_building: 'strength',
  build_department: 'strength', defend_tile: 'strength', mass_layoff: 'strength',
  launch_product: 'intelligence', pivot_product: 'intelligence', release_source: 'intelligence',
  build_ai: 'intelligence', ai_automation: 'intelligence',
  ceo_praise: 'charisma', ceo_discredit: 'charisma', run_pr_campaign: 'charisma',
  social_media_push: 'charisma', public_tender_offer: 'charisma',
  acquire_company: 'charisma', acquire_below_value: 'charisma',
  raise_capital: 'intelligence', reduce_costs: 'intelligence',
  legal_sue: 'intelligence', legal_patent: 'intelligence', legal_subpoena: 'intelligence',
  hire_executive: 'charisma', hire_ceo: 'charisma', hire_coo: 'charisma', fire_ceo: 'charisma',
  train_ceo: 'endurance', scout_acquisition: 'perception', expand_market: 'endurance',
  research_push: 'intelligence', product_improve: 'intelligence',
  // Luck is nudged by anything risky; handled separately in the engine.
};

/**
 * T: perks unlocked by SPECIAL pillar thresholds (in addition to trait-granted
 * perks). A CEO who builds a high-Charisma reputation earns market_savant; a
 * lucky one earns iron_will, etc. This makes every perk earnable in-game.
 */
export const PERK_SPECIAL_THRESHOLD: Partial<Record<ChiefPerk, { skill: CEOSkill; min: number }>> = {
  corporate_intelligence: { skill: 'intelligence', min: 7 },
  market_savant: { skill: 'charisma', min: 7 },
  iron_will: { skill: 'luck', min: 7 },
  talent_magnet: { skill: 'endurance', min: 7 },
  fast_learner: { skill: 'intelligence', min: 6 },
  cost_cutter: { skill: 'strength', min: 6 },
  high_leverage: { skill: 'strength', min: 5 },
};

/** T: grant any threshold perks the CEO now qualifies for (idempotent). */
export function unlockPerksForCeo(ceo: { skills: Partial<Record<CEOSkill, number>>; perks: ChiefPerk[] }): ChiefPerk[] {
  const fresh: ChiefPerk[] = [];
  (Object.keys(PERK_SPECIAL_THRESHOLD) as ChiefPerk[]).forEach(pk => {
    const t = PERK_SPECIAL_THRESHOLD[pk]!;
    const v = ceo.skills[t.skill] ?? 0;
    if (v >= t.min && !ceo.perks.includes(pk)) { ceo.perks.push(pk); fresh.push(pk); }
  });
  return fresh;
}

