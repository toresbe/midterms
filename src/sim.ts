import type { Party, RaceSeed, Side } from './data';

export type Status = 'waiting' | 'counting' | 'called';

export interface RaceState {
  seed: RaceSeed;
  status: Status;
  /** Share of the expected vote counted so far, 0..1. */
  reported: number;
  /** Current Democratic share of the counted two-party vote, percent. */
  dem: number;
  winner?: Party;
  calledAt?: number;
  /** Who projected the winner, e.g. "AP" (live data only). */
  calledBy?: string;
  /** Where the numbers come from, e.g. "Georgia Secretary of State". */
  src?: string;
}

/** How much of the expected vote is counted `h` hours after polls close. */
function reportingCurve(h: number): number {
  if (h <= 0) return 0;
  return Math.min(1, 1 - Math.exp(-h / 1.4)) * (h > 6 ? 1 : 0.985);
}

/**
 * Evaluate one race at a given clock time (hours after midnight ET).
 * Deterministic: the same time always gives the same state, so the
 * timeline can be scrubbed backwards as well as forwards.
 */
export function raceAt(seed: RaceSeed, clock: number): RaceState {
  const h = clock - seed.closesET;
  const reported = reportingCurve(h);
  if (reported === 0) return { seed, status: 'waiting', reported: 0, dem: 0 };

  // Early returns lean by `skew` points and converge on the final share.
  const dem = seed.finalDem + seed.skew * (1 - reported) ** 2;
  const finalMargin = Math.abs(seed.finalDem - 50) * 2;

  // A simple call rule, standing in for a real decision desk.
  let callAt: number | undefined;
  if (finalMargin >= 16) callAt = seed.closesET; // called at poll close
  else if (finalMargin >= 6) callAt = seed.closesET + 1.2;
  else if (finalMargin >= 2) callAt = seed.closesET + 3.5;
  else if (finalMargin >= 1) callAt = seed.closesET + 5.5;
  // Under 1 point: never called tonight.

  const winner: Party = seed.finalDem > 50 ? 'D' : 'R';
  if (callAt !== undefined && clock >= callAt) {
    return { seed, status: 'called', reported, dem, winner, calledAt: callAt };
  }
  return { seed, status: 'counting', reported, dem };
}

export interface ChamberTally {
  won: Record<Side, number>;
  leading: Record<Side, number>;
  waiting: number;
}

/*
 * A race has two sides, "D" (left) and "R" (right). Usually that is the
 * Democrat and the Republican, but a side can hold a second Democrat (a
 * top-two race) or an independent. These give the real party on a side.
 */
export const partyOf = (r: RaceState, slot: Party): Side => r.seed.cand[slot]?.party ?? slot;
export const winnerParty = (r: RaceState): Side | undefined => (r.winner ? partyOf(r, r.winner) : undefined);
export const isFlip = (r: RaceState) => r.status === 'called' && winnerParty(r) !== r.seed.incumbent;

export function tally(races: RaceState[]): ChamberTally {
  const t: ChamberTally = { won: { D: 0, R: 0, I: 0 }, leading: { D: 0, R: 0, I: 0 }, waiting: 0 };
  for (const r of races) {
    if (r.status === 'called' && r.winner) t.won[winnerParty(r)!]++;
    else if (r.status === 'counting') t.leading[partyOf(r, r.dem >= 50 ? 'D' : 'R')]++;
    else t.waiting++;
  }
  return t;
}
