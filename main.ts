// news-image-20261120 — "Sum up 20 November's world news in one image"
// Node 22, stdlib only, no network, deterministic (fixed layout, no Date/random).
// Renders out/entry.png (1024x1024 PNG, <= 1 MiB).
// Fresh 8x12 vector glyph set, drawn from the DESIGN-BRIEF spec only.
// All facts verified against NEWS.md / FACTS-SIGNED-OFF.md (20 Nov 2026).
// Anthropic is printed ONLY as "$1.27T AT CLOSE" — never the reported
// higher valuation figure as fact.
// v5 (20 Nov): FIX ROUND for the v4 poster the user called "acak-acakan"
// (messy) — every defect below was verified by direct viewing of the v4
// render. Layout re-measured with real row heights (no two text baselines
// share a row): masthead date/subline clearance; footer on THREE separate
// rows (sources / verified / date); DATE CHECK clear of the footer rule;
// numbers strip uniform boxes + uniform sizes + comma/period kerning fix
// ("-1, 101" / "300, 000" gap was the comma glyph's full 8-cell advance);
// ALL in-scene text REMOVED from tier-2 scene bands (pure graphics only —
// the info already lives in headline/body); tier-3 chip text overflows
// fixed (Rose "ROSE" and Phillips "118" were clipped by the chip edge);
// map rebuilt with 4 city labels only (WASHINGTON, LONDON, SHENZHEN,
// TOKYO), leader lines, labels in open sea only, caption outside the map
// rect; feature scenes given reserved rects (calendar clear of skyline,
// "4 POINTS" document clear of flags/table, seal + pen dropped).
// New band budget (y): masthead 0-110 | features 118-382 | numbers
// 392-432 | tier2 442-540 + 550-648 | tier3 658-730 | map caption 736,
// map 754-838 | IN BRIEF header 842, lines 860-932 | DATE CHECK 948,
// 960 | rule 974 | footer 982 / 995 / 1008. 26 stories unchanged.
// The v3 anti-aliased rasterizer, 8x12 glyph set and PNG encoder are
// kept intact; only layout, scenes and text metrics changed.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const PAPER = [246, 241, 227];
const INK = [20, 20, 20];
const RED = [166, 30, 30];
const BLUE = [31, 78, 121];
const TEAL = [15, 118, 110];
const GOLD = [150, 110, 10];
const GREY = [107, 107, 107];
const WHITE = [255, 255, 255];
const PANEL = [255, 255, 255];
const LINE = [200, 192, 168];
const SEA = [214, 230, 240];
const LAND = [201, 180, 88];
const CREAM = [246, 241, 227];

// ---------------------------------------------------------------- pixels
// v3 ANTI-ALIASED rasterizer: everything is drawn into a 3x supersampled
// framebuffer (3072x3072) and box-filter downsampled to 1024x1024. A glyph
// or illustration edge that lands on a fractional output pixel therefore
// renders as a grey ramp instead of a hard 1-bit step — genuine smooth
// (anti-aliased) typography from the same bitmap glyph cells. All drawing
// primitives below take 1024-space coordinates and scale by SS internally,
// so the layout code is unchanged and deterministic (no Date/random).
const SS = 3;
const SW = W * SS;
const SH = H * SS;
const hi = new Uint8Array(SW * SH * 3); // supersampled framebuffer
const px = new Uint8Array(W * H * 3); // final 1024x1024 framebuffer
function hiSet(sx: number, sy: number, c: number[]): void {
  if (sx < 0 || sy < 0 || sx >= SW || sy >= SH) return;
  const i = (sy * SW + sx) * 3;
  hi[i] = c[0]; hi[i + 1] = c[1]; hi[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: number[]): void {
  const x0 = Math.max(0, Math.floor(x * SS));
  const y0 = Math.max(0, Math.floor(y * SS));
  const x1 = Math.min(SW, Math.ceil((x + w) * SS));
  const y1 = Math.min(SH, Math.ceil((y + h) * SS));
  for (let yy = y0; yy < y1; yy++) {
    const row = yy * SW * 3;
    for (let xx = x0; xx < x1; xx++) {
      const i = row + xx * 3;
      hi[i] = c[0]; hi[i + 1] = c[1]; hi[i + 2] = c[2];
    }
  }
}
function setPix(x: number, y: number, c: number[]): void {
  // one 1024-space pixel = an SS x SS block in the supersampled buffer
  fillRect(x, y, 1, 1, c);
}
function hline(x: number, y: number, w: number, c: number[], t = 1): void {
  fillRect(x, y, w, t, c);
}
function vline(x: number, y: number, h: number, c: number[], t = 1): void {
  fillRect(x, y, t, h, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: number[], t = 1): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + (dx * i) / n);
    const y = Math.round(y0 + (dy * i) / n);
    fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
  }
}
function fillCircle(cx: number, cy: number, r: number, c: number[]): void {
  for (let yy = -r; yy <= r; yy++) {
    const half = Math.floor(Math.sqrt(r * r - yy * yy));
    for (let xx = -half; xx <= half; xx++) setPix(cx + xx, cy + yy, c);
  }
}
function fillPoly(pts: number[][], c: number[]): void {
  // scanline fill, pts = [[x,y],...]
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        const t = (y - a[1]) / (b[1] - a[1]);
        xs.push(a[0] + t * (b[0] - a[0]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      fillRect(xs[k], y, xs[k + 1] - xs[k], 1, c);
    }
  }
}
function polyOutline(pts: number[][], c: number[]): void {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    line(a[0], a[1], b[0], b[1], c, 1);
  }
}
// Box-filter downsample: each output pixel is the mean of its SS x SS
// supersamples. Edges at fractional output positions become grey steps;
// edges exactly on output boundaries stay crisp (correct for rules/panels).
function downsample(): void {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        const row = (y * SS + sy) * SW * 3;
        for (let sx = 0; sx < SS; sx++) {
          const i = row + (x * SS + sx) * 3;
          r += hi[i]; g += hi[i + 1]; b += hi[i + 2];
        }
      }
      const n = SS * SS;
      const o = (y * W + x) * 3;
      px[o] = Math.round(r / n);
      px[o + 1] = Math.round(g / n);
      px[o + 2] = Math.round(b / n);
    }
  }
}

