import { describe, expect, it } from 'vitest'
import { LifeIntentParser } from './parser'

describe('LifeIntentParser',()=>{
  const parser=new LifeIntentParser()
  it('recognizes shopping context',()=>{const r=parser.parse('I need toothpaste next time I am at Walmart');expect(r.type).toBe('shopping');expect(r.context).toBe('Walmart');expect(r.title.toLowerCase()).toContain('toothpaste')})
  it('recognizes calls and relative dates',()=>{const r=parser.parse('Call dentist sometime this week');expect(r.type).toBe('call');expect(r.dueDate).toBeTruthy()})
  it('never requires AI to return a usable result',()=>{const r=parser.parse('remember the blue folder');expect(r.title.length).toBeGreaterThan(0);expect(r.confidence).toBeGreaterThan(0)})
})
