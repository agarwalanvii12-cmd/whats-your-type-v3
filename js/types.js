/* =========================================================
   types.js · the 16 types, card stats and compatibility
   Code letters: Bold/Light · Grid/Freeform · Retro/New · Kerner/Vibes
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});

  W.AXES = [
    { name: 'Volume',    letters: ['B', 'L'], words: ['Bold', 'Light'] },
    { name: 'Structure', letters: ['G', 'F'], words: ['Grid', 'Freeform'] },
    { name: 'Era',       letters: ['R', 'N'], words: ['Retro', 'New'] },
    { name: 'Precision', letters: ['K', 'V'], words: ['Kerner', 'Vibes'] },
  ];

  // Results from challenges 1-4 → a 4-letter code like "BGRK".
  // A challenge not played yet counts as its second letter (L, F, N, V).
  W.computeCode = function (results = {}) {
    return W.AXES.map((axis, i) => {
      const letter = results[i + 1] && results[i + 1].letter;
      return axis.letters.includes(letter) ? letter : axis.letters[1];
    }).join('');
  };

  // Placeholders from BRIEF.md. Anvii will rename these.
  W.TYPES = {
    BGRK: { name: 'The Letterpress Boss', font: 'Playfair Display', weight: 900 },
    BGRV: { name: 'The Arcade Cabinet',   font: 'Press Start 2P',   weight: 400 },
    BGNK: { name: 'The Swiss Machine',    font: 'Archivo Black',    weight: 400 },
    BGNV: { name: 'The Billboard Brat',   font: 'Anton',            weight: 400 },
    BFRK: { name: 'The Neon Diner',       font: 'Monoton',          weight: 400 },
    BFRV: { name: 'The Pixel Punk',       font: 'Silkscreen',       weight: 400 },
    BFNK: { name: 'The Chrome Kid',       font: 'Unbounded',        weight: 400 },
    BFNV: { name: 'The Chaos Engine',     font: 'Rubik Glitch',     weight: 400 },
    LGRK: { name: 'The Old Soul',         font: 'EB Garamond',      weight: 400 },
    LGRV: { name: 'The Typewriter Poet',  font: 'Special Elite',    weight: 400 },
    LGNK: { name: 'The Quiet Modernist',  font: 'Work Sans',        weight: 300 },
    LGNV: { name: 'The Terminal Dreamer', font: 'VT323',            weight: 400 },
    LFRK: { name: 'The Art Deco Ghost',   font: 'Josefin Sans',     weight: 300 },
    LFRV: { name: 'The Scrapbook Heart',  font: 'Caveat',           weight: 400 },
    LFNK: { name: 'The Soft Futurist',    font: 'Space Grotesk',    weight: 300 },
    LFNV: { name: 'The Cloud Doodler',    font: 'Comfortaa',        weight: 400 },
  };

  /* ---------- Type Card stat bars (each 0..1) ----------
     Built from what you actually did in the challenges and drawing. */
  W.cardStats = function (results = {}, draw = {}) {
    const r = i => results[i] || {};
    const c = v => Math.max(0, Math.min(1, v || 0));
    return [
      { label: 'Loudness',        value: c(r(1).loudness) },
      { label: 'Grid love',       value: c(r(2).snap ? 0.5 + (r(2).aligned || 0) / 8 : (r(2).aligned || 0) / 4) },
      { label: 'Nostalgia',       value: c((r(3).retro || 0) / 5) },
      { label: 'Precision',       value: c(r(4).evenness) },
      { label: 'Speed',           value: c((r(5).speed || 0) / 4) },          // 4 keys a second fills the bar
      { label: 'Undo dependency', value: c(((r(5).backspaces || 0) + (draw.undos || 0)) / 6) },
    ];
  };

  /* ---------- Compatibility (BRIEF.md section 5) ----------
     Score each axis, add them up (max 100). */
  W.compatibility = function (a, b) {
    const same = i => a[i] === b[i];
    const parts = [
      same(0) ? 10 : 30, // Volume: different = headline + body, a classic pairing
      same(1) ? 25 : 10, // Structure: same = you'd share a grid
      same(2) ? 15 : 20, // Era: different = old meets new
      same(3) ? 25 : 5,  // Precision: same = no kerning fights
    ];
    const score = parts.reduce((s, n) => s + n, 0);
    const verdict =
      score >= 85 ? 'a classic pairing. print it.' :
      score >= 65 ? 'works with some tracking adjustments.' :
      score >= 45 ? 'a bold combo. art directors will talk.' :
                    'font clash. beautiful chaos.';
    return { score, parts, verdict, pair: `${W.TYPES[a].font} × ${W.TYPES[b].font}` };
  };
})();
