import type { RaceState } from './sim';

export const resultSignature = (r: RaceState) => r.status === 'waiting' ? 'waiting'
  : `${r.status}|${r.winner ?? ''}|${r.reported}|${r.dem}|${r.votes ?? ''}`;

export interface ResultUpdate {
  contest: string;
  race: RaceState;
  when: Date;
}

/** Compact broadcast copy; percentages are the two displayed candidates' shares. */
export function formatResultUpdate(update: ResultUpdate, contest: string, showNames = true): string {
  const r = update.race;
  const candidate = (slot: 'D' | 'R') => {
    const c = r.seed.cand[slot];
    const party = c?.party ?? slot;
    const name = showNames && c ? c.name.trim().replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/, '').split(/\s+/).at(-1) : null;
    return name ? `${name} (${party})` : `(${party})`;
  };
  const figures = r.votes === 0 ? 'Ingen stemmetall ennå' : r.seed.unopposed
    ? `${candidate(r.seed.unopposed)} uten motkandidat`
    : `${candidate('D')} ${r.dem.toFixed(1)} / ${candidate('R')} ${(100 - r.dem).toFixed(1)}`;
  const progress = r.reported > 0 ? `, ${Math.round(r.reported * 100)}% opptalt` : '';
  const verdict = r.status === 'called' && r.winner ? ` · ${candidate(r.winner)} vinner` : '';
  return `${r.seed.id} (${contest}) ${figures}${progress}${verdict}`;
}

/** One pending entry per race, in arrival order, with its newest figures. */
export class ResultUpdates {
  private pending = new Map<string, ResultUpdate>();

  add(contest: string, before: RaceState[], after: RaceState[], when: Date): RaceState[] {
    const old = new Map(before.map((r) => [r.seed.id, resultSignature(r)]));
    const changed = after.filter((r) => r.status !== 'waiting' && resultSignature(r) !== old.get(r.seed.id));
    // Withdraw an unseen entry if a correction removes its results altogether.
    for (const r of after) if (r.status === 'waiting') this.pending.delete(`${contest}:${r.seed.id}`);
    for (const race of changed) this.pending.set(`${contest}:${race.seed.id}`, { contest, race, when });
    return changed;
  }

  take(): ResultUpdate | undefined {
    const next = this.pending.entries().next().value;
    if (!next) return;
    this.pending.delete(next[0]);
    return next[1];
  }

  clear() { this.pending.clear(); }
}