// ---------------------------------------------------------------- PNG encode
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- 8x12 font
// v2 thin-stroke vector glyph set: 12 rows x 8 cols, every stroke is a
// SINGLE cell wide (1px at u=1) — no 2-3px blocks. Open counters, generous
// tracking (see track()). Uppercase rows 1-9, lowercase x-height rows 4-9,
// ascenders to row 1, descenders to row 11. "i"/"j" dotted, "g"
// single-storey, digits tabular (all 8 wide). "4" crossbar spans only its
// two legs (v1 full-width bar read as a strike through "144"/"300,000").
const BLANK = "        ";
function g(r1: string, r2: string, r3: string, r4: string, r5: string, r6: string, r7: string, r8: string, r9: string, r10 = BLANK, r11 = BLANK, r0 = BLANK): string[] {
  return [r0, r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11];
}
const GLYPHS: Record<string, string[]> = {
  A: g("   #    ", "  # #   ", "  # #   ", " #   #  ", " #   #  ", " #####  ", " #   #  ", " #   #  ", "#     # "),
  B: g(" ####   ", " #   #  ", " #   #  ", " #   #  ", " ####   ", " #   #  ", " #   #  ", " #   #  ", " ####   "),
  C: g("  ####  ", " #    # ", " #      ", " #      ", " #      ", " #      ", " #      ", " #    # ", "  ####  "),
  D: g(" ####   ", " #   #  ", " #    # ", " #    # ", " #    # ", " #    # ", " #    # ", " #   #  ", " ####   "),
  E: g(" ###### ", " #      ", " #      ", " #      ", " ####   ", " #      ", " #      ", " #      ", " ###### "),
  F: g(" ###### ", " #      ", " #      ", " #      ", " ####   ", " #      ", " #      ", " #      ", " #      "),
  G: g("  ####  ", " #    # ", " #      ", " #      ", " #  ### ", " #   #  ", " #   #  ", " #   #  ", "  ###   "),
  H: g("#     # ", "#     # ", "#     # ", "#     # ", "####### ", "#     # ", "#     # ", "#     # ", "#     # "),
  I: g(" ###### ", "   #    ", "   #    ", "   #    ", "   #    ", "   #    ", "   #    ", "   #    ", " ###### "),
  J: g("     ## ", "      # ", "      # ", "      # ", "      # ", "      # ", " #    # ", " #    # ", "  ####  "),
  K: g("#    #  ", "#   #   ", "#  #    ", "# #     ", "##      ", "# #     ", "#  #    ", "#   #   ", "#    #  "),
  L: g("#       ", "#       ", "#       ", "#       ", "#       ", "#       ", "#       ", "#       ", "####### "),
  M: g("#     # ", "##   ## ", "# # # # ", "# # # # ", "#  #  # ", "#     # ", "#     # ", "#     # ", "#     # "),
  N: g("#     # ", "##    # ", "# #   # ", "#  #  # ", "#   # # ", "#    ## ", "#     # ", "#     # ", "#     # "),
  O: g("  ####  ", " #    # ", "#      #", "#      #", "#      #", "#      #", "#      #", " #    # ", "  ####  "),
  P: g(" ####   ", " #   #  ", " #   #  ", " #   #  ", " ####   ", " #      ", " #      ", " #      ", " #      "),
  Q: g("  ####  ", " #    # ", "#      #", "#      #", "#      #", "#    # #", " #    # ", "  ####  ", "     #  "),
  R: g(" ####   ", " #   #  ", " #   #  ", " #   #  ", " ####   ", " #  #   ", " #   #  ", " #   #  ", " #    # "),
  S: g("  ####  ", " #    # ", " #      ", "  #     ", "   #    ", "    #   ", "     #  ", " #    # ", "  ####  "),
  T: g("####### ", "   #    ", "   #    ", "   #    ", "   #    ", "   #    ", "   #    ", "   #    ", "   #    "),
  U: g("#     # ", "#     # ", "#     # ", "#     # ", "#     # ", "#     # ", "#     # ", " #   #  ", "  ###   "),
  V: g("#     # ", "#     # ", "#     # ", "#     # ", "#     # ", " #   #  ", " #   #  ", "  # #   ", "   #    "),
  W: g("#     # ", "#     # ", "#     # ", "#     # ", "#  #  # ", "#  #  # ", "# # # # ", "##   ## ", "#     # "),
  X: g("#     # ", " #   #  ", "  # #   ", "   #    ", "   #    ", "   #    ", "  # #   ", " #   #  ", "#     # "),
  Y: g("#     # ", " #   #  ", "  # #   ", "   #    ", "   #    ", "   #    ", "   #    ", "   #    ", "   #    "),
  Z: g("####### ", "     #  ", "    #   ", "   #    ", "  #     ", "  #     ", " #      ", "#       ", "####### "),
  a: g(BLANK, BLANK, BLANK, "  ####  ", "     #  ", "  ##### ", " #   #  ", " #   #  ", "  ####  "),
  b: g("#       ", "#       ", "#       ", "####    ", "#   #   ", "#   #   ", "#   #   ", "#   #   ", "####    "),
  c: g(BLANK, BLANK, BLANK, "  ####  ", " #   #  ", "#       ", "#       ", " #   #  ", "  ####  "),
  d: g("     #  ", "     #  ", "     #  ", "  ####  ", " #   #  ", " #   #  ", " #   #  ", " #   #  ", "  ####  "),
  e: g(BLANK, BLANK, BLANK, "  ####  ", " #   #  ", "####### ", "#       ", " #   #  ", "  ####  "),
  f: g("   ##   ", "  #     ", "  #     ", " ####   ", "  #     ", "  #     ", "  #     ", "  #     ", "  #     "),
  g: g(BLANK, BLANK, BLANK, "  ####  ", " #   #  ", " #   #  ", " #   #  ", "  ####  ", "    #   ", " #  #   ", "  ##    "),
  h: g("#       ", "#       ", "#       ", "####    ", "#   #   ", "#   #   ", "#   #   ", "#   #   ", "#   #   "),
  i: g(BLANK, "  #     ", BLANK, "  #     ", "  #     ", "  #     ", "  #     ", "  #     ", "  #     "),
  j: g(BLANK, "  #     ", BLANK, "  #     ", "  #     ", "  #     ", "  #     ", "  #     ", "  #     ", "  #     ", " #      "),
  k: g("#       ", "#       ", "#       ", "#  #    ", "# #     ", "##      ", "# #     ", "#  #    ", "#   #   "),
  l: g("  #     ", "  #     ", "  #     ", "  #     ", "  #     ", "  #     ", "  #     ", "  #     ", "  #     "),
  m: g(BLANK, BLANK, BLANK, "##  ##  ", "# # # # ", "# # # # ", "# # # # ", "# # # # ", "# # # # "),
  n: g(BLANK, BLANK, BLANK, "####    ", "#   #   ", "#   #   ", "#   #   ", "#   #   ", "#   #   "),
  o: g(BLANK, BLANK, BLANK, "  ####  ", " #   #  ", "#     # ", "#     # ", " #   #  ", "  ####  "),
  p: g(BLANK, BLANK, BLANK, "####    ", "#   #   ", "#   #   ", "#   #   ", "####    ", "#       ", "#       ", "#       "),
  q: g(BLANK, BLANK, BLANK, "  ####  ", " #   #  ", " #   #  ", " #   #  ", "  ####  ", "     #  ", "     #  ", "     #  "),
  r: g(BLANK, BLANK, BLANK, "#  ##   ", "#   #   ", "#       ", "#       ", "#       ", "#       "),
  s: g(BLANK, BLANK, BLANK, "  ####  ", " #      ", "  ###   ", "     #  ", " #   #  ", "  ###   "),
  t: g("  #     ", "  #     ", "  #     ", "#####   ", "  #     ", "  #     ", "  #     ", "  #     ", "   #    "),
  u: g(BLANK, BLANK, BLANK, "#   #   ", "#   #   ", "#   #   ", "#   #   ", " #   #  ", "  ###   "),
  v: g(BLANK, BLANK, BLANK, "#   #   ", "#   #   ", "#   #   ", " # #    ", " # #    ", "  #     "),
  w: g(BLANK, BLANK, BLANK, "#   #   ", "#   #   ", "# # #   ", "# # #   ", "# # #   ", " # #    "),
  x: g(BLANK, BLANK, BLANK, "#   #   ", " # #    ", "  #     ", "  #     ", " # #    ", "#   #   "),
  y: g(BLANK, BLANK, BLANK, "#   #   ", "#   #   ", " # #    ", "  #     ", "  #     ", "  #     ", "  #     ", " #      "),
  z: g(BLANK, BLANK, BLANK, "######  ", "    #   ", "   #    ", "  #     ", " #      ", "######  "),
  "0": g("  ####  ", " #    # ", "#      #", "#      #", "#      #", "#      #", "#      #", " #    # ", "  ####  "),
  "1": g("   #    ", "  ##    ", "   #    ", "   #    ", "   #    ", "   #    ", "   #    ", "   #    ", "  ###   "),
  "2": g("  ####  ", " #    # ", "     #  ", "    #   ", "   #    ", "  #     ", " #      ", "#       ", "####### "),
  "3": g("  ####  ", " #    # ", "     #  ", "    #   ", "  ###   ", "     #  ", "     #  ", " #   #  ", "  ###   "),
  "4": g("#    #  ", "#    #  ", "#    #  ", "#    #  ", "######  ", "     #  ", "     #  ", "     #  ", "     #  "),
  "5": g("####### ", "#       ", "#       ", "####    ", "    #   ", "     #  ", "     #  ", " #   #  ", "  ###   "),
  "6": g("  ####  ", " #      ", "#       ", "####    ", "#   #   ", "#   #   ", "#   #   ", " #   #  ", "  ####  "),
  "7": g("####### ", "     #  ", "    #   ", "   #    ", "   #    ", "   #    ", "   #    ", "   #    ", "   #    "),
  "8": g("  ####  ", " #    # ", " #    # ", "  ####  ", " #    # ", "#      #", "#      #", " #    # ", "  ####  "),
  "9": g("  ####  ", " #    # ", "#     # ", "#     # ", " ###### ", "     #  ", "     #  ", " #   #  ", "  ###   "),
  ".": g(BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, "  #     ", "  #     "),
  ",": g(BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, "  #     ", "  #     ", " #      ", "#       "),
  ";": g(BLANK, BLANK, BLANK, BLANK, "  #     ", "  #     ", BLANK, "  #     ", "  #     ", " #      ", "#       "),
  ":": g(BLANK, BLANK, BLANK, BLANK, "  #     ", "  #     ", BLANK, "  #     ", "  #     "),
  "!": g("  #     ", "  #     ", "  #     ", "  #     ", "  #     ", "  #     ", "  #     ", BLANK, "  #     "),
  "?": g("  ####  ", " #    # ", "     #  ", "    #   ", "   #    ", "   #    ", BLANK, "   #    ", "   #    "),
  "'": g("  #     ", "  #     ", " #      ", BLANK, BLANK, BLANK, BLANK, BLANK, BLANK),
  "-": g(BLANK, BLANK, BLANK, BLANK, " ###### ", BLANK, BLANK, BLANK, BLANK),
  "–": g(BLANK, BLANK, BLANK, BLANK, "########", BLANK, BLANK, BLANK, BLANK),
  "(": g("    #   ", "   #    ", "  #     ", "  #     ", "  #     ", "  #     ", "  #     ", "   #    ", "    #   "),
  ")": g(" #      ", "  #     ", "   #    ", "   #    ", "   #    ", "   #    ", "   #    ", "  #     ", " #      "),
  "%": g(" ##     ", "#  #    ", " ##     ", "   #    ", "  #     ", "  #     ", "    ##  ", "   #  # ", "    ##  "),
  $: g("   #    ", "  ####  ", " #  #   ", "#       ", " ####   ", "    #   ", "#   #   ", " #  #   ", "  ####  ", "   #    ", "   #    ", "   #    "),
  "&": g("  ####  ", " #    # ", " #   #  ", "  # #   ", "   #    ", " # # #  ", "#   #   ", "#   #   ", "  ###   "),
  "+": g(BLANK, BLANK, "   #    ", "   #    ", " ###### ", "   #    ", "   #    ", BLANK, BLANK),
  "/": g("     #  ", "     #  ", "    #   ", "   #    ", "   #    ", "  #     ", " #      ", " #      ", "#       "),
  "@": g("  ####  ", " #    # ", "# ####  ", "# #  #  ", "# # #   ", "# ###   ", "#       ", " #    # ", "  ####  "),
  "#": g(BLANK, " #  #   ", " #  #   ", "######  ", " #  #   ", "######  ", " #  #   ", " #  #   ", BLANK),
  "|": g("   #    ", "   #    ", "   #    ", "   #    ", "   #    ", "   #    ", "   #    ", "   #    ", "   #    "),
  " ": [BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK],
};
// Validate every glyph is 12 rows of 8 cells (fail loudly, never silently).
for (const [ch, rows] of Object.entries(GLYPHS)) {
  if (rows.length !== 12) throw new Error("glyph " + ch + " has " + rows.length + " rows");
  for (const r of rows) if (r.length !== 8) throw new Error("glyph " + ch + " row not 8 wide: '" + r + "'");
}
const SPACE_W = 8;

