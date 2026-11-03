// SAMPLE DATA ONLY. Every result here is invented for the prototype.
// Which party holds each seat going in is real; outcomes and margins are not.

export type Party = 'D' | 'R';
/** A candidate's actual party: Democrat, Republican, or anyone else (independents, minor parties). */
export type Side = Party | 'I';

export interface Candidate {
  name: string;
  /** Party label when it isn't the slot's party, e.g. an independent in the Democratic slot. */
  label?: string;
  /** Actual party, when it differs from the slot (a second Democrat, an independent). */
  party?: Side;
  /** Headshot URL, if the feed has one. Without it an initials disc is shown. */
  photo?: string;
}

export interface RaceSeed {
  id: string;
  /** Two-letter state code. */
  state: string;
  /** Display name, e.g. "Georgia" or "Pennsylvania 7". */
  name: string;
  /** Poll close, in hours after midnight Eastern on election day (25 = 1 am). */
  closesET: number;
  /** Party that holds the seat going in. */
  /** Party holding the seat now (an independent counts as 'I'). */
  incumbent: Side;
  /** Invented final Democratic share of the two-party vote, in percent. */
  finalDem: number;
  /** Invented early-count skew in points; fades as the count completes. */
  skew: number;
  /** Nominees; null where unknown (House names come from the feed). */
  cand: Record<Party, Candidate | null>;
}

import CANDIDATES from './candidates.json';
import POLL_DATA from './polls.json';

type CandList = Record<string, Partial<Record<Party, string | null>>>;
/** Nominees as listed on Wikipedia's 2026 Senate and governor election pages. */
function nominees(list: CandList, state: string): Record<Party, Candidate | null> {
  const n = list[state] ?? {};
  return { D: n.D ? { name: n.D } : null, R: n.R ? { name: n.R } : null };
}

export const STATE_NAME: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
  UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming',
};

/** "7:00 PM" (ET, election night) -> hours after midnight ET; "1:00 AM" -> 25. */
export function etClock(t: string): number {
  const m = /^(\d+):(\d+)\s*(AM|PM)$/i.exec(t.trim());
  if (!m) return NaN;
  const h = (Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 24);
  return h + Number(m[2]) / 60;
}

/**
 * Poll closing times per state from The People's Tally (snapshot of core.json;
 * the template refreshes it from the feed). A state's first close is when
 * results may start to appear.
 */
export const POLLS = POLL_DATA as unknown as { polls: [string, string][]; stPolls: Record<string, [string, string][]> };
const CLOSES: Record<string, number> = Object.fromEntries(
  Object.entries(POLLS.stPolls).map(([st, list]) => [st, Math.min(...list.map(([t]) => etClock(t)))]));

const seed = (kind: string) => (state: string, incumbent: Party, finalDem: number, skew: number): RaceSeed =>
  ({ id: state, state, name: STATE_NAME[state], closesET: CLOSES[state], incumbent, finalDem, skew, cand: nominees((CANDIDATES as unknown as Record<string, CandList>)[kind], state) });

// The 35 Senate seats on the 2026 ballot (33 regular + OH and FL specials).
export const SENATE_SEEDS: RaceSeed[] = ([
  ['AL', 'R', 36, 3], ['AK', 'R', 46, -2], ['AR', 'R', 33, 2], ['CO', 'D', 56, 2], ['DE', 'D', 59, -2],
  ['FL', 'R', 45, 4], ['GA', 'D', 50.6, 5], ['ID', 'R', 31, 1], ['IL', 'D', 57, -3], ['IA', 'R', 47.2, 3],
  ['KS', 'R', 42, 2], ['KY', 'R', 38, 2], ['LA', 'R', 40, 1], ['ME', 'R', 50.9, -3], ['MA', 'D', 64, -1],
  ['MI', 'D', 50.3, -4], ['MN', 'D', 53, 2], ['MS', 'R', 41, 3], ['MT', 'R', 44, 2], ['NE', 'R', 47.5, 3],
  ['NH', 'D', 51.8, -2], ['NJ', 'D', 55, -2], ['NM', 'D', 54, 1], ['NC', 'R', 50.2, 4], ['OH', 'R', 47.8, 4],
  ['OK', 'R', 32, 1], ['OR', 'D', 57, -1], ['RI', 'D', 61, -1], ['SC', 'R', 42, 2], ['SD', 'R', 33, 1],
  ['TN', 'R', 36, 2], ['TX', 'R', 46.5, 3], ['VA', 'D', 54, 4], ['WV', 'R', 30, 1], ['WY', 'R', 27, 1],
] as const).map(([s, p, f, k]) => seed('sen')(s, p, f, k));

