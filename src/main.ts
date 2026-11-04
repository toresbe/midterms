import './style.css';
import { ResultUpdates, formatResultUpdate, resultSignature } from './result-updates';
import {
  SENATE_SEEDS, SENATE_HOLDOVER, GOV_SEEDS, GOV_HOLDOVER, houseSeeds, STATE_NAME, POLLS, etClock,
  type Party, type RaceSeed, type Candidate, type Side,
} from './data';
import { raceAt, tally, partyOf, winnerParty, isFlip, closestRaces, newlyCalledRaces, type ChamberTally, type RaceState } from './sim';
import { CIVIC_RACES, parseCivicRace, type CivicRace, type Feed } from './civicapi';
import { findPortraits, isWiki } from './portraits';
import { FACTS, NORWAY_KM2 } from './states';
import MEASURES from './measures.json';
import { parseMeasures, measureCategory } from './measures';
import FLAGS from './flags.json';
import NATURE_DATA from './nature.json';
import { SYMBOL_HISTORY } from './symbol-history';
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
// While numbers changed this recently (seconds), fresh numbers come first and the filler tabs are skipped.
const QUIET_MS = (Number(q.get('quiet')) || 300) * 1000;
// Seconds per page while paging through every race an update changed ("Nyeste tall", Senate and House).
const NEW_HOLD_MS = (Number(q.get('newhold')) || HOLD_MS / 1000) * 1000;
const ROWS = 4;
// Read the CSS row geometry so ordering animations stay aligned with the layout.
const layoutStyle = getComputedStyle(document.documentElement);
const ROW_STEP = parseFloat(layoutStyle.getPropertyValue('--row-height'))
  + parseFloat(layoutStyle.getPropertyValue('--row-gap'));

const NAME: Record<Party, string> = { D: 'Demokratene', R: 'Republikanerne' };
/** Who a seat is won from: "vinner setet fra …". */
const FROM: Record<Side, string> = { D: 'demokratene', R: 'republikanerne', I: 'en uavhengig' };
const ABBR: Record<Party, string> = { D: 'Dem.', R: 'Rep.' };

type Key = 'senat' | 'huset' | 'guv';
/** Tabs: the three contests, then poll closings and state fact sheets. */
type TabKey = Key | 'stenger' | 'stater';
type Sub = 'siste' | 'oversikt' | 'jevne' | 'skifter';
const SUBS: Sub[] = ['siste', 'oversikt', 'jevne', 'skifter'];
const SUB_LABEL: Record<string, string> = {
  siste: 'Nyeste tall', oversikt: 'Oversikt', jevne: 'Jevneste løp', skifter: 'Skifter parti',
  neste: 'Neste', fakta: 'Fakta', fugl: 'Delstatsfugl', blomst: 'Delstatsblomst', visste: 'Visste du?',
  valget: 'Dette valget', folkevalg: 'Folkevalg',
};
const TAB_SUBS: Record<TabKey, string[]> = {
  senat: SUBS, huset: SUBS, guv: SUBS, stenger: ['neste'], stater: ['fakta', 'valget', 'folkevalg', 'fugl', 'blomst', 'visste'],
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
  <div class="notice"><span class="l1">Ordinære sendinger utgår &ndash; se <b>frikanalen.no/protest</b> for informasjon</span><span class="l2" id="service">Vi viser valgdata fra <a href="https://civicapi.org/" target="_blank" rel="noopener noreferrer">civicAPI</a> som en tjeneste til våre seere</span></div>
  <header class="head">
    <div class="title">Mellomvalg</div>
    <nav class="tabs" id="tabs">
      ${CONTESTS.map((c) => `<span class="tab chamber-tab" data-k="${c.key}"><span>${c.tab}</span>
        <span class="tab-seats num" aria-label="Seter">
          <span class="d">D <b data-seats="D">0</b></span><span>/</span>
          <span class="r">R <b data-seats="R">0</b></span>
          <span data-independent hidden>/ <span class="i">I <b data-seats="I">0</b></span></span>
        </span></span>`).join('')}
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
  }
  return { D, R, open: c.total - D - R - t.won.I, control, lean, projD, projR };
}

const flips = (rs: RaceState[]) => rs.filter(isFlip);
/** Keep contest totals visible on every page, using the overview's called-seat totals. */
function renderHeaderSeats(c: Contest, rs: RaceState[]) {
  const t = tally(rs);
  const s = seats(c, t);
  const tab = frame.querySelector<HTMLElement>(`.tab[data-k="${c.key}"]`)!;
  const totals = { D: s.D, R: s.R, I: t.won.I };
  for (const [key, value] of Object.entries(totals)) {
    tab.querySelector<HTMLElement>(`[data-seats="${key}"]`)!.textContent = String(value);
  }
  tab.querySelector<HTMLElement>('[data-independent]')!.hidden = totals.I === 0;
  tab.querySelector('.tab-seats')!.setAttribute('aria-label',
    `${s.D} ${c.key === 'guv' ? 'guvernørseter' : 'seter'} til Demokratene, ${s.R} til Republikanerne, ${totals.I} uavhengige, ${s.open} uavgjort`);
}
/** Colour token for a side's real party: d, r or i. */
const col = (r: RaceState, slot: Party) => partyOf(r, slot).toLowerCase();
/** "Demokratene" / "Republikanerne", or an independent's own name. */
function sideName(r: RaceState, slot: Party): string {
  const p: Side = partyOf(r, slot);
  return p === 'I' ? (r.seed.cand[slot]?.name ?? 'Uavhengig kandidat') : NAME[p];
}

/* ================================================================ pages */

