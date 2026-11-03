import './style.css';
import {
  SENATE_SEEDS, SENATE_HOLDOVER, GOV_SEEDS, GOV_HOLDOVER, houseSeeds, STATE_NAME, POLLS, etClock,
  type Party, type RaceSeed, type Candidate, type Side,
} from './data';
import { raceAt, tally, partyOf, winnerParty, isFlip, type ChamberTally, type RaceState } from './sim';
import { parseCore, parseResults, type Feed } from './peoplestally';
import { findPortraits, isWiki } from './portraits';
import { FACTS, NORWAY_KM2 } from './states';
import FLAGS from './flags.json';
import NATURE_DATA from './nature.json';
import US from 'us-atlas/states-10m.json';
import { feature } from 'topojson-client';
import { geoAlbersUsa, geoCentroid, geoConicEqualArea, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection } from 'geojson';

/* =================================================================== setup */

const q = new URLSearchParams(location.search);
/**
 * waiting: real clock, real nominees, no numbers until results are pushed (default).
 * demo:    replays an invented night to show the motion; candidate names are
 *          hidden so no real person is ever shown next to an invented result.
 * live:    results pushed with update().
 */
let mode: 'waiting' | 'demo' | 'live' =
  q.get('demo') === '1' || (window as unknown as { MELLOMVALG_DEMO?: boolean }).MELLOMVALG_DEMO ? 'demo' : 'waiting';
const START = 18.75;
const END = 26.5;
const SPEED = Number(q.get('speed')) || 2; // simulated minutes per real second
const TICK_MS = 3000; // how often the sample feed delivers a new count
const HOLD_MS = (Number(q.get('hold')) || 9) * 1000; // per subpage
const ROWS = 4;
const ROW_STEP = 68;

const NAME: Record<Party, string> = { D: 'Demokratene', R: 'Republikanerne' };
/** Who a seat is won from: "vinner setet fra …". */
const FROM: Record<Side, string> = { D: 'demokratene', R: 'republikanerne', I: 'en uavhengig' };
const ABBR: Record<Party, string> = { D: 'Dem.', R: 'Rep.' };

type Key = 'senat' | 'huset' | 'guv';
/** Tabs: the three contests, then poll closings and state fact sheets. */
type TabKey = Key | 'stenger' | 'stater';
type Sub = 'oversikt' | 'jevne' | 'skifter';
const SUBS: Sub[] = ['oversikt', 'jevne', 'skifter'];
const SUB_LABEL: Record<string, string> = {
  oversikt: 'Oversikt', jevne: 'Jevneste løp', skifter: 'Skifter parti',
  neste: 'Neste', fakta: 'Fakta', fugl: 'Delstatsfugl', blomst: 'Delstatsblomst', visste: 'Visste du?',
};
const TAB_SUBS: Record<TabKey, string[]> = {
  senat: SUBS, huset: SUBS, guv: SUBS, stenger: ['neste'], stater: ['fakta', 'fugl', 'blomst', 'visste'],
};
const TAB_KEYS = Object.keys(TAB_SUBS) as TabKey[];
const isContest = (k: TabKey): k is Key => k === 'senat' || k === 'huset' || k === 'guv';

interface Contest {
  key: Key;
  tab: string;
  /** Used in sentences: "flertall i Senatet". */
  the: string;
  short: string;
  seeds: RaceSeed[];
  held: Record<Party, number>;
  total: number;
  /** Seats needed for control; null where there is no chamber to control. */
  need: Record<Party, number> | null;
}
const CONTESTS: Contest[] = [
  { key: 'senat', tab: 'Senatet', the: 'Senatet', short: 'Senatet', seeds: SENATE_SEEDS, held: SENATE_HOLDOVER, total: 100, need: { D: 51, R: 50 } },
  { key: 'huset', tab: 'Representantenes hus', the: 'Representantenes hus', short: 'Huset', seeds: houseSeeds(), held: { D: 0, R: 0 }, total: 435, need: { D: 218, R: 218 } },
  { key: 'guv', tab: 'Guvernører', the: 'guvernørvalgene', short: 'Guvernør', seeds: GOV_SEEDS, held: GOV_HOLDOVER, total: 50, need: null },
];
const C = Object.fromEntries(CONTESTS.map((c) => [c.key, c])) as Record<Key, Contest>;

/* ================================================================ formats */

const nb1 = (n: number) => n.toFixed(1).replace('.', ',');
const pct1 = (n: number) => `${nb1(n)} %`;
const pct0 = (n: number) => `${Math.round(n)} %`;

/** Sample clock: hours after midnight ET on 3 Nov 2026 (ET = UTC-5 that day). */
const simDate = (t: number) => new Date(Date.UTC(2026, 10, 3, 5, 0) + t * 3600e3);
const US_ZONES: [string, string][] = [
  ['New York', 'America/New_York'], ['Chicago', 'America/Chicago'], ['Denver', 'America/Denver'],
  ['Los Angeles', 'America/Los_Angeles'], ['Alaska', 'America/Anchorage'], ['Hawaii', 'Pacific/Honolulu'],
];
const usFmt = new Map(US_ZONES.map(([, z]) => [z, new Intl.DateTimeFormat('en-US', { timeZone: z, hour: 'numeric', minute: '2-digit', hour12: true })]));
const osloFmt = new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const etFmt = usFmt.get('America/New_York')!;
/** Zone abbreviation at a given moment, e.g. EST/EDT, AKST, HST, CET/CEST. */
const abbrFmt = new Map([...US_ZONES.map(([, z]) => [z, 'en-US'] as const), ['Europe/Oslo', 'en-GB'] as const]
  .map(([z, loc]) => [z, new Intl.DateTimeFormat(loc, { timeZone: z, timeZoneName: 'short' })]));
const abbr = (z: string, d: Date) => abbrFmt.get(z)!.formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? '';

/* ================================================================== frame */

const frame = document.getElementById('frame')!;
frame.innerHTML = `
<div class="safe">
  <div class="notice"><span class="l1">Ordinære sendinger utgår &ndash; se <b>frikanalen.no/protest</b> for informasjon</span><span class="l2" id="service">Vi viser valgdata fra People&rsquo;s Tally som en tjeneste til våre seere</span></div>
  <header class="head">
    <div class="title">Mellomvalg</div>
    <nav class="tabs" id="tabs">
      ${CONTESTS.map((c) => `<span class="tab" data-k="${c.key}">${c.tab}</span>`).join('')}
      <span class="ind" id="ind"></span>
    </nav>
  </header>
  <div class="subnav" id="subnav">
    <div class="subs" id="subs"></div>
    <div class="credit"><span class="sample" id="sample">Eksempeldata</span><span id="source">Oppdiktede tall og kandidater</span></div>
  </div>
  <div class="pages" id="pages"></div>
  <div class="latest" id="latest"></div>
  <div class="take" id="take"></div>
  <footer class="clocks" id="clocks">
    ${US_ZONES.map(([city, z]) => `<div class="clk"><span>${city} <em data-a="${z}"></em></span><b class="num" data-z="${z}"></b></div>`).join('')}
    <div class="clk station"><span>Oslo <em data-a="Europe/Oslo"></em></span><b class="num" id="oslo"></b><i class="ping" id="ping"></i></div>
  </footer>
</div>`;

const $ = (id: string) => document.getElementById(id)!;

function fit() {
  const s = Math.min(innerWidth / 1280, innerHeight / 720);
  frame.style.transform = `translate(${(innerWidth - 1280 * s) / 2}px, ${(innerHeight - 720 * s) / 2}px) scale(${s})`;
}
addEventListener('resize', fit);
fit();

function setClocks(d: Date) {
  frame.querySelectorAll<HTMLElement>('[data-z]').forEach((el) => { el.textContent = usFmt.get(el.dataset.z!)!.format(d); });
  $('oslo').textContent = osloFmt.format(d);
  frame.querySelectorAll<HTMLElement>('[data-a]').forEach((el) => { el.textContent = abbr(el.dataset.a!, d); });
}

