/* =========================================================
   types.js · the personality model

   5 TRAITS (personality first). Each is a scale from 0 to 1
   between two ends, measured by one challenge (half) + two quick
   questions (half), plus a small nudge from the palette you pick.

   18 FONT TYPES. Each font has a personality: a spot on all
   5 scales, and a job it's best at (headline, subheader, body).
   Your result = the fonts closest to your spot: your #1 font is
   your type, then your best headline, subheader and body font,
   plus the font that pairs best with you.

   Names, lines and questions live here so they're easy to edit.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});

  /* ---------- the 5 traits ----------
     Personality first. low = the 0 end, high = the 1 end,
     with a one-line meaning for each end. */
  W.TRAITS = [
    { id: 'energy',    name: 'Energy',    low: 'Introvert',   high: 'Extrovert',
      lowLine: 'you recharge alone and design deep.', highLine: 'you light up the room (and the moodboard).' },
    { id: 'structure', name: 'Structure', low: 'Free spirit', high: 'Planner',
      lowLine: 'rules are a suggestion.', highLine: 'everything has a place.' },
    { id: 'era',       name: 'Era',       low: 'Futurist',    high: 'Nostalgic',
      lowLine: 'always on the next thing.', highLine: 'old soul, good taste.' },
    { id: 'detail',    name: 'Detail',    low: 'Big picture', high: 'Detail-obsessed',
      lowLine: 'you see the whole poster, not the pixels.', highLine: 'you see the 1px gap.' },
    { id: 'pace',      name: 'Pace',      low: 'Slow burner', high: 'Fast mover',
      lowLine: 'slow, considered, fully formed.', highLine: 'fast hands, faster ideas.' },
  ];

  /* ---------- quick questions (the hand-written pool) ----------
     [question, answer for the LOW end, answer for the HIGH end].
     Each game picks 2 at random per trait (AI may write fresh ones instead). */
  W.QUESTION_POOL = [
    [ // Energy: Introvert vs Extrovert
      ['Crit day. You...', 'pray they skip you', 'volunteer to go first'],
      ['Group project energy:', "I'll do my part. alone.", 'I made the group chat'],
      ['Studio playlist is...', 'noise-cancelling, no talking', 'on speaker, everyone vibes'],
      ['Showcase night you are...', 'by the snacks, observing', 'giving tours of my work'],
      ['Your Pinterest boards are...', 'secret, for me only', 'public and I send them'],
      ['After a 6 hour studio sesh...', 'nap and silence pls', 'who wants bubble tea?'],
    ],
    [ // Structure: Free spirit vs Planner
      ['Your Figma layers are...', 'Rectangle 47 copy 3', 'named, grouped, colour-coded'],
      ['Brief drops. First move?', 'vibe sketch immediately', 'make a timeline'],
      ['Your desktop is...', 'a beautiful mess', 'folders in folders'],
      ['Deadline in 3 days. You...', 'will feel it out', 'already have a plan'],
      ['Moodboard method:', 'chaos collage', 'grid, sorted by colour'],
      ['Weekend plans?', 'see where it goes', 'itinerary in Notion'],
    ],
    [ // Era: Futurist vs Nostalgic
      ['Your camera roll is...', 'clean phone shots', 'film and digicam pics'],
      ['Dream studio:', 'glass and screens', 'an old print shop'],
      ['Fave design era:', 'whatever drops next', 'Y2K and before'],
      ['Music on...', 'a playlist', 'vinyl, obviously'],
      ['Your font crush:', 'something variable and new', 'a classic serif'],
      ['You sketch with...', 'iPad and Procreate', 'pen and paper'],
    ],
    [ // Detail: Big picture vs Detail-obsessed
      ['You spot a 1px gap.', 'nobody will notice', 'fix it immediately'],
      ['Your files are named...', 'final_final_v3', 'v03_2026-11-05'],
      ['Kerning?', "it's fine", 'I see it in my dreams'],
      ['Feedback you get most:', 'love the idea!', 'so polished!'],
      ['Picking colours:', 'eyeball it', 'exact hex codes only'],
      ['Your sketches are...', 'loose scribbles', 'basically final art'],
    ],
    [ // Pace: Slow burner vs Fast mover
      ['Ideas arrive...', 'slowly, fully formed', 'fast, all at once'],
      ["You'd rather...", 'one more round', 'ship it today'],
      ['Your process:', 'research rabbit hole first', '20 thumbnails right now'],
      ['Lunch order:', 'read the whole menu', 'same thing, instantly'],
      ['Exporting:', 'check every frame', 'export and send'],
      ['Replying to the group chat:', 'draft it twice', 'instant voice note'],
    ],
  ];

  // 2 random questions per trait for one game
  W.pickQuestions = function () {
    return W.QUESTION_POOL.map(pool => pool.slice().sort(() => Math.random() - 0.5).slice(0, 2));
  };

  /* ---------- palettes nudge your personality a little ----------
     [energy, structure, era, detail, pace] added to your traits */
  W.PALETTE_NUDGE = {
    pop:        [ 0.10,  0.00, -0.05,  0.00,  0.05],
    pastel:     [-0.08,  0.00,  0.04,  0.00, -0.05],
    complement: [ 0.03,  0.05,  0.00,  0.05,  0.00],
    analogous:  [ 0.05, -0.05,  0.08,  0.00,  0.00],
    triadic:    [ 0.05,  0.05,  0.00, -0.03,  0.03],
    mono:       [-0.10,  0.08,  0.00,  0.08, -0.03],
    paint:      [ 0.00,  0.00,  0.10,  0.00,  0.03],
  };

  /* ---------- 18 font types ----------
     p = personality: [energy, structure, era, detail, pace], each 0..1
     role = the job it's best at: head(line), sub(header) or body text */
  W.FONTS = [
    { font: 'Playfair Display', weight: 900, name: 'The Editor-in-Chief', line: 'classic, sharp, a little dramatic.',   p: [0.85, 0.75, 0.80, 0.85, 0.35] , role: 'head' },
    { font: 'Press Start 2P',   weight: 400, name: 'The Arcade Kid',      line: 'high score energy, pixel perfect.',   p: [0.80, 0.80, 0.95, 0.45, 0.90] , role: 'head' },
    { font: 'Archivo Black',    weight: 400, name: 'The Swiss Machine',   line: 'bold, gridded, zero nonsense.',       p: [0.90, 0.95, 0.30, 0.85, 0.70] , role: 'head' },
    { font: 'Anton',            weight: 400, name: 'The Billboard Brat',  line: 'big, fast and impossible to miss.',   p: [1.00, 0.60, 0.45, 0.40, 0.95] , role: 'head' },
    { font: 'Monoton',          weight: 400, name: 'The Neon Sign',       line: 'a late-night diner glow.',            p: [0.80, 0.35, 0.90, 0.55, 0.45] , role: 'head' },
    { font: 'Silkscreen',       weight: 400, name: 'The Pixel Punk',      line: 'lo-fi on purpose.',                   p: [0.60, 0.70, 0.90, 0.30, 0.85] , role: 'sub' },
    { font: 'Unbounded',        weight: 900, name: 'The Future Shaper',   line: 'wide, round, already in 2030.',       p: [0.85, 0.45, 0.05, 0.60, 0.75] , role: 'head' },
    { font: 'Rubik Glitch',     weight: 400, name: 'The Chaos Engine',    line: 'breaks things beautifully.',          p: [0.90, 0.10, 0.30, 0.05, 0.95] , role: 'head' },
    { font: 'EB Garamond',      weight: 400, name: 'The Old Soul',        line: 'quiet, wise, beautifully set.',       p: [0.20, 0.80, 0.95, 0.90, 0.15] , role: 'body' },
    { font: 'Special Elite',    weight: 400, name: 'The Typewriter Poet', line: 'smudged ink, big feelings.',          p: [0.35, 0.40, 0.95, 0.30, 0.30] , role: 'sub' },
    { font: 'Work Sans',        weight: 300, name: 'The Quiet Modernist', line: 'clean lines, calm mind.',             p: [0.15, 0.90, 0.20, 0.85, 0.50] , role: 'body' },
    { font: 'VT323',            weight: 400, name: 'The Terminal Dreamer', line: 'green screen, big ideas.',           p: [0.30, 0.75, 0.85, 0.50, 0.70] , role: 'sub' },
    { font: 'Josefin Sans',     weight: 300, name: 'The Art Deco Ghost',  line: 'elegant, airy, a bit mysterious.',    p: [0.30, 0.55, 0.75, 0.80, 0.35] , role: 'sub' },
    { font: 'Caveat',           weight: 400, name: 'The Scrapbook Heart', line: 'handmade, warm, a little messy.',     p: [0.40, 0.05, 0.50, 0.10, 0.60] , role: 'sub' },
    { font: 'Space Grotesk',    weight: 300, name: 'The Soft Futurist',   line: 'friendly tech, soft edges.',          p: [0.30, 0.60, 0.10, 0.70, 0.60] , role: 'body' },
    { font: 'Comfortaa',        weight: 400, name: 'The Cloud Doodler',   line: 'round, soft, endlessly kind.',        p: [0.35, 0.30, 0.30, 0.40, 0.50] , role: 'sub' },
    { font: 'Space Mono',       weight: 400, name: 'The Code Poet',       line: 'monospaced, honest, a little nerdy.', p: [0.40, 0.85, 0.55, 0.75, 0.60], role: 'body' },
    { font: 'Instrument Serif', weight: 400, name: 'The Gallery Whisperer', line: 'soft serif, quietly expensive.',   p: [0.20, 0.55, 0.65, 0.70, 0.30], role: 'body' },
  ];

  const clamp01 = v => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.5));
  const dist = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
  const MAX_DIST = Math.sqrt(5); // furthest two spots can be

  /* results[1..5].trait (0..1) → [volume, structure, era, precision, pace] */
  //    + a small nudge from the palette you picked (results.palette)
  W.traitsFrom = function (results = {}) {
    const nudge = W.PALETTE_NUDGE[results.palette] || [0, 0, 0, 0, 0];
    return W.TRAITS.map((t, i) => clamp01((results[i + 1] ? clamp01(results[i + 1].trait) : 0.5) + nudge[i]));
  };

  /* One trait's score. Half the challenge, a quarter per question. The voice
     check counts as a third answer on Energy; skipped, the formula is unchanged.
     No randomness: the same answers always give the same trait. */
  W.VOICE_VALUE = { introvert: 0, ambivert: 0.5, extrovert: 1 };
  W.traitScore = function (part, answers, voice) {
    const v = W.VOICE_VALUE[voice];
    return v === undefined
      ? 0.5 * part + 0.25 * answers[0] + 0.25 * answers[1]
      : 0.4 * part + 0.2 * answers[0] + 0.2 * answers[1] + 0.2 * v;
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

  /* Your full result: type (#1 font overall), your 3 fonts (one per job:
     headline, subheader, body text, so they're 3 different kinds), and best pair */
  const ROLES = [['head', 'Headline'], ['sub', 'Subheader'], ['body', 'Body text']];
  W.resultFor = function (traits) {
    const ranked = W.rankFonts(traits);
    const top3 = ROLES.map(([role, roleName]) => ({ ...ranked.find(f => f.role === role), roleName }));
    // the ideal partner: opposite volume + era (headline meets body, old meets new),
    // same structure, precision and pace (you'd share a grid and a rhythm)
    const ideal = [1 - traits[0], traits[1], 1 - traits[2], traits[3], traits[4]];
    const pair = W.rankFonts(ideal).find(f => !top3.some(t => t.font === f.font));
    return { traits, type: ranked[0], top3, pair };   // type = closest font of all 18
  };

  /* ---------- Compatibility between two people (max 100) ----------
     Per trait: some are better different, some better the same. */
  const COMPAT = [
    { pts: 25, why: 'different', score: d => 0.35 + 0.65 * d },       // energy: extrovert + introvert = headline + body
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
