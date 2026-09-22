import { analyzeSmartText } from '../lib/smartIntake.js';
import { calculateRelevanceScore } from '../lib/relevance.js';
export class FallbackAIProvider {
    async parseIntent(text) { return analyzeSmartText(text).intent; }
    async analyzeCapture(text) { return analyzeSmartText(text); }
    async rankItems(items, context) { return [...items].sort((a, b) => calculateRelevanceScore(b, context).score - calculateRelevanceScore(a, context).score); }
    async summarizeDay(items) { const done = items.filter(i => i.status === 'completed').length; return `${done} completed today.`; }
    async estimateDuration() { return null; }
    async suggestActions(items) { return items.filter(i => i.status === 'open').slice(0, 3).map(i => i.title); }
}
export const aiProvider = new FallbackAIProvider();
