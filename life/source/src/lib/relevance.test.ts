import { describe, expect, it } from 'vitest'
import { calculateRelevanceScore, shoppingNowSignal } from './relevance'
import type { AppContextSnapshot, LifeItem } from '../types'
import { todayISO } from './time'

const base:LifeItem={id:'1',user_id:'u',title:'Task',type:'task',status:'open',priority:'normal',context_tags:[],created_at:new Date().toISOString(),updated_at:new Date().toISOString(),snooze_count:0}
const context:AppContextSnapshot={now:new Date(),period:'afternoon',mood:null,minutesUntilNextEvent:null}

describe('relevance',()=>{
  it('boosts due-today work',()=>{const score=calculateRelevanceScore({...base,due_date:todayISO()},context).score;expect(score).toBeGreaterThan(0)})
  it('boosts quick wins in quick mode',()=>{const quick=calculateRelevanceScore({...base,estimated_minutes:5},{...context,mood:'quick'}).score;const normal=calculateRelevanceScore({...base,estimated_minutes:5},context).score;expect(quick).toBeGreaterThan(normal)})
  it('suppresses completed items',()=>{expect(calculateRelevanceScore({...base,status:'completed'},context).score).toBeLessThan(-100)})
  it('keeps far-future shopping out of Now',()=>{
    const now=new Date('2026-09-23T12:00:00')
    const shopping={...base,type:'shopping' as const,due_date:'2026-11-01',created_at:now.toISOString(),updated_at:now.toISOString()}
    expect(calculateRelevanceScore(shopping,{...context,now}).score).toBeLessThan(-80)
  })
  it('uses sparse shopping reminders for normal priority',()=>{
    const now=new Date('2026-09-23T12:00:00')
    const shopping={...base,type:'shopping' as const,priority:'normal' as const,created_at:now.toISOString(),updated_at:now.toISOString()}
    expect(shoppingNowSignal({...shopping,due_date:'2026-09-30'},{...context,now}).show).toBe(true)
    expect(shoppingNowSignal({...shopping,due_date:'2026-09-29'},{...context,now}).show).toBe(false)
    expect(shoppingNowSignal({...shopping,due_date:'2026-09-24'},{...context,now}).show).toBe(true)
    expect(shoppingNowSignal({...shopping,due_date:'2026-09-23'},{...context,now}).show).toBe(true)
  })
  it('shows a daily final-week countdown for high-priority shopping',()=>{
    const now=new Date('2026-09-23T12:00:00')
    const shopping={...base,type:'shopping' as const,priority:'high' as const,due_date:'2026-09-27',created_at:now.toISOString(),updated_at:now.toISOString()}
    const signal=shoppingNowSignal(shopping,{...context,now})
    expect(signal.show).toBe(true)
    expect(signal.label).toContain('4 days remaining')
  })

})
