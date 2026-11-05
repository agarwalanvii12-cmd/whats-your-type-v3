/* =========================================================
   types.js · the personality model

   5 TRAITS. Each is a scale from 0 to 1 between two poles,
   measured by one challenge (half) + two quick questions (half).

   16 FONT TYPES. Each font has a personality: a spot on all
   5 scales. Your result = the fonts closest to your spot:
   your #1 font is your type, plus your top 3, plus the font
   that pairs best with you (headline + body style).

   Names, lines and questions live here so they're easy to edit.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});

  /* ---------- the 5 traits ----------
     low = the 0 end, high = the 1 end.
     Each trait has a one-line meaning for both ends. */
  W.TRAITS = [
    { id: 'volume',    name: 'Volume',    low: 'Quiet',   high: 'Loud',
      lowLine: 'you let the work speak.', highLine: 'you walk in and own the room.' },
    { id: 'structure', name: 'Structure', low: 'Freeform', high: 'Planner',
      lowLine: 'rules are a suggestion.', highLine: 'everything has a place.' },
    { id: 'era',       name: 'Era',       low: 'Futurist', high: 'Nostalgic',
      lowLine: 'always on the next thing.', highLine: 'old soul, good taste.' },
    { id: 'precision', name: 'Precision', low: 'Vibes',   high: 'Perfectionist',
      lowLine: 'close enough is beautiful.', highLine: 'you see the 1px gap.' },
    { id: 'pace',      name: 'Pace',      low: 'Careful', high: 'Quick',
      lowLine: 'slow, considered, fully formed.', highLine: 'fast hands, faster ideas.' },
  ];

  /* ---------- 16 font types ----------
     p = personality: [volume, structure, era, precision, pace], each 0..1 */
  W.FONTS = [
    { font: 'Playfair Display', weight: 900, name: 'The Editor-in-Chief', line: 'classic, sharp, a little dramatic.',   p: [0.85, 0.75, 0.80, 0.85, 0.35] },
    { font: 'Press Start 2P',   weight: 400, name: 'The Arcade Kid',      line: 'high score energy, pixel perfect.',   p: [0.80, 0.80, 0.95, 0.45, 0.90] },
    { font: 'Archivo Black',    weight: 400, name: 'The Swiss Machine',   line: 'bold, gridded, zero nonsense.',       p: [0.90, 0.95, 0.30, 0.85, 0.70] },
    { font: 'Anton',            weight: 400, name: 'The Billboard Brat',  line: 'big, fast and impossible to miss.',   p: [1.00, 0.60, 0.45, 0.40, 0.95] },
    { font: 'Monoton',          weight: 400, name: 'The Neon Sign',       line: 'a late-night diner glow.',            p: [0.80, 0.35, 0.90, 0.55, 0.45] },
    { font: 'Silkscreen',       weight: 400, name: 'The Pixel Punk',      line: 'lo-fi on purpose.',                   p: [0.60, 0.70, 0.90, 0.30, 0.85] },
    { font: 'Unbounded',        weight: 900, name: 'The Future Shaper',   line: 'wide, round, already in 2030.',       p: [0.85, 0.45, 0.05, 0.60, 0.75] },
    { font: 'Rubik Glitch',     weight: 400, name: 'The Chaos Engine',    line: 'breaks things beautifully.',          p: [0.90, 0.10, 0.30, 0.05, 0.95] },
    { font: 'EB Garamond',      weight: 400, name: 'The Old Soul',        line: 'quiet, wise, beautifully set.',       p: [0.20, 0.80, 0.95, 0.90, 0.15] },
    { font: 'Special Elite',    weight: 400, name: 'The Typewriter Poet', line: 'smudged ink, big feelings.',          p: [0.35, 0.40, 0.95, 0.30, 0.30] },
    { font: 'Work Sans',        weight: 300, name: 'The Quiet Modernist', line: 'clean lines, calm mind.',             p: [0.15, 0.90, 0.20, 0.85, 0.50] },
    { font: 'VT323',            weight: 400, name: 'The Terminal Dreamer', line: 'green screen, big ideas.',           p: [0.30, 0.75, 0.85, 0.50, 0.70] },
    { font: 'Josefin Sans',     weight: 300, name: 'The Art Deco Ghost',  line: 'elegant, airy, a bit mysterious.',    p: [0.30, 0.55, 0.75, 0.80, 0.35] },
    { font: 'Caveat',           weight: 400, name: 'The Scrapbook Heart', line: 'handmade, warm, a little messy.',     p: [0.40, 0.05, 0.50, 0.10, 0.60] },
    { font: 'Space Grotesk',    weight: 300, name: 'The Soft Futurist',   line: 'friendly tech, soft edges.',          p: [0.30, 0.60, 0.10, 0.70, 0.60] },
    { font: 'Comfortaa',        weight: 400, name: 'The Cloud Doodler',   line: 'round, soft, endlessly kind.',        p: [0.35, 0.30, 0.30, 0.40, 0.50] },
  ];

  const clamp01 = v => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.5));
  const dist = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
  const MAX_DIST = Math.sqrt(5); // furthest two spots can be

  /* results[1..5].trait (0..1) → [volume, structure, era, precision, pace] */
  W.traitsFrom = function (results = {}) {
    return W.TRAITS.map((t, i) => clamp01(results[i + 1] && results[i + 1].trait));
  };

  // "Loud" or "Quiet" for one trait value
  W.traitWord = (i, v) => (v >= 0.5 ? W.TRAITS[i].high : W.TRAITS[i].low);
  W.traitLine = (i, v) => (v >= 0.5 ? W.TRAITS[i].highLine : W.TRAITS[i].lowLine);

  /* Your fonts: all 16 ranked by how close they are to you.
     match = 0..100 (100 = exactly your spot) */
  W.rankFonts = function (traits) {
    return W.FONTS
      // curved so close fonts score high (a short distance away ≈ 85%+)
      .map(f => ({ ...f, match: Math.round(100 * (1 - (dist(f.p, traits) / MAX_DIST) ** 1.5)) }))
      .sort((a, b) => b.match - a.match);
  };

  /* Your full result: type (#1 font), top 3, and best pair */
  W.resultFor = function (traits) {
    const ranked = W.rankFonts(traits);
    const top3 = ranked.slice(0, 3);
    // the ideal partner: opposite volume + era (headline meets body, old meets new),
    // same structure, precision and pace (you'd share a grid and a rhythm)
    const ideal = [1 - traits[0], traits[1], 1 - traits[2], traits[3], traits[4]];
    const pair = W.rankFonts(ideal).find(f => !top3.some(t => t.font === f.font));
    return { traits, type: top3[0], top3, pair };
  };

  /* ---------- Compatibility between two people (max 100) ----------
     Per trait: some are better different, some better the same. */
  const COMPAT = [
    { pts: 25, why: 'different', score: d => 0.35 + 0.65 * d },       // volume: loud + quiet = headline + body
    { pts: 20, why: 'same',      score: d => 0.35 + 0.65 * (1 - d) }, // structure: you'd share a grid
    { pts: 20, why: 'different', score: d => 0.5 + 0.5 * d },         // era: old meets new
    { pts: 20, why: 'same',      score: d => 0.2 + 0.8 * (1 - d) },   // precision: no kerning fights
    { pts: 15, why: 'same',      score: d => 0.4 + 0.6 * (1 - d) },   // pace: same rhythm
  ];
  W.compatibility = function (a, b) {
    const parts = COMPAT.map((c, i) => Math.round(c.pts * c.score(Math.abs(a[i] - b[i]))));
    const score = parts.reduce((s, n) => s + n, 0);
    const verdict =
      score >= 85 ? 'a classic pairing. print it.' :
      score >= 65 ? 'works with some tracking adjustments.' :
      score >= 45 ? 'a bold combo. art directors will talk.' :
                    'font clash. beautiful chaos.';
    return { score, parts, max: COMPAT.map(c => c.pts), best: COMPAT.map(c => c.why), verdict };
  };
})();