interface View { c: Contest; el: Record<Sub, HTMLElement>; rows: Map<string, HTMLElement>; recentRows: Map<string, HTMLElement>; recentOrder: string[]; lingering: Map<string, { until: number; index: number; race: RaceState }>; lastOrder: string[]; say: string; flipIds: string }
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
  el.oversikt.classList.toggle('governor-overview', !c.need);
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
          <span class="seg d"></span><span class="seg dl"></span><span class="seg dh"></span><span class="seg i"></span><span class="seg ih"></span><span class="seg rh"></span><span class="seg rl"></span><span class="seg r"></span>
          ${mark !== null ? `<span class="mark" style="left:${mark}%"></span>` : ''}
        </div>
        <div class="bleg"><i class="sw"></i>Ikke avgjort (farge = parti som har setet nå)</div>
        <div class="status"></div>
      </div>
      <div class="stats">
        <div class="stat"><span class="k">Avgjort i kveld</span><span class="v num" data-k="called">0</span></div>
        <div class="stat"><span class="k">Skifter til Dem.</span><span class="v d num" data-k="flipD">0</span></div>
        <div class="stat"><span class="k">Skifter til Rep.</span><span class="v r num" data-k="flipR">0</span></div>
      </div>
    </div>`;
  el.jevne.innerHTML = `<div class="rows"></div><div class="empty" hidden>Alle løp er avgjort.</div>`;
  el.siste.innerHTML = `<div class="rows"></div><div class="empty">Ingen nye tall ennå.</div>`;
  el.skifter.innerHTML = `<div class="rows"></div><div class="empty">Ingen ${c.key === 'guv' ? 'guvernørseter' : 'seter'} har skiftet parti ennå.</div>`;
  views[c.key] = { c, el, rows: new Map(), recentRows: new Map(), recentOrder: [], lingering: new Map(), lastOrder: [], say: '', flipIds: '' };
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
  const [d, dl, dh, ind, ih, rh, rl, r] = p.querySelectorAll<HTMLElement>('.seg');
  // From each end: won, leading, then (striped) seats with no numbers yet, by who holds them now.
  // Seats won or held by independents sit between the two parties.
  d.style.left = '0%'; d.style.width = w(s.D);
  dl.style.left = w(s.D); dl.style.width = w(t.leading.D);
  dh.style.left = w(s.D + t.leading.D); dh.style.width = w(t.open.D);
  ind.style.left = w(s.D + t.leading.D + t.open.D); ind.style.width = w(t.won.I);
  ih.style.left = w(s.D + t.leading.D + t.open.D + t.won.I); ih.style.width = w(t.open.I);
  r.style.left = `calc(100% - ${w(s.R)})`; r.style.width = w(s.R);
  rl.style.left = `calc(100% - ${w(s.R + t.leading.R)})`; rl.style.width = w(t.leading.R);
  rh.style.left = `calc(100% - ${w(s.R + t.leading.R + t.open.R)})`; rh.style.width = w(t.open.R);

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
  else say = `${called} av ${rs.length} guvernørvalg avgjort`;
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
/** No one on the ballot in this slot (known from the feed, never in demo mode). */
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

function rowFor(v: View, r: RaceState, rows = v.rows, page: HTMLElement = v.el.jevne): HTMLElement {
  let el = rows.get(r.seed.id);
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
  page.querySelector('.rows')!.appendChild(el);
  rows.set(r.seed.id, el);
  return el;
}

function paintRow(el: HTMLElement, r: RaceState, ms = 700) {
  // Names and photos can arrive after the row was built (the feed loads in the background).
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
  countTo(dv, r.dem, pct1, ms);
  countTo(rv, 100 - r.dem, pct1, ms);
  // The live feed often doesn't say how much is counted: then give the vote count, and draw the split dimmed.
  const known = r.reported > 0;
  const ct = el.querySelector<HTMLElement>('.ct')!;
  // Count share and vote count tween from their previous values (the two never share one starting point).
  if (ct.dataset.kind !== (known ? 'pct' : 'votes')) { delete ct.dataset.v; ct.dataset.kind = known ? 'pct' : 'votes'; }
  if (known) countTo(ct, r.reported * 100, (n) => `${pct0(n)} talt`, ms);
  else if (r.votes) countTo(ct, r.votes, (n) => `${nbInt(n)} st.`, ms);
  else { delete ct.dataset.v; ct.textContent = ''; }
  el.classList.toggle('unk', !known);
  // Each side grows from its own end; the gap in the middle is the vote not yet counted.
  const share = known ? r.reported * 100 : 100;
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

/** How long an update's numbers take to move from old to new on Nyeste tall. */
const UPDATE_TWEEN_MS = 1400;

/** Restart a one-shot CSS animation class. */
function restart(el: HTMLElement, cls: string) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/**
 * The direction of an update, said quietly: each share gets a small ▲/▼ with the change in points,
 * the side that gained a soft tint that fades, and a new leader a brief emphasis on their name.
 */
function accentChange(el: HTMLElement, r: RaceState, wasDem: number) {
  const delta = r.dem - wasDem;
  for (const p of ['D', 'R'] as Party[]) {
    const cn = el.querySelector<HTMLElement>(`.cn.${p.toLowerCase()}`)!;
    cn.querySelector('.delta')?.remove();
    const d = p === 'D' ? delta : -delta;
    if (Math.abs(d) < 0.05 || noCand(r, p)) continue;
    const tag = document.createElement('span');
    tag.className = `delta ${d > 0 ? 'up' : 'down'}`;
    tag.textContent = `${d > 0 ? '▲' : '▼'} ${d > 0 ? '+' : '−'}${nb1(Math.abs(d))}`;
    cn.querySelector('.pc')!.after(tag);
  }
  el.classList.remove('gain-d', 'gain-r', 'newlead-d', 'newlead-r');
  if (Math.abs(delta) >= 0.05) restart(el, delta > 0 ? 'gain-d' : 'gain-r');
  const led = wasDem === 50 ? null : wasDem > 50 ? 'd' : 'r';
  const leads = r.dem === 50 ? null : r.dem > 50 ? 'd' : 'r';
  if (led && leads && led !== leads) restart(el, `newlead-${leads}`);
}

function renderClosest(v: View, rs: RaceState[], now: number) {
  const byId = new Map(rs.map((r) => [r.seed.id, r]));
  // A row that was on screen and is now called stays a moment, so the call is seen.
  for (const id of v.lastOrder) {
    const r = byId.get(id)!;
    if (r.status === 'called' && !v.lingering.has(id)) v.lingering.set(id, { until: now + 4500, index: v.lastOrder.indexOf(id), race: r });
  }
  for (const [id, l] of v.lingering) if (now > l.until) v.lingering.delete(id);

  const order = closestRaces(rs, mode === 'demo').filter((r) => !v.lingering.has(r.seed.id));
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
  const empty = v.el.jevne.querySelector<HTMLElement>('.empty')!;
  empty.hidden = shown.length > 0;
  empty.textContent = rs.every((r) => r.status === 'called')
    ? 'Alle løp er avgjort.' : 'Venter på stemmetall og kandidatnavn.';
}

/* Fresh numbers: when each race's numbers last changed (Date.now()), keyed "senat:GA". */
const changedAt = new Map<string, number>();
let lastChange = 0;
/** Changes restored from an earlier launch are history: they don't flash or queue. */
const LAUNCHED_AT = Date.now();
/** Governors: the contest's "Nyeste tall" page is visited after an update (at most once per three pages). */
let pendingJump: Key | null = null;
/**
 * Senate and House: every counting race an update changes is queued (once), and the rotation pages
 * through the queue ROWS at a time before anything else; calls still interrupt. A race already on
 * screen updates in place instead. `page` is the page on screen (fixed order), `pageNo` its number.
 */
const PAGED: Key[] = ['senat', 'huset'];
const batches = Object.fromEntries(PAGED.map((k) => [k, { queue: [] as string[], queuedAt: new Map<string, number>(), from: new Map<string, RaceState>(), page: null as string[] | null, pageNo: 0 }])) as
  Partial<Record<Key, { queue: string[]; queuedAt: Map<string, number>; from: Map<string, RaceState>; page: string[] | null; pageNo: number }>>;
const fresh = () => Date.now() - lastChange < QUIET_MS;
const resultUpdates = new ResultUpdates();
const tickerItems = new Set<{ line: HTMLElement; animation: Animation; width: number }>();
let tickerFrame = 0;
const TICKER_SPEED = 100;
const TICKER_GAP = 36;
const recentOf = (key: Key, rs: RaceState[]) => rs.filter((r) => r.status === 'counting' && changedAt.has(`${key}:${r.seed.id}`))
  .sort((a, b) => changedAt.get(`${key}:${b.seed.id}`)! - changedAt.get(`${key}:${a.seed.id}`)!);

/** Note which races' numbers changed since the last snapshot. */
function noteChanges(old: Snapshot, snap: Snapshot) {
  const t = Date.now();
  let best = 0;
  for (const c of CONTESTS) {
    // A contest's first poll after a fresh launch is the starting point, not a flood of new numbers.
    if (c.key === baselineKey) continue;
    const changed = resultUpdates.add(c.key, old.races[c.key], snap.races[c.key], snap.when);
    const n = changed.length;
    for (const r of changed) changedAt.set(`${c.key}:${r.seed.id}`, t);
    if (n) lastChange = t;
    const b = batches[c.key];
    if (b) {
      const before = new Map(old.races[c.key].map((r) => [r.seed.id, r]));
      for (const r of changed) {
        if (r.status === 'counting' && !b.page?.includes(r.seed.id) && !b.queue.includes(r.seed.id)) {
          b.queue.push(r.seed.id);
          b.queuedAt.set(r.seed.id, t);
          // The numbers viewers saw before this update: the row starts there and moves to the new ones.
          const was = before.get(r.seed.id);
          if (was && was.status !== 'waiting') b.from.set(r.seed.id, was);
        }
      }
    } else if (n > best) { best = n; pendingJump = c.key; }
  }
}

const recentStages = new Map<View, { pending: Map<string, RaceState>; timer: number }>();
const RECENT_UPDATE_MS = 1100;

function startRecent(v: View, delay = 0) {
  const stage = recentStages.get(v);
  if (!stage || stage.timer || !stage.pending.size || !playing || holding
    || current.key !== v.c.key || current.sub !== 'siste') return;
  stage.timer = window.setTimeout(() => revealRecent(v), delay);
}

function pauseRecent() {
  for (const stage of recentStages.values()) {
    clearTimeout(stage.timer);
    stage.timer = 0;
  }
}

/** Reveal one row at a time, coalescing newer figures while a row waits. */
function revealRecent(v: View) {
  const stage = recentStages.get(v)!;
  stage.timer = 0;
  if (!playing || holding || current.key !== v.c.key || current.sub !== 'siste') return;
  // Top to bottom, in the order the rows stand on screen.
  const id = v.recentOrder.find((x) => stage.pending.has(x)) ?? stage.pending.keys().next().value;
  if (!id) return;
  const race = stage.pending.get(id)!;
  stage.pending.delete(id);
  const el = v.recentRows.get(id);
  if (el && !el.classList.contains('leave')) {
    const wasDem = el.dataset.dem !== undefined && el.style.visibility !== 'hidden' ? Number(el.dataset.dem) : null;
    el.style.visibility = '';
    paintRow(el, race, UPDATE_TWEEN_MS);
    el.dataset.result = resultSignature(race);
    el.dataset.dem = String(race.dem);
    if (wasDem === null) restart(el, 'appear');
    else accentChange(el, race, wasDem);
  }
  stage.timer = window.setTimeout(() => revealRecent(v), RECENT_UPDATE_MS);
}

/** "Nyeste tall": undecided races whose numbers changed most recently. */
function renderRecent(v: View, rs: RaceState[]) {
  // Paging (Senate, House): the page's races in a fixed order, so rows never reshuffle while they reveal.
  const b = batches[v.c.key];
  const byId = new Map(rs.map((r) => [r.seed.id, r]));
  const shown = b?.page ? b.page.map((id) => byId.get(id)!).filter(Boolean) : recentOf(v.c.key, rs).slice(0, ROWS);
  const ids = new Set(shown.map((r) => r.seed.id));
  v.recentOrder = shown.map((r) => r.seed.id);
  let stage = recentStages.get(v);
  if (!stage) { stage = { pending: new Map(), timer: 0 }; recentStages.set(v, stage); }
  for (const id of stage.pending.keys()) if (!ids.has(id)) stage.pending.delete(id);
  shown.forEach((r, i) => {
    const el = rowFor(v, r, v.recentRows, v.el.siste);
    el.classList.remove('leave');
    const y = i * ROW_STEP;
    if (el.classList.contains('enter')) {
      el.style.transform = `translateY(${y + 22}px)`;
      nextFrame(() => { el.classList.remove('enter'); el.style.transform = `translateY(${y}px)`; });
    } else {
      el.style.transform = `translateY(${y}px)`;
    }
    if (!el.dataset.result && !b?.page && (changedAt.get(`${v.c.key}:${r.seed.id}`) ?? 0) < LAUNCHED_AT) {
      // Restored from an earlier launch: show as is, no reveal or flash.
      el.dataset.result = resultSignature(r);
      paintRow(el, r);
    } else if (el.dataset.result !== resultSignature(r)) {
      // Existing rows keep their previous figures until their turn. A new row for an updated race starts
      // from the numbers before the update (drawn at once, no transition); a race with its first numbers fades in.
      const was = b?.from.get(r.seed.id);
      if (!el.dataset.result && was) {
        el.classList.add('instant');
        paintRow(el, was);
        el.dataset.result = resultSignature(was);
        el.dataset.dem = String(was.dem);
        nextFrame(() => el.classList.remove('instant'));
        b!.from.delete(r.seed.id);
      } else if (!el.dataset.result) el.style.visibility = 'hidden';
      stage.pending.set(r.seed.id, r);
    } else {
      stage.pending.delete(r.seed.id);
      paintRow(el, r);
      el.dataset.dem = String(r.dem);
    }
  });
  startRecent(v);
  for (const [id, el] of v.recentRows) {
    if (ids.has(id) || el.classList.contains('leave')) continue;
    el.classList.add('leave');
    setTimeout(() => {
      if (!el.classList.contains('leave')) return;
      el.remove(); v.recentRows.delete(id);
    }, 600);
  }
  v.el.siste.querySelector<HTMLElement>('.empty')!.hidden = shown.length > 0;
  const sub = frame.querySelector<HTMLElement>('.sub[data-s="siste"]');
  if (sub && current.key === v.c.key) {
    sub.hidden = !(hasContent(v.c.key, 'siste') || current.sub === 'siste');
    sub.querySelector<HTMLElement>('.cnt')!.textContent = pageLabel(v.c.key);
  }
}

/** "1/3" while paging: this page, and how many it takes to show what is queued. */
function pageLabel(key: Key) {
  const b = batches[key];
  if (!b?.page) return '';
  const total = b.pageNo + Math.ceil(b.queue.length / ROWS);
  return total > 1 ? ` ${b.pageNo}/${total}` : '';
}

/** The next page of changed races to show (Senate, House), or null when everything queued has been shown. */
function nextPage(): Key | null {
  const onScreen = isContest(current.key) && current.sub === 'siste' ? current.key : null;
  for (const k of PAGED) {
    const b = batches[k]!;
    const counting = new Set(prev?.races[k].filter((r) => r.status === 'counting').map((r) => r.seed.id));
    // Races called since they were queued got their own call screen.
    b.queue = b.queue.filter((id) => counting.has(id));
  }
  // Whichever contest has waited longest goes next, so a busy House can't hold back the Senate.
  const waited = (k: Key) => batches[k]!.queuedAt.get(batches[k]!.queue[0]) ?? Infinity;
  const order = PAGED.filter((k) => batches[k]!.queue.length).sort((a, b) => waited(a) - waited(b));
  for (const k of order) {
    const b = batches[k]!;
    b.pageNo = k === onScreen && b.page ? b.pageNo + 1 : 1;
    b.page = b.queue.splice(0, ROWS);
    for (const id of b.page) b.queuedAt.delete(id);
    for (const other of PAGED) if (other !== k) { batches[other]!.page = null; batches[other]!.pageNo = 0; }
    return k;
  }
  for (const k of PAGED) { batches[k]!.page = null; batches[k]!.pageNo = 0; }
  return null;
}

/** How long the page on screen is held. */
const holdMs = () => (isContest(current.key) && current.sub === 'siste' && batches[current.key]?.page ? NEW_HOLD_MS : HOLD_MS);

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
let activeState: string | null = null;
const stateMeasures = parseMeasures(MEASURES);
let measurePage = 0;
const MEASURES_PER_PAGE = 2;
const escapeHTML = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

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
  activeState = st;
  measurePage = 0;
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
      <div class="fv-text">${f.trivia.map((t) => `<p>${t}</p>`).join('')}</div>
    </div>`;
  renderStateElection(st);
  renderStateMeasures(st);
  extra.stater.fugl.innerHTML = symbolPage(st, 0, 'Delstatsfugl', f.bird);
  extra.stater.blomst.innerHTML = symbolPage(st, 1, 'Delstatsblomst', f.flower);
  const sl = document.getElementById('sublabel');
  if (sl) sl.innerHTML = `${flagImg(st, 'flag')}<span>${STATE_NAME[st]}</span>`;
}