function track(u: number): number {
  return Math.max(0.5, u * 0.3);
}
// v5 KERNING FIX: the comma and period glyphs carry their ink in cells
// 0-2 of an 8-wide cell, so a full 8u advance after "," or "." (before a
// digit) left a visible gap — "-1, 101", "300, 000", "$1. 27T" in v4.
// A comma, and a period directly before a digit, now advance only 4.5u.
// textWidth and drawText share this helper, so centring stays exact.
function adv(ch: string, next: string, u: number): number {
  if (ch === ",") return 4.5 * u + track(u);
  if (ch === "." && next >= "0" && next <= "9") return 4.5 * u + track(u);
  return 8 * u + track(u);
}
function textWidth(s: string, u: number): number {
  if (s.length === 0) return 0;
  let w = -track(u);
  for (let i = 0; i < s.length; i++) w += adv(s[i], s[i + 1] || "", u);
  return w;
}
// v3b: COVERAGE-BASED glyph rasterizer. The bitmap cells alone cannot
// make a smooth diagonal — a staircase of square blocks stays a staircase
// no matter how much you supersample its edges. So each glyph is now
// rendered as a coverage mask: the 8x12 cell mask is bilinearly
// interpolated in cell space and each supersample is BLENDED with the
// background at its coverage alpha. A diagonal step becomes a grey ramp
// ~1 cell wide; straight stems keep a solid core with soft edges —
// genuine anti-aliased letterforms from the same glyph data, generic
// over all 66 glyphs (no per-glyph hand work). Deterministic: fixed
// arithmetic, no Date/random.
// v3: sub-pixel offset of exactly 1 supersample (1/3 output px) in x and
// y, so no glyph edge lands exactly on an output-pixel boundary. The
// offset is inside drawGlyph only, so text metrics and layout are unchanged.
const AA_OX = 1 / SS;
const AA_OY = 1 / SS;
function maskAt(rows: string[], col: number, row: number): number {
  if (col < 0 || col > 7 || row < 0 || row > 11) return 0;
  return rows[row][col] === "#" ? 1 : 0;
}
function maskBilinear(rows: string[], mx: number, my: number): number {
  const x0 = Math.floor(mx);
  const y0 = Math.floor(my);
  const fx = mx - x0;
  const fy = my - y0;
  const a00 = maskAt(rows, x0, y0);
  const a10 = maskAt(rows, x0 + 1, y0);
  const a01 = maskAt(rows, x0, y0 + 1);
  const a11 = maskAt(rows, x0 + 1, y0 + 1);
  return (
    a00 * (1 - fx) * (1 - fy) +
    a10 * fx * (1 - fy) +
    a01 * (1 - fx) * fy +
    a11 * fx * fy
  );
}
function hiBlend(sx: number, sy: number, c: number[], a: number): void {
  if (sx < 0 || sy < 0 || sx >= SW || sy >= SH) return;
  const i = (sy * SW + sx) * 3;
  const inv = 1 - a;
  hi[i] = Math.round(c[0] * a + hi[i] * inv);
  hi[i + 1] = Math.round(c[1] * a + hi[i + 1] * inv);
  hi[i + 2] = Math.round(c[2] * a + hi[i + 2] * inv);
}
function drawGlyph(ch: string, x: number, y: number, u: number, c: number[]): void {
  const rows = GLYPHS[ch];
  if (!rows) return; // unknown char: blank (should not happen; all text checked)
  let any = false;
  for (const r of rows) if (r.indexOf("#") >= 0) { any = true; break; }
  if (!any) return;
  const gx = x + AA_OX;
  const gy = y + AA_OY;
  // cell-space coords: cell centres sit at (col+0.5, row+0.5); the
  // bilinear footprint extends 0.5 cell past the 8x12 box on each side.
  const sx0 = Math.max(0, Math.floor((gx - 0.5 * u) * SS));
  const sy0 = Math.max(0, Math.floor((gy - 0.5 * u) * SS));
  const sx1 = Math.min(SW, Math.ceil((gx + 8.5 * u) * SS));
  const sy1 = Math.min(SH, Math.ceil((gy + 12.5 * u) * SS));
  for (let sy = sy0; sy < sy1; sy++) {
    const my = (sy / SS - gy) / u - 0.5;
    for (let sx = sx0; sx < sx1; sx++) {
      const mx = (sx / SS - gx) / u - 0.5;
      const a = maskBilinear(rows, mx, my);
      if (a <= 0) continue;
      if (a >= 1) hiSet(sx, sy, c);
      else hiBlend(sx, sy, c, a);
    }
  }
}
function drawText(x: number, y: number, s: string, u: number, c: number[]): void {
  let cx = x;
  for (let i = 0; i < s.length; i++) {
    drawGlyph(s[i], cx, y, u, c);
    cx += adv(s[i], s[i + 1] || "", u);
  }
}
function drawTextFit(x: number, y: number, s: string, uMax: number, uMin: number, maxW: number, c: number[]): number {
  let u = uMax;
  while (u > uMin && textWidth(s, u) > maxW) u -= 0.05;
  drawText(x, y, s, u, c);
  return u;
}
function drawCentered(y: number, s: string, u: number, c: number[], cx = W / 2): void {
  drawText(cx - textWidth(s, u) / 2, y, s, u, c);
}
// Draw "KEY rest..." with the keyword in one colour and the rest in another.
function drawKeywordLine(x: number, y: number, key: string, rest: string, u: number, keyColor: number[], restColor: number[]): void {
  drawText(x, y, key, u, keyColor);
  drawText(x + textWidth(key, u) + track(u), y, rest, u, restColor);
}

