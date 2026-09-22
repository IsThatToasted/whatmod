import type { LifeItem, ParsedIntent } from '../types'
import { analyzeSmartText } from '../lib/smartIntake'
import { calculateRelevanceScore } from '../lib/relevance'
import type { AppContextSnapshot } from '../types'
import type { SmartAnalysis } from '../lib/smartIntake'

/**
 * The Smart Engine is provider-based on purpose. Today the local provider is
 * deterministic, private, instant, and works without an AI API. A future
 * server/Edge provider can enrich the same contract with OCR, document
 * extraction, URL metadata, entity resolution, and better intent inference.
 */
export interface AIProvider {
  parseIntent(text: string): Promise<ParsedIntent>
  analyzeCapture(text: string): Promise<SmartAnalysis>
  rankItems(items: LifeItem[], context: AppContextSnapshot): Promise<LifeItem[]>
  summarizeDay(items: LifeItem[]): Promise<string>
  estimateDuration(text: string): Promise<number | null>
  suggestActions(items: LifeItem[]): Promise<string[]>
}

export class FallbackAIProvider implements AIProvider {
  async parseIntent(text: string) { return analyzeSmartText(text).intent }
  async analyzeCapture(text: string) { return analyzeSmartText(text) }
  async rankItems(items: LifeItem[], context: AppContextSnapshot) { return [...items].sort((a,b) => calculateRelevanceScore(b, context).score - calculateRelevanceScore(a, context).score) }
  async summarizeDay(items: LifeItem[]) { const done = items.filter(i => i.status === 'completed').length; return `${done} completed today.` }
  async estimateDuration() { return null }
  async suggestActions(items: LifeItem[]) { return items.filter(i => i.status === 'open').slice(0,3).map(i => i.title) }
}

export const aiProvider: AIProvider = new FallbackAIProvider()