/** A lead is provisional; only a called race can have a winner. */
const stateLeader = (race: RaceState): Party | null => race.status === 'counting' && Number.isFinite(race.dem) && race.dem !== 50 ? (race.dem > 50 ? 'D' : 'R') : null;
const stateReported = (race: RaceState) => Number.isFinite(race.reported) ? Math.min(1, Math.max(0, race.reported)) * 100 : 0;
const stateHasVotes = (race: RaceState) => race.status !== 'waiting' && Number.isFinite(race.dem);
const stateShare = (race: RaceState) => stateHasVotes(race) ? Math.min(100, Math.max(0, race.dem)) : 50;
const statePartyAbbr = (party: Side) => party === 'I' ? 'U' : party;

function renderStateElection(st: string) {
  const stateRaces = (k: Key): RaceState[] => (prev?.races[k] ?? C[k].seeds.map((seed) => ({ seed, status: 'waiting' as const, reported: 0, dem: 0 }))).filter((r) => r.seed.state === st);
  const house = stateRaces('huset');
  const races = (['senat', 'guv'] as Key[]).flatMap((k) => {
    return stateRaces(k).map((race) => ({ k, race }));
  });
  extra.stater.valget.innerHTML = `<div class="state-election">
    <div class="state-candidates">${races.length ? races.map(({ k, race }) => `<div class="state-race">
      <div class="k">${k === 'senat' ? 'Senatet' : 'Guvernør'}</div>
      <div class="state-pair">${(['D', 'R'] as Party[]).map((p) => {
        const seed = race.seed;
        const c = seed.cand[p];
        const party = c?.party ?? p;
        const called = race.status === 'called' && !!race.winner;
        const won = called && race.winner === p;
        const leading = stateLeader(race) === p;
        return `<div class="state-candidate ${party.toLowerCase()}${won ? ' won' : called ? ' lost' : leading ? ' leading' : ''}"><b>${mode === 'demo' ? 'Kandidatnavn skjult i demo' : c ? escapeHTML(c.name) : seed.unopposed ? 'Ingen motkandidat' : 'Kandidat ikke oppgitt'}</b><span>${c ? escapeHTML(c.label ?? (party === 'I' ? 'Uavhengig' : NAME[party])) : ''}${won ? '<strong class="state-winner">✓ Vinner</strong>' : leading ? '<strong class="state-leader">↑ Leder</strong>' : ''}</span></div>`;
      }).join('')}</div>
      <div class="state-vote-numbers num"><b>${stateHasVotes(race) ? pct1(stateShare(race)) : '–'}</b><span>${stateHasVotes(race) && race.reported > 0 ? `${pct0(stateReported(race))} talt` : race.status === 'waiting' ? 'Venter på tall' : 'Andel opptalt ukjent'}</span><b>${stateHasVotes(race) ? pct1(100 - stateShare(race)) : '–'}</b></div>
      <div class="state-vote-bar${stateHasVotes(race) ? '' : ' waiting'}" style="--share:${stateShare(race)}%;--left:var(--${partyOf(race, 'D').toLowerCase()});--right:var(--${partyOf(race, 'R').toLowerCase()})"></div>
      </div>`).join('') : ''}</div>
    <div class="state-house"><div class="k">Representantenes hus</div>
      <div class="state-house-chips">${house.map((race) => {
        const won = race.status === 'called' && race.winner;
        const leader = stateLeader(race);
        const slot = won || leader;
        const c = slot ? race.seed.cand[slot] : null;
        const party = slot ? partyOf(race, slot) : null;
        const counting = race.status === 'counting' && Number.isFinite(race.dem);
        const share = counting ? Math.min(100, Math.max(0, race.dem)) : 50;
        const counted = race.reported > 0 ? `${pct0(stateReported(race))} talt` : '– talt';
        const name = party ? mode !== 'demo' && c ? c.name : party === 'I' ? 'Uavhengig' : NAME[party] : '';
        const percent = race.status === 'waiting' || !(race.reported > 0) ? '–' : `${Math.round(stateReported(race))}%`;
        const label = `${race.seed.id}: ${won ? `${name} vinner` : leader ? `${name} leder` : counting ? 'Likt' : 'Venter på tall'}${counting ? `, ${statePartyAbbr(partyOf(race, 'D'))}: ${pct1(share)}, ${statePartyAbbr(partyOf(race, 'R'))}: ${pct1(100 - share)}, ${counted}` : ''}`;
        return `<span class="state-house-chip${won ? ` won ${party!.toLowerCase()}` : counting ? ' counting' : ' waiting'}" style="--share:${share}%;--counted:${race.status === 'waiting' ? 0 : stateReported(race)}%;--left:var(--${partyOf(race, 'D').toLowerCase()}-soft);--right:var(--${partyOf(race, 'R').toLowerCase()}-soft)" aria-label="${escapeHTML(label)}" title="${escapeHTML(label)}"><span class="state-chip-text">${won ? '✓ ' : ''}${escapeHTML(race.seed.id)} <b>${percent}</b></span><span class="state-count-progress" aria-hidden="true"></span></span>`;
      }).join('')}</div>
    </div>
    ${pageCredit('Valgdata: <a href="https://civicapi.org/" target="_blank" rel="noopener noreferrer">civicAPI</a> / Wikipedia (reserve) &middot; ✓ Vinner &middot; fremdrift: rapportering')}
  </div>`;
}

