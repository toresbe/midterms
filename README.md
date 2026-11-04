# Mellomvalg (civicAPI)

US midterms results board in Norwegian for a **1280x720 (720p50) CasparCG
HTML channel**. Vite + TypeScript, no framework. `npm run build` gives one
self-contained `dist/index.html` (JS, CSS and fonts inlined).

Text and results use the 90% safe region: **1152 × 648 at (64, 36)** within the
1280 × 720 frame. Pages use a 334 px content area with four 76 px race rows;
call sequences fill the space between the notice and the clocks. The notice
background extends to the top and side edges to sit behind the channel bug.

Three modes:
- **Waiting (default):** real clocks, real nominees, "Stenger 7:00 PM EST" /
  "Venter på tall" per race. No numbers until live results arrive or are pushed manually.
- **Demo (`?demo=1`):** replays an invented night to show the motion. Candidate
  names are hidden here, so no real person is shown next to an invented result.
- **Live:** after the first live feed results or `update()` push. Credits "Vi viser valgdata fra
  civicAPI som en tjeneste til våre seere".

Nominees for Senate and governor are in `src/candidates.json`, read from
Wikipedia on 3 Nov 2026, with Florida Senate/governor names updated from
civicAPI on 4 Nov. The Senate page looked stale (newest data June 2026)
and some nominees are missing (null); verify before air. The live feed overrides
names; manual pushes can add photos per race (`candidates` below). House names come from the
feed only.

## Always on screen
- Notice: "Ordinære sendinger utgår – se frikanalen.no/protest for informasjon",
  with "Vi viser valgdata fra civicAPI som en tjeneste til våre seere"
  under it (in demo mode it says the numbers are invented instead)
- "Mellomvalg" and the tabs, the source credit
- Clocks: New York, Chicago, Denver, Los Angeles, Alaska, Hawaii (12-hour) and
  Oslo station time (24-hour)

## Tabs and pages
Senatet / Representantenes hus / Guvernører, each with Siste tall (the four
races whose numbers changed most recently; a row flashes when it changes),
Oversikt, Jevneste løp,
Skifter parti. Jevneste løp lists only races with vote counts and named
opponents; waiting races do not fill spare rows. Demo mode hides names.
On Oversikt the seat bar fills from each end with seats won (solid)
and leading (soft); seats with no numbers yet are softly striped in the colour
of the party holding them now, with a small legend under the bar. Then two tabs for quiet stretches:
- **Stengetider:** one page: the next poll closing on top (Oslo and ET time,
  a countdown, and the states with their flags), the rest of the night's
  closings underneath. Times use the retained People's Tally snapshot in `src/polls.json`
  (CC BY 4.0), credited on the closing-times page. The tab hides
  itself after the last close (1 AM ET, 07:00 Oslo).