/** Tween the number shown in `el` to `to`, formatted by `fmt`. */
const tweens = new WeakMap<HTMLElement, number>();
function countTo(el: HTMLElement, to: number, fmt: (n: number) => string = (n) => String(Math.round(n)), ms = 900) {
  const from = Number(el.dataset.v ?? to);
  el.dataset.v = String(to);
  cancelAnimationFrame(tweens.get(el) ?? 0);
  if (from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    el.textContent = fmt(from + (to - from) * (1 - (1 - k) ** 3));
    if (k < 1) tweens.set(el, requestAnimationFrame(step));
  };
  tweens.set(el, requestAnimationFrame(step));
}
const nextFrame = (f: () => void) => requestAnimationFrame(() => requestAnimationFrame(f));

/* ================================================================= model */

type Snapshot = { when: Date; races: Record<Key, RaceState[]>; quiet?: boolean };

function seats(c: Contest, t: ChamberTally) {
  const D = c.held.D + t.won.D;
  const R = c.held.R + t.won.R;
  const projD = D + t.leading.D;
  const projR = R + t.leading.R;
  let control: Party | null = null;
  let lean: Party | null = null;
  if (c.need) {
    control = D >= c.need.D ? 'D' : R >= c.need.R ? 'R' : null;
    lean = control ?? (projD >= c.need.D ? 'D' : projR >= c.need.R ? 'R' : null);
  } else {
    lean = projD > projR ? 'D' : projR > projD ? 'R' : null;
  }
  return { D, R, open: c.total - D - R - t.won.I, control, lean, projD, projR };
}

const flips = (rs: RaceState[]) => rs.filter(isFlip);
/** Colour token for a side's real party: d, r or i. */
const col = (r: RaceState, slot: Party) => partyOf(r, slot).toLowerCase();
/** "Demokratene" / "Republikanerne", or an independent's own name. */
function sideName(r: RaceState, slot: Party): string {
  const p: Side = partyOf(r, slot);
  return p === 'I' ? (r.seed.cand[slot]?.name ?? 'Uavhengig kandidat') : NAME[p];
}

/* ================================================================ pages */

interface View { c: Contest; el: Record<Sub, HTMLElement>; rows: Map<string, HTMLElement>; lingering: Map<string, { until: number; index: number; race: RaceState }>; lastOrder: string[]; say: string; flipIds: string }
const views = {} as Record<Key, View>;

for (const c of CONTESTS) {
  const el = {} as Record<Sub, HTMLElement>;
  for (const s of SUBS) {
    const p = document.createElement('section');
    p.className = 'page';
    $('pages').appendChild(p);
    el[s] = p;
  }
  // Senate: the line sits half a seat past the threshold, so it reads right
  // from either end (51 from the left, 50 from the right). Same for 218.
  const mark = c.need ? ((c.total - c.need.R + c.need.D) / 2 / c.total) * 100 : null;
  el.oversikt.innerHTML = `
    <div class="say"></div>
    <div class="ov">
      <div class="blk">
        <div class="nums">
          <div class="side d"><span class="lab">${NAME.D}</span><span class="n num" data-k="D">0</span></div>
          <div class="need">${c.need ? `${c.need.D} for flertall` : `${c.total} delstater`}</div>
          <div class="side r"><span class="lab">${NAME.R}</span><span class="n num" data-k="R">0</span></div>
        </div>
        <div class="bar">
          <span class="seg d"></span><span class="seg dl"></span><span class="seg i"></span><span class="seg rl"></span><span class="seg r"></span>
          ${mark !== null ? `<span class="mark" style="left:${mark}%"></span>` : ''}
        </div>
        <div class="status"></div>
      </div>
      <div class="stats">
        <div class="stat"><span class="k">Avgjort i kveld</span><span class="v num" data-k="called">0</span></div>
        <div class="stat"><span class="k">Skifter til Dem.</span><span class="v d num" data-k="flipD">0</span></div>
        <div class="stat"><span class="k">Skifter til Rep.</span><span class="v r num" data-k="flipR">0</span></div>
      </div>
    </div>`;
  el.jevne.innerHTML = `<div class="rows"></div><div class="empty" hidden>Alle løp er avgjort.</div>`;
  el.skifter.innerHTML = `<div class="rows"></div><div class="empty">Ingen ${c.key === 'guv' ? 'guvernørseter' : 'seter'} har skiftet parti ennå.</div>`;
  views[c.key] = { c, el, rows: new Map(), lingering: new Map(), lastOrder: [], say: '', flipIds: '' };
}

function renderOverview(v: View, rs: RaceState[]) {
  const c = v.c;
  const t = tally(rs);
  const s = seats(c, t);
  const p = v.el.oversikt;
  countTo(p.querySelector<HTMLElement>('[data-k="D"]')!, s.D);
  countTo(p.querySelector<HTMLElement>('[data-k="R"]')!, s.R);
  const called = rs.filter((r) => r.status === 'called').length;
  const f = flips(rs);
  countTo(p.querySelector<HTMLElement>('[data-k="called"]')!, called, (n) => `${Math.round(n)} av ${rs.length}`);
  countTo(p.querySelector<HTMLElement>('[data-k="flipD"]')!, f.filter((r) => winnerParty(r) === 'D').length);
  countTo(p.querySelector<HTMLElement>('[data-k="flipR"]')!, f.filter((r) => winnerParty(r) === 'R').length);

  const w = (n: number) => `${(n / c.total) * 100}%`;
  const [d, dl, ind, rl, r] = p.querySelectorAll<HTMLElement>('.seg');
  // Seats won by independents sit between the two parties.
  ind.style.left = w(s.D + t.leading.D); ind.style.width = w(t.won.I);
  d.style.left = '0%'; d.style.width = w(s.D);
  dl.style.left = w(s.D); dl.style.width = w(t.leading.D);
  r.style.left = `calc(100% - ${w(s.R)})`; r.style.width = w(s.R);
  rl.style.left = `calc(100% - ${w(s.R + t.leading.R)})`; rl.style.width = w(t.leading.R);

  const status = p.querySelector('.status')!;
  const blk = p.querySelector<HTMLElement>('.blk')!;
  if (s.control) {
    status.innerHTML = `<span class="won" style="color:var(--${s.control.toLowerCase()}-ink)">${NAME[s.control]} har flertall</span>`;
  } else if (c.need) {
    status.innerHTML = `<b>${s.open}</b> ikke avgjort${t.won.I ? ` &middot; <b>${t.won.I}</b> uavhengig` : ''} &middot; ${ABBR.D} trenger <b>${c.need.D - s.D}</b>, ${ABBR.R} trenger <b>${c.need.R - s.R}</b>`;
  } else {
    const open = rs.length - called;
    status.innerHTML = open ? `<b>${open}</b> av ${rs.length} valg ikke avgjort` : `Alle ${rs.length} valg er avgjort`;
  }
  blk.style.setProperty('--ctl', s.control ? `var(--${s.control.toLowerCase()})` : 'transparent');
  blk.style.setProperty('--ctl-x', s.control ? '1' : '0');

  // One plain sentence on where things stand.
  const anyCounted = rs.some((x) => x.status !== 'waiting');
  const cls = (x: Party) => x.toLowerCase();
  let say: string;
  if (!anyCounted) say = 'Ingen resultater ennå';
  else if (c.need && s.control) say = `<span class="${cls(s.control)}">${NAME[s.control]}</span> får flertall i ${c.the}`;
  else if (c.need && s.lean) say = `${c.the} heller mot <span class="${cls(s.lean)}">${NAME[s.lean]}</span>`;
  else if (c.need) say = 'For jevnt til å si hvem som får flertall';
  else if (rs.every((x) => x.status === 'called')) say = `<span class="${cls(s.D > s.R ? 'D' : 'R')}">${NAME[s.D > s.R ? 'D' : 'R']}</span> får ${Math.max(s.D, s.R)} guvernører`;
  else if (s.lean) say = `<span class="${cls(s.lean)}">${NAME[s.lean]}</span> ligger an til flest guvernører`;
  else say = 'Jevnt om guvernørene';
  if (say !== v.say) {
    v.say = say;
    const box = p.querySelector('.say')!;
    box.querySelectorAll('.line').forEach((old) => { old.classList.add('out'); setTimeout(() => old.remove(), 500); });
    const line = document.createElement('span');
    line.className = 'line in';
    line.innerHTML = say;
    box.appendChild(line);
    nextFrame(() => line.classList.remove('in'));
  }
}

