// Produce a portrait-tool roster using exactly the candidate slots shown on air.
import { writeFile } from 'node:fs/promises';
import { CIVIC_RACES, parseCivicRace } from '../../src/civicapi.ts';

const output = process.argv[2];
if (!output) throw new Error('Usage: node --experimental-strip-types tools/civicapi/roster.mjs OUTPUT.json');
const races = {};
const updated = {};
for (const [kind, id] of Object.entries(CIVIC_RACES)) {
  const response = await fetch(`https://civicapi.org/api/v2/race/${id}`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`civicAPI ${kind}: HTTP ${response.status}`);
  const payload = await response.json();
  races[kind] = parseCivicRace(kind, payload);
  if (!races[kind].length) throw new Error(`No ${kind} races returned`);
  updated[kind] = payload.last_updated;
}
await writeFile(output, JSON.stringify({ source: 'https://civicapi.org/', updated, races }, null, 2) + '\n');