/** Senate seats not on the ballot (real composition going in). */
export const SENATE_HOLDOVER = { D: 34, R: 31 };

// The 36 governorships on the 2026 ballot.
export const GOV_SEEDS: RaceSeed[] = ([
  ['AL', 'R', 35, 2], ['AK', 'R', 45, -2], ['AZ', 'D', 50.4, -3], ['AR', 'R', 34, 2], ['CA', 'D', 60, -3],
  ['CO', 'D', 55, 2], ['CT', 'D', 56, -2], ['FL', 'R', 44, 4], ['GA', 'R', 49.4, 5], ['HI', 'D', 63, -1],
  ['ID', 'R', 30, 1], ['IL', 'D', 56, -3], ['IA', 'R', 46, 3], ['KS', 'D', 48.6, 3], ['ME', 'D', 52.5, -2],
  ['MD', 'D', 62, -2], ['MA', 'D', 63, -1], ['MI', 'D', 49.7, -4], ['MN', 'D', 52.8, 2], ['NE', 'R', 40, 2],
  ['NV', 'R', 50.8, -3], ['NH', 'R', 48.2, -2], ['NM', 'D', 54, 1], ['NY', 'D', 56, -2], ['OH', 'R', 46, 4],
  ['OK', 'R', 33, 1], ['OR', 'D', 53, -1], ['PA', 'D', 54.5, -3], ['RI', 'D', 58, -1], ['SC', 'R', 41, 2],
  ['SD', 'R', 33, 1], ['TN', 'R', 35, 2], ['TX', 'R', 45, 3], ['VT', 'R', 42, -1], ['WI', 'D', 50.9, -4],
  ['WY', 'R', 26, 1],
] as const).map(([s, p, f, k]) => seed('gov')(s, p, f, k));

/** Governorships not on the ballot (real composition going in). */
export const GOV_HOLDOVER = { D: 6, R: 8 };

/** House seats per state (2020 apportionment). */
const SEATS: Record<string, number> = {
  AL: 7, AK: 1, AZ: 9, AR: 4, CA: 52, CO: 8, CT: 5, DE: 1, FL: 28, GA: 14, HI: 2, ID: 2, IL: 17,
  IN: 9, IA: 4, KS: 4, KY: 6, LA: 6, ME: 2, MD: 8, MA: 9, MI: 13, MN: 8, MS: 4, MO: 8, MT: 2,
  NE: 3, NV: 4, NH: 2, NJ: 12, NM: 3, NY: 26, NC: 14, ND: 1, OH: 15, OK: 5, OR: 6, PA: 17, RI: 2,
  SC: 7, SD: 1, TN: 9, TX: 38, UT: 4, VT: 1, VA: 11, WA: 10, WV: 2, WI: 8, WY: 1,
};

function mulberry32(s: number) {
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 435 House districts with invented results; real seat counts per state. */
export function houseSeeds(): RaceSeed[] {
  const rand = mulberry32(2026);
  const out: RaceSeed[] = [];
  for (const [state, n] of Object.entries(SEATS)) {
    for (let d = 1; d <= n; d++) {
      const lean = rand() < 0.12 ? (rand() - 0.5) * 12 : (rand() < 0.5 ? -1 : 1) * (8 + rand() * 30);
      const finalDem = 50 + lean + 0.4;
      const name = n === 1 ? STATE_NAME[state] : `${STATE_NAME[state]} ${d}`;
      out.push({
        id: `${state}-${d}`,
        state,
        name,
        closesET: CLOSES[state],
        incumbent: finalDem + (rand() - 0.5) * 7 > 50 ? 'D' : 'R',
        finalDem,
        skew: (rand() - 0.4) * 8,
        cand: { D: null, R: null },
      });
    }
  }
  return out;
}
