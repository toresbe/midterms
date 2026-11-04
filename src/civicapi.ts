/** Production civicAPI v2 results. Reuse requires attribution: https://civicapi.org/faq */
import type { Candidate, Party, Side } from './data';
import type { RaceState } from './sim';

export type Kind = 'senat' | 'huset' | 'guv';
export const CIVIC_RACES: Record<Kind, number> = { senat: 87528, huset: 87524, guv: 87535 };
const TYPES: Record<Kind, string> = { senat: 'US Senate', huset: 'House of Representatives', guv: 'Governor' };

export interface FeedRace {
  id: string;
  /** Provider's percent_reporting, scaled to 0..1; not an expected-vote estimate. */
  reported: number;
  votes?: number;
  dem: number;
  status: RaceState['status'];
  winner?: Party;
  calledBy?: string;
  src?: string;
  candidates?: Partial<Record<Party, Candidate | null>>;
  incumbent?: Side;
  unopposed?: Party;
}
export type Feed = Partial<Record<Kind, FeedRace[]>>;

interface CivicCandidate {
  name: string;
  party: string;
  votes?: number | string;
  winner?: boolean;
  incumbent?: boolean;
  major_candidate?: boolean;
}
interface CivicRegion {
  candidates?: CivicCandidate[];
  percent_reporting?: number | string | null;
  test_data?: boolean;
}
export interface CivicRace extends CivicRegion {
  election_type: string;
  election_date: string;
  country: string;
  last_updated?: string;
  region_results: Record<string, CivicRegion>;
}

const partyCode = (party: string): Side => party === 'Democratic' ? 'D' : party === 'Republican' ? 'R' : 'I';
const LABELS: Record<string, string> = {
  Democratic: 'Demokratene', Republican: 'Republikanerne', Independent: 'Uavhengig',
  Nonpartisan: 'Partiløs', Libertarian: 'Libertarianerne', Green: 'De grønne',
};
const votes = (c: CivicCandidate) => {
  const n = Number(c.votes);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

/** Match civicAPI's district codes to the board, including at-large seats. */
export function ourId(kind: Kind, raw: string): string | null {
  const key = raw.toUpperCase();
  if (kind !== 'huset') return /^[A-Z]{2}$/.test(key) ? key : null;
  const m = /^([A-Z]{2})-(\d+|AL)$/.exec(key);
  return m ? `${m[1]}-${m[2] === 'AL' || Number(m[2]) === 0 ? 1 : Number(m[2])}` : null;
}

/** The board has two candidate slots; preserve actual parties on either side. */
function slots(candidates: CivicCandidate[]): Partial<Record<Party, CivicCandidate>> {
  const ranked = [...candidates].sort((a, b) =>
    Number(b.winner === true) - Number(a.winner === true) || votes(b) - votes(a)
    || Number(b.major_candidate === true) - Number(a.major_candidate === true)
    || Number(b.incumbent === true) - Number(a.incumbent === true));
  const D = ranked.find((c) => c.party === 'Democratic')
    ?? ranked.find((c) => c.party === 'Independent')
    ?? ranked.find((c) => c.party !== 'Republican');
  const R = ranked.find((c) => c.party === 'Republican') ?? ranked.find((c) => c !== D);
  const selected = { D: D ?? ranked.find((c) => c !== R), R };
  // A called independent/minor-party winner must not disappear behind D/R slots.
  const won = ranked.find((c) => c.winner === true);
  if (won && won !== selected.D && won !== selected.R) selected.D = won;
  return selected;
}

export function parseCivicRace(kind: Kind, race: CivicRace): FeedRace[] {
  if (race.test_data === true) throw new Error('civicAPI returned test data');
  if (race.country !== 'US' || race.election_type !== TYPES[kind]
    || !race.election_date?.startsWith('2026-11-03')
    || !race.region_results || typeof race.region_results !== 'object' || Array.isArray(race.region_results)) {
    throw new Error(`Unexpected civicAPI ${kind} payload`);
  }
  return Object.entries(race.region_results).flatMap(([key, region]) => {
    const id = ourId(kind, key);
    if (!id || region.test_data === true || !Array.isArray(region.candidates)) return [];
    const cands = region.candidates.filter((c) => typeof c.name === 'string' && c.name.trim() && typeof c.party === 'string');
    if (!cands.length) return [];
    const selected = slots(cands);
    const candidates: Record<Party, Candidate | null> = { D: null, R: null };
    for (const p of ['D', 'R'] as Party[]) {
      const c = selected[p];
      if (c) candidates[p] = { name: c.name, party: partyCode(c.party), label: LABELS[c.party] ?? c.party };
    }
    const won = cands.find((c) => c.winner === true);
    const winner = won ? (won === selected.D ? 'D' : won === selected.R ? 'R' : undefined) : undefined;
    const total = cands.reduce((sum, c) => sum + votes(c), 0);
    const dv = selected.D ? votes(selected.D) : 0;
    const rv = selected.R ? votes(selected.R) : 0;
    const count = Number(region.percent_reporting);
    const incumbent = cands.find((c) => c.incumbent === true);
    return [{ id, candidates, votes: total,
      reported: Number.isFinite(count) ? Math.max(0, Math.min(1, count / 100)) : 0,
      dem: dv + rv > 0 ? dv / (dv + rv) * 100 : 50,
      status: winner ? 'called' : total > 0 ? 'counting' : 'waiting', winner,
      calledBy: winner ? 'civicAPI' : undefined, src: 'civicAPI',
      incumbent: incumbent ? partyCode(incumbent.party) : undefined,
      unopposed: cands.length === 1 ? (selected.D ? 'D' : 'R') : undefined,
    }];
  });
}