- **Delstatene:** a fact sheet per visit: Fakta (flag, the state's outline,
  where it is in the US, capital, largest city, 2020 population, area compared
  with mainland Norway, statehood, poll close), Delstatsfugl and
  Delstatsblomst (photo, uncropped at its own aspect, with Norwegian histories
  of each symbol's selection) and Visste du? (trivia).
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
  Measures use the retained People's Tally snapshot in `src/measures.json`
  (CC BY 4.0) and Norwegian editorial summaries, with their own source credit.
  Translations are used only while the original description still matches;
  new or changed descriptions use the source text until translated.
  States whose polls close next come first.
  Facts in `src/states.ts`; adoption histories and per-entry source links for
  all 50 states in `src/symbol-history.ts`. School and club polls are distinct
  from formal adoption; where sources give no rationale, the copy says so.
  History and photo credits appear together below each symbol's text.
  Flags from Wikimedia Commons rasterised into
  `src/flags.json` (Georgia missing, Wikimedia throttled it); outlines from
  `us-atlas` (US Census Bureau); bird and flower photos from each species'
  Wikipedia article, packed into `src/nature.json` by `tools/nature`. These
  pages credit their sources at the foot of the page, not in the subnav.

Rotates every `hold` seconds (default 9); "Skifter parti" and "Siste tall" are
skipped while empty. Calls interrupt any tab. Fresh numbers come first: after
an update the next page change jumps to Siste tall on the contest with the
most changed races (at most once per three pages), and while any numbers have
changed in the last `quiet` seconds (default 300) the fillers (Stengetider,
Delstatene) are skipped and Oversikt shows every other round. When the numbers
stop, the full rotation comes back.

    PLAY 1-90 [HTML] "http://host/mellomvalg/index.html"
    CG 1-90 NEXT 0                 dismiss the card on screen, else next page
    CG 1-90 INVOKE 0 "huset"       go to a tab and hold (senat, huset, guv, stenger, stater)
    CG 1-90 INVOKE 0 "stater:TX"   fact sheet for one state
    CG 1-90 INVOKE 0 "auto"        resume rotation
    CG 1-90 UPDATE 0 "<json>"      push results
    CG 1-90 STOP 0                 fade out

Query: `t` (replay start, ET hours, e.g. 21.5), `speed` (sim minutes per
second), `hold`, `quiet` (seconds; see above), `view` (e.g. `huset:jevne`),
`auto=0`, `autoplay=0`.

## Real data: civicAPI

By default the template reads civicAPI v2 directly from `https://civicapi.org`
(no key). Use `?feed=` to change the origin to a compatible proxy, or
`?feed=off` to disable automatic fetching. Code: `src/civicapi.ts` and
`src/main.ts`.

- House: `/api/v2/race/87524` (435 district entries).
- Senate: `/api/v2/race/87528` (35 contests, including FL/OH specials).
- Governors: `/api/v2/race/87535` (36 contests).
- Each contest refreshes independently 10 seconds after its previous request
  completes. Requests time out after 15 seconds. A failed contest retains its
  previous results while the others continue updating.
- Calls in the first successful response are announced too. Later polls do not
  repeat unchanged calls; a corrected winner or a withdrawn and reissued call
  triggers a new announcement. House holds and flips both receive animations.
- Candidate names, actual party labels, votes, reporting percentages and winner
  flags come from each district/state's `region_results`. At-large House IDs
  such as `ak-al` map to `AK-1`. Missing entries retain their previous state;
  zero-vote entries are waiting, not missing. Explicit corrections can withdraw
  a call or return a race to waiting.
- The existing two-slot display shows one Democrat and one Republican where
  available, otherwise an independent or another candidate with their own party
  label. Vote shares are normalized over the two displayed candidates; total
  votes include all candidates. Same-party races retain the actual parties.
- `percent_reporting / 100` supplies progress. This is the provider's reporting
  percentage, not an independently calculated percentage of expected ballots.
  Unknown progress remains unknown. No winner is inferred from leads or progress:
  only an explicit candidate `winner: true` generates a call, credited to civicAPI.
- Production responses marked `test_data: true` are rejected, even with
  `?early=1`. Numbers are also suppressed until the state's first poll close;
  `?early=1` bypasses only that time gate for testing.
- Provider `last_updated` timestamps drive freshness for each contest. After
  five minutes, or on a request failure, the credit shows the last update time.
  A successful fetch of old data does not make it fresh, and older snapshots
  cannot overwrite newer ones.
- Current House seat parties come from the bundled civicAPI incumbent-party
  snapshot in `src/house-incumbents.json`. No forecast probabilities are used.
  Senate/governor incumbent candidates can also update the existing seat metadata.
- Candidate portraits remain bundled in `src/portrait-catalogue.json`, keyed
  by name and state. Missing photos use the existing bounded Wikipedia lookup
  with initials as fallback.
- The retained poll-closing and ballot-measure snapshots are static reference
  material, with their original People's Tally / Ballotpedia credits. There are
  no runtime requests to People's Tally.

### Attribution and reuse

civicAPI's [API documentation](https://civicapi.org/api-documentation) and
[usage policy](https://civicapi.org/faq) allow personal, non-commercial and
commercial use, including publishing live results. For non-personal projects,
attribution is required: link to civicapi.org (preferred) **or** mention civicAPI.
Checked 4 November 2026.

The non-demo notice always names civicAPI and links to https://civicapi.org/,
including during full-screen calls and feed failures. Results credits also name
civicAPI, and state election pages link to it. This supplies visible on-air
attribution as well as a clickable credit for web use. Demo mode explicitly
labels invented numbers and hides candidate names. Retained reference material
and photos keep their own credits; civicAPI is not labelled CC BY 4.0.

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
  - Single call (about 20 s): 1) state/district name and verdict on the
    full party colour; 2) the colour shrinks to a left column and both
    candidates appear, the winner first, the loser dimmed, bars growing;
    3) what it means: seat totals, the bar to the majority line, one sentence.
  - Poll-close batch / simultaneous House calls: 1) "6 løp avgjort";
    2) a tile per state or district in the party colour; 3) what it means.
  - A backlog of more than four calls is folded into one batch per contest.
- Before the first call, the band above the clocks shows "Opptelling": waiting
  for the first vote counts, then how many races have reported counts and how
  many are decided. It refreshes with each update. After a call it shows "Siste".
- Control of a chamber: its own sequence (headline, then the totals), ahead
  of anything queued; afterwards the board lands on that chamber's overview.

## Verification

Run `node --experimental-strip-types --test tools/civicapi/test.mjs` (Node 22.6+)
and `npm run build`. The adapter tests cover district IDs, third-party and
same-party candidates, explicit calls, test-data rejection and corrections.
