/** Embedded portraits first, then a bounded, retryable Wikipedia lookup. */
import { STATE_NAME, type Candidate } from './data';
import CATALOGUE from './portrait-catalogue.json';

type Portrait = { uri: string; source: string; credit: string };
const catalogue: Record<string, Portrait> = CATALOGUE;
const STORE = 'mellomvalg-portraits-v3';
const REST = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
type Entry = { url: string | null; until: number };
let cache: Record<string, Entry> = {};
try {
  const stored: unknown = JSON.parse(localStorage.getItem(STORE) ?? '{}');
  if (stored && typeof stored === 'object') {
    for (const [key, value] of Object.entries(stored)) {
      if (value && typeof value.until === 'number' && value.until > Date.now()
        && (value.url === null || (typeof value.url === 'string' && value.url.startsWith('https://')))) cache[key] = value;
    }
  }
} catch { /* blocked storage or invalid cache */ }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(cache)); } catch { /* storage full */ } };

export const isWiki = (url?: string) => !!url && /https:\/\/[^/]*wikimedia\.org\//.test(url);
type Job = { c: Candidate; state: string; statewide: boolean };
type Pending = { job: Job; candidates: Set<Candidate>; attempts: number };
const pending = new Map<string, Pending>();
const queue: string[] = [];
let running = 0;
let onFound: () => void = () => {};
let notify: ReturnType<typeof setTimeout> | undefined;
const changed = () => { clearTimeout(notify); notify = setTimeout(() => onFound(), 250); };
const keyFor = (job: Job) => `${job.c.name}|${job.state}`;
function assign(c: Candidate, url: string, credit = 'Wikipedia / Wikimedia Commons', source?: string) {
  c.photo = url;
  c.photoCredit = credit;
  c.photoSource = source;
}

async function summary(title: string): Promise<{ type?: string; title?: string; extract?: string; thumbnail?: { source: string } } | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 15_000); });
    const res = await Promise.race([fetch(REST + encodeURIComponent(title.replace(/ /g, '_'))), timeout]);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

async function lookup({ c, state }: Job): Promise<string | null> {
  for (const title of [`${c.name} (${state} politician)`, `${c.name} (American politician)`, `${c.name} (politician)`, c.name]) {
    const s = await summary(title);
    if (!s || s.type !== 'standard' || !s.title || !s.thumbnail || !/\.(?:jpe?g|png)(?:\/|$)/i.test(s.thumbnail.source)
      || /\.svg|seal|logo|flag|coat.of.arms|results.map/i.test(s.thumbnail.source)) continue;
    const words = (name: string): string[] => name.split(' (')[0].normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z]+/g) ?? [];
    const name = words(c.name), article = words(s.title);
    if (name.join(' ') !== article.join(' ') && (name.at(-1) !== article.at(-1)
      || !name.slice(0, -1).some((word) => word.length > 1 && article.includes(word)))) continue;
    // An unrelated American or a politician from another state is not a match.
    if (!(s.extract ?? '').includes(state)) continue;
    if (!/politic|candidate|senator|governor|representative|congress|attorney|commissioner|mayor/i.test(s.extract ?? '')) continue;
    return s.thumbnail.source;
  }
  return null;
}

function pump() {
  while (running < 2 && queue.length) {
    const key = queue.shift()!;
    const work = pending.get(key)!;
    running++;
    void lookup(work.job).then((url) => {
      cache[key] = { url, until: Date.now() + (url ? 7 * 86400_000 : 3600_000) };
      save();
      if (url) { for (const c of work.candidates) if (!c.photo) assign(c, url); changed(); }
      pending.delete(key);
    }, () => {
      if (++work.attempts < 3) {
        setTimeout(() => { queue.push(key); pump(); }, 30_000 * work.attempts);
      } else {
        cache[key] = { url: null, until: Date.now() + 5 * 60_000 };
        pending.delete(key);
      }
    }).finally(() => { running--; pump(); });
  }
}

/** Apply bundled photos synchronously; fresh feed objects also join pending lookups. */
export function findPortraits(jobs: Job[], found: () => void) {
  onFound = found;
  let hit = false;
  for (const job of jobs) {
    const key = keyFor(job);
    const stateCode = Object.keys(STATE_NAME).find((code) => STATE_NAME[code] === job.state) ?? job.state;
    const bundled = catalogue[`${job.c.name}|${stateCode}`];
    // Keep explicit feed photos; replace Congress URLs with their offline copy.
    if (bundled && (!job.c.photo || job.c.photo.startsWith('https://bioguide.congress.gov/photo/'))) {
      assign(job.c, bundled.uri, bundled.credit, bundled.source);
      hit = true;
    }
    if (job.c.photo) continue;
    const cached = cache[key];
    if (cached && cached.until > Date.now()) {
      if (cached.url) { assign(job.c, cached.url); hit = true; }
      continue;
    }
    const existing = pending.get(key);
    if (existing) { existing.candidates.add(job.c); continue; }
    pending.set(key, { job, candidates: new Set([job.c]), attempts: 0 });
    queue.push(key);
  }
  if (hit) changed();
  pump();
}