const initials = (n: string) => n.split(/\s+/).filter((w) => /^[A-ZÆØÅ]/.test(w)).map((w) => w[0]).slice(0, 2).join('');
/** The nominee to show, or null: unknown, or hidden in demo mode. */
const who = (r: RaceState, p: Party): Candidate | null => (mode === 'demo' ? null : r.seed.cand[p]);
function photo(c: Candidate | null, p: Party, cls = '', party: Side = p) {
  // Initials sit under the photo, so a portrait that fails to load leaves them showing.
  const inner = `${c ? initials(c.name) : p}${c?.photo ? `<img src="${c.photo}" alt="" onerror="this.remove()">` : ''}`;
  return `<span class="ph ${party.toLowerCase()} ${cls}" data-slot="${p}">${inner}</span>`;
}
const surname = (c: Candidate | null, p: Party) =>
  c ? c.name.replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/, '').split(/\s+/).slice(-1)[0] : `${ABBR[p]} kandidat`;
/** No one on the ballot in this slot (known from core.json, so never in demo mode). */
const noCand = (r: RaceState, p: Party) => mode !== 'demo' && !!r.seed.unopposed && r.seed.unopposed !== p;
const NO_CAND = 'Uten motkandidat';
const slotPhoto = (r: RaceState, p: Party) => (noCand(r, p) ? `<span class="ph none" data-slot="${p}"></span>` : photo(who(r, p), p, '', partyOf(r, p)));
const slotName = (r: RaceState, p: Party) => (noCand(r, p) ? NO_CAND : surname(who(r, p), p));

/** Hours after midnight ET on election day, for a real moment. */
const etHours = (d: Date) => (d.getTime() - Date.UTC(2026, 10, 3, 5, 0)) / 3600e3;
let nowET = 0;
function closeLabel(r: RaceState) {
  return nowET >= r.seed.closesET
    ? 'Venter på tall'
    : `Stenger ${etFmt.format(simDate(r.seed.closesET))} ${abbr('America/New_York', simDate(r.seed.closesET))}`;
}

function rowFor(v: View, r: RaceState): HTMLElement {
  let el = v.rows.get(r.seed.id);
  if (el) return el;
  el = document.createElement('div');
  el.className = 'row enter';
  el.innerHTML = `
    <span class="wipe"></span>
    <span class="nm">${r.seed.name}</span>
    ${photo(who(r, 'D'), 'D')}
    <span class="cn d"><span class="who">${surname(who(r, 'D'), 'D')}</span><span class="pc num"></span></span>
    <span class="mini"><span class="md"></span><span class="mr"></span><span class="half"></span></span>
    <span class="cn r"><span class="who">${surname(who(r, 'R'), 'R')}</span><span class="pc num"></span></span>
    ${photo(who(r, 'R'), 'R')}
    <span class="ct num"></span>
    <span class="wait"></span>
    <span class="verdict"></span>`;
  v.el.jevne.querySelector('.rows')!.appendChild(el);
  v.rows.set(r.seed.id, el);
  return el;
}

function paintRow(el: HTMLElement, r: RaceState) {
  // Names and photos can arrive after the row was built (core.json loads in the background).
  const ck = JSON.stringify([who(r, 'D'), who(r, 'R'), r.seed.unopposed]);
  if (el.dataset.cand !== ck) {
    el.dataset.cand = ck;
    for (const p of ['D', 'R'] as Party[]) {
      el.querySelector(`.ph[data-slot="${p}"]`)!.outerHTML = slotPhoto(r, p);
      el.querySelector(`.cn.${p.toLowerCase()} .who`)!.textContent = slotName(r, p);
      el.querySelector(`.cn.${p.toLowerCase()}`)!.classList.toggle('none', noCand(r, p));
    }
    // Each side in its own party's colour; two from the same party: the right one lighter.
    const same = partyOf(r, 'D') === partyOf(r, 'R');
    el.style.setProperty('--lc', `var(--${col(r, 'D')})`);
    el.style.setProperty('--rc', `var(--${col(r, 'R')}${same ? '-soft' : ''})`);
    el.style.setProperty('--lci', `var(--${col(r, 'D')}-ink)`);
    el.style.setProperty('--rci', `var(--${col(r, 'R')}-ink)`);
  }
  el.classList.toggle('waiting', r.status === 'waiting');
  if (r.status !== 'called') el.classList.remove('called');
  if (r.status === 'waiting') { el.querySelector('.wait')!.innerHTML = closeLabel(r); return; }
  const [dv, rv] = el.querySelectorAll<HTMLElement>('.cn .pc');
  countTo(dv, r.dem, pct1, 700);
  countTo(rv, 100 - r.dem, pct1, 700);
  countTo(el.querySelector<HTMLElement>('.ct')!, r.reported * 100, (n) => `${pct0(n)} talt`, 700);
  // Each side grows from its own end; the gap in the middle is the vote not yet counted.
  const share = r.reported * 100;
  (el.querySelector('.md') as HTMLElement).style.width = `${(r.dem / 100) * share}%`;
  (el.querySelector('.mr') as HTMLElement).style.width = `${((100 - r.dem) / 100) * share}%`;
  if (r.status === 'called' && r.winner && !el.classList.contains('called')) {
    const flip = isFlip(r);
    el.style.setProperty('--call', `var(--${col(r, r.winner)})`);
    // Two candidates from one party (e.g. a California top-two race): name the winner instead.
    const same = partyOf(r, 'D') === partyOf(r, 'R');
    el.querySelector('.verdict')!.innerHTML = `${flip ? '<span class="tagflip">Skifte</span>' : ''}${same ? `${r.seed.cand[r.winner]?.name ?? sideName(r, r.winner)} vinner` : `${sideName(r, r.winner)} ${flip ? 'vinner' : 'beholder'}`}`;
    el.classList.add('called');
  }
}

function renderClosest(v: View, rs: RaceState[], now: number) {
  const byId = new Map(rs.map((r) => [r.seed.id, r]));
  // A row that was on screen and is now called stays a moment, so the call is seen.
  for (const id of v.lastOrder) {
    const r = byId.get(id)!;
    if (r.status === 'called' && !v.lingering.has(id)) v.lingering.set(id, { until: now + 4500, index: v.lastOrder.indexOf(id), race: r });
  }
  for (const [id, l] of v.lingering) if (now > l.until) v.lingering.delete(id);

  const counting = rs.filter((r) => r.status === 'counting' && !v.lingering.has(r.seed.id))
    .sort((a, b) => Math.abs(a.dem - 50) - Math.abs(b.dem - 50));
  const waiting = rs.filter((r) => r.status === 'waiting')
    .sort((a, b) => a.seed.closesET - b.seed.closesET || a.seed.name.localeCompare(b.seed.name));
  const order = [...counting, ...waiting];
  for (const l of [...v.lingering.values()].sort((a, b) => a.index - b.index)) order.splice(Math.min(l.index, order.length), 0, l.race);
  const shown = order.slice(0, ROWS);
  const ids = new Set(shown.map((r) => r.seed.id));

  shown.forEach((r, i) => {
    const el = rowFor(v, r);
    const y = i * ROW_STEP;
    if (el.classList.contains('enter')) {
      el.style.transform = `translateY(${y + 22}px)`;
      nextFrame(() => { el.classList.remove('enter'); el.style.transform = `translateY(${y}px)`; });
    } else {
      el.style.transform = `translateY(${y}px)`;
    }
    paintRow(el, r);
  });
  for (const [id, el] of v.rows) {
    if (ids.has(id) || el.classList.contains('leave')) continue;
    el.classList.add('leave');
    setTimeout(() => { el.remove(); v.rows.delete(id); }, 600);
  }
  v.lastOrder = shown.filter((r) => r.status === 'counting' || v.lingering.has(r.seed.id)).map((r) => r.seed.id);
  v.el.jevne.querySelector<HTMLElement>('.empty')!.hidden = shown.length > 0;
}