function renderStateMeasures(st: string) {
  const measures = stateMeasures.filter((m) => m.state === st);
  const pages = Math.ceil(measures.length / MEASURES_PER_PAGE);
  extra.stater.folkevalg.innerHTML = `<div class="state-measures">
    <div class="measure-heading"><span>${measures.length} ${measures.length === 1 ? 'folkeavstemning' : 'folkeavstemninger'}</span><span>${pages > 1 ? `${measurePage + 1} / ${pages}` : ''}</span></div>
    <div class="measure-list">${measures.slice(measurePage * MEASURES_PER_PAGE, (measurePage + 1) * MEASURES_PER_PAGE).map((m) => `<div class="measure"><div class="measure-title"><b>${escapeHTML(m.title)}</b><span>${escapeHTML(measureCategory(m.category))}</span></div><p>${escapeHTML(m.summary)}</p></div>`).join('')}</div>
    ${pageCredit('Kilde: The People&rsquo;s Tally (CC BY 4.0) / Ballotpedia')}
  </div>`;
}

/** Bird and flower photos (Wikimedia Commons, via each species' Wikipedia article), embedded at build time. */
const NATURE = NATURE_DATA as unknown as { states: Record<string, [string, string]>; img: Record<string, { uri?: string; desc?: string }> };
const listStates = (sts: string[]) => (sts.length > 1 ? `${sts.slice(0, -1).join(', ')} og ${sts.at(-1)}` : sts[0]);

