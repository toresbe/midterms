import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ResultUpdates, formatResultUpdate } from '../../src/result-updates.ts';

const when = new Date('2026-11-04T02:00:00Z');
const race = (id, changes = {}) => ({ seed: { id }, status: 'counting', reported: 0.25, dem: 51, votes: 1000, ...changes });

test('all contests enter the ticker; identical polls and metadata refreshes do not', () => {
  const updates = new ResultUpdates();
  const first = race('GA');
  updates.add('senat', [], [first], when);
  updates.add('huset', [], [race('GA-1')], when);
  updates.add('guv', [], [first], when);
  assert.deepEqual(updates.add('senat', [first], [{ ...first, src: 'New source' }], when), []);
  assert.deepEqual([updates.take().contest, updates.take().contest, updates.take().contest], ['senat', 'huset', 'guv']);
  assert.equal(updates.take(), undefined);
});

test('a backlog keeps the newest figures without starving other races', () => {
  const updates = new ResultUpdates();
  const first = race('GA');
  updates.add('senat', [], [first, race('NC')], when);
  const revised = race('GA', { dem: 49, votes: 2000 });
  const later = new Date(when.getTime() + 60000);
  updates.add('senat', [first], [revised], later);
  assert.deepEqual(updates.take(), { contest: 'senat', race: revised, when: later });
  assert.equal(updates.take().race.seed.id, 'NC');
  assert.equal(updates.take(), undefined);
});

test('vote-only changes, calls and retracted calls are updates', () => {
  const updates = new ResultUpdates();
  let before = race('GA');
  for (const changes of [{ votes: 1001 }, { reported: 0.3 }, { status: 'called', winner: 'D' }, { status: 'counting', winner: undefined }]) {
    const after = { ...before, ...changes };
    assert.equal(updates.add('senat', [before], [after], when).length, 1);
    assert.equal(updates.take().race, after);
    before = after;
  }
});

test('waiting results, withdrawals and replay reset leave no stale pending entry', () => {
  const updates = new ResultUpdates();
  const counting = race('GA');
  const waiting = race('GA', { status: 'waiting' });
  updates.add('senat', [], [waiting], when);
  assert.equal(updates.take(), undefined);
  updates.add('senat', [waiting], [counting], when);
  updates.add('senat', [counting], [waiting], when);
  assert.equal(updates.take(), undefined);
  updates.add('senat', [], [counting], when);
  updates.clear();
  assert.equal(updates.take(), undefined);
});


test('compact copy uses district IDs, surnames, party codes and one decimal', () => {
  const r = race('FL-4', { dem: 44, reported: 0.55, seed: {
    id: 'FL-4', cand: { D: { name: 'Erika Grage' }, R: { name: 'John Rutherford' } },
  } });
  assert.equal(formatResultUpdate({ race: r }, 'huset'),
    'FL-4 (huset) Grage (D) 44.0 / Rutherford (R) 56.0, 55% opptalt');
  assert.equal(formatResultUpdate({ race: r }, 'huset', false),
    'FL-4 (huset) (D) 44.0 / (R) 56.0, 55% opptalt');
});

test('compact copy preserves actual parties, suffixes, calls and missing counts', () => {
  const r = race('ME', { votes: 0, reported: 0, status: 'called', winner: 'D', seed: {
    id: 'ME', cand: { D: { name: 'Angus King Jr.', party: 'I' }, R: null }, unopposed: 'D',
  } });
  assert.equal(formatResultUpdate({ race: r }, 'senatet'),
    'ME (senatet) Ingen stemmetall ennå · King (I) vinner');
  assert.equal(formatResultUpdate({ race: { ...r, votes: 100 } }, 'senatet'),
    'ME (senatet) King (I) uten motkandidat · King (I) vinner');
});