function renderFlips(v: View, rs: RaceState[]) {
  const f = flips(rs).sort((a, b) => (b.calledAt ?? 0) - (a.calledAt ?? 0));
  const ids = f.slice(0, ROWS).map((r) => r.seed.id).join();
  v.el.skifter.querySelector<HTMLElement>('.empty')!.hidden = f.length > 0;
  const cnt = $('subnav').querySelector<HTMLElement>('[data-s="skifter"] .cnt');
  if (cnt && current.key === v.c.key) cnt.textContent = f.length ? ` (${f.length})` : '';
  if (ids === v.flipIds) return;
  v.flipIds = ids;
  const box = v.el.skifter.querySelector('.rows')!;
  box.innerHTML = f.slice(0, ROWS).map((r, i) => `
    <div class="row settled" style="transform:translateY(${i * ROW_STEP}px)">
      <span class="nm">${r.seed.name}</span>
      <span class="note"><b style="color:var(--${col(r, r.winner!)}-ink)">${sideName(r, r.winner!)}</b> vinner fra ${FROM[r.seed.incumbent]} &middot; ${pct1(r.winner === 'D' ? r.dem : 100 - r.dem)}</span>
    </div>`).join('');
}

/* ==================================================== poll closing times */

const FLAG = FLAGS as Record<string, string>;
const flagImg = (st: string, cls = 'flag') => (FLAG[st] ? `<img class="${cls}" src="${FLAG[st]}" alt="">` : `<span class="${cls} noflag"></span>`);
/** ET hours on election night -> a Date. */
const etDate = (h: number) => new Date(Date.UTC(2026, 10, 3, 5, 0) + h * 3600e3);
/** People's Tally notes on split states, in Norwegian. */
const PART: Record<string, string> = { most: 'det meste', latest: 'de siste' };
const partNote = (n: string) => (n ? PART[n] ?? 'delvis' : '');

interface Closing { et: number; label: string; states: { st: string; note: string }[] }
function closings(): Closing[] {
  return POLLS.polls.map(([t, list]) => ({
    et: etClock(t),
    label: t,
    states: list.split(',').map((x) => /^\s*([A-Z]{2})\s*(?:\((.*)\))?/.exec(x)).filter((m): m is RegExpExecArray => !!m && !!STATE_NAME[m[1]])
      .map((m) => ({ st: m[1], note: m[2] ?? '' })),
  })).filter((c) => !Number.isNaN(c.et)).sort((a, b) => a.et - b.et);
}
/** The night's clock: the replay clock in demo mode, otherwise now. */
const nightET = () => (mode === 'demo' ? clock : etHours(new Date()));
const closingsLeft = () => closings().some((c) => c.et > nightET());