function symbolPage(st: string, i: 0 | 1, kicker: string, name: string) {
  const key = NATURE.states[st]?.[i];
  const img = key ? NATURE.img[key] : undefined;
  const history = SYMBOL_HISTORY[st]?.[i];
  // Other states with the same symbol: the cardinal and the meadowlark are popular.
  const shared = Object.entries(NATURE.states).filter(([s, v]) => s !== st && v[i] === key && FACTS[s]).map(([s]) => STATE_NAME[s]);
  return `
    <div class="sym">
      <div class="sym-img">${img?.uri ? `<img src="${img.uri}" alt="">` : ''}</div>
      <div class="sym-text">
        <div class="k">${kicker}</div>
        <div class="sym-name">${name}</div>
        ${key && !name.toLowerCase().includes(key.toLowerCase()) ? `<div class="sym-sci">${key}</div>` : ''}
        ${history ? `<p class="sym-history">${escapeHTML(history.text)}</p>` : ''}
        <div class="sym-footer">
          ${shared.length ? `<p class="sym-shared">Også ${kicker.toLowerCase()} i ${listStates(shared)}.</p>` : ''}
          ${pageCredit(`${history ? `Historie: <a href="${escapeHTML(history.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(history.source)}</a>` : ''}${img?.uri ? `${history ? ' &middot; ' : ''}Foto: Wikimedia Commons` : ''}`)}
        </div>
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
  if (key === 'stater' && sub === 'folkevalg') return stateMeasures.some((m) => m.state === activeState);
  // Senate and House: only while paging through new numbers (everything else has been shown already).
  if (isContest(key) && sub === 'siste') return batches[key] ? !!(batches[key]!.page || batches[key]!.queue.length) : !!prev && recentOf(key, prev.races[key]).length > 0;
  if (key === 'stater' || sub !== 'skifter' || !prev) return true;
  return flips(prev.races[key]).length > 0;
}

const pageOf = (key: TabKey, sub: string): HTMLElement => (isContest(key) ? views[key].el[sub as Sub] : extra[key][sub]);

function go(key: TabKey, sub: string) {
  pauseRecent();
  const was = pageOf(current.key, current.sub);
  if (key === 'stater' && (current.key !== 'stater' || pendingState)) nextState();
  if (key === 'stater' && !hasContent(key, sub)) sub = 'valget';
  if (key === 'stater' && activeState && current.sub !== sub) {
    measurePage = 0;
    renderStateMeasures(activeState);
  }
  const next = pageOf(key, sub);
  // Entering a tab: build its subpage list, and pick the next state for a fact sheet.
  if (key !== current.key || !$('subs').childElementCount) {
    const label = { stenger: 'Stengetider', stater: '' }[key as 'stenger' | 'stater'];
    // A tab with a single page needs no page list.
    $('subs').innerHTML = (label !== undefined ? `<span class="sublabel" id="sublabel">${label}</span>` : '') + (TAB_SUBS[key].length < 2 ? '' : TAB_SUBS[key].map((s) => `<span class="sub" data-s="${s}">${SUB_LABEL[s]}<span class="cnt"></span><span class="fill"></span></span>`).join(''));
  }
  if (key === 'stater' && activeState) {
    $('sublabel').innerHTML = `${flagImg(activeState, 'flag')}<span>${STATE_NAME[activeState]}</span>`;
    frame.querySelector<HTMLElement>('.sub[data-s="folkevalg"]')!.hidden = !hasContent(key, 'folkevalg');
  }
  if (key === 'stenger') renderClosings();
  if (isContest(key)) frame.querySelector<HTMLElement>('.sub[data-s="siste"]')!.hidden = !(hasContent(key, 'siste') || sub === 'siste');
  if (isContest(key)) frame.querySelector<HTMLElement>('.sub[data-s="siste"] .cnt')!.textContent = pageLabel(key);
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
  // Let the page transition finish before revealing updates and their highlights.
  if (isContest(key) && sub === 'siste') startRecent(views[key], 700);

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
    if (on && auto && !holding) nextFrame(() => { fill.style.transition = `width ${holdMs()}ms linear`; fill.style.width = '100%'; });
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
  if (current.key === 'stater' && current.sub === 'folkevalg' && activeState) {
    const count = stateMeasures.filter((m) => m.state === activeState).length;
    if ((measurePage + 1) * MEASURES_PER_PAGE < count) {
      measurePage++;
      renderStateMeasures(activeState);
      go('stater', 'folkevalg');
      return;
    }
  }
  // Senate and House: page through every race the updates changed before anything else.
  const paged = nextPage();
  if (paged) {
    renderRecent(views[paged], prev!.races[paged]);
    go(paged, 'siste');
    return;
  }
  // Governors: show their new numbers, at most one jump per three pages.
  const jump = pendingJump;
  pendingJump = null;
  if (jump && current.sub !== 'siste' && Date.now() - lastJump > 3 * HOLD_MS && hasContent(jump, 'siste')) {
    lastJump = Date.now();
    go(jump, 'siste');
    return;
  }
  // While numbers keep coming, skip the fillers (closing times, state pages) and show Oversikt every other round.
  const busy = fresh();
  const seq = TAB_KEYS.flatMap((k) => TAB_SUBS[k].map((s) => [k, s] as [TabKey, string]));
  let i = seq.findIndex(([k, s]) => k === current.key && s === current.sub);
  for (let n = 0; n < seq.length; n++) {
    i = (i + 1) % seq.length;
    const [k, s] = seq[i];
    if (!hasContent(k, s)) continue;
    if (busy && !isContest(k)) continue;
    if (busy && s === 'oversikt' && (overviewSkip[k as Key] = !overviewSkip[k as Key])) continue;
    break;
  }
  go(...seq[i]);
}

const overviewSkip: Partial<Record<Key, boolean>> = {};
let lastJump = 0;
let holding = false;
function schedule() {
  clearTimeout(rotateTimer);
  if (auto && !holding && playing) rotateTimer = window.setTimeout(advance, holdMs());
}

/* ================================================================= cards */

type Card =
  | { kind: 'call'; c: Contest; race: RaceState }
  | { kind: 'callband'; c: Contest; race: RaceState }
  | { kind: 'batch'; c: Contest; races: RaceState[]; flipsOnly?: boolean }
  | { kind: 'control'; c: Contest; party: Party };

const queue: Card[] = [];
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
      if (c.kind === 'call' || c.kind === 'callband') { g.races.push(c.race); g.flipsOnly = false; }
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
  winner?: { candidate: Candidate; slot: Party; party: Side };
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
      <div class="ti${c.need ? '' : ' governor-impact'}">
        <div class="tk">${c.tab}${c.need ? ` &middot; ${c.need.D} for flertall` : ''}</div>
        <div class="inums">
          <div class="d"><span>${NAME.D}</span><b class="num">${s.D}</b></div>
          <div class="r"><span>${NAME.R}</span><b class="num">${s.R}</b></div>
        </div>
        <div class="bar ibar">
          <span class="seg d" style="left:0;--w:${w(s.D)}"></span>
          <span class="seg dl" style="left:${w(s.D)};--w:${w(t.leading.D)}"></span>
          <span class="seg dh" style="left:${w(s.D + t.leading.D)};--w:${w(t.open.D)}"></span>
          <span class="seg i" style="left:${w(s.D + t.leading.D + t.open.D)};--w:${w(t.won.I)}"></span>
          <span class="seg ih" style="left:${w(s.D + t.leading.D + t.open.D + t.won.I)};--w:${w(t.open.I)}"></span>
          <span class="seg rh" style="right:${w(s.R + t.leading.R)};--w:${w(t.open.R)}"></span>
          <span class="seg rl" style="right:${w(s.R)};--w:${w(t.leading.R)}"></span>
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
  const photoCredits = [...new Set((['D', 'R'] as Party[]).flatMap((p) => {
    const c = r.seed.cand[p];
    return c?.photoCredit ? [c.photoCredit] : isWiki(c?.photo) ? ['Wikipedia / Wikimedia Commons'] : [];
  }))];
  const credit = [r.calledBy && `Utropt av ${r.calledBy}`, r.src && `Tall: ${r.src}`, photoCredits.length && `Foto: ${photoCredits.join(', ')}`].filter(Boolean).join(' &middot; ');
  return { ms: 7500, html: `<div class="tcs">${cand(w)}${l === w ? `<div class="tc none"><div class="tn">${NO_CAND}</div></div>` : cand(l)}</div><div class="tfoot num">${r.reported > 0 ? `${pct0(r.reported * 100)} av forventede stemmer er talt` : r.votes ? `${nbInt(r.votes)} stemmer talt` : 'Andel opptalt ukjent'}${credit ? ` &middot; ${credit}` : ''}</div>` };
}

function tilesStep(races: RaceState[]): Step {
  return {
    ms: 5000 + Math.min(races.length, 16) * 150,
    html: `<div class="tiles${races.length > 12 ? ' dense' : ''}">${races.slice(0, 16).map((r, i) => {
      const flip = isFlip(r);
      return `<div class="tile ${col(r, r.winner!)}" style="transition-delay:${200 + i * 90}ms">
        <b>${r.seed.name}</b><span>${sideName(r, r.winner!)}${flip ? ' &middot; skifte' : ''}</span></div>`;
    }).join('')}${races.length > 16 ? `<div class="tile more">+${races.length - 16} til</div>` : ''}</div>`,
  };
}

/** Six House winners per page keep portraits and full names legible on air. */
function houseWinnersSteps(races: RaceState[]): Step[] {
  const shown = races.slice(0, 16);
  const steps: Step[] = [];
  for (let start = 0; start < shown.length; start += 6) {
    const page = shown.slice(start, start + 6);
    const credits = [...new Set(page.flatMap((r) => {
      const candidate = who(r, r.winner!);
      return candidate?.photoCredit ? [candidate.photoCredit] : isWiki(candidate?.photo) ? ['Wikipedia / Wikimedia Commons'] : [];
    }))];
    steps.push({
      ms: 6500,
      html: `<div class="tiles house-winners">${page.map((r, i) => {
        const w = r.winner!;
        const candidate = who(r, w);
        return `<div class="tile ${col(r, w)}" style="transition-delay:${200 + i * 90}ms">
          ${photo(candidate, w, '', partyOf(r, w))}
          <div class="winner-details">
            <div class="winner-heading"><b class="district">${escapeHTML(r.seed.id)}</b><span>✓ Vinner${isFlip(r) ? ' · skifte' : ''}</span></div>
            <b class="winner-name">${escapeHTML(candidate?.name ?? sideName(r, w))}</b>
          </div>
        </div>`;
      }).join('')}</div><div class="tfoot">${start + 1}–${start + page.length} av ${races.length} avgjorte løp${credits.length ? ` · Foto: ${escapeHTML(credits.join(', '))}` : ''}</div>`,
    });
  }
  return steps;
}

function sequenceFor(c: Card): Sequence {
  if (c.kind === 'call' || c.kind === 'callband') {
    const r = c.race;
    const w = r.winner!;
    const wp = winnerParty(r)!;
    const flip = isFlip(r);
    const seat = c.c.key === 'guv' ? 'guvernørsetet' : 'setet';
    const wn = who(r, w);
    // Two candidates from one party (e.g. a California top-two race): say who, not which party.
    const sameParty = partyOf(r, 'D') === partyOf(r, 'R');
    return {
      colour: `var(--${col(r, w)})`,
      kicker: `${c.c.tab} &middot; avgjort${flip ? ' <span class="tagflip">Skifte</span>' : ''}`,
      title: r.seed.name,
      winner: (c.c.key === 'senat' || c.c.key === 'huset') && wn ? { candidate: wn, slot: w, party: wp } : undefined,
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
    return {
      colour: 'var(--ink)',
      kicker: `${c.c.tab} &middot; ${c.flipsOnly ? 'skifter parti' : 'avgjort'}`,
      title: c.flipsOnly ? `${n} ${n === 1 ? 'sete skifter' : 'seter skifter'} parti` : `${n} løp avgjort`,
      verdict: `${d} til demokratene, ${n - d} til republikanerne`,
      long: true,
      openMs: 4500,
      steps: [...(c.c.key === 'huset' ? houseWinnersSteps(c.races) : [tilesStep(c.races)]), impactStep(c.c, null)],
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
  pauseRecent();
  holding = true;
  pauseTicker();
  clearTimeout(rotateTimer);
  frame.querySelectorAll<HTMLElement>('.sub .fill').forEach((f) => { f.style.transition = 'none'; f.style.width = '0'; });
  const t = $('take');
  t.style.setProperty('--c', s.colour);
  t.classList.toggle('long', !!s.long);
  t.classList.toggle('has-winner', !!s.winner);
  t.innerHTML = `
    <div class="tl">
      <div class="kick">${s.kicker}</div>
      <h2>${s.title}</h2>
      ${s.winner ? `<div class="call-winner-name">${escapeHTML(s.winner.candidate.name)}</div>` : ''}
      <p>${s.verdict}</p>
      ${s.winner ? `<figure class="call-winner">
        ${photo(s.winner.candidate, s.winner.slot, '', s.winner.party)}
        ${s.winner.candidate.photoCredit || isWiki(s.winner.candidate.photo) ? `<small>Foto: ${escapeHTML(s.winner.candidate.photoCredit ?? 'Wikipedia / Wikimedia Commons')}</small>` : ''}
      </figure>` : ''}
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
  renderLatest();
  el.classList.remove('hide');
  holding = false;
  if (playing) resumeTicker();
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

function pauseTicker() {
  cancelAnimationFrame(tickerFrame);
  tickerFrame = 0;
  for (const item of tickerItems) item.animation.pause();
}

function resumeTicker() {
  for (const item of tickerItems) item.animation.play();
  renderLatest();
}

/** Admit the next entry once the preceding entry's trailing edge leaves room. */
function scheduleTicker() {
  if (tickerFrame || !tickerItems.size || !playing || holding) return;
  tickerFrame = requestAnimationFrame(() => {
    tickerFrame = 0;
    renderLatest();
  });
}

function renderLatest() {
  const el = $('latest');
  const tail = [...tickerItems].at(-1);
  if (tail) {
    // All entries move at the same speed, so a fixed gap never closes.
    const distance = Number(tail.animation.currentTime ?? 0) / 1000 * TICKER_SPEED;
    if (distance < tail.width + TICKER_GAP) { scheduleTicker(); return; }
  }
  const update = resultUpdates.take();
  if (update) {
    if (!tickerItems.size) {
      el.innerHTML = '<span class="k">Siste</span><div class="ticker-window"></div>';
    }
    const viewport = el.querySelector<HTMLElement>('.ticker-window')!;
    const line = document.createElement('span');
    line.className = 'ticker-item';
    line.textContent = formatResultUpdate(update, C[update.contest as Key].short.toLowerCase(), mode !== 'demo');
    viewport.appendChild(line);
    const width = line.offsetWidth;
    const animation = line.animate([
      { transform: `translateX(${viewport.clientWidth}px)` },
      { transform: `translateX(${-width}px)` },
    ], { duration: (viewport.clientWidth + width) / TICKER_SPEED * 1000, easing: 'linear' });
    const item = { line, animation, width };
    tickerItems.add(item);
    animation.onfinish = () => {
      tickerItems.delete(item);
      line.remove();
      renderLatest();
    };
    if (!playing || holding) animation.pause();
    scheduleTicker();
    return;
  }
  if (tickerItems.size) { scheduleTicker(); return; }
  const races = prev ? CONTESTS.flatMap((c) => prev!.races[c.key]) : [];
  const reporting = races.filter((r) => r.status !== 'waiting').length;
  const called = races.filter((r) => r.status === 'called').length;
  el.innerHTML = `<span class="k">Opptelling</span><span>${reporting || called
    ? `Stemmetall fra ${reporting} av ${races.length} løp · ${called} avgjort`
    : 'Venter på de første stemmetallene'}</span>`;
}

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
  // Attach bundled portraits before creating call screens from fresh feed candidates.
  if (!snap.quiet) fillPortraits();
  if (old && !snap.quiet) noteChanges(old, snap);
  if (activeState) renderStateElection(activeState);
  for (const c of CONTESTS) {
    const v = views[c.key];
    const rs = snap.races[c.key];
    renderHeaderSeats(c, rs);
    renderOverview(v, rs);
    renderClosest(v, rs, now);
    renderRecent(v, rs);
    renderFlips(v, rs);
  }
  placeIndicator();
  if (!old || snap.quiet) {
    renderLatest();
    return;
  }

  renderLatest();
  const cards: Card[] = [];
  for (const c of CONTESTS) {
    const called = newlyCalledRaces(old.races[c.key], snap.races[c.key]);
    if (c.key === 'huset') {
      // Announce holds too; batch simultaneous calls to keep up with 435 races.
      if (called.length === 1) cards.push({ kind: 'call', c, race: called[0] });
      else if (called.length > 1) cards.push({ kind: 'batch', c, races: called });
    } else {
      // Calls made the moment polls close are expected; announce them together.
      const before = new Map(old.races[c.key].map((r) => [r.seed.id, r]));
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
  for (const stage of recentStages.values()) clearTimeout(stage.timer);
  recentStages.clear();
  for (const b of Object.values(batches)) { b!.queue.length = 0; b!.queuedAt.clear(); b!.page = null; b!.pageNo = 0; }
  prev = null;
  queue.length = 0;
  pauseTicker();
  for (const item of tickerItems) { item.animation.cancel(); item.line.remove(); }
  tickerItems.clear();
  resultUpdates.clear();
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
    if (isContest(current.key) && current.sub === 'siste') startRecent(views[current.key], 700);
    if (!holding) resumeTicker();
    frame.classList.add('on');
    if (mode !== 'live') startSample();
    schedule();
  },
  stop() {
    pauseRecent();
    playing = false;
    pauseTicker();
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
    go(k, s && TAB_SUBS[k].includes(s) ? s : TAB_SUBS[k].find((x) => hasContent(k, x)) ?? TAB_SUBS[k][0]);
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
function applyFeed(feed: Feed) {
  const now = etHours(new Date());
  const hasNumbers = CONTESTS.some((c) => (feed[c.key] ?? []).some((f) => f.status !== 'waiting'
    && c.seeds.some((s) => s.id === f.id && (q.get('early') === '1' || now >= s.closesET))));
  if (hasNumbers) goLive();
  if (mode === 'demo') return;
  const base = prev ?? waitingSnapshot();
  apply({
    when: new Date(),
    races: Object.fromEntries(CONTESTS.map((c) => {
      const byId = new Map((feed[c.key] ?? []).map((r) => [r.id, r]));
      return [c.key, base.races[c.key].map((r) => {
        const f = byId.get(r.seed.id);
        if (!f) return r;
        // Production payloads carry both candidates and results; manual pushes may include either.
        const seed = f.candidates ? { ...r.seed, incumbent: f.incumbent ?? r.seed.incumbent, cand: { ...r.seed.cand, ...f.candidates }, unopposed: f.unopposed } : r.seed;
        const named = seed === r.seed ? r : { ...r, seed };
        // State feeds may post test numbers before their polls close; never show those.
        if (q.get('early') !== '1' && etHours(new Date()) < seed.closesET) return named;
        return { seed, reported: f.reported, votes: f.votes, dem: f.dem, status: f.status, winner: f.winner, calledBy: f.calledBy, src: f.src,
          calledAt: f.status === 'called' ? r.calledAt ?? Date.now() : undefined };
      })];
    })) as Record<Key, RaceState[]>,
  });
}

const FEED = q.get('feed') ?? 'https://civicapi.org';
// Track provider timestamps per contest: a successful fetch can still contain old data.
const feedUpdated: Partial<Record<Key, number>> = {};
const feedSeen = new Set<Key>();
const feedErrors = new Set<Key>();
/** Set while applying a contest's first poll of this launch (and nothing was restored for it). */
let baselineKey: Key | null = null;
async function getJSON(path: string): Promise<CivicRace> {
  // Keep the timeout active through reading/parsing the response body.
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, no) => {
    timer = setTimeout(() => no(new Error('timeout')), 15_000);
  });
  try {
    return await Promise.race([(async () => {
      const res = await fetch(FEED.replace(/\/$/, '') + path);
      if (!res.ok) throw new Error(`${res.status}`);
      return await res.json();
    })(), timeout]);
  } finally { clearTimeout(timer!); }
}
function fillPortraits() {
  if (!prev || mode === 'demo' || q.get('photos') === '0') return;
  const jobs = (['senat', 'guv', 'huset'] as Key[]).flatMap((k) => prev!.races[k].flatMap((r) =>
    (['D', 'R'] as Party[]).map((p) => r.seed.cand[p]).filter((c): c is Candidate => !!c)
      .map((c) => ({ c, state: STATE_NAME[r.seed.state], statewide: k !== 'huset' }))));
  findPortraits(jobs, () => { if (prev) apply({ ...prev, when: new Date(), quiet: true }); });
}
async function pollContest(key: Key) {
  try {
    const data = await getJSON(`/api/v2/race/${CIVIC_RACES[key]}`);
    const races = parseCivicRace(key, data);
    if (!races.length) throw new Error('No usable races in civicAPI response');
    const updated = Date.parse(data.last_updated ?? '');
    // Do not roll results back when an upstream cache serves an older snapshot.
    if (feedUpdated[key] && Number.isFinite(updated) && updated < feedUpdated[key]!) return;
    // The initial waiting frame is already our baseline: announce calls in the
    // first response as well as subsequent updates, once per call transition.
    baselineKey = feedSeen.has(key) ? null : key;
    try { applyFeed({ [key]: races }); } finally { baselineKey = null; }
    feedSeen.add(key);
    feedUpdated[key] = Number.isFinite(updated) ? updated : 0;
    feedErrors.delete(key);
    saveResults();
  } catch (e) {
    feedErrors.add(key);
    console.warn(`civicAPI ${key}`, e);
  }
  showSource();
}
function showSource() {
  if (mode === 'demo') return;
  const key = isContest(current.key) ? current.key : 'senat';
  const updated = feedUpdated[key];
  const stale = feedErrors.has(key) || !updated || Date.now() - updated > 5 * 60_000;
  $('source').textContent = !feedSeen.has(key)
    ? feedErrors.has(key) ? 'civicAPI · kan ikke hente tall' : 'civicAPI · venter på valgresultater'
    : stale
      ? `civicAPI · sist oppdatert ${updated ? osloFmt.format(new Date(updated)) : 'ukjent'}`
      : 'civicAPI · uoffisielle tall';
}
function startFeed() {
  if (mode === 'demo' || FEED === 'off') return;
  // Poll each contest independently: an outage must not stop the other feeds.
  for (const c of CONTESTS) {
    const poll = async () => {
      await pollContest(c.key);
      setTimeout(poll, 10_000);
    };
    void poll();
  }
  setInterval(showSource, 1000);
}

/* ============================================ saved results (relaunch) */

// The last results are kept in the browser (CasparCG 2.5 keeps CEF storage on disk), so a relaunch
// opens with them instead of "venter på valgresultater" and doesn't announce every call again.
const SAVE_KEY = 'mellomvalg-snapshot-v1';
const SAVE_MAX_AGE = 24 * 3600e3;
type SavedRace = Pick<RaceState, 'status' | 'reported' | 'votes' | 'dem' | 'winner' | 'calledBy' | 'src' | 'calledAt'>
  & Pick<RaceState['seed'], 'cand' | 'incumbent' | 'unopposed'> & { id: string };
interface Saved { savedAt: number; updated: Partial<Record<Key, number>>; changed: [string, number][]; races: Partial<Record<Key, SavedRace[]>> }

function saveResults() {
  if (mode !== 'live' || !prev) return;
  const races: Saved['races'] = {};
  for (const c of CONTESTS) {
    races[c.key] = prev.races[c.key].filter((r) => r.status !== 'waiting' || r.seed.cand.D || r.seed.cand.R).map((r) => ({
      id: r.seed.id, status: r.status, reported: r.reported, votes: r.votes, dem: r.dem, winner: r.winner, calledBy: r.calledBy,
      src: r.src, calledAt: r.calledAt, cand: { D: withoutPhoto(r.seed.cand.D), R: withoutPhoto(r.seed.cand.R) },
      incumbent: r.seed.incumbent, unopposed: r.seed.unopposed,
    }));
  }
  const saved: Saved = { savedAt: Date.now(), updated: feedUpdated, changed: [...changedAt], races };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  } catch (e) {
    // No storage, or full: the next launch starts from scratch. Say so once.
    if (!saveFailed) console.warn('Could not save results for relaunch', e);
    saveFailed = true;
  }
}
let saveFailed = false;
/**
 * Portraits are embedded images (a few hundred KB each): with them the snapshot outgrows the
 * storage quota after the first poll and every later save fails. They come back from the
 * portrait catalogue at launch (fillPortraits), so keep only names and labels.
 */
