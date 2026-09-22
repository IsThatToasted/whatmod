import { describe, expect, it } from 'vitest';
import { nextRecurrenceDate } from './recurrence.js';
describe('recurrence', () => {
    it('rolls daily items forward', () => expect(nextRecurrenceDate('daily', '2026-09-20')).toBe('2026-09-21'));
    it('skips weekends for weekdays', () => expect(nextRecurrenceDate('weekdays', '2026-09-18')).toBe('2026-09-21'));
    it('supports every N days', () => expect(nextRecurrenceDate('every:3', '2026-09-20')).toBe('2026-09-23'));
    it('preserves month cadence safely', () => expect(nextRecurrenceDate('monthly', '2026-01-31')).toBe('2026-02-28'));
});
