import type { ProductCategory, MarketSegment, VoiceTone, CampaignAuthenticity } from '../types';
import { createRNG } from '../simulation/utils/rng';

/**
 * Invented product / company name banks keyed by sector, so generated names
 * feel native to the chosen product category. The user can edit any of these.
 */
const PREFIXES = [
  'Nexus', 'Apex', 'Quantum', 'Vertex', 'Meridian', 'Sentinel', 'Axiom',
  'Catalyst', 'Horizon', 'Pinnacle', 'Zenith', 'Orion', 'Nova', 'Prism',
  'Eclipse', 'Vanguard', 'Hyperion', 'Cobalt', 'Obsidian', 'Helix', 'Photon',
  'Cipher', 'Aether', 'Onyx', 'Pulse', 'Forge', 'Lumen', 'Specter', 'Titan',
  'Wraith', 'Halo', 'Drift', 'Echo', 'Flux', 'Nebula', 'Vortex', 'Astra',
];

const SUFFIX_BY_CATEGORY: Record<ProductCategory, string[]> = {
  saas: ['Flow', 'Sync', 'Core', 'Hub', 'Stream', 'Link', 'Bridge', 'Pulse', 'Suite', 'Desk'],
  ai: ['Mind', 'Brain', 'Cortex', 'Neural', 'Insight', 'Predict', 'Vision', 'Sense', 'Logic', 'Synapse'],
  cybersecurity: ['Shield', 'Guard', 'Wall', 'Fortress', 'Sentinel', 'Bastion', 'Aegis', 'Defense', 'Lock', 'Warden'],
  consulting: ['Advisory', 'Strategy', 'Partners', 'Consulting', 'Experts', 'Group', 'Associates', 'Solutions', 'Labs'],
  managed_service: ['Ops', 'Manage', 'Care', 'Support', 'Run', 'Maintain', 'Service', 'Control', 'Watch'],
  data_service: ['Data', 'Analytics', 'Insights', 'Intelligence', 'Metrics', 'Warehouse', 'Lake', 'Stream', 'Graph'],
  platform_api: ['Platform', 'API', 'Gateway', 'Connect', 'Bridge', 'Mesh', 'Fabric', 'Layer', 'Grid', 'Node'],
  hybrid: ['Fusion', 'Blend', 'Hybrid', 'Unified', 'Integrated', 'Combined', 'Joint', 'Merged', 'One', 'Edge'],
  fintech: ['Pay', 'Bank', 'Capital', 'Ledger', 'Coin', 'Finance', 'Fund', 'Trade', 'Yield', 'Vault'],
  cloud_infra: ['Cloud', 'Stack', 'Compute', 'Scale', 'Grid', 'Edge', 'Mesh', 'Node', 'Region', 'Host'],
  iot: ['Sense', 'Connect', 'Thing', 'Device', 'Edge', 'Mesh', 'Pulse', 'Track', 'Monitor', 'Link'],
  blockchain: ['Chain', 'Ledger', 'Token', 'Block', 'Node', 'Protocol', 'Verify', 'Trust', 'Mint', 'DAO'],
  healthtech: ['Health', 'Care', 'Med', 'Bio', 'Vital', 'Clinic', 'Genome', 'Therapy', 'Well', 'Life'],
  edtech: ['Learn', 'Academy', 'Edu', 'Class', 'Teach', 'Scholar', 'Campus', 'Tutor', 'Skill', 'Mind'],
  greentech: ['Green', 'Eco', 'Solar', 'Clean', 'Carbon', 'Earth', 'Leaf', 'Volt', 'Wind', 'Pure'],
  gaming: ['Play', 'Quest', 'Arcade', 'Arena', 'World', 'Pixel', 'Realm', 'Game', 'Clash', 'League'],
  ecommerce: ['Shop', 'Cart', 'Store', 'Market', 'Buy', 'Retail', 'Mall', 'Deal', 'Commerce', 'Trade'],
  data_analytics: ['Metrics', 'Insight', 'Graph', 'Query', 'Report', 'Dash', 'BI', 'Stats', 'Signal', 'View'],
  robotics: ['Bot', 'Arm', 'Automaton', 'Mech', 'Drone', 'Assembly', 'Kinetic', 'Servo', 'Unit', 'Forge'],
  biotech: ['Gene', 'Cell', 'Protein', 'Vitro', 'Therapy', 'Lab', 'Biome', 'Culture', 'Strain', 'Helix'],
  quantum: ['Qubit', 'Entangle', 'Superpose', 'Gate', 'Compute', 'Cipher', 'Cohere', 'Phase', 'Wave', 'Core'],
  ar_vr: ['Vision', 'Immerse', 'Reality', 'Holo', 'Spatial', 'Lens', 'World', 'Mixed', 'View', 'Scene'],
};

const COMPANY_PREFIX = [
  'Nexus', 'Apex', 'Quantum', 'Vertex', 'Meridian', 'Sentinel', 'Axiom',
  'Catalyst', 'Horizon', 'Pinnacle', 'Zenith', 'Orion', 'Nova', 'Prism',
  'Vanguard', 'Helix', 'Cobalt', 'Obsidian', 'Lumen', 'Specter',
];

const COMPANY_SUFFIX = [
  'Tech', 'Digital', 'Systems', 'Solutions', 'AI', 'Networks', 'Computing',
  'Soft', 'Labs', 'Dynamics', 'Cyber', 'Cloud', 'Analytics', 'Robotics',
];

