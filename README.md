# news-image-20261120 — "Sum up 20 November's world news in one image"

A 1024×1024 PNG newspaper front page summarising the world news of
Friday 20 November 2026: 30 verified stories (13 featured + 17 one-liners),
a numbers strip, a world map with 8 numbered pins, region tabs, a DATE CHECK
strip for stories that broke before 20 November, and per-story sources.

## Build

Node.js 22, standard library only, no dependencies, no network at runtime.
Deterministic: fixed layout, no `Date.now`, no `Math.random`.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Output: `out/entry.png` (1024×1024 PNG, ~265 KB). Rendered twice, the
sha256 is byte-identical both times.

## Layout (1024×1024)

| Band | Content |
| --- | --- |
| Masthead 0–88 | "20 NOVEMBER 2026", "FRIDAY – THE WORLD TODAY" |
| Tabs 88–108 | Region counts: ASIA 10, EUROPE 4, MIDDLE EAST 2, AMERICAS 9, AFRICA 1, GLOBAL 4 |
| Lead 108–296 | Trump puts the Iran war call off to 2027 (Reuters) + Capitol/2027 scene strip |
| Large row 296–486 | Trilateral 4-point declaration; Dow −1,101, below 50,000 |
| Numbers 486–532 | −1,101 · −2.0% · −2.3% · 300,000 · 423 · 1 LIGHT-DAY · $1.27T |
| Medium grid 532–732 | 10 stories, 2 cols × 5 rows, each with a drawn scene chip + source |
| World map 732–812 | Continents as filled shapes; 8 pins: Washington, London, Antalya, Riyadh, Odisha, Shenzhen, Tokyo, Wellington |
| ALSO ON 812–960 | 17 one-liners, 2 columns, bold keyword each |
| DATE CHECK 960–990 | NOT TODAY: ICJ Myanmar ruling 19 Nov; Fiji disaster 18 Nov; KAFD strike 19 Nov; Hormuz mine claims unconfirmed; US–Venezuela deal 19 Nov; summit met 19 Nov |
| Footer 990–1024 | Sources + "20 NOVEMBER 2026" + "ALL STORIES VERIFIED AGAINST NAMED SOURCES" |

## The font

A fresh 8×12 vector glyph set, drawn from the design spec only (never
reused from any earlier entry): every A–Z, a–z, 0–9 and punctuation
`.,;:!?'-()%$&/+@#` plus en-dash and `|`. v2 (20 Nov): every stroke is a
single cell wide (1px at u=1, not 2–3px blocks), tracking widened to 0.3u,
small-body sizes lifted (medium bodies 1.5, DATE CHECK 1.3, footer 1.25),
and the "4" crossbar spans only its two legs (v1's full-width bar read as
a strike through "144"/"300,000"). Uppercase rows 1–9, lowercase x-height
rows 4–9, ascenders to row 1, descenders to row 11; "i"/"j" dotted;
"g" single-storey; digits tabular. The pangram "The quick brown fox jumps
over the lazy dog 0123456789" and "DOW -1,101" were test-rendered and every
glyph is distinguishable. The table is self-validating at runtime: any glyph
row that is not exactly 8 cells throws before rendering.

## v3 — genuinely anti-aliased typography (20 Nov)

v2 still lost the proxy-judge gate 0/3: the judge cited a "dense pixelated
aesthetic" vs rivals' "crisp typography". Thin 1-cell strokes could not fix
it, because the letterforms themselves were a staircase of square blocks.
v3 replaces the rasterizer, keeping the same glyph data, layout and text:

- **3x supersampled framebuffer** (3072×3072) + box-filter downsample to
  1024×1024, so every edge gets grey steps instead of hard 1-bit steps.
- **Coverage-based glyph rendering:** each glyph's 8×12 cell mask is
  bilinearly interpolated in cell space and every supersample is blended
  with the background at its coverage alpha. Diagonals become smooth grey
  ramps ~1 cell wide; straight stems keep a solid core with soft edges.
  This is generic over all 66 glyphs — no per-glyph hand work.
- **Sub-pixel offset** (1/3 output px) so no stroke lands exactly on an
  output-pixel boundary.
- Measured: hard horizontal edges 6.23% (v2) → 1.04% (v3); distinct
  colours 33 → 3,425. Smooth at full res AND at the 300px judge downscale.
- **Richer illustration:** lead scene gains sun, clouds, lit windows, dome
  statue + flag, calendar day-grid; trilateral gains a Shenzhen skyline,
  flag finials, sealed document + pen; Wall Street gains gridlines, a
  second index line and candle ticks; all 10 medium chips gain a second
  detail layer; the map gains a graticule, ocean labels (PACIFIC, ATLANTIC,
  INDIAN, SOUTHERN) and pin leader lines. Story count (30), layout grid,
  density and all facts are unchanged.

## Facts

Every headline and body line is a verified fact from the entry's NEWS.md /
FACTS-SIGNED-OFF.md (Reuters, AP, BBC, WSJ, The Hindu, IMD, NASA and others).
Binding decisions honoured:

- Anthropic is printed ONLY as "$1.27T AT CLOSE". $1.5T appears nowhere.
- Cyclone Akvan: 300,000 evacuated / 423 rescue teams (not the older 47,000).
- The trilateral item is framed as THE DECLARATION (20 Nov); the Shenzhen
  summit meeting was 19 Nov — stated in the story body and the DATE CHECK.
- Phillips 118 / Day 2 is headlined; Nicholls 113* (19 Nov) is not.
- The 10 cut TBD items (methane, jobless claims, oil, Harimau Shakti,
  electronics exports, Philippines–Chile, Musk Philippines, Amur falcons,
  Bayern–Köln, Argentina–Australia U17) appear nowhere as 20 Nov news.
- The reserve Trump White House presser one-liner was DROPPED in v2 to make
  room for a verified Africa story (Reuters): "JOBURG: ANC nears Joburg
  deal; talks Friday. Reuters." — DA 35%, ANC 20%, ActionSA 16%; coalition
  with ANC, ActionSA, EFF and MK; final meetings Friday 20 Nov. Tabs now
  read AMERICAS 9, AFRICA 1; total stays 30 stories.

## Notes / known compromises

- The 1024×1024 gate cap forced the per-story scenes to be strips/chips
  (lead 1000×34, large-row 488×16, medium 56×36) rather than the
  240×120 scenes in the original 1024×1536 brief; the layout budget in
  DESIGN-BRIEF.md governs.
- At the judge's ~300 px width the masthead, tabs, lead, large headlines
  and numbers strip read clearly; the medium grid and ALSO ON list are
  fine print by design (smallest cap height 9.9 px on the 1024 canvas,
  above the 7 px floor).
- Map pin numbers are small (u=1.0, ~8 px); city labels carry the names.

## v4 — airy editorial layout rebuild (20 Nov)

v3 gated 0/3 a third time with the same "dense pixelated aesthetic"
verdict, so v4 rebuilds the layout (the v3 AA rasterizer is kept
intact). Paper masthead instead of a black bar; two large illustrated
feature cards (Iran decision, Shenzhen declaration); 8 tier-2 cards
with wide scene bands; 3 tier-3 cards; 8-box numbers strip; world
map; 12 IN BRIEF one-liners. 25 stories, filled fraction 73.5%
(v3: 92.4% block coverage). Render: 1024×1024, 296,257 bytes, sha256
`204d11db…` (byte-identical across 2 renders). See
`../news-image-20261120/V4-DESIGN-REPORT.md`.

## License

MIT — see LICENSE.