function withoutPhoto(c: Candidate | null): Candidate | null {
  if (!c) return c;
  const { photo: _p, photoCredit: _c, photoSource: _s, ...rest } = c;
  return rest;
}

/** The saved results as a snapshot, or null if there are none (or they're over a day old). */
function restoreResults(): Snapshot | null {
  let saved: Saved;
  try {
    if (q.get('reset') === '1') { localStorage.removeItem(SAVE_KEY); return null; }
    saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
  } catch { return null; }
  if (!saved?.races || !(Date.now() - saved.savedAt < SAVE_MAX_AGE)) return null;
  for (const c of CONTESTS) {
    const u = saved.updated?.[c.key];
    if (u) { feedUpdated[c.key] = u; feedSeen.add(c.key); }
  }
  for (const [k, t] of saved.changed ?? []) { changedAt.set(k, t); lastChange = Math.max(lastChange, t); }
  return {
    when: new Date(),
    quiet: true,
    races: Object.fromEntries(CONTESTS.map((c) => {
      const byId = new Map((saved.races[c.key] ?? []).map((r) => [r.id, r]));
      return [c.key, c.seeds.map((seed) => {
        const r = byId.get(seed.id);
        if (!r) return { seed, status: 'waiting' as const, reported: 0, dem: 50 };
        const { id: _, cand, incumbent, unopposed, ...numbers } = r;
        return { ...numbers, seed: { ...seed, cand: cand ?? seed.cand, incumbent: incumbent ?? seed.incumbent, unopposed } };
      })];
    })) as Record<Key, RaceState[]>,
  };
}

/* First frame: no cards for what came before. */
if (mode === 'demo') {
  $('source').textContent = 'Demo: oppdiktede tall, kandidatnavn skjult';
  // Demo must not present invented numbers as civicAPI results.
  $('service').textContent = 'Demo med oppdiktede tall og skjulte kandidatnavn';
  apply(sampleSnapshot(clock));
} else {
  $('sample').hidden = true;
  $('source').textContent = 'civicAPI · venter på valgresultater';
  // Pick up where the last launch left off: those numbers and calls are the baseline, so only new calls get a card.
  const restored = FEED === 'off' ? null : restoreResults();
  if (restored && CONTESTS.some((c) => restored.races[c.key].some((r) => r.status !== 'waiting'))) goLive();
  apply(restored ?? waitingSnapshot());
  if (restored) showSource();
  // The saved results carry no photos: put the portraits back without waiting for the first poll.
  if (restored) fillPortraits();
}
renderClosings();
const v0 = q.get('view');
if (v0) api.invoke(v0); else go('senat', 'oversikt');
if (q.get('autoplay') !== '0') api.play();
startFeed();
