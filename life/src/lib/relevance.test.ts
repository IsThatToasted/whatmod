import { describe, expect, it } from 'vitest'
import { calculateRelevanceScore } from './relevance'
import type { AppContextSnapshot, LifeItem } from '../types'
import { todayISO } from './time'

const base:LifeItem={id:'1',user_id:'u',title:'Task',type:'task',status:'open',priority:'normal',context_tags:[],created_at:new Date().toISOString(),updated_at:new Date().toISOString(),snooze_count:0}
const context:AppContextSnapshot={now:new Date(),period:'afternoon',mood:null,minutesUntilNextEvent:null}

describe('relevance',()=>{
  it('boosts due-today work',()=>{const score=calculateRelevanceScore({...base,due_date:todayISO()},context).score;expect(score).toBeGreaterThan(0)})
  it('boosts quick wins in quick mode',()=>{const quick=calculateRelevanceScore({...base,estimated_minutes:5},{...context,mood:'quick'}).score;const normal=calculateRelevanceScore({...base,estimated_minutes:5},context).score;expect(quick).toBeGreaterThan(normal)})
  it('suppresses completed items',()=>{expect(calculateRelevanceScore({...base,status:'completed'},context).score).toBeLessThan(-100)})
})
