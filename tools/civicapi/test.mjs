import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCivicRace, ourId } from '../../src/civicapi.ts';
import { closestRaces, newlyCalledRaces } from '../../src/sim.ts';

test('announces initial calls and House holds once, plus corrected and reissued calls', () => {
  const seed = { id: 'AK-1', incumbent: 'R', cand: { D: { name: 'Dem', party: 'D' }, R: { name: 'Rep', party: 'R' } } };
  const waiting = { seed, status: 'waiting', reported: 0, dem: 50 };
  const called = { ...waiting, status: 'called', winner: 'R' };
  assert.deepEqual(newlyCalledRaces([waiting], [called]), [called]);
  assert.deepEqual(newlyCalledRaces([], [called]), [called]);
  assert.deepEqual(newlyCalledRaces([called], [{ ...called, reported: 1 }]), []);
  const corrected = { ...called, winner: 'D' };
  assert.deepEqual(newlyCalledRaces([called], [corrected]), [corrected]);
  assert.deepEqual(newlyCalledRaces([called], [waiting]), []);
  assert.deepEqual(newlyCalledRaces([waiting], [called]), [called]);
  const renamedWinner = { ...called, seed: { ...seed, cand: { ...seed.cand, R: { name: 'Replacement', party: 'R' } } } };
  assert.deepEqual(newlyCalledRaces([called], [renamedWinner]), [renamedWinner]);
});

const candidate = (name, party, votes = 0, extra = {}) => ({ name, party, votes, ...extra });
const payload = (regions, extra = {}) => ({
  country: 'US', election_type: 'House of Representatives',
  election_date: '2026-11-03T05:00:00.000Z', test_data: false,
  region_results: regions, ...extra,
});
const parse = (candidates, extra = {}) => parseCivicRace('huset', payload({
  'ak-al': { candidates, ...extra },
}))[0];

test('closest races excludes waiting placeholders, unnamed opponents and called races', () => {
  const race = (id, status, dem, named = true) => ({
    seed: { id, cand: { D: named ? { name: 'Democrat' } : null, R: named ? { name: 'Republican' } : null } }, status, dem,
  });
  const races = [race('FL', 'waiting', 50, false), race('AK', 'counting', 50, false),
    race('GA', 'counting', 52), race('NC', 'counting', 49.5), race('VA', 'called', 50)];
  assert.deepEqual(closestRaces(races).map(r => r.seed.id), ['NC', 'GA']);
  assert.deepEqual(closestRaces(races, true).map(r => r.seed.id), ['AK', 'NC', 'GA']);
  assert.deepEqual(closestRaces([races[0]]), []);
});

test('normalizes district IDs, including at-large seats and special Senate entries', () => {
  assert.equal(ourId('huset', 'ak-al'), 'AK-1');
  assert.equal(ourId('huset', 'ca-09'), 'CA-9');
  assert.equal(ourId('senat', 'fl'), 'FL');
  assert.equal(ourId('senat', 'oh'), 'OH');
  assert.equal(ourId('huset', 'not-a-district'), null);
});

test('counts all ballots but normalizes the two displayed candidates', () => {
  const r = parse([candidate('Dem', 'Democratic', '60'), candidate('Rep', 'Republican', 30), candidate('Other', 'Green', 10)], { percent_reporting: 25 });
  assert.equal(r.votes, 100);
  assert.equal(r.dem, 60 / 90 * 100);
  assert.equal(r.reported, 0.25);
  assert.equal(r.status, 'counting');
  assert.equal(r.winner, undefined);
});

test('a lead or 100% reporting never generates a call', () => {
  const r = parse([candidate('Dem', 'Democratic', 99), candidate('Rep', 'Republican', 1)], { percent_reporting: 100 });
  assert.equal(r.status, 'counting');
  assert.equal(r.calledBy, undefined);
});

test('attributes explicit calls and preserves calls at zero votes', () => {
  const r = parse([candidate('Rep', 'Republican', 0, { winner: true })]);
  assert.equal(r.status, 'called');
  assert.equal(r.winner, 'R');
  assert.equal(r.calledBy, 'civicAPI');
  assert.equal(r.candidates.D, null);
  assert.equal(r.unopposed, 'R');
});

test('independents, same-party races, and third-party winners keep their actual parties', () => {
  const independent = parse([candidate('Ind', 'Independent', 50), candidate('Rep', 'Republican', 40)]);
  assert.equal(independent.candidates.D.party, 'I');
  assert.equal(independent.candidates.D.label, 'Uavhengig');
  const sameParty = parse([candidate('First', 'Republican', 60), candidate('Second', 'Republican', 40)]);
  assert.equal(sameParty.candidates.D.name, 'Second');
  assert.equal(sameParty.candidates.D.party, 'R');
  const third = parse([candidate('Dem', 'Democratic', 20), candidate('Rep', 'Republican', 30), candidate('Ind', 'Independent', 50, { winner: true })]);
  assert.equal(third.winner, 'D');
  assert.equal(third.candidates.D.party, 'I');
});

test('rejects test data, wrong elections and malformed national responses', () => {
  assert.throws(() => parseCivicRace('huset', payload({}, { test_data: true })), /test data/);
  assert.throws(() => parseCivicRace('huset', payload({}, { election_date: '2024-11-05' })), /Unexpected/);
  assert.throws(() => parseCivicRace('senat', payload({})), /Unexpected/);
  assert.throws(() => parseCivicRace('huset', payload(null)), /Unexpected/);
  assert.equal(parse([candidate('Dem', 'Democratic', 10)], { test_data: true }), undefined);
});

test('withdrawn calls and zero-vote corrections return to waiting', () => {
  const r = parse([candidate('Dem', 'Democratic'), candidate('Rep', 'Republican')]);
  assert.equal(r.status, 'waiting');
  assert.equal(r.winner, undefined);
  assert.equal(r.reported, 0);
  assert.equal(parse([candidate('Dem', 'Democratic', 1)], { percent_reporting: 120 }).reported, 1);
});
