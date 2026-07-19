import type { CampaignCondition, CampaignDefinition, Company, GameState } from '../types';

const PREFIX = 'strategyless:campaign:';

export interface CampaignValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export const evaluateCampaignCondition = (condition: CampaignCondition, state: GameState): boolean => {
  if (condition.kind === 'always') return true;
  const player = state.companies.get(state.playerCompanyId);
  if (!player) return false;
  const compare = (actual: number, expected: number, operator: 'gte' | 'lte') =>
    operator === 'gte' ? actual >= expected : actual <= expected;
  switch (condition.kind) {
    case 'cash': return compare(player.cash, condition.value, condition.operator);
    case 'debt': return compare(player.debt, condition.value, condition.operator);
    case 'turn': return compare(state.turn, condition.value, condition.operator);
    case 'market_share': {
      const total = Array.from(state.companies.values()).reduce((sum, c) => sum + c.marketInfluence, 0) || 1;
      return compare(player.marketInfluence / total, condition.value, condition.operator);
    }
    case 'technology': return player.ideas.some(idea => idea.id === condition.technologyId);
  }
};

export const validateCampaign = (campaign: CampaignDefinition): CampaignValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set(campaign.chapters.map(ch => ch.id));
  if (!campaign.name.trim()) errors.push('Campaign name is required.');
  if (!campaign.chapters.length) errors.push('Add at least one chapter.');
  if (!ids.has(campaign.entryChapterId)) errors.push('Entry chapter is missing.');
  if (ids.size !== campaign.chapters.length) errors.push('Chapter IDs must be unique.');
  campaign.edges.forEach(edge => {
    if (!ids.has(edge.fromChapterId) || !ids.has(edge.toChapterId)) errors.push(`Edge “${edge.label}” has a missing chapter reference.`);
    if (!edge.conditions.length) warnings.push(`Edge “${edge.label}” has no condition and will never be selected.`);
  });
  const reachable = new Set<string>();
  const visit = (id: string) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    campaign.edges.filter(e => e.fromChapterId === id).forEach(e => visit(e.toChapterId));
  };
  if (ids.has(campaign.entryChapterId)) visit(campaign.entryChapterId);
  campaign.chapters.filter(ch => !reachable.has(ch.id)).forEach(ch => errors.push(`Chapter “${ch.title}” is unreachable.`));
  const finals = campaign.chapters.filter(ch => ch.isFinal);
  if (!finals.length) errors.push('At least one final chapter is required.');
  if (finals.length && !finals.some(ch => reachable.has(ch.id))) errors.push('No final chapter is reachable from the entry point.');
  campaign.chapters.filter(ch => !ch.isFinal && !campaign.edges.some(e => e.fromChapterId === ch.id))
    .forEach(ch => warnings.push(`Chapter “${ch.title}” is a dead end but is not marked final.`));
  return { valid: errors.length === 0, errors, warnings };
};

export const createCampaignDefinition = (): CampaignDefinition => {
  const entryId = `chapter_${Date.now()}`;
  const finalId = `${entryId}_final`;
  return {
    schemaVersion: 1,
    id: `campaign_${Date.now()}`,
    name: 'The Signal War',
    description: 'A branching corporate war about technology, loyalty and manufactured truth.',
    entryChapterId: entryId,
    updatedAt: Date.now(),
    chapters: [
      {
        id: entryId, title: 'Hostile Signal', description: 'Establish a foothold before the market notices.',
        aiDifficulty: 'aggressive', turnLimit: 12, isFinal: false,
        narrativeIntro: 'A weak signal surfaces in the data. Three corporations move at once.',
        narrativeBeats: [],
        scenario: { id: `${entryId}_scenario`, name: 'Hostile Signal', mapSize: 'medium', aiRivals: 3, disasters: true, startCash: 5_000_000, winConditions: [{ kind: 'market_share', target: 25 }] },
      },
      {
        id: finalId, title: 'The Open Market', description: 'Carry the corporation beyond the authored story.',
        aiDifficulty: 'ruthless', isFinal: true, narrativeBeats: [],
        scenario: { id: `${finalId}_scenario`, name: 'The Open Market', mapSize: 'large', aiRivals: 5, disasters: true, startCash: 7_000_000, winConditions: [] },
      },
    ],
    edges: [{ id: `${entryId}_edge`, fromChapterId: entryId, toChapterId: finalId, label: 'Survive the launch', conditions: [{ kind: 'turn', operator: 'gte', value: 12 }] }],
  };
};

const memory = new Map<string, string>();
const storage = () => typeof localStorage === 'undefined' ? null : localStorage;

export const CampaignLibrary = {
  save(campaign: CampaignDefinition): CampaignDefinition {
    const saved = { ...campaign, updatedAt: Date.now() };
    const raw = JSON.stringify(saved);
    const store = storage();
    if (store) store.setItem(PREFIX + saved.id, raw); else memory.set(saved.id, raw);
    return saved;
  },
  list(): CampaignDefinition[] {
    const raws: string[] = [];
    const store = storage();
    if (store) {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (key?.startsWith(PREFIX)) raws.push(store.getItem(key)!);
      }
    } else raws.push(...memory.values());
    return raws.flatMap(raw => { try { return [JSON.parse(raw) as CampaignDefinition]; } catch { return []; } })
      .filter(c => c.schemaVersion === 1).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  remove(id: string): void { storage()?.removeItem(PREFIX + id); memory.delete(id); },
  import(raw: string): CampaignDefinition {
    const parsed = JSON.parse(raw) as CampaignDefinition;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.chapters) || !Array.isArray(parsed.edges)) throw new Error('Unsupported or invalid campaign file.');
    const validation = validateCampaign(parsed);
    if (!validation.valid) throw new Error(validation.errors.join(' '));
    return this.save(parsed);
  },
  export(campaign: CampaignDefinition): string { return JSON.stringify(campaign, null, 2); },
};

export const snapshotCorporation = (company: Company): Company => structuredClone(company);