/** What a state has on the ballot tonight, from the race lists. */
function ballot(st: string) {
  const sen = C.senat.seeds.filter((s) => s.state === st).length;
  const gov = C.guv.seeds.some((s) => s.state === st);
  const house = C.huset.seeds.filter((s) => s.state === st).length;
  return { sen, gov, house };
}
const ballotText = (st: string) => {
  const b = ballot(st);
  const parts = [b.sen === 2 ? 'to senatsvalg' : b.sen ? 'senatsvalg' : '', b.gov ? 'guvernørvalg' : '', `${b.house} ${b.house === 1 ? 'sete' : 'seter'} i Huset`].filter(Boolean);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} og ${parts.at(-1)}` : parts[0];
};
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function untilText(h: number) {
  const min = Math.round((h - nightET()) * 60);
  if (min <= 0) return 'stenger nå';
  return `om ${min >= 60 ? `${Math.floor(min / 60)} t ` : ''}${min % 60} min`;
}

/** Credit line at the foot of a page. */
const pageCredit = (t: string) => `<div class="pcredit">${t}</div>`;

/** Poll closings on one page: the next closing on top, the rest of the night underneath. */
function renderClosings() {
  const all = closings();
  const now = nightET();
  const next = all.find((c) => c.et > now);
  const page = extra.stenger.neste;
  if (!next) { page.innerHTML = `<div class="empty">Alle valglokaler er stengt.</div>`; return; }
  const sts = next.states;
  const uniq = [...new Set(sts.map((s) => s.st))];
  const sen = uniq.reduce((a, s) => a + ballot(s).sen, 0);
  const gov = uniq.filter((s) => ballot(s).gov).length;
  const house = uniq.reduce((a, s) => a + ballot(s).house, 0);
  const many = sts.length > 12;
  const later = all.filter((c) => c.et > next.et);
  page.innerHTML = `
    <div class="cl">
      <div class="cl-head">
        <span class="cl-when num">${osloFmt.format(etDate(next.et))}</span>
        <span class="cl-et">${etFmt.format(etDate(next.et))} ${abbr('America/New_York', etDate(next.et))}</span>
        <span class="cl-in">${untilText(next.et)}</span>
        <span class="cl-sum">${sts.length} ${sts.length === 1 ? 'delstat' : 'delstater'}${sen ? ` &middot; ${sen} senatsvalg` : ''}${gov ? ` &middot; ${gov} guvernørvalg` : ''} &middot; ${house} husseter</span>
      </div>
      <div class="cl-grid${many ? ' many' : ''}">
        ${sts.map((s) => `<div class="chip">${flagImg(s.st)}<span class="n">${STATE_NAME[s.st]}${s.note && many ? '*' : ''}</span>${s.note && !many ? `<span class="pt">${partNote(s.note)}</span>` : ''}</div>`).join('')}
      </div>
      ${later.length ? `<div class="cl-later">
        <span class="k">Senere</span>
        ${later.map((c) => `<div class="tlc" style="flex-grow:${Math.max(3, c.states.length)}"><b class="num">${osloFmt.format(etDate(c.et))}</b><span class="sts">${c.states.map((s) => s.st + (s.note ? '*' : '')).join(' ')}</span></div>`).join('')}
      </div>` : ''}
      ${pageCredit('Norsk tid &middot; * delvis (flere tidssoner) &middot; Kilde: The People&rsquo;s Tally')}
    </div>`;
}

/* ===================================================== state fact sheets */

const ABBR_OF = Object.fromEntries(Object.entries(STATE_NAME).map(([a, n]) => [n, a]));
const usTopo = US as unknown as Parameters<typeof feature>[0] & { objects: { states: Parameters<typeof feature>[1] } };
const US_FC = feature(usTopo, usTopo.objects.states) as unknown as FeatureCollection;
const SHAPES = new Map(US_FC.features.filter((f) => ABBR_OF[f.properties?.name]).map((f) => [ABBR_OF[f.properties!.name] as string, f]));
const locator = geoAlbersUsa().fitSize([200, 128], { type: 'FeatureCollection', features: [...SHAPES.values()] });

function silhouette(f: Feature, w: number, h: number) {
  const [lon, lat] = geoCentroid(f);
  const p = geoConicEqualArea().parallels([lat - 4, lat + 4]).rotate([-lon, 0]).fitExtent([[8, 8], [w - 8, h - 8]], f);
  return geoPath(p)(f) ?? '';
}

const STATE_ORDER = Object.keys(FACTS);
let pendingState: string | null = null;
const shownStates = new Set<string>();

/** Next state for the fact sheets: states whose polls close next go first. */
function nextState() {
  let st = pendingState;
  pendingState = null;
  if (!st) {
    const now = nightET();
    const order = (s: string) => { const t = Math.min(...(POLLS.stPolls[s] ?? []).map(([x]) => etClock(x))); return t > now ? t : t + 100; };
    let pool = STATE_ORDER.filter((s) => !shownStates.has(s));
    if (!pool.length) { shownStates.clear(); pool = STATE_ORDER.slice(); }
    st = pool.sort((a, b) => order(a) - order(b) || a.localeCompare(b))[0];
  }
  shownStates.add(st);
  renderState(st);
}

const nbInt = (n: number) => Math.round(n).toLocaleString('nb-NO').replace(/ /g, ' ');
const people = (n: number) => (n >= 1e6 ? `${nb1(n / 1e6)} mill.` : `${nbInt(Math.round(n / 1000) * 1000)}`);

function renderState(st: string) {
  const f = FACTS[st];
  const shape = SHAPES.get(st);
  const close = Math.min(...(POLLS.stPolls[st] ?? []).map(([x]) => etClock(x)));
  const ratio = f.area / NORWAY_KM2;
  const norway = ratio >= 1.15 ? `${nb1(ratio)} × Fastlands-Norge` : ratio >= 0.85 ? 'omtrent som Fastlands-Norge' : `${Math.round(ratio * 100)} % av Fastlands-Norge`;
  const loc = geoPath(locator);
  extra.stater.fakta.innerHTML = `
    <div class="fs">
      <div class="fs-map">${shape ? `<svg viewBox="0 0 250 236"><path d="${silhouette(shape, 250, 236)}"/></svg>` : ''}</div>
      <div class="fs-main">
        <div class="fs-head">${flagImg(st, 'flag big')}<div><div class="fs-name">${STATE_NAME[st]}</div><div class="fs-nick">&laquo;${f.nick}&raquo;</div></div></div>
        <div class="fs-stats">
          <div><span class="k">Hovedstad</span><b>${f.capital}</b></div>
          <div><span class="k">Største by</span><b>${f.largest}</b></div>
          <div><span class="k">Innbyggere</span><b class="num">${people(f.pop)}</b></div>
          <div><span class="k">Areal</span><b class="num">${nbInt(f.area)} km²</b><small>${norway}</small></div>
          <div><span class="k">Delstat siden</span><b class="num">${f.joined}</b><small>som nr. ${f.order}</small></div>
          <div><span class="k">Valglokalene stenger</span><b class="num">${Number.isFinite(close) ? osloFmt.format(etDate(close)) : '&ndash;'}</b><small>norsk tid</small></div>
        </div>
        ${pageCredit('Kart: US Census Bureau &middot; Flagg: Wikimedia Commons')}
      </div>
      <div class="fs-loc"><svg viewBox="0 0 200 128">
        ${[...SHAPES].map(([a, s]) => `<path class="${a === st ? 'on' : ''}" d="${loc(s) ?? ''}"/>`).join('')}
        ${shape && f.area < 40000 ? (() => { const [x, y] = locator(geoCentroid(shape)) ?? [0, 0]; return `<circle cx="${x}" cy="${y}" r="7"/>`; })() : ''}
      </svg></div>
    </div>`;
  extra.stater.visste.innerHTML = `
    <div class="fv">
      <div class="fv-body">
        <div class="fv-text">${f.trivia.map((t) => `<p>${t}</p>`).join('')}</div>
        <div class="fv-side">
          <div><span class="k">På valg i kveld</span><b>${cap(ballotText(st))}</b></div>
          <div><span class="k">Største by</span><b>${f.largest}</b></div>
        </div>
      </div>
    </div>`;
  extra.stater.fugl.innerHTML = symbolPage(st, 0, 'Delstatsfugl', f.bird);
  extra.stater.blomst.innerHTML = symbolPage(st, 1, 'Delstatsblomst', f.flower);
  const sl = document.getElementById('sublabel');
  if (sl) sl.innerHTML = `${flagImg(st, 'flag')}<span>${STATE_NAME[st]}</span>`;
}

/** Bird and flower photos (Wikimedia Commons, via each species' Wikipedia article), embedded at build time. */
const NATURE = NATURE_DATA as unknown as { states: Record<string, [string, string]>; img: Record<string, { uri?: string; desc?: string }> };
const listStates = (sts: string[]) => (sts.length > 1 ? `${sts.slice(0, -1).join(', ')} og ${sts.at(-1)}` : sts[0]);

function symbolPage(st: string, i: 0 | 1, kicker: string, name: string) {
  const key = NATURE.states[st]?.[i];
  const img = key ? NATURE.img[key] : undefined;
  // Other states with the same symbol: the cardinal and the meadowlark are popular.
  const shared = Object.entries(NATURE.states).filter(([s, v]) => s !== st && v[i] === key && FACTS[s]).map(([s]) => STATE_NAME[s]);
  return `
    <div class="sym">
      <div class="sym-img">${img?.uri ? `<img src="${img.uri}" alt="">` : ''}</div>
      <div class="sym-text">
        <div class="k">${kicker}</div>
        <div class="sym-name">${name}</div>
        ${key && !name.toLowerCase().includes(key.toLowerCase()) ? `<div class="sym-sci">${key}</div>` : ''}
        ${shared.length ? `<p>Også ${kicker.toLowerCase()} i ${listStates(shared)}.</p>` : `<p>Ingen andre delstater har valgt den samme.</p>`}
        ${img?.uri ? pageCredit('Foto: Wikimedia Commons') : ''}
      </div>
    </div>`;
}

const extra = { stenger: {} as Record<string, HTMLElement>, stater: {} as Record<string, HTMLElement> };
for (const k of ['stenger', 'stater'] as const) {
  for (const s of TAB_SUBS[k]) {
    const p = document.createElement('section');
    p.className = `page ${k}`;
    $('pages').appendChild(p);
    extra[k][s] = p;
  }
}
// Countdown and the "done" marks move with the clock.
setInterval(renderClosings, 15_000);

/* ============================================================ navigation */

let current: { key: TabKey; sub: string } = { key: 'senat', sub: 'oversikt' };
let rotateTimer = 0;
let auto = q.get('auto') !== '0';

function hasContent(key: TabKey, sub: string): boolean {
  if (key === 'stenger') return closingsLeft();
  if (key === 'stater' || sub !== 'skifter' || !prev) return true;
  return flips(prev.races[key]).length > 0;
}

const pageOf = (key: TabKey, sub: string): HTMLElement => (isContest(key) ? views[key].el[sub as Sub] : extra[key][sub]);

function go(key: TabKey, sub: string) {
  const was = pageOf(current.key, current.sub);
  const next = pageOf(key, sub);
  // Entering a tab: build its subpage list, and pick the next state for a fact sheet.
  if (key !== current.key || !$('subs').childElementCount) {
    const label = { stenger: 'Stengetider', stater: '' }[key as 'stenger' | 'stater'];
    // A tab with a single page needs no page list.
    $('subs').innerHTML = (label !== undefined ? `<span class="sublabel" id="sublabel">${label}</span>` : '') + (TAB_SUBS[key].length < 2 ? '' : TAB_SUBS[key].map((s) => `<span class="sub" data-s="${s}">${SUB_LABEL[s]}<span class="cnt"></span><span class="fill"></span></span>`).join(''));
  }
  if (key === 'stater' && (current.key !== 'stater' || pendingState)) nextState();
  if (key === 'stenger') renderClosings();
  // The race tabs credit their numbers up here; the other pages credit their sources at the foot.
  $('source').hidden = !isContest(key);
  $('sample').hidden = !isContest(key) || mode !== 'demo';
  if (was !== next) {
    was.classList.remove('on');
    was.classList.add('past');
    setTimeout(() => was.classList.remove('past'), 700);
  }
  next.classList.add('on');
  current = { key, sub };

  // Tabs: the underline slides to the active tab.
  frame.querySelectorAll<HTMLElement>('.tab').forEach((t) => t.classList.toggle('on', t.dataset.k === key));
  placeIndicator();

  // Subnav: the active entry's line fills over the time the page is held.
  frame.querySelectorAll<HTMLElement>('.sub').forEach((s) => {
    const on = s.dataset.s === sub;
    s.classList.toggle('on', on);
    const fill = s.querySelector<HTMLElement>('.fill')!;
    fill.style.transition = 'none';
    fill.style.width = '0';
    if (on && auto && !holding) nextFrame(() => { fill.style.transition = `width ${HOLD_MS}ms linear`; fill.style.width = '100%'; });
  });
  if (prev && isContest(key)) renderFlips(views[key], prev.races[key]);
  schedule();
}

function placeIndicator() {
  // Closing times and fact sheets aren't on the tab bar: no tab is lit, the underline fades.
  const tab = frame.querySelector<HTMLElement>(`.tab[data-k="${current.key}"]`);
  const ind = $('ind');
  ind.style.opacity = tab ? '1' : '0';
  if (!tab) return;
  ind.style.width = `${tab.offsetWidth}px`;
  ind.style.transform = `translateX(${tab.offsetLeft}px)`;
}
// Tab widths change once the web font has loaded.
document.fonts?.ready.then(placeIndicator);

function advance() {
  const seq = TAB_KEYS.flatMap((k) => TAB_SUBS[k].map((s) => [k, s] as [TabKey, string]));
  let i = seq.findIndex(([k, s]) => k === current.key && s === current.sub);
  for (let n = 0; n < seq.length; n++) {
    i = (i + 1) % seq.length;
    if (hasContent(...seq[i])) break;
  }
  go(...seq[i]);
}

let holding = false;
function schedule() {
  clearTimeout(rotateTimer);
  if (auto && !holding && playing) rotateTimer = window.setTimeout(advance, HOLD_MS);
}

/* ================================================================= cards */

type Card =
  | { kind: 'call'; c: Contest; race: RaceState }
  | { kind: 'callband'; c: Contest; race: RaceState }
  | { kind: 'batch'; c: Contest; races: RaceState[]; flipsOnly?: boolean }
  | { kind: 'control'; c: Contest; party: Party };

const queue: Card[] = [];
let latest: { text: string; party: Side | null } | null = null;
let cardBusy = false;
let cardTimer = 0;

function enqueue(cards: Card[]) {
  // Control of a chamber is the story of the night: it goes first.
  queue.unshift(...cards.filter((c) => c.kind === 'control'));
  queue.push(...cards.filter((c) => c.kind !== 'control'));
  // Keep cards from lagging far behind the board: fold a backlog into one card per contest.
  const rest = queue.filter((c) => c.kind !== 'control');
  if (rest.length > 4) {
    const controls = queue.filter((c) => c.kind === 'control');
    const by = new Map<Key, { races: RaceState[]; flipsOnly: boolean }>();
    for (const c of rest) {
      const g = by.get(c.c.key) ?? { races: [], flipsOnly: true };
      if (c.kind === 'call') { g.races.push(c.race); g.flipsOnly = false; }
      if (c.kind === 'batch') { g.races.push(...c.races); g.flipsOnly &&= !!c.flipsOnly; }
      by.set(c.c.key, g);
    }
    queue.length = 0;
    queue.push(...controls, ...[...by].map(([k, g]): Card => (g.races.length === 1 && !g.flipsOnly
      ? { kind: 'call', c: C[k], race: g.races[0] }
      : { kind: 'batch', c: C[k], ...g })));
  }
  if (!cardBusy) showNext();
}

/*
 * Every call is a short full-screen sequence (everything but the notice band
 * and the clocks): the announcement in the party colour, then the people or
 * the states involved, then what it means for the chamber. Then the normal
 * page rotation resumes.
 */
interface Step { html: string; ms: number }
interface Sequence {
  colour: string;
  kicker: string;
  title: string;
  verdict: string;
  long?: boolean;
  steps: Step[]; // after the opening announcement
  openMs: number;
  then?: { key: Key; sub: Sub };
}

const isSenateR = (c: Contest, p: Party) => c.key === 'senat' && p === 'R';

/** What the board looks like now for one contest, as a takeover step. */
function impactStep(c: Contest, focus: Party | null): Step {
  const rs = prev!.races[c.key];
  const t = tally(rs);
  const s = seats(c, t);
  const w = (n: number) => `${(n / c.total) * 100}%`;
  const mark = c.need ? ((c.total - c.need.R + c.need.D) / 2 / c.total) * 100 : null;
  let line: string;
  if (c.need) {
    if (s.control) line = `${NAME[s.control]} har flertall i ${c.the}.`;
    else {
      const p = focus ?? (s.D >= s.R ? 'D' : 'R');
      const left = c.need[p] - s[p];
      line = `${NAME[p]} har nå ${s[p]} seter og trenger ${left} til for flertall${isSenateR(c, p) ? ' (visepresidenten avgjør ved stemmelikhet)' : ''}. ${s.open} er ikke avgjort.${t.won.I ? ` ${t.won.I === 1 ? 'Én uavhengig' : `${t.won.I} uavhengige`} har vunnet.` : ''}`;
    }
  } else {
    const open = rs.filter((r) => r.status !== 'called').length;
    line = `${NAME.D} har nå ${s.D} guvernører, ${NAME.R.toLowerCase()} ${s.R}. ${open ? `${open} valg er ikke avgjort.` : 'Alle valg er avgjort.'}`;
  }
  return {
    ms: 7000,
    html: `
      <div class="ti">
        <div class="tk">${c.tab}${c.need ? ` &middot; ${c.need.D} for flertall` : ''}</div>
        <div class="inums">
          <div class="d"><span>${NAME.D}</span><b class="num">${s.D}</b></div>
          <div class="r"><span>${NAME.R}</span><b class="num">${s.R}</b></div>
        </div>
        <div class="bar ibar">
          <span class="seg d" style="left:0;--w:${w(s.D)}"></span>
          <span class="seg i" style="left:${w(s.D)};--w:${w(t.won.I)}"></span>
          <span class="seg r" style="right:0;--w:${w(s.R)}"></span>
          ${mark !== null ? `<span class="mark" style="left:${mark}%"></span>` : ''}
        </div>
        <p class="iline">${line}</p>
      </div>`,
  };
}

function candidatesStep(r: RaceState): Step {
  const w = r.winner!;
  let l: Party = w === 'D' ? 'R' : 'D';
  const share = (p: Party) => (p === 'D' ? r.dem : 100 - r.dem);
  // Unopposed: only the winner is on the ballot.
  if (r.seed.unopposed) l = w;
  const cand = (p: Party) => `
    <div class="tc ${p === w ? 'win' : 'lose'} ${col(r, p)}">
      ${photo(who(r, p), p, 'big', partyOf(r, p))}
      <div class="tn">${who(r, p)?.name ?? NAME[p]}</div>
      <div class="tp">${who(r, p) ? who(r, p)!.label ?? NAME[p] : 'Kandidat'}</div>
      <div class="tv num">${pct1(share(p))}</div>
      <div class="tb"><span style="--w:${share(p)}%"></span></div>
    </div>`;
  const wiki = isWiki(r.seed.cand.D?.photo) || isWiki(r.seed.cand.R?.photo);
  const credit = [r.calledBy && `Utropt av ${r.calledBy}`, r.src && `Tall: ${r.src}`, wiki && 'Foto: Wikipedia'].filter(Boolean).join(' &middot; ');
  return { ms: 7500, html: `<div class="tcs">${cand(w)}${l === w ? `<div class="tc none"><div class="tn">${NO_CAND}</div></div>` : cand(l)}</div><div class="tfoot num">${pct0(r.reported * 100)} av forventede stemmer er talt${credit ? ` &middot; ${credit}` : ''}</div>` };
}

function tilesStep(races: RaceState[]): Step {
  return {
    ms: 5000 + Math.min(races.length, 16) * 150,
    html: `<div class="tiles">${races.slice(0, 16).map((r, i) => {
      const flip = isFlip(r);
      return `<div class="tile ${col(r, r.winner!)}" style="transition-delay:${200 + i * 90}ms">
        <b>${r.seed.name}</b><span>${sideName(r, r.winner!)}${flip ? ' &middot; skifte' : ''}</span></div>`;
    }).join('')}${races.length > 16 ? `<div class="tile more">+${races.length - 16} til</div>` : ''}</div>`,
  };
}

function sequenceFor(c: Card): Sequence {
  if (c.kind === 'call' || c.kind === 'callband') {
    const r = c.race;
    const w = r.winner!;
    const wp = winnerParty(r)!;
    const flip = isFlip(r);
    const seat = c.c.key === 'guv' ? 'guvernørsetet' : 'setet';
    const wn = who(r, w);
    latest = { text: `<b>${r.seed.name}</b> (${c.c.short.toLowerCase()}): ${wn ? `${wn.name} (${wp === 'I' ? 'uavh.' : ABBR[wp]})` : sideName(r, w)} ${flip ? 'vinner' : 'beholder'}`, party: wp };
    // Two candidates from one party (e.g. a California top-two race): say who, not which party.
    const sameParty = partyOf(r, 'D') === partyOf(r, 'R');
    return {
      colour: `var(--${col(r, w)})`,
      kicker: `${c.c.tab} &middot; avgjort${flip ? ' <span class="tagflip">Skifte</span>' : ''}`,
      title: r.seed.name,
      verdict: r.seed.unopposed && !noCand(r, w)
        ? `${wn?.name ?? sideName(r, w)} vinner uten motkandidat`
        : sameParty && wn
        ? `${wn.name} vinner. ${NAME[wp as Party] ?? ''} beholder ${seat}`
        : flip ? `${sideName(r, w)} vinner ${seat} fra ${FROM[r.seed.incumbent]}` : `${sideName(r, w)} beholder ${seat}`,
      openMs: 5000,
      steps: [candidatesStep(r), impactStep(c.c, wp === 'I' ? null : wp)],
    };
  }
  if (c.kind === 'batch') {
    const n = c.races.length;
    const d = c.races.filter((r) => winnerParty(r) === 'D').length;
    latest = { text: `<b>${n} ${c.flipsOnly ? 'seter skifter parti' : 'løp avgjort'}</b> (${c.c.short.toLowerCase()}): ${d} Dem., ${n - d} Rep.`, party: null };
    return {
      colour: 'var(--ink)',
      kicker: `${c.c.tab} &middot; ${c.flipsOnly ? 'skifter parti' : 'avgjort'}`,
      title: c.flipsOnly ? `${n} ${n === 1 ? 'sete skifter' : 'seter skifter'} parti` : `${n} løp avgjort`,
      verdict: `${d} til demokratene, ${n - d} til republikanerne`,
      long: true,
      openMs: 4500,
      steps: [tilesStep(c.races), impactStep(c.c, null)],
    };
  }
  return {
    colour: `var(--${c.party.toLowerCase()})`,
    kicker: `${c.c.tab} &middot; flertall`,
    title: `${NAME[c.party]} får flertall i ${c.c.the}`,
    verdict: isSenateR(c.c, c.party) ? 'Med visepresidentens stemme er 50 seter nok.' : `${c.c.need![c.party]} seter trengs for flertall.`,
    long: true,
    openMs: 8000,
    steps: [impactStep(c.c, c.party)],
    then: { key: c.c.key, sub: 'oversikt' },
  };
}

let seq: { s: Sequence; i: number } | null = null;

function showNext() {
  const c = queue.shift();
  if (!c) { cardBusy = false; return; }
  cardBusy = true;
  runSequence(sequenceFor(c));
}

function runSequence(s: Sequence) {
  holding = true;
  clearTimeout(rotateTimer);
  frame.querySelectorAll<HTMLElement>('.sub .fill').forEach((f) => { f.style.transition = 'none'; f.style.width = '0'; });
  const t = $('take');
  t.style.setProperty('--c', s.colour);
  t.classList.toggle('long', !!s.long);
  t.innerHTML = `
    <div class="tl">
      <div class="kick">${s.kicker}</div>
      <h2>${s.title}</h2>
      <p>${s.verdict}</p>
      <div class="steps">${[0, ...s.steps].map(() => '<i><b></b></i>').join('')}</div>
    </div>
    <div class="tr">${s.steps.map((st) => `<div class="ts">${st.html}</div>`).join('')}</div>`;
  t.classList.remove('out');
  t.classList.add('wide');
  seq = { s, i: 0 };
  nextFrame(() => { t.classList.add('on'); step(0); });
}

function step(i: number) {
  if (!seq) return;
  const t = $('take');
  const { s } = seq;
  seq.i = i;
  if (i > s.steps.length) { endSequence(); return; }
  t.classList.toggle('wide', i === 0);
  t.querySelectorAll('.ts').forEach((el, k) => el.classList.toggle('on', k === i - 1));
  const ms = i === 0 ? s.openMs : s.steps[i - 1].ms;
  t.querySelectorAll<HTMLElement>('.steps b').forEach((b, k) => {
    b.style.transition = 'none';
    b.style.width = k < i ? '100%' : '0';
    if (k === i) nextFrame(() => { b.style.transition = `width ${ms}ms linear`; b.style.width = '100%'; });
  });
  clearTimeout(cardTimer);
  cardTimer = window.setTimeout(() => step(i + 1), ms);
}

function endSequence() {
  clearTimeout(cardTimer);
  const t = $('take');
  const then = seq?.s.then;
  seq = null;
  t.classList.add('out');
  t.classList.remove('on');
  const el = $('latest');
  el.innerHTML = latest ? `<span class="k">Siste</span><span><i style="--c:var(--${latest.party?.toLowerCase() ?? 'faint'})"></i>${latest.text}</span>` : '';
  el.classList.remove('hide');
  holding = false;
  if (then) go(then.key, then.sub); else go(current.key, current.sub);
  cardTimer = window.setTimeout(showNext, 1200);
}

/** Cancel whatever is on screen (used when the replay loops). */
function hideCard() {
  clearTimeout(cardTimer);
  seq = null;
  $('take').classList.remove('on', 'wide');
  holding = false;
  cardBusy = false;
}

/* ================================================================ apply */

let prev: Snapshot | null = null;

function apply(snap: Snapshot) {
  const now = performance.now();
  nowET = etHours(snap.when);
  setClocks(snap.when);
  const ping = $('ping');
  ping.classList.remove('go');
  void ping.offsetWidth;
  ping.classList.add('go');

  const old = prev;
  prev = snap;
  for (const c of CONTESTS) {
    const v = views[c.key];
    const rs = snap.races[c.key];
    renderOverview(v, rs);
    renderClosest(v, rs, now);
    renderFlips(v, rs);
  }
  if (!old || snap.quiet) {
    // Open with the most recent call already in the "Siste" line.
    const last = [...snap.races.senat, ...snap.races.guv].filter((x) => x.status === 'called' && x.calledAt !== undefined)
      .sort((a, b) => b.calledAt! - a.calledAt!)[0];
    if (last && !latest) {
      const c = snap.races.senat.includes(last) ? C.senat : C.guv;
      const flip = isFlip(last);
      latest = { text: `<b>${last.seed.name}</b> (${c.short.toLowerCase()}): ${sideName(last, last.winner!)} ${flip ? 'vinner' : 'beholder'}`, party: winnerParty(last)! };
      $('latest').innerHTML = `<span class="k">Siste</span><span><i style="--c:var(--${latest.party!.toLowerCase()})"></i>${latest.text}</span>`;
    }
    return;
  }

  const cards: Card[] = [];
  for (const c of CONTESTS) {
    const before = new Map(old.races[c.key].map((r) => [r.seed.id, r]));
    const called = snap.races[c.key].filter((r) => r.status === 'called' && before.get(r.seed.id)?.status !== 'called');
    if (c.key === 'huset') {
      // 435 races: only seats changing hands get a card.
      const f = called.filter(isFlip);
      if (f.length) cards.push({ kind: 'batch', c, races: f, flipsOnly: true });
    } else {
      // Calls made the moment polls close are expected; announce them together.
      const atClose = called.filter((r) => before.get(r.seed.id)?.status === 'waiting');
      const later = called.filter((r) => before.get(r.seed.id)?.status !== 'waiting')
        .sort((a, b) => Number(isFlip(b)) - Number(isFlip(a)));
      if (atClose.length === 1) cards.push({ kind: 'callband', c, race: atClose[0] });
      else if (atClose.length > 1) cards.push({ kind: 'batch', c, races: atClose });
      for (const r of later) cards.push({ kind: 'call', c, race: r });
    }
    if (c.need) {
      const a = seats(c, tally(old.races[c.key]));
      const b = seats(c, tally(snap.races[c.key]));
      if (!a.control && b.control) cards.push({ kind: 'control', c, party: b.control });
    }
  }
  if (cards.length) enqueue(cards);
}

/* ===================================================== sample replay feed */

let clock = Math.max(START, Math.min(END, Number(q.get('t')) || 21.5));
let sampleTimer = 0;
let playing = false;

const sampleSnapshot = (t: number): Snapshot => ({
  when: simDate(t),
  races: Object.fromEntries(CONTESTS.map((c) => [c.key, c.seeds.map((s) => raceAt(s, t))])) as Record<Key, RaceState[]>,
});

function reset() {
  prev = null;
  queue.length = 0;
  latest = null;
  for (const v of Object.values(views)) {
    v.lingering.clear();
    for (const el of v.rows.values()) el.remove();
    v.rows.clear();
    v.lastOrder = [];
    v.flipIds = '';
  }
  hideCard();
}

const waitingSnapshot = (): Snapshot => ({
  when: new Date(),
  races: Object.fromEntries(CONTESTS.map((c) => [c.key, c.seeds.map((s) => ({ seed: s, status: 'waiting' as const, reported: 0, dem: 50 }))])) as Record<Key, RaceState[]>,
});

function startSample() {
  if (mode === 'waiting') {
    // No numbers yet: keep the clocks and the poll-close notes current.
    setInterval(() => { if (mode === 'waiting') setClocks(new Date()); }, 1000);
    // Re-render the same races (keeping names from the feed) so poll-close notes move on.
    sampleTimer = window.setInterval(() => { if (mode === 'waiting') apply({ ...(prev ?? waitingSnapshot()), when: new Date() }); }, 30_000);
    return;
  }
  clearInterval(sampleTimer);
  sampleTimer = window.setInterval(() => {
    clock += (SPEED * TICK_MS) / 1000 / 60;
    if (clock > END) { clock = START; reset(); }
    apply(sampleSnapshot(clock));
  }, TICK_MS);
}

/* ================================================== CasparCG template API */



const api = {
  play() {
    if (playing) return;
    playing = true;
    frame.classList.add('on');
    if (mode !== 'live') startSample();
    schedule();
  },
  stop() {
    playing = false;
    clearInterval(sampleTimer);
    clearTimeout(rotateTimer);
    frame.classList.remove('on');
  },
  /** Dismiss the card on screen, or go to the next page. */
  next() {
    if (seq) step(seq.i + 1);
    else advance();
  },
  /** Jump to a tab or page: "senat", "huset", "guv", or e.g. "huset:jevne". "auto" resumes rotation. */
  invoke(target: string) {
    if (target === 'auto') { auto = true; schedule(); return; }
    const [k, s0] = target.split(':') as [TabKey, string | undefined];
    let s = s0;
    if (!TAB_SUBS[k]) return;
    auto = false;
    // "stater:TX" shows Texas.
    if (k === 'stater' && s && FACTS[s.toUpperCase()]) { pendingState = s.toUpperCase(); s = undefined; }
    go(k, s && TAB_SUBS[k].includes(s) ? s : TAB_SUBS[k][0]);
  },
  /** Push results as JSON in the board's own format (see README). */
  update(raw: string) {
    try { applyFeed(JSON.parse(raw)); } catch { /* ignore malformed pushes */ }
  },
};
Object.assign(window, api, {
  senat: () => api.invoke('senat'),
  huset: () => api.invoke('huset'),
  guv: () => api.invoke('guv'),
  stenger: () => api.invoke('stenger'),
  stater: () => api.invoke('stater'),
});

/* ====================================================== real data: feed */

function goLive() {
  if (mode === 'live') return;
  const wasDemo = mode === 'demo';
  mode = 'live';
  clearInterval(sampleTimer);
  if (wasDemo) reset();
  $('sample').hidden = true;
  setInterval(() => setClocks(new Date()), 1000);
}

/** Merge a feed (candidates and/or numbers) onto the board and animate the difference. */
function applyFeed(feed: Feed, quiet = false) {
  const hasNumbers = CONTESTS.some((c) => (feed[c.key] ?? []).some((f) => f.status !== 'waiting'));
  if (hasNumbers) goLive();
  if (mode === 'demo') return;
  const base = prev ?? waitingSnapshot();
  apply({
    when: new Date(),
    quiet,
    races: Object.fromEntries(CONTESTS.map((c) => {
      const byId = new Map((feed[c.key] ?? []).map((r) => [r.id, r]));
      return [c.key, base.races[c.key].map((r) => {
        const f = byId.get(r.seed.id);
        if (!f) return r;
        // core.json brings names (keep the numbers); results.json brings numbers (keep the names).
        if (f.candidates) return { ...r, seed: { ...r.seed, incumbent: f.incumbent ?? r.seed.incumbent, cand: { ...r.seed.cand, ...f.candidates }, unopposed: f.unopposed } };
        // State feeds may post test numbers before their polls close; never show those.
        if (q.get('early') !== '1' && etHours(new Date()) < r.seed.closesET) return r;
        return { seed: r.seed, reported: f.reported, dem: f.dem, status: f.status, winner: f.winner, calledBy: f.calledBy, src: f.src,
          calledAt: r.calledAt ?? (f.status === 'called' ? Date.now() : undefined) };
      })];
    })) as Record<Key, RaceState[]>,
  });
}

const FEED = q.get('feed') ?? 'https://thepeoplestally.com';
let lastData = 0;
async function getJSON(path: string) {
  // A plain fetch with a timeout race: no AbortSignal, because some hosts
  // (the Claude app's viewer among them) proxy fetch and cannot clone one.
  const timeout = new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), 15_000));
  const res = await Promise.race([fetch(FEED.replace(/\/$/, '') + path), timeout]);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}
async function pollCore() {
  try { applyFeed(parseCore(await getJSON('/data/core.json'))); } catch (e) { console.warn('core.json', e); return; }
  // Congress only has portraits of its members; look the rest up on Wikipedia, Senate and governors first.
  if (!prev || q.get('photos') === '0') return;
  const jobs = (['senat', 'guv', 'huset'] as Key[]).flatMap((k) => prev!.races[k].flatMap((r) =>
    (['D', 'R'] as Party[]).map((p) => r.seed.cand[p]).filter((c): c is Candidate => !!c)
      .map((c) => ({ c, state: STATE_NAME[r.seed.state], statewide: k !== 'huset' }))));
  findPortraits(jobs, () => { if (prev) apply({ ...prev, when: new Date(), quiet: true }); });
}
async function pollResults() {
  try {
    // The first load is the starting point: a template started mid-evening shouldn't replay every call.
    applyFeed(parseResults(await getJSON('/data/results.json')), !lastData);
    lastData = Date.now();
  } catch (e) { console.warn('results.json', e); }
  if (mode === 'live') {
    // Name the source, and say so if it has gone quiet.
    const stale = Date.now() - lastData > 5 * 60_000;
    $('source').textContent = stale
      ? `Ingen nye tall siden ${lastData ? osloFmt.format(new Date(lastData)) : 'start'}`
      : "The People\u2019s Tally (CC BY 4.0) \u00b7 uoffisielle tall";
  }
}
function startFeed() {
  if (mode === 'demo' || FEED === 'off') return;
  void pollCore();
  setInterval(pollCore, 10 * 60_000);
  void pollResults();
  // The People's Tally refreshes results about once a minute; 30 s is polite and timely.
  setInterval(pollResults, 30_000);
}

/* First frame: no cards for what came before. */
if (mode === 'demo') {
  $('source').textContent = 'Demo: oppdiktede tall, kandidatnavn skjult';
  // Don't credit People's Tally for invented numbers.
  $('service').textContent = 'Demo med oppdiktede tall, ikke valgdata fra People\u2019s Tally';
  apply(sampleSnapshot(clock));
} else {
  $('sample').hidden = true;
  $('source').textContent = 'Venter på valgresultater';
  apply(waitingSnapshot());
}
renderClosings();
const v0 = q.get('view');
if (v0) api.invoke(v0); else go('senat', 'oversikt');
if (q.get('autoplay') !== '0') api.play();
startFeed();
