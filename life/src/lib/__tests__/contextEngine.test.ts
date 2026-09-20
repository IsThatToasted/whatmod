import { describe, expect, it } from 'vitest';
import { calculateRelevanceScore } from '../contextEngine';
import type { LifeItem } from '../../types/models';

const base: LifeItem = {id:'x',title:'Test',type:'task',status:'open',priority:'normal',context_tags:[],created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
describe('relevance engine', () => {
  it('boosts high priority items', () => {
    expect(calculateRelevanceScore({...base,priority:'high'})).toBeGreaterThan(calculateRelevanceScore(base));
  });
  it('boosts quick tasks in quick-win mood', () => {
    expect(calculateRelevanceScore({...base,estimated_minutes:5},'quick')).toBeGreaterThan(calculateRelevanceScore({...base,estimated_minutes:30},'quick'));
  });
});
