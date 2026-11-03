# Mellomvalg (People's Tally prototype)

US midterms results board in Norwegian for a **1280x720 (720p50) CasparCG
HTML channel**. Vite + TypeScript, no framework. `npm run build` gives one
self-contained `dist/index.html` (JS, CSS and fonts inlined).

Text and results use the 90% safe region: **1152 × 648 at (64, 36)** within the
1280 × 720 frame. Pages use a 334 px content area with four 76 px race rows;
call sequences fill the space between the notice and the clocks. The notice
background extends to the top and side edges to sit behind the channel bug.

Three modes:
- **Waiting (default):** real clocks, real nominees, "Stenger 7:00 PM EST" /
  "Venter på tall" per race. No numbers until results are pushed.
- **Demo (`?demo=1`):** replays an invented night to show the motion. Candidate
  names are hidden here, so no real person is shown next to an invented result.
- **Live:** after the first `update()` push. Credits "Vi viser valgdata fra
  People's Tally som en tjeneste til våre seere".

Nominees for Senate and governor are in `src/candidates.json`, read from
Wikipedia on 3 Nov 2026. The Senate page looked stale (newest data June 2026)
and some nominees are missing (null); verify before air. The feed can override
names and add photos per race (`candidates` below). House names come from the
feed only.

## Always on screen
- Notice: "Ordinære sendinger utgår – se frikanalen.no/protest for informasjon",
  with "Vi viser valgdata fra People's Tally som en tjeneste til våre seere"
  under it (in demo mode it says the numbers are invented instead)
- "Mellomvalg" and the tabs, the source credit
- Clocks: New York, Chicago, Denver, Los Angeles, Alaska, Hawaii (12-hour) and
  Oslo station time (24-hour)

## Tabs and pages
Senatet / Representantenes hus / Guvernører, each with Oversikt, Jevneste løp,
Skifter parti. On Oversikt the seat bar fills from each end with seats won (solid)
and leading (soft); seats with no numbers yet are softly striped in the colour
of the party holding them now, with a small legend under the bar. Then two tabs for quiet stretches:
- **Stengetider:** one page: the next poll closing on top (Oslo and ET time,
  a countdown, and the states with their flags), the rest of the night's
  closings underneath. Times come from The People's Tally (`polls` in
  core.json, refreshed with it; snapshot in `src/polls.json`). The tab hides
  itself after the last close (1 AM ET, 07:00 Oslo).
- **Delstatene:** a fact sheet per visit: Fakta (flag, the state's outline,
  where it is in the US, capital, largest city, 2020 population, area compared
  with mainland Norway, statehood, poll close), Delstatsfugl and
  Delstatsblomst (photo, uncropped at its own aspect) and Visste du? (trivia).
  Dette valget shows Senate and governor candidates and a compact chip for
  each House district, with attribution at the bottom of the white panel.
  Called winners are highlighted with “✓ Vinner”; called House chips show
  a checkmark and the winning party's colour. These refresh with results,
  including corrections; counting races do not receive a winner marker.
  Senate and governor races show both vote shares, a party-coloured bar,
  and percentage counted. Provisional leaders show “↑ Leder”.
  Undecided House chips split their
  background by the two candidates' vote shares. Each chip uses a single
  line such as “TX-30 40%” or “✓ TX-20 100%”, with a thin count-progress
  bar along the bottom. Percentages always reflect actual count progress,
  including called races. Waiting chips show a dash over a striped split;
  called chips use a solid winning-party colour.
  Folkevalg appears only for states with ballot measures, two per page;
  NEXT and automatic rotation walk through all measures before moving on.
  Measures come from The People's Tally's `meas` field in core.json, with a
  bundled snapshot in `src/measures.json` and Norwegian editorial summaries.
  Translations are used only while the original description still matches;
  new or changed descriptions use the source text until translated.
  States whose polls close next come first.
  Facts in `src/states.ts`; flags from Wikimedia Commons rasterised into
  `src/flags.json` (Georgia missing, Wikimedia throttled it); outlines from
  `us-atlas` (US Census Bureau); bird and flower photos from each species'
  Wikipedia article, packed into `src/nature.json` by `tools/nature`. These
  pages credit their sources at the foot of the page, not in the subnav.

