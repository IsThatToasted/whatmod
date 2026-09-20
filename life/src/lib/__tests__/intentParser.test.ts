import { describe, expect, it } from 'vitest';
import { parseLifeIntent } from '../intentParser';

describe('LifeIntentParser', () => {
  it('recognizes shopping context', () => {
    const result = parseLifeIntent('I need toothpaste next time I am at Walmart');
    expect(result.type).toBe('shopping');
    expect(result.context).toBe('Walmart');
  });
  it('recognizes a call this week', () => {
    const result = parseLifeIntent('Call dentist sometime this week');
    expect(result.type).toBe('call');
    expect(result.dueDate).toBeTruthy();
  });
});
