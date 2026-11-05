/* =========================================================
   type.js · the typography kit (collage look)

   ransom(text, size, seed, opts)  big ransom-note headings
   sticker(text, tilt, shape)      small tilted pill / tag labels
   human(text)                     italic serif line (Instrument Serif)
   label(text)                     uppercase mono label (Space Mono)

   Same text + same seed always gives the same collage,
   so a heading doesn't reshuffle every time you see it.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});

  /* Heading fonts: serif + sans, heavy + light, upright + italic,
     tall + wide. scale evens out how big each one looks.
     sy stretches the letter: >1 tall, <1 short and squat.
     lower: false = the font only has capitals. */
  const FONTS = [
    { family: '"Bagel Fat One"',    weight: 400, style: 'normal', scale: 0.92, lower: true },  // heavy round sans
    { family: '"Playfair Display"', weight: 900, style: 'normal', scale: 1.05, lower: true },  // heavy serif
    { family: '"Playfair Display"', weight: 400, style: 'italic', scale: 1.12, lower: true },  // light serif italic
    { family: '"DM Serif Display"', weight: 400, style: 'italic', scale: 1.1,  lower: true },  // serif italic
    { family: '"Fraunces"',         weight: 900, style: 'normal', scale: 1.0,  lower: true },  // chunky serif
    { family: '"Fraunces"',         weight: 300, style: 'italic', scale: 1.1,  lower: true },  // light serif italic
    { family: '"Space Mono"',       weight: 700, style: 'italic', scale: 1.0,  lower: true },  // mono italic
    { family: 'Bungee',             weight: 400, style: 'normal', scale: 0.86, lower: false }, // chunky display
    { family: '"Archivo Black"',    weight: 400, style: 'normal', scale: 0.95, lower: true },  // heavy grotesk
    { family: '"Bebas Neue"',       weight: 400, style: 'normal', scale: 1.3,  lower: false, sy: 1.12 }, // tall condensed
    { family: 'Oswald',             weight: 300, style: 'normal', scale: 1.15, lower: true,  sy: 1.12 }, // tall light
    { family: '"Work Sans"',        weight: 200, style: 'normal', scale: 1.1,  lower: true },  // thin sans
    { family: '"Rubik Mono One"',   weight: 400, style: 'normal', scale: 0.8,  lower: false, sy: 0.9 },  // wide short
    { family: 'Unbounded',          weight: 900, style: 'normal', scale: 0.82, lower: true,  sy: 0.9 },  // wide heavy
    { family: 'Unbounded',          weight: 300, style: 'normal', scale: 0.85, lower: true },  // wide light
    { family: '"Press Start 2P"',   weight: 400, style: 'normal', scale: 0.78, lower: true },  // pixel
  ];

  /* Whimsical palette: lots of colours that pop, a few neutrals.
     Letter colour is picked automatically for best contrast. */
  const COLORS = [
    '#ff4fa3', // bubblegum pink
    '#ff8a1f', // tangerine
    '#ffd23f', // lemon
    '#9be15d', // lime
    '#2ec4b6', // mint teal
    '#3a86ff', // sky blue
    '#7b2ff7', // grape
    '#ff3b30', // tomato
    '#ffb3de', // candy floss
    '#b8f2ff', // ice
    '#b388ff', // lilac
    '#00a86b', // jade
    '#1d2bb8', // cobalt
    '#111111', // ink
    '#ffffff', // white
    '#f3ead3', // paper
  ];

  /* ---------- colour contrast ---------- */
  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255]
      .map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  }
  // black or white, whichever reads better on this background
  function inkFor(bg) {
    const L = luminance(bg);
    return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? '#111111' : '#ffffff';
  }

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
     opts  { dark: true }       no ink tiles (for black backgrounds)
           { mixCase: false }   keep the text's own capitals (Type Codes)
           { align: 'center' }  centre the lines
  */
  function ransom(text, size = 32, seed, opts = {}) {
    const r = rng(seed == null ? text : seed);
    const colors = opts.dark ? COLORS.filter(c => c !== '#111111') : COLORS;
    const mixCase = opts.mixCase !== false;

    const wrap = document.createElement('span');
    wrap.className = 'ransom' + (opts.align === 'center' ? ' center' : '');
    wrap.setAttribute('role', 'heading');
    wrap.setAttribute('aria-level', String(opts.level || 1));
    wrap.setAttribute('aria-label', text);

    // Shrink so the longest word always fits on one line
    const longest = Math.max(1, ...text.split(/\s+/).map(w => w.length));
    wrap.style.fontSize = `min(${size}px, calc((min(100cqi, 420px) - 40px) / ${(longest * 1.15).toFixed(2)}))`;

    let lastFont = null, lastColor = null;
    text.split(/\s+/).filter(Boolean).forEach(word => {
      const w = document.createElement('span');
      w.className = 'ransom-word';
      w.setAttribute('aria-hidden', 'true');
      for (const ch of word) {
        // neighbours never share a font or a colour
        let font, bg;
        do { font = pick(r, FONTS); } while (font.family === lastFont);
        do { bg = pick(r, colors); } while (bg === lastColor);
        lastFont = font.family; lastColor = bg;

        let glyph = ch;
        if (mixCase && font.lower && r() < 0.3) glyph = ch.toLowerCase();
        else if (mixCase) glyph = ch.toUpperCase();

        const jitter = 0.88 + r() * 0.26;          // some letters bigger, some smaller
        const t = document.createElement('span');
        t.className = 'rt';
        t.textContent = glyph;
        t.style.fontFamily = font.family;
        t.style.fontWeight = font.weight;
        t.style.fontStyle = font.style;
        t.style.fontSize = (font.scale * jitter).toFixed(3) + 'em';
        t.style.background = bg;
        t.style.color = inkFor(bg);
        t.style.setProperty('--r', ((r() - 0.5) * 14).toFixed(1) + 'deg');
        t.style.setProperty('--dy', ((r() - 0.5) * 0.16).toFixed(3) + 'em');
        t.style.setProperty('--sy', String(font.sy || 1));
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

  W.type = { ransom, sticker, human, label, rng, inkFor };
  window.ransom = ransom; // the reusable ransom(text, size, seed)
})();