Rotates every `hold` seconds (default 9); "Skifter parti" is skipped while
empty. Calls interrupt any tab.

    PLAY 1-90 [HTML] "http://host/mellomvalg/index.html"
    CG 1-90 NEXT 0                 dismiss the card on screen, else next page
    CG 1-90 INVOKE 0 "huset"       go to a tab and hold (senat, huset, guv, stenger, stater)
    CG 1-90 INVOKE 0 "stater:TX"   fact sheet for one state
    CG 1-90 INVOKE 0 "auto"        resume rotation
    CG 1-90 UPDATE 0 "<json>"      push results
    CG 1-90 STOP 0                 fade out

Query: `t` (replay start, ET hours, e.g. 21.5), `speed` (sim minutes per
second), `hold`, `view` (e.g. `huset:jevne`), `auto=0`, `autoplay=0`.

## Real data: The People's Tally

By default the template reads The People's Tally open data itself
(CC BY 4.0, no key) from `https://thepeoplestally.com` (`?feed=` to change,
`?feed=off` to disable). Code: `src/peoplestally.ts`.

- `/data/core.json`, at start and every 10 min: candidates per race. One
  Democrat and one Republican per race; where there is no Democrat, the
  strongest other candidate takes that side with their own label (e.g.
  "Uavhengig"). Candidate portraits are embedded in
  `src/portrait-catalogue.json`, keyed by name and state. Sources include
  Congress, campaigns, government biographies, candidate profiles, and news
  coverage. The bundled photos also work offline. Missing photos use a
  bounded Wikipedia lookup, with initials as the fallback.
- `/data/results.json`, every 30 s: votes per candidate become two-party
  shares, `votes / exp` the share counted, a `winner` flag a call. The call
  screen names who called it (`called_by`) and the source (`src`).
- Numbers for a race are ignored until its polls have closed (state feeds may
  post test data before then; `?early=1` turns this off for testing).
- The first real numbers switch the board to live; the credit reads "The
  People's Tally (CC BY 4.0) · uoffisielle tall", or "Ingen nye tall siden …"
  if the feed has been quiet for 5 minutes.
- The core.json line format is undocumented; it was read from the data.
  The CasparCG browser does not enforce CORS, so it can fetch the files directly.

The portrait audit in `tools/portraits/coverage.json` lists every displayed
candidate without a bundled photo. It covers the two slots selected by the
app per race, plus the offline statewide nominees. Bundled photos are applied
on startup and after both feed and manual updates. Discovered photos survive
replacement feed objects; unsuccessful lookups expire. Demo mode continues
to hide candidates. Source links, credits, reviewed crops, and image
fingerprints are recorded in `tools/portraits/campaign-sources.json` for the
additional portraits. See `tools/README.md` for the refresh workflow.

## Pushing results by hand (optional)

```json
{
  "senat": [{ "id": "GA", "reported": 0.82, "dem": 50.8, "status": "counting",
              "candidates": { "R": { "name": "…", "photo": "https://…/headshot.jpg" } } }],
  "huset": [{ "id": "PA-7", "reported": 1, "dem": 49.1, "status": "called", "winner": "R" }],
  "guv":   [{ "id": "AZ", "reported": 0.4, "dem": 50.2, "status": "counting" }]
}
```

`dem` is the Democratic share of the two-party vote. Races left out keep their
last state. Each push is diffed against the last; the diff drives the motion.

## What moves, and when
- Every update: numbers count to their new value, bars grow, the dot by the
  Oslo clock pulses.
- Changing page: the tab underline slides, the page slides out left and the
  next in from the right; a line under the page name fills while it is held.
- Jevneste løp: rows re-sort by margin and slide; a called row fills with the
  party colour ("beholder", or "vinner" with a "Skifte" tag), holds 4.5 s, leaves.
- Every call is a full-screen sequence (all but the notice band and clocks),
  then the rotation resumes. A thin line per step shows progress; `CG NEXT`
  skips a step.
  - Single Senate/governor call (about 20 s): 1) state name and verdict on the
    full party colour; 2) the colour shrinks to a left column and both
    candidates appear, the winner first, the loser dimmed, bars growing;
    3) what it means: seat totals, the bar to the majority line, one sentence.
  - Poll-close batch / House seats changing hands: 1) "6 løp avgjort";
    2) a tile per state or district in the party colour; 3) what it means.
  - A backlog of more than four calls is folded into one batch per contest.
- Between sequences the band above the clocks shows "Siste".
- Control of a chamber: its own sequence (headline, then the totals), ahead
  of anything queued; afterwards the board lands on that chamber's overview.