// ---------------------------------------------------------------- scenes
// v4: LARGE feature scenes (the two top stories get real illustrated
// space, like the rivals) + wide scene bands for the tier-2 cards.
// The v3 medium-chip functions below are kept and reused for tier 3.
// v5 sceneLead: RESERVED RECTANGLES — label zone x+8..x+108, sun
// x+118..x+142, clouds x+170..x+290, skyline x+8..cx-8 (ends 8px short
// of the calendar), dome x+112..x+216, calendar cx..cx+140. In v4 the
// skyline's last building ran to cx-2 (touching the calendar edge) and a
// cloud sat inside the calendar rect. Calendar interior re-measured:
// "2027" ends cx+81, "JAN 1" starts cx+86; grid ends y+51, DELAYED ink
// y+h-24.3..y+h-10.7, underline y+h-9, calendar bottom y+h-6.
function sceneLead(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [232, 226, 205]);
  hline(x, y + h - 1, w, INK, 2);
  // pale sun: centre x+130, r 10 -> x+120..x+140, clear of the label
  // (ends x+108) and of the clouds (start x+196)
  fillCircle(x + 130, y + 10, 10, [230, 190, 90]);
  fillCircle(x + 130, y + 10, 7, [240, 210, 120]);
  // clouds: two flat bars, both clear of sun (ends x+140) and calendar
  fillRect(x + 196, y + 6, 26, 4, WHITE);
  fillRect(x + 240, y + 10, 24, 4, WHITE);
  // calendar page, right; cx is its left edge
  const cx = x + w - 152;
  // skyline silhouette along the bottom, with lit windows; stops 8px
  // short of the calendar's left edge (bx+20 <= cx-8)
  const base = y + h - 2;
  let bx = x + 8;
  const heights = [18, 30, 14, 38, 22, 44, 16, 26, 34, 12, 40, 20, 28, 16, 36, 24];
  let hi = 0;
  while (bx + 20 <= cx - 8) {
    const hh = heights[hi % heights.length];
    hi++;
    // leave a gap where the dome stands
    if (bx > x + 118 && bx < x + 210) { bx += 24; continue; }
    fillRect(bx, base - hh, 20, hh, [90, 88, 78]);
    if (hi % 2 === 0) fillRect(bx + 4, base - hh + 5, 3, 3, [240, 210, 120]);
    if (hi % 3 === 0) fillRect(bx + 13, base - hh + 12, 3, 3, [240, 210, 120]);
    if (hh >= 38) vline(bx + 10, base - hh - 7, 7, [90, 88, 78], 1);
    bx += 24;
  }
  // Capitol dome, centre-left: stepped base, columns, dome, statue, flag
  const dx = x + 164;
  const dy = base;
  fillRect(dx - 52, dy - 4, 104, 4, INK);
  fillRect(dx - 44, dy - 12, 88, 12, INK);
  for (let i = 0; i < 6; i++) fillRect(dx - 36 + i * 13, dy - 22, 5, 10, INK);
  fillRect(dx - 40, dy - 25, 80, 4, INK);
  fillCircle(dx, dy - 25, 19, INK);
  fillRect(dx - 3, dy - 50, 6, 7, INK);
  fillRect(dx - 2, dy - 54, 4, 4, RED);
  vline(dx + 22, dy - 46, 12, INK, 1);
  fillRect(dx + 23, dy - 46, 14, 8, RED);
  fillRect(cx, y + 6, 140, h - 12, WHITE);
  hline(cx, y + 6, 140, INK, 2);
  hline(cx, y + h - 6, 140, INK, 2);
  vline(cx, y + 6, h - 12, INK, 2);
  vline(cx + 138, y + 6, h - 12, INK, 2);
  drawText(cx + 12, y + 10, "2027", 2.1, RED);
  drawText(cx + 86, y + 12, "JAN 1", 1.15, INK);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 7; c++) {
      fillRect(cx + 10 + c * 18, y + 32 + r * 8, 3, 3, r === 0 && c === 0 ? RED : [180, 175, 160]);
    }
  }
  drawText(cx + 10, y + h - 26, "DELAYED", 1.7, RED);
  hline(cx + 10, y + h - 9, textWidth("DELAYED", 1.7), RED, 1);
  drawText(x + 8, y + 4, "WASHINGTON", 1.2, GREY);
}
// v5 sceneTrilateral: RESERVED RECTANGLES — flags y+8..y+38 (poles
// x+22/x+162/x+302, flags to x+412), document y+44..y+70 (sits on the
// table line y+70), table y+70..y+84. In v4 the red seal dot sat ON the
// "POINTS" text and the pen line crossed the document; both are DROPPED
// (a clean document beats a decorated one). The third flagpole passes
// behind the document (document drawn after the flags) — layered, not
// touching: flag bottom y+38, document top y+44, 6px clear. Right-hand
// towers dropped (they crossed the table line); left towers only.
function sceneTrilateral(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [232, 226, 205]);
  hline(x, y + h - 1, w, INK, 2);
  // Shenzhen towers behind the flags (thin, dark, stepped tops) — left
  // side only, clear of the table (table starts x+262)
  const towers: [number, number][] = [[8, 14], [30, 22], [52, 10]];
  for (const [tx0, th] of towers) {
    fillRect(x + tx0, y + h - 1 - th, 10, th, [120, 118, 108]);
    fillRect(x + tx0 + 4, y + h - 2 - th, 2, 1, [240, 210, 120]);
  }
  const flags: [number[], string][] = [
    [[190, 30, 40], "US"],
    [[200, 40, 40], "CN"],
    [[60, 90, 160], "RU"],
  ];
  let fx = x + 22;
  for (const [col] of flags) {
    vline(fx, y + 8, h - 12, INK, 2);
    fillCircle(fx, y + 6, 3, GOLD);
    fillRect(fx + 2, y + 8, 108, 30, col);
    if (col[0] === 190) { // US: canton + stripes
      fillRect(fx + 2, y + 8, 42, 15, BLUE);
      hline(fx + 2, y + 23, 108, WHITE, 2);
      hline(fx + 2, y + 30, 108, WHITE, 2);
    }
    if (col[0] === 200) fillRect(fx + 14, y + 14, 9, 9, [250, 220, 60]); // star
    if (col[0] === 60) { // RU: white/blue/red bands
      fillRect(fx + 2, y + 8, 108, 10, WHITE);
      fillRect(fx + 2, y + 18, 108, 10, BLUE);
      fillRect(fx + 2, y + 28, 108, 10, RED);
    }
    fx += 140;
  }
  // table + document, bottom-right. Document (90x26) sits ON the table
  // line: top y+h-40, bottom y+h-14 = table top. One interior rule at
  // y+h-36; "4 POINTS" on one line at y+h-30 ("4" ink ends y+h-16.5,
  // document bottom y+h-14). No seal, no pen.
  const tx = x + w - 190;
  fillRect(tx, y + h - 14, 170, 4, INK);
  fillRect(tx + 10, y + h - 10, 5, 10, INK);
  fillRect(tx + 155, y + h - 10, 5, 10, INK);
  fillRect(tx + 40, y + h - 40, 90, 26, WHITE);
  hline(tx + 40, y + h - 40, 90, INK, 1);
  hline(tx + 40, y + h - 14, 90, INK, 1);
  vline(tx + 40, y + h - 40, 26, INK, 1);
  vline(tx + 129, y + h - 40, 26, INK, 1);
  hline(tx + 46, y + h - 36, 78, INK, 1);
  drawText(tx + 46, y + h - 30, "4", 1.5, RED);
  drawText(tx + 62, y + h - 29, "POINTS", 1.05, INK);
}
// v5 tier-2 scene bands: PURE GRAPHICS, NO TEXT AT ALL. In v4 every band
// carried a label ("144-80 PARAS", "1 LIGHT-DAY SINCE 1977", "ENGINE
// FAULT NO LANDING", "$1.8B SALES", "$1.27T AT CLOSE", "-2.2%") and
// every one collided with its own graphic. The information already lives
// in the headline/body directly below the band, so the text is dropped,
// not moved. Each band keeps its graphics inside x+2..x+w-2, y+2..y+30.
// Wall Street scene band (tier 2): plunging chart + arrowhead only.
function scene2WallSt(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [232, 226, 205]);
  for (let gy = 6; gy < h - 2; gy += 7) hline(x + 4, y + gy, w - 8, [208, 202, 186], 1);
  const pts: number[][] = [];
  for (let i = 0; i < 8; i++) {
    pts.push([x + 12 + (i * 198) / 7, y + 5 + (i * i * 22) / 49]);
  }
  for (let i = 0; i + 1 < pts.length; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], RED, 3);
  const e = pts[pts.length - 1];
  line(e[0], e[1], e[0] - 11, e[1] - 2, RED, 3);
  line(e[0], e[1], e[0] - 2, e[1] - 11, RED, 3);
}
// COP31 scene band: globe + shrinking bars + thermometer. No text.
function scene2COP31(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [214, 230, 240]);
  fillCircle(x + 24, y + 16, 11, BLUE);
  fillRect(x + 20, y + 10, 8, 13, [120, 200, 120]);
  hline(x + 13, y + 13, 22, [160, 210, 230], 1);
  hline(x + 13, y + 19, 22, [160, 210, 230], 1);
  // shrinking bars (144 -> 80): long grey bar, short red bar
  fillRect(x + 70, y + 12, 60, 4, GREY);
  fillRect(x + 70, y + 20, 34, 4, RED);
  // thermometer, right: tube + bulb, clear of the bars (end x+130)
  fillRect(x + w - 26, y + 5, 5, 18, WHITE);
  fillRect(x + w - 25, y + 8, 3, 13, RED);
  fillCircle(x + w - 23, y + 26, 4, RED);
}
// Akvan scene band: cyclone spiral + rain + boat + coastline. No text.
function scene2Akvan(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [214, 230, 240]);
  fillRect(x, y + 25, w, 6, [150, 130, 80]);
  fillCircle(x + 30, y + 14, 10, WHITE);
  fillCircle(x + 30, y + 14, 7, TEAL);
  fillCircle(x + 30, y + 14, 4, WHITE);
  fillCircle(x + 30, y + 14, 2, TEAL);
  line(x + 21, y + 7, x + 16, y + 3, TEAL, 1);
  line(x + 39, y + 21, x + 44, y + 25, TEAL, 1);
  for (let i = 0; i < 6; i++) line(x + 120 + i * 12, y + 4, x + 117 + i * 12, y + 14, BLUE, 1);
  fillRect(x + 62, y + 19, 20, 5, RED);
  vline(x + 72, y + 13, 6, INK, 1);
}
// Voyager scene band: stars + probe + dish + gold arc. No text.
function scene2Voyager(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [20, 24, 40]);
  for (const [sx, sy] of [[10, 6], [60, 4], [120, 8], [180, 5], [220, 12], [40, 28], [150, 30], [200, 26]]) fillRect(x + sx, y + sy, 2, 2, WHITE);
  fillRect(x + 14, y + 14, 20, 7, [200, 200, 200]);
  fillRect(x + 18, y + 16, 4, 3, GOLD);
  line(x + 34, y + 17, x + 56, y + 10, WHITE, 2);
  line(x + 56, y + 8, x + 68, y + 4, WHITE, 2);
  line(x + 56, y + 8, x + 68, y + 12, WHITE, 2);
  // gold arc sweeping right: the distance travelled
  line(x + 80, y + 27, x + 110, y + 18, GOLD, 2);
  line(x + 110, y + 18, x + 140, y + 10, GOLD, 2);
  fillRect(x + 140, y + 8, 4, 4, GOLD);
}
// Europe talks scene band: Europe shape + dove + handshake bars.
// No text (v4 had none here; kept text-free).
function scene2Talks(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [232, 226, 205]);
  fillPoly([[x + 8, y + 10], [x + 30, y + 5], [x + 48, y + 12], [x + 42, y + 28], [x + 20, y + 30], [x + 8, y + 18]], LAND);
  polyOutline([[x + 8, y + 10], [x + 30, y + 5], [x + 48, y + 12], [x + 42, y + 28], [x + 20, y + 30], [x + 8, y + 18]], [120, 105, 50]);
  fillRect(x + 70, y + 10, 26, 8, WHITE);
  fillCircle(x + 98, y + 12, 5, WHITE);
  line(x + 76, y + 8, x + 88, y + 2, WHITE, 2);
  fillRect(x + 100, y + 18, 5, 3, [120, 200, 120]);
  fillRect(x + 130, y + 24, 40, 5, BLUE);
  fillRect(x + 170, y + 24, 40, 5, RED);
  fillRect(x + 164, y + 22, 12, 9, [240, 220, 180]);
}
// Anthropic scene band: bell + chip + rising ticks. No text — the
// "$1.27T AT CLOSE" label sat half under the chip in v4; the headline
// directly below already says it.
function scene2Anthropic(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [30, 30, 40]);
  fillRect(x + 10, y + 6, 12, 9, GOLD);
  fillCircle(x + 16, y + 6, 6, GOLD);
  fillRect(x + 60, y + 6, 44, 22, [60, 60, 80]);
  fillRect(x + 74, y + 13, 16, 9, GOLD);
  for (let i = 0; i < 3; i++) {
    hline(x + 46, y + 10 + i * 8, 14, GOLD, 2);
    hline(x + 104, y + 10 + i * 8, 14, GOLD, 2);
  }
  line(x + 130, y + 28, x + 142, y + 20, [120, 200, 120], 2);
  line(x + 142, y + 20, x + 154, y + 12, [120, 200, 120], 2);
}
// Hayabusa2 scene band: asteroid + probe + crossed-out flame (the X is
// a graphic, not text). No text — "ENGINE FAULT NO LANDING" overlapped
// the probe and the X in v4; the headline says it.
function scene2Hayabusa(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [20, 24, 40]);
  for (const [sx, sy] of [[12, 5], [200, 6], [120, 4], [220, 26], [8, 26]]) fillRect(x + sx, y + sy, 2, 2, WHITE);
  fillCircle(x + 26, y + 18, 11, [150, 140, 120]);
  fillCircle(x + 22, y + 14, 3, [120, 110, 95]);
  fillCircle(x + 30, y + 22, 3, [120, 110, 95]);
  fillRect(x + 70, y + 12, 24, 9, [200, 200, 200]);
  fillRect(x + 58, y + 9, 12, 15, [40, 80, 160]);
  fillRect(x + 94, y + 9, 12, 15, [40, 80, 160]);
  line(x + 106, y + 16, x + 112, y + 16, GOLD, 2);
  line(x + 116, y + 10, x + 126, y + 22, RED, 2);
  line(x + 126, y + 10, x + 116, y + 22, RED, 2);
}
// GTA VI scene band: dusk sky + skyline + sun. No text — "$1.8B SALES"
// sat on the skyline and the sun in v4; the headline says it.
function scene2GTA(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, 14, [90, 60, 110]);
  fillRect(x, y + 14, w, 8, [200, 110, 80]);
  fillRect(x, y + 22, w, 12, [40, 30, 60]);
  fillCircle(x + 222, y + 10, 5, [250, 200, 100]);
  const base = y + 26;
  const hs = [10, 16, 12, 20, 14];
  let bx = x + 8;
  for (const hh of hs) {
    fillRect(bx, base - hh, 10, hh, [220, 180, 90]);
    fillRect(bx + 3, base - hh + 3, 2, 2, [255, 240, 180]);
    bx += 14;
  }
}
const SCENES2: ((x: number, y: number, w: number, h: number) => void)[] = [
  scene2WallSt, scene2COP31, scene2Akvan, scene2Voyager,
  scene2Talks, scene2Anthropic, scene2Hayabusa, scene2GTA,
];
// Compact scene chips for the medium grid (56x36). Drawn, not icons.
// Compact scene chips for the medium grid (56x36). Drawn, not icons.
// v3: every chip gains a second layer of detail — ground lines, skies,
// labels, motion marks — so each reads as a small scene at full res.
function chipCOP31(x: number, y: number): void {
  fillRect(x, y, 56, 36, [214, 230, 240]);
  // globe with latitude lines
  fillCircle(x + 18, y + 18, 12, BLUE);
  fillRect(x + 14, y + 10, 8, 16, [120, 200, 120]);
  hline(x + 7, y + 14, 22, [160, 210, 230], 1);
  hline(x + 7, y + 22, 22, [160, 210, 230], 1);
  // thermometer with scale ticks
  fillRect(x + 38, y + 8, 4, 20, WHITE);
  fillRect(x + 39, y + 10, 2, 16, RED);
  fillCircle(x + 40, y + 30, 4, RED);
  for (let i = 0; i < 3; i++) hline(x + 42, y + 10 + i * 6, 4, INK, 1);
  // shrinking bar: 144 -> 80
  fillRect(x + 2, y + 32, 20, 2, GREY);
  fillRect(x + 2, y + 34, 11, 2, RED);
  drawText(x + 2, y + 27, "144-80", 1.0, INK);
}
function chipAkvan(x: number, y: number): void {
  fillRect(x, y, 56, 36, [214, 230, 240]);
  // coastline + sea
  fillRect(x, y + 26, 56, 10, [150, 130, 80]);
  hline(x, y + 26, 56, [120, 105, 60], 1);
  fillRect(x + 40, y + 26, 16, 10, [90, 140, 180]); // sea on the right
  // spiral with arms
  fillCircle(x + 26, y + 14, 10, WHITE);
  fillCircle(x + 26, y + 14, 7, TEAL);
  fillCircle(x + 26, y + 14, 4, WHITE);
  fillCircle(x + 26, y + 14, 2, TEAL);
  line(x + 16, y + 8, x + 12, y + 4, TEAL, 1);
  line(x + 36, y + 20, x + 40, y + 24, TEAL, 1);
  // rain, slanted
  for (let i = 0; i < 4; i++) line(x + 42 + i * 4, y + 2, x + 40 + i * 4, y + 10, BLUE, 1);
  // evacuation boat with mast and passengers
  fillRect(x + 4, y + 28, 14, 5, RED);
  vline(x + 11, y + 22, 6, INK, 1);
  fillRect(x + 7, y + 29, 2, 2, WHITE);
  fillRect(x + 13, y + 29, 2, 2, WHITE);
  // wave marks
  hline(x + 42, y + 30, 10, WHITE, 1);
  hline(x + 44, y + 33, 8, WHITE, 1);
}
function chipVoyager(x: number, y: number): void {
  fillRect(x, y, 56, 36, [20, 24, 40]);
  for (const [sx, sy] of [[6, 6], [20, 4], [44, 8], [50, 20], [12, 28], [34, 30], [48, 28], [4, 16]]) fillRect(x + sx, y + sy, 2, 2, WHITE);
  // Earth, bottom-left
  fillCircle(x + 8, y + 30, 4, BLUE);
  fillRect(x + 6, y + 29, 4, 2, [120, 200, 120]);
  // probe body + boom + dish
  line(x + 14, y + 18, x + 30, y + 12, WHITE, 2);
  fillRect(x + 30, y + 10, 12, 6, [200, 200, 200]);
  line(x + 42, y + 13, x + 50, y + 6, WHITE, 2); // dish
  line(x + 30, y + 15, x + 22, y + 20, WHITE, 1); // antenna boom
  fillRect(x + 20, y + 20, 3, 3, GOLD);
  // light-day arc with arrow, from Earth to the probe
  line(x + 12, y + 28, x + 26, y + 20, GOLD, 1);
  line(x + 26, y + 20, x + 22, y + 20, GOLD, 1);
  line(x + 26, y + 20, x + 25, y + 24, GOLD, 1);
  line(x + 6, y + 32, x + 50, y + 32, GOLD, 1); // baseline arc
}
function chipTalks(x: number, y: number): void {
  fillRect(x, y, 56, 36, [232, 226, 205]);
  // Europe shape
  fillPoly([[x + 6, y + 10], [x + 20, y + 6], [x + 30, y + 12], [x + 26, y + 26], [x + 12, y + 28], [x + 6, y + 18]], LAND);
  polyOutline([[x + 6, y + 10], [x + 20, y + 6], [x + 30, y + 12], [x + 26, y + 26], [x + 12, y + 28], [x + 6, y + 18]], [120, 105, 50]);
  // dove with wing and olive branch
  fillRect(x + 34, y + 10, 16, 5, WHITE);
  fillCircle(x + 50, y + 11, 3, WHITE);
  fillRect(x + 38, y + 8, 8, 2, [220, 220, 220]); // raised wing
  line(x + 36, y + 8, x + 42, y + 4, WHITE, 2);
  line(x + 38, y + 15, x + 46, y + 20, WHITE, 2);
  fillRect(x + 48, y + 14, 3, 2, [120, 200, 120]); // olive leaf
  // handshake bars + clasped hands
  fillRect(x + 8, y + 30, 20, 4, BLUE);
  fillRect(x + 28, y + 30, 20, 4, RED);
  fillRect(x + 24, y + 29, 8, 6, [240, 220, 180]);
  vline(x + 28, y + 29, 6, [200, 180, 140], 1);
}
function chipAnthropic(x: number, y: number): void {
  fillRect(x, y, 56, 36, [30, 30, 40]);
  // IPO bell, top-left
  fillRect(x + 4, y + 4, 8, 6, GOLD);
  fillCircle(x + 8, y + 4, 4, GOLD);
  fillRect(x + 7, y + 10, 2, 2, GOLD);
  // chip with pins and traces
  fillRect(x + 16, y + 8, 24, 20, [60, 60, 80]);
  fillRect(x + 22, y + 14, 12, 8, GOLD);
  drawText(x + 24, y + 15, "$", 1.0, [30, 30, 40]);
  for (let i = 0; i < 3; i++) {
    hline(x + 8, y + 12 + i * 7, 8, GOLD, 2);
    hline(x + 40, y + 12 + i * 7, 8, GOLD, 2);
  }
  // rising ticks on the right edge
  line(x + 44, y + 26, x + 48, y + 20, [120, 200, 120], 1);
  line(x + 48, y + 20, x + 52, y + 14, [120, 200, 120], 1);
  drawText(x + 4, y + 29, "$1.27T", 1.0, WHITE);
}
function chipHayabusa(x: number, y: number): void {
  fillRect(x, y, 56, 36, [20, 24, 40]);
  for (const [sx, sy] of [[8, 6], [48, 8], [30, 4], [52, 26], [4, 26]]) fillRect(x + sx, y + sy, 2, 2, WHITE);
  // asteroid with craters
  fillCircle(x + 14, y + 20, 9, [150, 140, 120]);
  fillCircle(x + 11, y + 17, 2, [120, 110, 95]);
  fillCircle(x + 17, y + 23, 2, [120, 110, 95]);
  fillCircle(x + 15, y + 14, 1, [120, 110, 95]);
  // probe with solar panels
  fillRect(x + 30, y + 12, 14, 6, [200, 200, 200]);
  fillRect(x + 24, y + 10, 6, 10, [40, 80, 160]);
  fillRect(x + 44, y + 10, 6, 10, [40, 80, 160]);
  line(x + 44, y + 15, x + 52, y + 15, GOLD, 2);
  // crossed-out flame (engine dead) + drifting debris
  line(x + 46, y + 10, x + 52, y + 20, RED, 2);
  line(x + 52, y + 10, x + 46, y + 20, RED, 2);
  fillRect(x + 28, y + 26, 2, 2, [200, 200, 200]);
  fillRect(x + 34, y + 30, 2, 2, [200, 200, 200]);
}
function chipGTA(x: number, y: number): void {
  // dusk sky: three horizontal bands
  fillRect(x, y, 56, 12, [90, 60, 110]);
  fillRect(x, y + 12, 56, 8, [200, 110, 80]);
  fillRect(x, y + 20, 56, 16, [40, 30, 60]);
  // low sun
  fillCircle(x + 44, y + 12, 5, [250, 200, 100]);
  // skyline with windows
  const base = y + 24;
  const hs = [8, 14, 10, 18, 12];
  let bx = x + 3;
  for (const hh of hs) {
    fillRect(bx, base - hh, 7, hh, [220, 180, 90]);
    fillRect(bx + 2, base - hh + 2, 2, 2, [255, 240, 180]);
    bx += 9;
  }
  // controller with D-pad and buttons
  fillRect(x + 8, y + 26, 40, 8, [30, 30, 30]);
  fillRect(x + 12, y + 28, 6, 2, WHITE);
  fillRect(x + 14, y + 27, 2, 4, WHITE);
  fillCircle(x + 40, y + 30, 2, RED);
  fillCircle(x + 34, y + 30, 2, [120, 200, 120]);
  drawText(x + 8, y + 27, "$1.8B", 1.0, WHITE);
}
function chipRose(x: number, y: number): void {
  fillRect(x, y, 56, 36, [200, 230, 190]);
  // baseball diamond with bases
  fillPoly([[x + 28, y + 4], [x + 50, y + 26], [x + 28, y + 32], [x + 6, y + 26]], [120, 180, 100]);
  polyOutline([[x + 28, y + 4], [x + 50, y + 26], [x + 28, y + 32], [x + 6, y + 26]], [90, 140, 70]);
  fillRect(x + 26, y + 26, 4, 4, WHITE); // home plate
  fillRect(x + 48, y + 24, 3, 3, WHITE); // first base
  fillRect(x + 26, y + 3, 3, 3, WHITE); // second base
  fillRect(x + 5, y + 24, 3, 3, WHITE); // third base
  // bat + ball in flight with motion lines
  line(x + 10, y + 8, x + 22, y + 20, [140, 100, 50], 3);
  fillCircle(x + 46, y + 8, 3, WHITE);
  line(x + 46, y + 8, x + 44, y + 6, RED, 1);
  line(x + 40, y + 4, x + 44, y + 6, [180, 180, 180], 1);
  line(x + 38, y + 8, x + 42, y + 10, [180, 180, 180], 1);
  // v5: ribbon is a plain red band — the "ROSE" text sat half below the
  // chip's bottom edge in v4 (ink to y+40 in a 36px chip). The headline
  // already says PETE ROSE.
  fillRect(x + 4, y + 30, 48, 5, RED);
}
function chipModi(x: number, y: number): void {
  fillRect(x, y, 56, 36, [232, 226, 205]);
  // podium with mic
  fillPoly([[x + 8, y + 12], [x + 24, y + 12], [x + 28, y + 30], [x + 4, y + 30]], INK);
  vline(x + 16, y + 4, 8, INK, 1);
  fillCircle(x + 16, y + 4, 2, INK);
  // factory with chimney + smoke puffs
  fillRect(x + 34, y + 18, 18, 12, GREY);
  fillRect(x + 36, y + 12, 3, 6, GREY);
  fillRect(x + 44, y + 12, 3, 6, GREY);
  fillCircle(x + 37, y + 9, 2, [220, 220, 220]);
  fillCircle(x + 40, y + 6, 2, [220, 220, 220]);
  // tax-cut arrow (down-right = cut) with a small gear
  line(x + 34, y + 10, x + 52, y + 4, TEAL, 2);
  line(x + 52, y + 4, x + 46, y + 4, TEAL, 2);
  line(x + 52, y + 4, x + 52, y + 10, TEAL, 2);
  fillCircle(x + 48, y + 24, 3, TEAL);
  fillCircle(x + 48, y + 24, 1, [232, 226, 205]);
}
function chipPhillips(x: number, y: number): void {
  fillRect(x, y, 56, 36, [200, 230, 190]);
  // outfield line + pitch
  hline(x, y + 20, 56, [120, 180, 100], 2);
  fillRect(x + 30, y + 22, 20, 10, [190, 170, 120]); // pitch
  // bat + ball in flight (bat ends y+20, clear of the scoreboard top)
  line(x + 8, y + 6, x + 20, y + 20, [140, 100, 50], 3);
  fillCircle(x + 44, y + 6, 3, WHITE);
  line(x + 44, y + 6, x + 42, y + 4, RED, 1);
  line(x + 38, y + 4, x + 42, y + 6, [150, 150, 150], 1);
  // stumps + bails
  for (let i = 0; i < 3; i++) vline(x + 34 + i * 5, y + 22, 10, GOLD, 2);
  hline(x + 34, y + 22, 14, GOLD, 2);
  // v5 scoreboard: WIDENED to 28px and moved up so "118" fits INSIDE
  // the chip — in v4 the rect was 22 wide (text 32 wide) and the text
  // ink ran to y+38 in a 36px chip, clipped by the chip edge. Now:
  // rect y+24..y+34, text y+24.5 u=1.0, ink y+25.5..y+33.5.
  fillRect(x + 3, y + 24, 28, 10, INK);
  drawText(x + 5, y + 24.5, "118", 1.0, RED);
}
const CHIPS: ((x: number, y: number) => void)[] = [
  chipCOP31, chipAkvan, chipVoyager, chipTalks, chipAnthropic,
  chipHayabusa, chipGTA, chipRose, chipModi, chipPhillips,
];

