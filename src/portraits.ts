/*
 * Portraits for candidates who aren't sitting members of Congress.
 *
 * Congress's own archive (bioguide) only has members, so challengers,
 * governor candidates and newcomers fall back to the lead image of their
 * English Wikipedia article. Lookups run in the browser, a few at a time,
 * and are remembered in localStorage so a restarted template doesn't ask again.
 *
 * A page is only accepted when it is an ordinary article with a photo (not a
 * seal or logo) whose opening text names the candidate's state or the race,
 * so a namesake from elsewhere isn't shown.
 * Images on Wikimedia Commons carry their own licences; the board credits
 * "Foto: Wikipedia" wherever one is on screen.
 */
import type { Candidate } from './data';

const STORE = 'mellomvalg-portraits-v2';
const REST = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

let cache: Record<string, string | null> = {};
try { cache = JSON.parse(localStorage.getItem(STORE) ?? '{}'); } catch { /* private window or blocked storage */ }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(cache)); } catch { /* ignore */ } };

const isWiki = (url?: string) => !!url && url.includes('wikimedia.org');
export { isWiki };

async function summary(title: string): Promise<{ type?: string; extract?: string; thumbnail?: { source: string } } | null> {
  const timeout = new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), 15_000));
  const res = await Promise.race([fetch(REST + encodeURIComponent(title.replace(/ /g, '_'))), timeout]);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function lookup(name: string, state: string, statewide: boolean): Promise<string | null> {
  // Most specific title first, so a disambiguated politician wins over a namesake.
  for (const t of [`${name} (${state} politician)`, `${name} (American politician)`, `${name} (politician)`, name]) {
    const s = await summary(t);
    // A photo, not a seal or logo (those are SVG or PNG drawings).
    if (!s || s.type !== 'standard' || !s.thumbnail || !/\.jpe?g\//i.test(s.thumbnail.source)) continue;
    // About this candidate, not a namesake: the article names the state or the race.
    const text = s.extract ?? '';
    if (text.includes(state) || /candidate|Senate|governor|Congress|House of Representatives/.test(text)) return s.thumbnail.source;
    // Senate and governor nominees are well known (e.g. a broadcaster turned candidate); an American with that exact name will do.
    if (statewide && t === name && /^\S.* is an American /.test(text)) return s.thumbnail.source;
  }
  return null;
}

type Job = { c: Candidate; state: string; statewide: boolean };
const queue: Job[] = [];
const seen = new Set<string>();
let running = 0;
let onFound: () => void = () => {};
let notify = 0;

function pump() {
  while (running < 3 && queue.length) {
    const job = queue.shift()!;
    const { c, state } = job;
    const key = `${c.name}|${state}`;
    running++;
    lookup(c.name, state, job.statewide)
      .then((url) => { cache[key] = url; save(); if (url && !c.photo) { c.photo = url; clearTimeout(notify); notify = window.setTimeout(onFound, 1500); } })
      // Rate limited or offline: back off, then try this one again later.
      .then(() => { running--; pump(); }, () => { queue.push(job); setTimeout(() => { running--; pump(); }, 5000); });
  }
}

/** Fill in photos for candidates without one; calls back (debounced) when any arrive. */
export function findPortraits(jobs: Job[], found: () => void) {
  onFound = found;
  let hit = false;
  for (const j of jobs) {
    if (j.c.photo) continue;
    const key = `${j.c.name}|${j.state}`;
    if (key in cache) { if (cache[key]) { j.c.photo = cache[key]!; hit = true; } continue; }
    if (seen.has(key)) continue;
    seen.add(key);
    queue.push(j);
  }
  if (hit) found();
  pump();
}
