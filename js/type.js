/* =========================================================
   type.js · the typography kit (collage look)

   ransom(text, size, seed, opts)  big ransom-note headings
   sticker(text, tilt, shape)      small tilted pill / tag labels
   human(text)                     italic serif line (Instrument Serif)
   label(text)                     tiny uppercase mono label (Space Mono)

   Same text + same seed always gives the same collage,
   so a heading doesn't reshuffle every time you see it.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});

  // Heading fonts. scale evens out how big each font looks.
  // lower: false = the font only has capitals
  const FONTS = [
    { family: '"Bagel Fat One"',     weight: 400, scale: 0.92, lower: true },
    { family: '"Playfair Display"',  weight: 900, scale: 1.05, lower: true },
    { family: '"Space Mono"',        weight: 700, scale: 1.0,  lower: true },
    { family: 'Bungee',              weight: 400, scale: 0.86, lower: false },
    { family: '"Archivo Black"',     weight: 400, scale: 0.95, lower: true },
    { family: '"Bebas Neue"',        weight: 400, scale: 1.25, lower: false },
    { family: '"DM Serif Display"',  weight: 400, scale: 1.08, lower: true },
    { family: '"Rubik Mono One"',    weight: 400, scale: 0.8,  lower: false },
    { family: '"Press Start 2P"',    weight: 400, scale: 0.66, lower: true },
  ];

  // Tile colours: [background, text]. Paper tones appear more often.
  const TILES = [
    ['#111111', '#ffffff'], ['#111111', '#ffffff'],
    ['#ffffff', '#111111'], ['#ffffff', '#111111'],
    ['#f3ead3', '#111111'], ['#f3ead3', '#111111'],
    ['#ff6fa8', '#111111'],
    ['#000080', '#ffffff'],
    ['#ffe14d', '#111111'],
    ['#f4c6d7', '#000080'],
    ['#e8402a', '#ffffff'],
  ];

  /* ---------- seeded random (same seed, same result) ---------- */
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = typeof seed === 'number' ? seed >>> 0 : hash(String(seed));
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, list) => list[Math.floor(r() * list.length)];

  /* ---------- ransom(text, size, seed, opts) ----------
     size  biggest letter size in px (shrinks to fit narrow screens)
     seed  any number or string; defaults to the text
     opts  { dark: true }       no black tiles (for black backgrounds)
           { mixCase: false }   keep the text's own capitals (Type Codes)
           { align: 'center' }  centre the lines
  */
  function ransom(text, size = 32, seed, opts = {}) {
    const r = rng(seed == null ? text : seed);
    const tiles = opts.dark ? TILES.filter(t => t[0] !== '#111111') : TILES;
    const mixCase = opts.mixCase !== false;

    const wrap = document.createElement('span');
    wrap.className = 'ransom' + (opts.align === 'center' ? ' center' : '');
    wrap.setAttribute('role', 'heading');
    wrap.setAttribute('aria-level', String(opts.level || 1));
    wrap.setAttribute('aria-label', text);

    // Shrink so the longest word always fits on one line
    const longest = Math.max(1, ...text.split(/\s+/).map(w => w.length));
    wrap.style.fontSize = `min(${size}px, calc((min(100cqi, 420px) - 40px) / ${(longest * 1.12).toFixed(2)}))`;

    let lastFont = null, lastTile = null;
    text.split(/\s+/).filter(Boolean).forEach(word => {
      const w = document.createElement('span');
      w.className = 'ransom-word';
      w.setAttribute('aria-hidden', 'true');
      for (const ch of word) {
        // never the same font or colour twice in a row
        let font, tile;
        do { font = pick(r, FONTS); } while (font === lastFont);
        do { tile = pick(r, tiles); } while (tile === lastTile);
        lastFont = font; lastTile = tile;

        let glyph = ch;
        if (mixCase && font.lower && r() < 0.3) glyph = ch.toLowerCase();
        else if (mixCase) glyph = ch.toUpperCase();

        const t = document.createElement('span');
        t.className = 'rt';
        t.textContent = glyph;
        t.style.fontFamily = font.family;
        t.style.fontWeight = font.weight;
        t.style.fontSize = font.scale + 'em';
        t.style.background = tile[0];
        t.style.color = tile[1];
        t.style.setProperty('--r', ((r() - 0.5) * 14).toFixed(1) + 'deg');
        t.style.setProperty('--dy', ((r() - 0.5) * 0.16).toFixed(3) + 'em');
        w.append(t);
      }
      wrap.append(w);
    });
    return wrap;
  }

  /* ---------- sticker(text, tilt, shape) ----------
     shape 'pill' (default) or 'tag' (luggage tag with a hole) */
  function sticker(text, tilt = -4, shape = 'pill') {
    const s = document.createElement('span');
    s.className = 'sticker ' + shape;
    s.textContent = text;
    s.style.setProperty('--tilt', tilt + 'deg');
    return s;
  }

  function human(text) {
    const p = document.createElement('p');
    p.className = 'human';
    p.textContent = text;
    return p;
  }

  function label(text, tag = 'p') {
    const el = document.createElement(tag);
    el.className = 'label';
    el.textContent = text;
    return el;
  }

  W.type = { ransom, sticker, human, label, rng };
  window.ransom = ransom; // the reusable ransom(text, size, seed)
})();