// ---------------------------------------------------------------- layout
// v5 AIRY EDITORIAL layout (v4 rebuild, defect-fixed). Band budget (y),
// measured with real glyph row heights (ink rows 1-9 of the 12-row box,
// so a text row's ink spans y+u..y+9u; no two baselines share a row):
// masthead 0-110 (rule 106) | features 118-382 | numbers 392-432 |
// tier2 442-540 + 550-648 | tier3 658-730 | map caption 736,
// map 754-838 | IN BRIEF header 842, lines 860-932 |
// DATE CHECK 948, 960 | rule 976 | footer 982 / 995 / 1008.
// 26 stories: 2 features + 8 tier-2 + 3 tier-3 + 13 IN BRIEF.
// Every text row has >=2.5px of clear ink-to-ink space to its neighbours.
function panel(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, PANEL);
  hline(x, y, w, LINE, 1);
  hline(x, y + h - 1, w, LINE, 1);
  vline(x, y, h, LINE, 1);
  vline(x + w - 1, y, h, LINE, 1);
}

function build(): void {
  fillRect(0, 0, W, H, PAPER);

  // ---- masthead: date ink ends y+72.4, subline ink starts y+85.5 —
  // 13px of real clearance (v4: subline sat on the date/rule). ----
  drawCentered(6, "FRIDAY - ONE DAY, ONE PICTURE", 1.4, RED);
  drawCentered(22, "20 NOVEMBER 2026", 5.6, INK);
  drawCentered(84, "THE WORLD TODAY - 26 STORIES - ONE DAY", 1.5, GREY);
  hline(12, 106, W - 24, INK, 2);

  // ---- two LARGE feature stories, side by side (264 tall) ----
  // Scene 84 tall (y0+10..y0+94); kicker y0+104; headlines y0+118 /
  // y0+150 / y0+182 at u=3.0 (ink gap 8px between lines); body y0+224 /
  // y0+240 at u=1.3. Scene bottom -> kicker ink: 11px clear.
  // (a) lead: Trump delays Iran war decision to 2027
  panel(12, 118, 484, 264);
  sceneLead(28, 128, 452, 84);
  drawText(28, 222, "US-IRAN", 1.4, RED);
  drawText(496 - 16 - textWidth("REUTERS", 1.4), 222, "REUTERS", 1.4, INK);
  drawText(28, 236, "TRUMP PUTS IRAN", 3.0, INK);
  drawText(28, 268, "WAR CALL OFF", 3.0, INK);
  drawText(28, 300, "TO 2027", 3.0, INK);
  drawText(28, 342, "No rush, Trump says. He will see", 1.3, INK);
  drawText(28, 358, "what happens after Jan 1. Reuters.", 1.3, INK);
  // (b) trilateral declaration
  panel(528, 118, 484, 264);
  sceneTrilateral(544, 128, 452, 84);
  drawText(544, 222, "SHENZHEN DECLARATION", 1.4, RED);
  drawText(1012 - 16 - textWidth("CFR", 1.4), 222, "CFR", 1.4, INK);
  drawText(544, 236, "TRUMP, XI, PUTIN", 3.0, INK);
  drawText(544, 268, "IN 4-POINT", 3.0, INK);
  drawText(544, 300, "DECLARATION", 3.0, INK);
  drawText(544, 342, "UN reform, fuel supply, immunities,", 1.3, INK);
  drawText(544, 358, "nuclear-risk talks. No Ukraine mention.", 1.3, INK);

  // ---- numbers strip: 8 UNIFORM boxes (118 wide, 8px gutters), values
  // ALL at u=1.2 and labels ALL at u=1.05, both centred. v4 mixed
  // fitted sizes (2.0 down to 1.2) and uneven widths; the longest value
  // ("1 LIGHT-DAY", 109px at u=1.2) sets the uniform size so nothing
  // wraps. The comma kerning fix makes "-1,101" / "300,000" render
  // without the space after the comma. ----
  const nums: [string, string][] = [
    ["-1,101", "DOW POINTS"],
    ["-2.0%", "S&P 500"],
    ["-2.3%", "NASDAQ"],
    ["300,000", "EVACUATED"],
    ["423", "RESCUE TEAMS"],
    ["1 LIGHT-DAY", "VOYAGER 1"],
    ["80 MINUTES", "SUMMIT"],
    ["118", "PHILLIPS"],
  ];
  const nbw = 118;
  nums.forEach(([val, lab], i) => {
    const bx = 12 + i * (nbw + 8);
    panel(bx, 392, nbw, 40);
    drawCentered(398, val, 1.2, RED, bx + nbw / 2);
    drawCentered(416, lab, 1.05, INK, bx + nbw / 2);
  });

  // ---- tier 2: 8 featured stories, 4 cols x 2 rows, 98 tall ----
  // Scene band 32px, pure graphics (no text — see scene2*). Kicker
  // y0+36, headlines y0+49 / y0+67 at u=1.8 (ink gaps 3.6px / 2.9px to
  // the body), body y0+85 at u=1.1. Headline/body fit to maxW 221.
  const tier2: [string, string, string, string][] = [
    ["WALL STREET", "DOW -1,101", "BELOW 50,000", "4th day down. S&P -2.0%."],
    ["COP31 ANTALYA", "COP31: NO DEAL", "YET", "144-80 paras. $120bn cut."],
    ["BAY OF BENGAL", "CYCLONE AKVAN", "LANDFALL", "300,000 moved, 423 teams."],
    ["DEEP SPACE", "VOYAGER 1", "1 LIGHT-DAY", "First object, 1 light-day."],
    ["UKRAINE WAR", "EUROPE OPEN TO", "RUSSIA TALKS", "Leaders ready for talks. BBC"],
    ["AI MARKETS", "ANTHROPIC", "$1.27T AT CLOSE", "Closed about $97, up 17%."],
    ["JAPAN SPACE", "HAYABUSA2", "ENGINE FAULT", "No more asteroid landing."],
    ["GAMES", "GTA VI SALES", "PASS $1.8B", "Beats Odyssey $1.80B run."],
  ];
  const cw = (1000 - 3 * 12) / 4;
  tier2.forEach(([kick, h1, h2, body], i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x0 = 12 + col * (cw + 12);
    const y0 = 442 + row * 108;
    panel(x0, y0, cw, 98);
    SCENES2[i](x0 + 1, y0 + 1, cw - 2, 32);
    drawText(x0 + 10, y0 + 36, kick, 1.15, RED);
    drawTextFit(x0 + 10, y0 + 49, h1, 1.8, 1.6, cw - 20, INK);
    drawTextFit(x0 + 10, y0 + 67, h2, 1.8, 1.6, cw - 20, INK);
    drawTextFit(x0 + 10, y0 + 85, body, 1.1, 1.0, cw - 20, [60, 60, 60]);
  });

  // ---- tier 3: 3 wider cards, 72 tall. RESERVED RECTANGLES: text zone
  // x0+14..x0+241, chip zone x0+249..x0+325 (chip 56x36 at x0+255,
  // y0+18). Headlines fit to maxW 227 so no glyph can enter the chip
  // zone; the chip cannot touch a headline. Kicker y0+7, headlines
  // y0+20 / y0+38 at u=1.8, body y0+58 at u=1.1. ----
  const tier3: [string, string, string, string, number][] = [
    ["US", "TRUMP PARDONS", "PETE ROSE", "Posthumous pardon. BBC", 7],
    ["INDIA ECONOMY", "MODI: WHERE ARE", "THE HIRES?", "Tax cut, where are hires?", 8],
    ["CRICKET", "PHILLIPS 118", "LEADS NZ", "NZ pass 250, day 2.", 9],
  ];
  const tw = 325;
  tier3.forEach(([kick, h1, h2, body, chip], i) => {
    const x0 = 12 + i * (tw + 12);
    const y0 = 658;
    panel(x0, y0, tw, 72);
    drawText(x0 + 14, y0 + 7, kick, 1.15, RED);
    drawTextFit(x0 + 14, y0 + 20, h1, 1.8, 1.6, 227, INK);
    drawTextFit(x0 + 14, y0 + 38, h2, 1.8, 1.6, 227, INK);
    drawTextFit(x0 + 14, y0 + 58, body, 1.1, 1.0, 227, [60, 60, 60]);
    CHIPS[chip](x0 + tw - 70, y0 + 18);
  });

  // ---- world map, 754-838. v5 rebuild: 8 numbered pins kept, but only
  // FOUR city labels (WASHINGTON, LONDON, SHENZHEN, TOKYO) — the
  // ANTALYA / RIYADH / ODISHA / SHENZHEN cluster was unreadable. Each
  // label sits in OPEN SEA with a white backing and a red leader line
  // from its pin; no label touches a pin, another label, a coastline or
  // a section edge (positions computed from the lon/lat mapping below).
  // Ocean labels: PACIFIC / ATLANTIC / INDIAN only, in open ocean;
  // SOUTHERN dropped (it sat on the map edge). The "WHERE IT HAPPENED"
  // caption is OUTSIDE the map rect, above it, with a 6px gap. ----
  drawText(12, 736, "WHERE IT HAPPENED", 1.3, INK);
  fillRect(0, 754, W, 84, SEA);
  const mx = (lon: number): number => ((lon + 170) / 360) * W;
  const my = (lat: number): number => 754 + ((75 - lat) / 130) * 84;
  for (let lon = -150; lon <= 150; lon += 30) vline(mx(lon), 754, 84, [200, 218, 230], 1);
  for (let lat = 60; lat >= -30; lat -= 30) hline(0, my(lat), W, [200, 218, 230], 1);
  const ll = (pts: [number, number][]): number[][] => pts.map(([lo, la]) => [mx(lo), my(la)]);
  const NA: [number, number][] = [[-165, 60], [-150, 70], [-130, 71], [-115, 73], [-95, 80], [-85, 75], [-75, 72], [-60, 60], [-55, 47], [-70, 42], [-75, 35], [-80, 25], [-85, 20], [-90, 15], [-95, 18], [-105, 22], [-115, 28], [-125, 40], [-140, 60]];
  const SA: [number, number][] = [[-80, 10], [-75, 5], [-60, 0], [-50, -5], [-40, -10], [-35, -20], [-45, -30], [-55, -35], [-65, -40], [-70, -50], [-75, -55], [-70, -35], [-75, -20], [-80, -5]];
  const AF: [number, number][] = [[-17, 15], [-10, 30], [0, 35], [10, 37], [20, 32], [30, 31], [35, 28], [40, 15], [48, 11], [51, 0], [40, -10], [35, -20], [30, -30], [20, -35], [15, -30], [12, -18], [8, -5], [9, 4], [-8, 4]];
  const AS: [number, number][] = [[30, 62], [40, 68], [55, 70], [70, 72], [90, 75], [110, 76], [130, 72], [150, 70], [170, 66], [178, 65], [170, 60], [160, 55], [155, 50], [142, 45], [140, 40], [135, 35], [130, 32], [127, 35], [122, 38], [120, 30], [115, 22], [108, 18], [105, 10], [100, 8], [95, 15], [90, 22], [85, 20], [80, 13], [77, 8], [72, 20], [65, 25], [58, 26], [55, 26], [50, 29], [48, 30], [45, 28], [40, 30], [35, 36], [30, 36], [30, 42], [35, 45], [30, 50], [28, 55]];
  const EU: [number, number][] = [[-10, 36], [-9, 43], [-2, 48], [0, 50], [5, 53], [8, 57], [12, 55], [18, 56], [21, 55], [24, 58], [28, 60], [30, 62], [25, 65], [20, 70], [15, 70], [10, 65], [5, 60], [0, 55], [-5, 50], [-10, 45]];
  const AU: [number, number][] = [[113, -22], [114, -30], [115, -35], [120, -34], [125, -32], [130, -32], [135, -35], [140, -38], [145, -38], [150, -37], [153, -32], [153, -27], [150, -22], [146, -19], [142, -15], [142, -11], [137, -12], [135, -15], [132, -12], [130, -13], [126, -14], [122, -17], [118, -20]];
  const NZ: [number, number][] = [[167, -45], [175, -38], [178, -37], [174, -41]];
  for (const cont of [NA, SA, AF, AS, AU, NZ]) fillPoly(ll(cont), LAND);
  fillPoly(ll(EU), [190, 170, 90]);
  for (const cont of [NA, SA, AF, AS, AU, NZ, EU]) polyOutline(ll(cont), [120, 105, 50]);
  // ocean labels, open sea only (no backing: sea is empty here)
  drawText(60, 806, "PACIFIC", 1.0, [90, 120, 140]);
  drawText(430, 820, "ATLANTIC", 1.0, [90, 120, 140]);
  drawText(700, 824, "INDIAN", 1.0, [90, 120, 140]);
  const pins: [number, number, string, number, number][] = [
    [-77, 39, "WASHINGTON", 320, 786],
    [-0.1, 51.5, "LONDON", 390, 763],
    [30.7, 36.9, "ANTALYA", 0, 0],
    [46.7, 24.6, "RIYADH", 0, 0],
    [85.5, 20, "ODISHA", 0, 0],
    // v5-fix: SHENZHEN's first spot (820,800) sat on Australia's north
    // coast (28 land samples in its backing rect) and TOKYO's (898,766)
    // sat on Kamchatka (92 samples). Swapped to verified-clean sea:
    // SHENZHEN SW over the Indian Ocean (700,804), TOKYO E over the
    // open Pacific (900,786). Both rects test 0 land samples.
    [114, 22.5, "SHENZHEN", 700, 804],
    [139.7, 35.7, "TOKYO", 900, 786],
    [174.8, -41.3, "WELLINGTON", 0, 0],
  ];
  pins.forEach(([lo, la, name, lx, ly], i) => {
    const px0 = mx(lo);
    const py0 = my(la);
    fillCircle(px0, py0, 8, RED);
    fillCircle(px0, py0, 7, WHITE);
    fillCircle(px0, py0, 6, RED);
    drawText(px0 - 4, py0 - 5, String(i + 1), 1.1, WHITE);
    if (lx === 0 && ly === 0) return; // unlabelled pin: number only
    // leader line from the pin to the label's backing rect, then the
    // backing rect, then the label — three separate reserved pieces.
    const lw = textWidth(name, 1.2);
    line(px0, py0, lx - 2, ly + 7, RED, 1);
    fillRect(lx - 2, ly - 2, lw + 4, 15, WHITE);
    drawText(lx, ly, name, 1.2, INK);
  });
  hline(0, 838, W, INK, 2);

  // ---- IN BRIEF: 13 verified one-liners, 2 cols x 7+6 rows ----
  // Rows at 12px step, u=0.95 (ink 8.55px) — 3.45px clear between rows
  // (v4: 11px step, rows nearly touched). Header ink ends y+856.4,
  // first row ink starts y+861.
  drawText(12, 842, "IN BRIEF - 13 MORE FROM THE WIRES", 1.6, RED);
  drawText(W - 12 - textWidth("26 STORIES, ONE DAY", 1.5), 844, "26 STORIES, ONE DAY", 1.5, GREY);
  const brief: [string, string][] = [
    ["YUNUS HOME FIRE: ", "arson feared, Bangladesh."],
    ["HONG KONG OPEN: ", "Rakshitha stuns Olympic champion."],
    ["RAHUL GANDHI ", "rejects poll boycott strategy."],
    ["US SUMMONSES ", "to Doval, Goel via Delhi courts."],
    ["PAKISTAN ", "minister to lead SCO delegation to Delhi."],
    ["CALIFORNIA ", "targets Nvidia in China AI-chip probe."],
    ["CANADA ", "embraces AI data centres."],
    ["TAIZ SIEGE: ", "people inside speak to BBC."],
    ["US MEASLES ", "comeback fuelled by vaccine fears."],
    ["FIONA ", "the hippo dies after swallowing a hat."],
    ["CUMIN SODAS ", "challenge cola giants in India."],
    ["WORLD CHILDREN'S DAY ", "marked."],
    ["JOBURG: ", "ANC nears Joburg deal; talks Friday. Reuters."],
  ];
  brief.forEach(([key, rest], i) => {
    const col = i < 7 ? 0 : 1;
    const row = col === 0 ? i : i - 7;
    const x0 = col === 0 ? 12 : 524;
    const y0 = 860 + row * 12;
    drawKeywordLine(x0, y0, key, rest, 0.95, RED, INK);
  });

  // ---- DATE CHECK: two lines, 12px apart, clear of the brief above
  // (last brief ink ends y+940.6, first line ink starts y+949.1) and
  // of the footer rule below (second line ink ends y+970.9, rule y+976).
  drawText(12, 948, "NOT TODAY: ICJ Myanmar ruling 19 Nov. Fiji disaster 18 Nov. KAFD strike 19 Nov.", 1.1, INK);
  drawText(12, 960, "Hormuz mine claims unconfirmed. US-Venezuela deal 19 Nov. Summit met 19 Nov.", 1.1, INK);
  hline(0, 976, W, INK, 1);

  // ---- footer: THREE SEPARATE ROWS, each with real vertical spacing
  // (v4 piled sources + verified + date onto two colliding rows).
  // Sources y+982 (ink 983.2..992.8), verified y+995 (ink 996.1..
  // 1004.9), date y+1008 (ink 1009.2..1018.8, 5px from the page edge).
  drawText(12, 982, "SOURCES: REUTERS AP BBC WSJ THE HINDU IMD NASA", 1.2, INK);
  drawCentered(995, "ALL STORIES VERIFIED AGAINST NAMED SOURCES", 1.1, GREY);
  drawCentered(1008, "20 NOVEMBER 2026", 1.2, INK);
}

build();
downsample(); // 3072x3072 supersampled -> smooth 1024x1024
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
mkdirSync(outDir, { recursive: true });
writeFileSync(outDir + "/entry.png", encodePNG());
console.log("wrote " + outDir + "/entry.png");
