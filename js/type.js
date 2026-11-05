/* =========================================================
   type.js · the typography kit (collage look)

   ransom(text, size, seed, opts)  big ransom-note headings
   mag(text, seed)                 magazine-letter button labels
   sticker(text, tilt, shape)      small tilted pill / tag labels
   human(text)                     italic serif line (Instrument Serif)
   label(text)                     uppercase mono label (Space Mono)

   Colours come from the active palette (pick one in the Colors
   window). Same text + same seed always gives the same collage,
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

  /* ---------- PALETTES (colour theory, Paint style) ----------
     Letter colour is always picked automatically for contrast. */
  const PALETTES = [
    { id: 'pop', name: 'Pop', note: 'bright and loud',
      colors: ['#ff4fa3', '#ff8a1f', '#ffd23f', '#9be15d', '#2ec4b6', '#3a86ff', '#7b2ff7', '#ff3b30', '#111111', '#ffffff'] },
    { id: 'pastel', name: 'Pastel', note: 'soft tints',
      colors: ['#ffc8dd', '#ffafcc', '#bde0fe', '#a2d2ff', '#cdb4db', '#fff1a8', '#c1f0c1', '#ffd6a5', '#ffffff', '#f3ead3'] },
    { id: 'complement', name: 'Complementary', note: 'opposites attract',
      colors: ['#1d3fbf', '#3a86ff', '#8fb8ff', '#ff7a00', '#ffb056', '#ffd8a8', '#111111', '#ffffff'] },
    { id: 'analogous', name: 'Sunset', note: 'next-door neighbours',
      colors: ['#ffbe0b', '#fb5607', '#ff006e', '#ff7096', '#ff9e00', '#c9184a', '#fff3d6', '#111111'] },
    { id: 'triadic', name: 'Triadic', note: 'three, evenly spaced',
      colors: ['#e63946', '#ffd60a', '#1d4ed8', '#ff9aa2', '#fff08a', '#8ab4ff', '#111111', '#f3ead3'] },
    { id: 'mono', name: 'Monochrome', note: 'one hue, many shades',
      colors: ['#2a0a5e', '#4b1fa3', '#7b2ff7', '#a679ff', '#d4bfff', '#f1e9ff', '#111111', '#ffffff'] },
    { id: 'paint', name: 'Paint 95', note: 'the classic 16',
      colors: ['#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080',
               '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff'] },
  ];

  let paletteId = 'pop';
  try { paletteId = localStorage.getItem('wyt-palette') || 'pop'; } catch (e) { /* private mode */ }
  if (!PALETTES.some(p => p.id === paletteId)) paletteId = 'pop';

  const palette = () => PALETTES.find(p => p.id === paletteId);

  function setPalette(id) {
    if (!PALETTES.some(p => p.id === id)) return;
    paletteId = id;
    try { localStorage.setItem('wyt-palette', id); } catch (e) { /* ignore */ }
    refresh();
    document.dispatchEvent(new CustomEvent('wyt:palette', { detail: id }));
  }

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

  /* Hands out colours for one heading:
     never the same as the letter before, and always one of the
     least-used colours so far. With 8+ colours that means no colour
     shows up more than twice in a heading of up to 16 letters. */
  function colorPicker(r, colors) {
    const used = {};
    let last = null;
    return function () {
      const options = colors.filter(c => c !== last);
      const least = Math.min(...options.map(c => used[c] || 0));
      const c = pick(r, options.filter(c => (used[c] || 0) === least));
      used[c] = (used[c] || 0) + 1;
      last = c;
      return c;
    };
  }
  function fontPicker(r) {
    let last = null;
    return function () {
      let f;
      do { f = pick(r, FONTS); } while (f.family === last);
      last = f.family;
      return f;
    };
  }

  /* ---------- ransom(text, size, seed, opts) ----------
     size  biggest letter size in px (shrinks to fit narrow screens)
     seed  any number or string; defaults to the text
     opts  { dark: true }       outline very dark tiles (for black backgrounds)
           { mixCase: false }   keep the text's own capitals (Type Codes)
           { align: 'center' }  centre the lines
  */
  /* tiles(text, seed, opts) → the collage as data, one array per word:
     { glyph, font, bg, ink, em, rot (deg), dy (em), outlined }.
     ransom() turns it into HTML; the Type Card draws it on a canvas. */
  function tiles(text, seed, opts = {}) {
    const r = rng(seed == null ? text : seed);
    const nextColor = colorPicker(r, palette().colors);
    const nextFont = fontPicker(r);
    const mixCase = opts.mixCase !== false;

    return text.split(/\s+/).filter(Boolean).map(word => [...word].map(ch => {
      const font = nextFont();
      const bg = nextColor();
      let glyph = ch;
      if (mixCase && font.lower && r() < 0.3) glyph = ch.toLowerCase();
      else if (mixCase) glyph = ch.toUpperCase();
      const jitter = 0.88 + r() * 0.26; // some letters bigger, some smaller
      return {
        glyph, font, bg, ink: inkFor(bg),
        em: font.scale * jitter,
        rot: (r() - 0.5) * 14,
        dy: (r() - 0.5) * 0.16,
        outlined: !!opts.dark && luminance(bg) < 0.03, // show dark tiles on black
      };
    }));
  }

  function ransom(text, size = 32, seed, opts = {}) {
    const wrap = document.createElement('span');
    wrap.className = 'ransom' + (opts.align === 'center' ? ' center' : '');
    wrap.setAttribute('role', 'heading');
    wrap.setAttribute('aria-level', String(opts.level || 1));
    wrap.setAttribute('aria-label', text);
    wrap.dataset.ransom = JSON.stringify([text, size, seed, opts]); // so it can be redrawn

    // Shrink so the longest word always fits on one line
    const longest = Math.max(1, ...text.split(/\s+/).map(w => w.length));
    wrap.style.fontSize = `min(${size}px, calc((min(100cqi, 420px) - 40px) / ${(longest * 1.15).toFixed(2)}))`;

    tiles(text, seed, opts).forEach(word => {
      const w = document.createElement('span');
      w.className = 'ransom-word';
      w.setAttribute('aria-hidden', 'true');
      for (const t of word) {
        const el = document.createElement('span');
        el.className = 'rt' + (t.outlined ? ' outlined' : '');
        el.textContent = t.glyph;
        styleLetter(el, t.font, t.em);
        el.style.background = t.bg;
        el.style.color = t.ink;
        el.style.setProperty('--r', t.rot.toFixed(1) + 'deg');
        el.style.setProperty('--dy', t.dy.toFixed(3) + 'em');
        w.append(el);
      }
      wrap.append(w);
    });
    return wrap;
  }

  function styleLetter(el, font, em) {
    el.style.fontFamily = font.family;
    el.style.fontWeight = font.weight;
    el.style.fontStyle = font.style;
    el.style.fontSize = em.toFixed(3) + 'em';
    el.style.setProperty('--sy', String(font.sy || 1));
  }

  /* ---------- mag(text, seed) ----------
     Magazine letters for button labels: every letter a different
     font, about a third of them on a little coloured tile.
     Put it inside a button; the button keeps the plain text as its label. */
  function mag(text, seed) {
    const r = rng(seed == null ? 'mag' + text : seed);
    const nextColor = colorPicker(r, palette().colors);
    const nextFont = fontPicker(r);

    const wrap = document.createElement('span');
    wrap.className = 'mag';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.dataset.mag = JSON.stringify([text, seed]);

    text.split(/\s+/).filter(Boolean).forEach(word => {
      const w = document.createElement('span');
      w.className = 'mag-word';
      for (const ch of word) {
        const font = nextFont();
        const l = document.createElement('span');
        l.className = 'ml';
        l.textContent = font.lower && r() < 0.35 ? ch.toLowerCase() : ch.toUpperCase();
        styleLetter(l, font, font.scale * (0.92 + r() * 0.16));
        l.style.setProperty('--r', ((r() - 0.5) * 10).toFixed(1) + 'deg');
        if (r() < 0.38) {
          const bg = nextColor();
          l.classList.add('tile');
          l.style.background = bg;
          l.style.color = inkFor(bg);
        }
        w.append(l);
      }
      wrap.append(w);
    });
    return wrap;
  }

  // Fill a button with magazine letters (screen readers still get the plain text)
  function magButton(btn, text, seed) {
    btn.setAttribute('aria-label', text);
    btn.classList.add('mag-btn');
    btn.replaceChildren(mag(text, seed));
    return btn;
  }

  /* Redraw every heading and button label in the new palette */
  function refresh(root = document) {
    root.querySelectorAll('[data-ransom]').forEach(el => {
      const [text, size, seed, opts] = JSON.parse(el.dataset.ransom);
      el.replaceWith(ransom(text, size, seed ?? undefined, opts));
    });
    root.querySelectorAll('[data-mag]').forEach(el => {
      const [text, seed] = JSON.parse(el.dataset.mag);
      el.replaceWith(mag(text, seed ?? undefined));
    });
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

  W.type = {
    ransom, tiles, mag, magButton, sticker, human, label, refresh,
    rng, inkFor, PALETTES, palette, setPalette,
  };
  window.ransom = ransom; // the reusable ransom(text, size, seed)
})();
