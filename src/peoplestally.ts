/*
 * The People's Tally open data (thepeoplestally.com/open-data, CC BY 4.0).
 *
 *   /data/core.json     races and candidates, one pipe-delimited line per race:
 *                       TYPE|ID|INCUMBENT|PARTY|RATING|CANDS, where CANDS is
 *                       ";"-separated "PARTY:Name[ *][#FEC~age~bio~BIOGUIDE]"
 *                       (" *" = incumbent, "!" after the party = see note below).
 *   /data/results.json  races{ "S-OH-sp" | "G-OH" | "H-OH-09": { status, exp,
 *                       cands[{name, party, votes, pct, winner}], called_by,
 *                       winner_name, asof, src, url } }
 *
 * The line format is not documented; it is read from the data. Results are
 * only "called" here when the feed marks a winner, which The People's Tally
 * does only when a named source (AP or certified results) projects one.
 */
import type { Candidate, Party, Side } from './data';
import type { RaceState } from './sim';

export type Kind = 'senat' | 'huset' | 'guv';

export interface FeedRace {
  id: string;
  /** Share of the expected vote counted, 0..1; 0 also when the feed doesn't say. */
  reported: number;
  /** Votes counted so far, when the feed gives them. */
  votes?: number;
  dem: number;
  status: RaceState['status'];
  winner?: Party;
  calledBy?: string;
  src?: string;
  candidates?: Partial<Record<Party, Candidate>>;
  /** Party holding the seat now, from core.json. */
  incumbent?: Side;
  /** Only one candidate on the ballot: the slot they fill. */
  unopposed?: Party;
}
export type Feed = Partial<Record<Kind, FeedRace[]>>;

/** "S|FL-sp" -> senat/FL, "G|AZ" -> guv/AZ, "H|NJ-06" -> huset/NJ-6. Also "S-OH-sp", "H-OH-09". */
export function ourId(type: string, raw: string): { kind: Kind; id: string } | null {
  const kind: Kind | undefined = ({ S: 'senat', G: 'guv', H: 'huset' } as const)[type as 'S' | 'G' | 'H'];
  if (!kind) return null;
  if (kind === 'huset') {
    const m = /^([A-Z]{2})-(\d+|AL)$/.exec(raw);
    if (!m) return null;
    const n = m[2] === 'AL' || Number(m[2]) === 0 ? 1 : Number(m[2]);
    return { kind, id: `${m[1]}-${n}` };
  }
  const m = /^([A-Z]{2})(-sp)?$/.exec(raw);
  return m ? { kind, id: m[1] } : null;
}

interface CoreCand { party: string; name: string; incumbent: boolean; bioguide?: string; withdrawn: boolean }

function parseCand(s: string): CoreCand | null {
  const m = /^([A-Z]+)(!?):(.*)$/.exec(s.trim());
  if (!m) return null;
  const [namePart, meta = ''] = m[3].split('#');
  const incumbent = /\s\*$/.test(namePart);
  const bioguide = meta.split('~')[3] || undefined;
  return { party: m[1], withdrawn: m[2] === '!', name: namePart.replace(/\s\*$/, '').trim(), incumbent, bioguide };
}

/** Official congressional portrait (public domain) for sitting members. */
const portrait = (id?: string) => (id ? `https://bioguide.congress.gov/photo/${id}.jpg` : undefined);

const PARTY_LABEL: Record<string, string> = { I: 'Uavhengig', L: 'Libertarianerne', G: 'De grønne', O: 'Annet parti' };

/**
 * Pick one candidate per slot. Democrats and Republicans fill their own slot;
 * where there is no Democrat, the strongest other candidate takes that slot
 * with their own party label (e.g. an independent backed in place of a Democrat).
 */
function slots<T extends { party: string; incumbent?: boolean }>(cands: T[], rank: (c: T) => number): Partial<Record<Party, T>> {
  const best = (f: (c: T) => boolean) => cands.filter(f).sort((a, b) => rank(b) - rank(a))[0];
  // Independents before minor parties: e.g. Dan Osborn in Nebraska, not a minor-party name listed first.
  const D = best((c) => c.party === 'D') ?? best((c) => c.party === 'I') ?? best((c) => c.party !== 'R');
  // No Republican (e.g. two Democrats in a California top-two race): the strongest other candidate.
  const R = best((c) => c.party === 'R') ?? best((c) => c !== D);
  // Two Republicans (e.g. California's 40th): the second one takes the left slot.
  return { D: D ?? best((c) => c !== R), R };
}

const side = (party: string): Side => (party === 'D' || party === 'R' ? party : 'I');
const LABEL: Record<string, string> = { D: 'Demokratene', R: 'Republikanerne' };

