import type { LifeItem, ParsedIntent } from '../types'
import { lifeIntentParser } from '../lib/parser'
import { calculateRelevanceScore } from '../lib/relevance'
import type { AppContextSnapshot } from '../types'

export interface AIProvider {
  parseIntent(text: string): Promise<ParsedIntent>
  rankItems(items: LifeItem[], context: AppContextSnapshot): Promise<LifeItem[]>
  summarizeDay(items: LifeItem[]): Promise<string>
  estimateDuration(text: string): Promise<number | null>
  suggestActions(items: LifeItem[]): Promise<string[]>
}

export class FallbackAIProvider implements AIProvider {
  async parseIntent(text: string) { return lifeIntentParser.parse(text) }
  async rankItems(items: LifeItem[], context: AppContextSnapshot) { return [...items].sort((a,b) => calculateRelevanceScore(b, context).score - calculateRelevanceScore(a, context).score) }
  async summarizeDay(items: LifeItem[]) { const done = items.filter(i => i.status === 'completed').length; return `${done} completed today.` }
  async estimateDuration() { return null }
  async suggestActions(items: LifeItem[]) { return items.filter(i => i.status === 'open').slice(0,3).map(i => i.title) }
}

export const aiProvider: AIProvider = new FallbackAIProvider()