/** Pick the best segments for a given category (used to pre-roll targets). */
export const SEGMENTS_BY_CATEGORY: Record<ProductCategory, MarketSegment[]> = {
  saas: ['enterprise_cluster', 'high_growth', 'startup_zone'],
  ai: ['innovation_hub', 'enterprise_cluster', 'high_growth'],
  cybersecurity: ['regulated_industry', 'enterprise_cluster', 'public_sector'],
  consulting: ['enterprise_cluster', 'public_sector', 'strategic_account'],
  managed_service: ['enterprise_cluster', 'legacy_market', 'strategic_account'],
  data_service: ['innovation_hub', 'enterprise_cluster', 'high_growth'],
  platform_api: ['innovation_hub', 'startup_zone', 'high_growth'],
  hybrid: ['enterprise_cluster', 'regulated_industry', 'high_growth'],
  fintech: ['regulated_industry', 'strategic_account', 'enterprise_cluster'],
  cloud_infra: ['enterprise_cluster', 'high_growth', 'innovation_hub'],
  iot: ['enterprise_cluster', 'legacy_market', 'high_growth'],
  blockchain: ['innovation_hub', 'startup_zone', 'strategic_account'],
  healthtech: ['regulated_industry', 'public_sector', 'innovation_hub'],
  edtech: ['public_sector', 'startup_zone', 'high_growth'],
  greentech: ['public_sector', 'high_growth', 'innovation_hub'],
  gaming: ['high_growth', 'startup_zone', 'open_market'],
  ecommerce: ['open_market', 'price_sensitive', 'high_growth'],
  data_analytics: ['enterprise_cluster', 'innovation_hub', 'strategic_account'],
  robotics: ['enterprise_cluster', 'legacy_market', 'high_growth'],
  biotech: ['regulated_industry', 'innovation_hub', 'public_sector'],
  quantum: ['innovation_hub', 'enterprise_cluster', 'strategic_account'],
  ar_vr: ['high_growth', 'startup_zone', 'open_market'],
};

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'saas', 'ai', 'cybersecurity', 'consulting', 'managed_service', 'data_service', 'platform_api', 'hybrid',
  'fintech', 'cloud_infra', 'iot', 'blockchain', 'healthtech', 'edtech', 'greentech',
  'gaming', 'ecommerce', 'data_analytics', 'robotics', 'biotech', 'quantum', 'ar_vr',
];

export const SEGMENT_LABELS: Record<MarketSegment, string> = {
  open_market: 'Open Market',
  enterprise_cluster: 'Enterprise Cluster',
  public_sector: 'Public Sector',
  regulated_industry: 'Regulated Industry',
  innovation_hub: 'Innovation Hub',
  price_sensitive: 'Price Sensitive',
  high_growth: 'High Growth',
  legacy_market: 'Legacy Market',
  strategic_account: 'Strategic Account',
  startup_zone: 'Startup Zone',
};

/** Market-segment colors (used to tint map tiles so segments read at a glance). */
export const SEGMENT_COLORS: Record<MarketSegment, string> = {
  open_market: '#00d4aa',
  enterprise_cluster: '#007bff',
  public_sector: '#ffc107',
  regulated_industry: '#6f42c1',
  innovation_hub: '#20c997',
  price_sensitive: '#fd7e14',
  high_growth: '#e83e8c',
  legacy_market: '#8a8d99',
  strategic_account: '#ff6b35',
  startup_zone: '#00ffa3',
};

export const VOICE_TONES: { value: VoiceTone; label: string; blurb: string }[] = [
  { value: 'aggressive', label: 'Aggressive', blurb: 'Attack rivals, claim dominance' },
  { value: 'visionary', label: 'Visionary', blurb: 'Paint the future, inspire' },
  { value: 'technical', label: 'Technical', blurb: 'Specs, benchmarks, proofs' },
  { value: 'provocative', label: 'Provocative', blurb: 'Hot takes, stir debate' },
  { value: 'corporate', label: 'Corporate', blurb: 'Safe, polished, on-message' },
  { value: 'rebellious', label: 'Rebellious', blurb: 'Anti-establishment, punk' },
];

export const AUTHENTICITY_LEVELS: { value: CampaignAuthenticity; label: string; blurb: string }[] = [
  { value: 'verified', label: 'Verified', blurb: 'Claims backed by real metrics' },
  { value: 'aspirational', label: 'Aspirational', blurb: 'Mostly true, lightly spun' },
  { value: 'fabricated', label: 'Fake It Till You Make It', blurb: 'Bold claims, thin proof' },
];

/** Deterministic-ish generator using the shared RNG so it respects the game seed. */
export const generateProductName = (seed: number, category: ProductCategory): string => {
  const rng = createRNG(seed + category.length * 7919);
  const prefix = rng.shuffle([...PREFIXES]).pop()!;
  const suffix = rng.shuffle([...SUFFIX_BY_CATEGORY[category]]).pop()!;
  return `${prefix}${suffix}`;
};

export const generateCompanyName = (seed: number): string => {
  const rng = createRNG(seed + 104729);
  const prefix = rng.shuffle([...COMPANY_PREFIX]).pop()!;
  const suffix = rng.shuffle([...COMPANY_SUFFIX]).pop()!;
  return `${prefix}${suffix}`;
};

/** A small pool of flavor names for quick "surprise me" cycling in the editor. */
export const spinProductName = (seed: number, category: ProductCategory, n: number): string => {
  const rng = createRNG(seed * 31 + n * 131 + category.length);
  const prefix = rng.shuffle([...PREFIXES]).pop()!;
  const suffix = rng.shuffle([...SUFFIX_BY_CATEGORY[category]]).pop()!;
  return `${prefix}${suffix}`;
};

export const spinCompanyName = (seed: number, n: number): string => {
  const rng = createRNG(seed * 17 + n * 977);
  const prefix = rng.shuffle([...COMPANY_PREFIX]).pop()!;
  const suffix = rng.shuffle([...COMPANY_SUFFIX]).pop()!;
  return `${prefix}${suffix}`;
};
