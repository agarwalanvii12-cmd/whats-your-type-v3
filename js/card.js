/* =========================================================
   card.js · the Type Card

   Drawn in a p5 graphics buffer as a Win95 "Properties"
   window: pixel self-portrait, name, ransom-letter Type Code,
   type name, your name set in your font, and stat bars.
   Saved as a 1200×1700 PNG (drawn at 2× for crisp printing).

   WYT.renderCard(data) → Promise<{ dataURL, blob, url }>
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});

  const CW = 600, CH = 850; // card size in points (PNG is 2× this)
  const COL = {
    grey: '#c0c0c0', dark: '#808080', black: '#0a0a0a', light: '#dfdfdf',
    white: '#ffffff', navy: '#000080', ink: '#111111', pink: '#f4c6d7',
  };

  /* ---------- Win95 drawing helpers ---------- */
  function bevel(g, x, y, w, h, sunken) {
    const [tl1, tl2, br1, br2] = sunken
      ? [COL.dark, COL.black, COL.white, COL.light]
      : [COL.white, COL.light, COL.black, COL.dark];
    g.noStroke();
    g.fill(tl1); g.rect(x, y, w, 1); g.rect(x, y, 1, h);
    g.fill(br1); g.rect(x, y + h - 1, w, 1); g.rect(x + w - 1, y, 1, h);
    g.fill(tl2); g.rect(x + 1, y + 1, w - 2, 1); g.rect(x + 1, y + 1, 1, h - 2);
    g.fill(br2); g.rect(x + 1, y + h - 2, w - 2, 1); g.rect(x + w - 2, y + 1, 1, h - 2);
  }
  function raised(g, x, y, w, h, fill = COL.grey) { g.noStroke(); g.fill(fill); g.rect(x, y, w, h); bevel(g, x, y, w, h, false); }
  function sunken(g, x, y, w, h, fill = COL.white) { g.noStroke(); g.fill(fill); g.rect(x, y, w, h); bevel(g, x, y, w, h, true); }
  function etched(g, x, y, w) { g.noStroke(); g.fill(COL.dark); g.rect(x, y, w, 1); g.fill(COL.white); g.rect(x, y + 1, w, 1); }

  function text(ctx, str, x, y, font, color, align = 'left', spacing = 0) {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = spacing + 'px';
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  const label = (ctx, str, x, y, color = COL.ink) =>
    text(ctx, str.toUpperCase(), x, y, '700 12px "Space Mono"', color, 'left', 2);

  function button(g, ctx, x, y, w, h, str, isDefault) {
    raised(g, x, y, w, h);
    if (isDefault) { g.noFill(); g.stroke(COL.black); g.strokeWeight(1); g.rect(x - 0.5, y - 0.5, w + 1, h + 1); g.noStroke(); }
    text(ctx, str, x + w / 2, y + h / 2 + 5, '700 13px Silkscreen', COL.ink, 'center');
  }

  function wrapLines(ctx, str, maxW) {
    const words = str.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    lines.push(line);
    return lines;
  }

  /* ---------- ransom tiles on canvas ---------- */
  function drawTiles(ctx, word, x, y, size) {
    let cx = x;
    for (const t of word) {
      const px = size * t.em;
      const font = `${t.font.style} ${t.font.weight} ${px}px ${t.font.family}`;
      ctx.font = font;
      const tw = Math.max(ctx.measureText(t.glyph).width, px * 0.45) + size * 0.28;
      const th = size * 1.22;
      ctx.save();
      ctx.translate(cx + tw / 2, y + th / 2 + t.dy * size);
      ctx.rotate((t.rot * Math.PI) / 180);
      ctx.shadowColor = 'rgba(0,0,0,.25)';
      ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 4; ctx.shadowBlur = 8;
      ctx.fillStyle = t.bg;
      ctx.fillRect(-tw / 2, -th / 2, tw, th);
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = t.ink;
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.scale(1, t.font.sy || 1);
      ctx.fillText(t.glyph, 0, size * 0.05);
      ctx.restore();
      cx += tw + size * 0.08;
    }
  }

  /* ---------- the card ---------- */
  function drawCard(g, d) {
    const ctx = g.drawingContext;
    g.background(COL.pink);

    // window
    const x = 18, y = 18, w = CW - 36, h = CH - 36;
    raised(g, x, y, w, h);

    // title bar: "Anvii Properties"  [?][×]
    g.fill(COL.navy); g.rect(x + 4, y + 4, w - 8, 34);
    text(ctx, `${d.name} Properties`, x + 14, y + 27, '700 16px Silkscreen', COL.white);
    [['?', w - 66], ['×', w - 38]].forEach(([s, bx]) => {
      raised(g, x + bx, y + 10, 26, 22);
      text(ctx, s, x + bx + 13, y + 27, '700 14px Silkscreen', COL.ink, 'center');
    });

    // tabs + panel
    const tabY = y + 50, panelY = tabY + 30;
    const px = x + 12, pw = w - 24, ph = h - (panelY - y) - 60;
    [['Fonts', 116], ['Stats', 204]].forEach(([s, tx]) => {
      raised(g, px + tx, tabY + 4, 86, 28);
      text(ctx, s, px + tx + 43, tabY + 24, '700 13px Silkscreen', COL.ink, 'center');
    });
    raised(g, px, panelY, pw, ph);
    raised(g, px, tabY, 112, 32);                        // the selected tab
    g.fill(COL.grey); g.rect(px + 2, panelY - 1, 108, 4); // joins it to the panel
    text(ctx, 'General', px + 56, tabY + 21, '700 13px Silkscreen', COL.ink, 'center');

    const ix = px + 20, iw = pw - 40;   // inner content area
    let cy = panelY + 22;

    // avatar
    const scale = 7, av = 24 * scale;
    sunken(g, ix, cy, av + 8, av + 8);
    g.noStroke();
    (d.avatar || []).forEach((c, i) => {
      if (c < 0) return;
      g.fill(W.PAINT28[c]);
      g.rect(ix + 4 + (i % 24) * scale, cy + 4 + Math.floor(i / 24) * scale, scale, scale);
    });

    // code + type name, right of the avatar
    const rx = ix + av + 28, rw = iw - (av + 28);
    label(ctx, 'Type code', rx, cy + 14);
    drawTiles(ctx, W.type.tiles(d.code, 'code' + d.code, { mixCase: false })[0], rx + 2, cy + 30, 52);
    ctx.font = 'italic 32px "Instrument Serif"';
    const nameLines = wrapLines(ctx, d.type.name, rw);
    nameLines.slice(0, 2).forEach((line, i) =>
      text(ctx, line, rx, cy + 134 + i * 32, 'italic 32px "Instrument Serif"', COL.ink));

    cy += av + 26;
    etched(g, ix, cy, iw);

    // your name in your font
    cy += 24;
    label(ctx, 'Your font', ix, cy);
    const fontCss = size => `${d.type.weight} ${size}px "${d.type.font}"`;
    let size = 76;
    ctx.font = fontCss(size);
    while (size > 22 && ctx.measureText(d.name).width > iw) { size -= 2; ctx.font = fontCss(size); }
    text(ctx, d.name, ix, cy + 22 + size * 0.85, fontCss(size), COL.ink);
    cy += 34 + size;
    text(ctx, `${d.type.font} · ${d.type.weight}`.toUpperCase(), ix, cy, '400 12px "Space Mono"', '#333333', 'left', 2);

    cy += 18;
    etched(g, ix, cy, iw);

    // stat bars
    cy += 26;
    label(ctx, 'Stats', ix, cy);
    cy += 14;
    const trackX = ix + 190, trackW = iw - 190, seg = 12, gap = 2;
    d.stats.forEach(s => {
      text(ctx, s.label.toUpperCase(), ix, cy + 17, '700 12px "Space Mono"', COL.ink, 'left', 1);
      sunken(g, trackX, cy, trackW, 24);
      const n = Math.round(s.value * Math.floor((trackW - 6) / (seg + gap)));
      g.fill(COL.navy);
      for (let k = 0; k < n; k++) g.rect(trackX + 4 + k * (seg + gap), cy + 4, seg, 16);
      cy += 34;
    });

    // the 4 letters spelled out, as tilted sticker tags
    cy += 8;
    let tx = ix;
    d.code.split('').forEach((letter, i) => {
      const axis = W.AXES[i];
      const word = axis.words[axis.letters.indexOf(letter)].toUpperCase();
      ctx.save();
      ctx.font = '700 12px "Space Mono"';
      if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
      const tw = ctx.measureText(word).width + 26, th = 28;
      ctx.translate(tx + tw / 2, cy + th / 2);
      ctx.rotate(([-3, 2, -2, 3][i] * Math.PI) / 180);
      ctx.fillStyle = COL.ink;
      ctx.beginPath(); ctx.roundRect(-tw / 2 + 2, -th / 2 + 2, tw, th, th / 2); ctx.fill();   // hard shadow
      ctx.fillStyle = COL.white; ctx.strokeStyle = COL.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(-tw / 2, -th / 2, tw, th, th / 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = COL.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(word, 1, 1);
      ctx.restore();
      tx += tw + 10;
    });

    // footer: OK / Cancel / Apply, like every Win95 dialog
    const by = y + h - 44;
    text(ctx, "WHAT'S YOUR TYPE?! v3", x + 16, by + 20, '400 11px Silkscreen', '#404040');
    button(g, ctx, x + w - 312, by, 92, 30, 'OK', true);
    button(g, ctx, x + w - 210, by, 92, 30, 'Cancel');
    button(g, ctx, x + w - 108, by, 92, 30, 'Apply');
  }

  /* ---------- fonts must be loaded before drawing on a canvas ---------- */
  function loadFonts(d) {
    const specs = [
      '700 16px Silkscreen', '400 11px Silkscreen', '700 12px "Space Mono"', '400 12px "Space Mono"',
      'italic 32px "Instrument Serif"', `${d.type.weight} 40px "${d.type.font}"`,
      ...W.type.tiles(d.code, 'code' + d.code, { mixCase: false })[0]
        .map(t => `${t.font.style} ${t.font.weight} 40px ${t.font.family}`),
    ];
    const all = Promise.all(specs.map(s => document.fonts.load(s).catch(() => null)));
    const timeout = new Promise(r => setTimeout(r, 3000)); // offline: draw with what we have
    return Promise.race([all, timeout]);
  }

  /* data: { name, code, type, avatar, stats } */
  W.renderCard = async function (d) {
    await loadFonts(d);
    const canvas = await new Promise(resolve => {
      new p5(p => {
        p.setup = () => {
          p.noCanvas();
          const g = p.createGraphics(CW, CH);
          g.pixelDensity(2);
          drawCard(g, d);
          // copy out, so removing the p5 sketch doesn't take the picture with it
          const out = document.createElement('canvas');
          out.width = g.elt.width; out.height = g.elt.height;
          out.getContext('2d').drawImage(g.elt, 0, 0);
          p.remove();
          resolve(out);
        };
      });
    });
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    return { dataURL: canvas.toDataURL('image/png'), blob, url: URL.createObjectURL(blob) };
  };

  /* ---------- download (iPhone: open in a new tab to long-press) ---------- */
  const isIOS = () =>
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  W.downloadCard = function (card, filename) {
    if (isIOS()) {
      const tab = window.open(card.url, '_blank');
      if (!tab) alert('Long-press the card to save it.');
      return;
    }
    const a = document.createElement('a');
    a.href = card.url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
  };

  /* ---------- the screen ---------- */
  W.screens = W.screens || {};
  W.screens.card = {
    enter(el, state) {
      const h = W.h, T = W.type;
      const code = W.computeCode(state.results);
      const type = W.TYPES[code];
      const stats = W.cardStats(state.results, state.drawStats || {});
      const avatar = state.avatar || W.DEFAULT_FACES[0];
      const name = state.name || 'Anon';
      const token = (this.token = {});

      // the share code for Compare (saved on this device, so it survives a reload)
      state.share = W.net.encode({ name, code, avatar, stats });
      W.net.saveMine(state.share);
      if (W.live.active) W.live.send({ type: 'card', share: state.share });

      const box = h('div', { class: 'card-box' }, h('p', { class: 'card-printing' }, 'Printing card...'));
      const dl = T.magButton(h('button', { disabled: true }), 'Download PNG', 'dl');
      const next = T.magButton(h('button', { class: 'big', onclick: () => W.next() }), 'Compare', 'compare');

      el.append(h('div', { class: 'stack card-stack' },
        T.sticker('Your type', -4),
        T.ransom(code, 64, 'code' + code, { mixCase: false }),
        T.human(`you are ${type.name.replace(/^The /, 'the ')}.`),
        box,
        isIOS() && T.label('Tip: long-press the card to save'),
        h('div', { class: 'row' }, dl),
        next));

      W.renderCard({ name, code, type, avatar, stats }).then(card => {
        if (this.token !== token) return; // left the screen already
        box.replaceChildren(h('img', { class: 'card-img', src: card.dataURL, alt: `Type Card: ${name}, ${code}, ${type.name}` }));
        W.sound.play('levelup');
        state.card = { code, typeName: type.name, font: type.font, stats, dataURL: card.dataURL };
        const file = `whats-your-type-${code}-${name.replace(/[^a-z0-9]+/gi, '-')}.png`;
        dl.disabled = false;
        dl.addEventListener('click', () => W.downloadCard(card, file));
      });
    },
    exit() { this.token = null; },
  };
})();