/** Candidates per race from core.json. */
export function parseCore(core: { races?: string }): Feed {
  const out: Feed = {};
  for (const line of (core.races ?? '').split('\n')) {
    const f = line.split('|');
    if (f.length < 6) continue;
    const where = ourId(f[0], f[1]);
    if (!where) continue;
    const cands = f.slice(5).join('|').split(';').map(parseCand).filter((c): c is CoreCand => !!c && !c.withdrawn);
    const s = slots(cands, (c) => (c.incumbent ? 2 : 0) + (c.bioguide ? 1 : 0));
    const candidates: Partial<Record<Party, Candidate>> = {};
    for (const p of ['D', 'R'] as Party[]) {
      const c = s[p];
      if (c) {
        candidates[p] = c.party === p
          ? { name: c.name, photo: portrait(c.bioguide) }
          : { name: c.name, photo: portrait(c.bioguide), party: side(c.party), label: LABEL[c.party] ?? PARTY_LABEL[c.party] ?? c.party };
      }
    }
    const filled = (['D', 'R'] as Party[]).filter((p) => candidates[p]);
    (out[where.kind] ??= []).push({ id: where.id, reported: 0, dem: 50, status: 'waiting', candidates,
      incumbent: /^[A-Z]+$/.test(f[3]) ? side(f[3]) : undefined, unopposed: filled.length === 1 ? filled[0] : undefined });
  }
  return out;
}

interface ResCand { name: string; party: string; votes?: number; pct?: number; winner?: boolean }
interface ResRace { status?: string; exp?: number; cands?: ResCand[]; called_by?: string | null; src?: string | null }

/** Numbers per race from results.json, as two-party shares. */
export function parseResults(res: { races?: Record<string, ResRace> }): Feed {
  const out: Feed = {};
  for (const [key, r] of Object.entries(res.races ?? {})) {
    const m = /^([SGH])-(.+)$/.exec(key);
    const where = m && ourId(m[1], m[2]);
    if (!where || !r.cands?.length) continue;
    const s = slots(r.cands, (c) => c.votes ?? 0);
    const dv = s.D?.votes ?? 0;
    const rv = s.R?.votes ?? 0;
    const total = r.cands.reduce((a, c) => a + (c.votes ?? 0), 0);
    const won = r.cands.find((c) => c.winner);
    const winner: Party | undefined = won ? (won === s.R ? 'R' : won === s.D ? 'D' : undefined) : undefined;
    const status: RaceState['status'] = winner ? 'called' : total > 0 ? 'counting' : 'waiting';
    (out[where.kind] ??= []).push({
      id: where.id,
      status,
      winner,
      reported: r.exp && r.exp > 0 ? Math.min(1, total / r.exp) : 0,
      dem: dv + rv > 0 ? (dv / (dv + rv)) * 100 : 50,
      calledBy: r.called_by ?? undefined,
      src: r.src ?? undefined,
    });
  }
  return out;
}

/*
 * /api/live: the live bundle the site itself polls. On election night the
 * numbers show up here well before /data/results.json is published.
 *
 *   { at, ev, res: { GA: { src, url, asOf, races: { "S-GA": race } } }, st: { GA: { feed, mode } } }
 *   race = { status, votes, cands: [[name, pct, votes, party, winner?]], rep: { u, t, unit }, contest }
 *
 * `rep` counts reporting units (counties, towns, precincts) and is often null;
 * there is no expected-vote figure. `ev` is early-vote data under a different
 * licence (CC BY-NC-ND) and is not used.
 */
type LiveCand = [string, number, number, string, unknown?];
interface LiveRace {
  status?: string; votes?: number; cands?: LiveCand[]; rep?: { u?: number | null; t?: number | null };
  winner?: string; called_by?: string; calledBy?: string;
}
interface Live { res?: Record<string, { src?: string; races?: Record<string, LiveRace> }>; st?: Record<string, { mode?: string }> }

/** Live party codes -> the ones core.json uses; write-ins ("") are dropped. */
const liveParty = (p: string) => (p === 'INDEPENDENT' ? 'I' : p);

/** Numbers per race from /api/live, in the same shape as parseResults. */
export function parseLive(live: Live): Feed {
  const out: Feed = {};
  for (const [st, block] of Object.entries(live.res ?? {})) {
    // Before polls close a state's feed runs "dry": anything in it is test data.
    if (live.st?.[st]?.mode === 'dry') continue;
    for (const [key, r] of Object.entries(block.races ?? {})) {
      const m = /^([SGH])-(.+)$/.exec(key);
      const where = m && ourId(m[1], m[2]);
      if (!where || !r.cands?.length) continue;
      const cands = r.cands.filter((c) => c[3]).map(([name, , votes, party, won]) => ({ name, party: liveParty(party), votes: votes ?? 0, won: !!won }));
      if (!cands.length) continue;
      const s = slots(cands, (c) => c.votes);
      const dv = s.D?.votes ?? 0;
      const rv = s.R?.votes ?? 0;
      const total = cands.reduce((a, c) => a + c.votes, 0);
      // No call seen in this feed yet; accept a winner flag on a candidate, or a named winner or party on the race.
      const w = (r.winner ?? '').toLowerCase();
      const won = cands.find((c) => c.won) ?? (w ? cands.find((c) => c.name.toLowerCase() === w || c.party.toLowerCase() === w) : undefined);
      const winner: Party | undefined = won ? (won === s.R ? 'R' : won === s.D ? 'D' : undefined) : undefined;
      const status: RaceState['status'] = winner ? 'called' : total > 0 ? 'counting' : 'waiting';
      const { u, t } = r.rep ?? {};
      (out[where.kind] ??= []).push({
        id: where.id,
        status,
        winner,
        reported: u != null && t ? Math.min(1, u / t) : 0,
        votes: total,
        dem: dv + rv > 0 ? (dv / (dv + rv)) * 100 : 50,
        calledBy: r.called_by ?? r.calledBy ?? undefined,
        src: block.src,
      });
    }
  }
  return out;
}
