import assert from 'node:assert/strict';
import test from 'node:test';
import { statsQuerySchema } from '../schemas.js';
import { resolveStatsDateRange } from './stats-routes.js';

test('statistics queries default to a rolling monthly range', () => {
  const query = statsQuerySchema.parse({});
  const now = new Date('2026-07-15T12:30:00.000Z');

  assert.deepEqual(resolveStatsDateRange(query, now), {
    start: new Date('2026-06-15T12:30:00.000Z'),
    end: now,
  });
});

test('custom statistics ranges include the complete end date', () => {
  const query = statsQuerySchema.parse({
    range: 'custom',
    from: '2026-07-01',
    to: '2026-07-15',
  });

  assert.deepEqual(resolveStatsDateRange(query), {
    start: new Date('2026-07-01T00:00:00.000Z'),
    end: new Date('2026-07-16T00:00:00.000Z'),
  });
});

test('custom statistics ranges require valid ordered dates', () => {
  assert.equal(
    statsQuerySchema.safeParse({
      range: 'custom',
      from: '2026-07-15',
      to: '2026-07-01',
    }).success,
    false,
  );
  assert.equal(
    statsQuerySchema.safeParse({
      range: 'custom',
      from: '2026-02-31',
      to: '2026-03-01',
    }).success,
    false,
  );
  assert.equal(
    statsQuerySchema.safeParse({
      range: 'custom',
      from: '2026-99-99',
      to: '2026-03-01',
    }).success,
    false,
  );
});
