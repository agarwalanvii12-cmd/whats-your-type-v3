/* =========================================================
   card.js · the Type Card

   Drawn in a p5 graphics buffer as a Win95 "Properties"
   window: pixel self-portrait, your type, your name set in your
   font, your 5 traits, your top 3 fonts, and the font you pair
   best with. Saved as a 1200×1840 PNG (2× for crisp printing).

   WYT.renderCard(data) → Promise<{ dataURL, blob, url }>
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});

  const CW = 600, CH = 920; // card size in points (PNG is 2× this)
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
    const { type, top3, pair, traits } = d.result;
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
    [['Fonts', 116], ['Traits', 204]].forEach(([s, tx]) => {
      raised(g, px + tx, tabY + 4, 86, 28);
      text(ctx, s, px + tx + 43, tabY + 24, '700 13px Silkscreen', COL.ink, 'center');
    });
    raised(g, px, panelY, pw, ph);
    raised(g, px, tabY, 112, 32);                        // the selected tab
    g.fill(COL.grey); g.rect(px + 2, panelY - 1, 108, 4); // joins it to the panel
    text(ctx, 'General', px + 56, tabY + 21, '700 13px Silkscreen', COL.ink, 'center');

    const ix = px + 20, iw = pw - 40;   // inner content area
    let cy = panelY + 20;

    // avatar
    const scale = 6, av = 24 * scale;
    sunken(g, ix, cy, av + 8, av + 8);
    g.noStroke();
    (d.avatar || []).forEach((c, i) => {
      if (c < 0) return;
      g.fill(W.PAINT28[c]);
      g.rect(ix + 4 + (i % 24) * scale, cy + 4 + Math.floor(i / 24) * scale, scale, scale);
    });

    // your type, right of the avatar
    const rx = ix + av + 26, rw = iw - (av + 26);
    label(ctx, 'Your type', rx, cy + 14);
    ctx.font = 'italic 34px "Instrument Serif"';
    const nameLines = wrapLines(ctx, type.name, rw).slice(0, 2);
    nameLines.forEach((line, i) => text(ctx, line, rx, cy + 52 + i * 34, 'italic 34px "Instrument Serif"', COL.ink));
    ctx.font = '400 12px "Space Mono"';
    wrapLines(ctx, type.line, rw).slice(0, 2).forEach((line, i) =>
      text(ctx, line, rx, cy + 66 + nameLines.length * 34 + i * 17, '400 12px "Space Mono"', '#333333'));

    cy += av + 26;
    etched(g, ix, cy, iw);

    // your name in your #1 font
    cy += 24;
    label(ctx, 'Your font', ix, cy);
    const fontCss = (f, size) => `${f.weight} ${size}px "${f.font}"`;
    let size = 64;
    ctx.font = fontCss(type, size);
    while (size > 22 && ctx.measureText(d.name).width > iw) { size -= 2; ctx.font = fontCss(type, size); }
    text(ctx, d.name, ix, cy + 18 + size * 0.85, fontCss(type, size), COL.ink);
    cy += 30 + size;
    text(ctx, `${type.font} · ${type.match}% match`.toUpperCase(), ix, cy, '400 12px "Space Mono"', '#333333', 'left', 2);

    cy += 16;
    etched(g, ix, cy, iw);

    // your 5 traits: a scale between two ends, with a marker
    cy += 24;
    label(ctx, 'Your 5 traits', ix, cy);
    cy += 12;
    const endW = 118, trackX = ix + endW + 8, trackW = iw - 2 * (endW + 8);
    W.TRAITS.forEach((t, i) => {
      const v = traits[i], high = v >= 0.5;
      text(ctx, t.low.toUpperCase(), ix, cy + 17, `${high ? 400 : 700} 11px "Space Mono"`, high ? '#555555' : COL.ink, 'left', 1);
      text(ctx, t.high.toUpperCase(), ix + iw, cy + 17, `${high ? 700 : 400} 11px "Space Mono"`, high ? COL.ink : '#555555', 'right', 1);
      sunken(g, trackX, cy + 4, trackW, 18);
      g.fill(COL.light); g.rect(trackX + trackW / 2 - 1, cy + 6, 2, 14); // middle line
      const mx = trackX + 3 + v * (trackW - 20);
      g.fill(COL.navy); g.rect(mx, cy + 6, 14, 14);
      cy += 30;
    });

    cy += 4;
    etched(g, ix, cy, iw);

    // top 3 fonts, each set in itself
    cy += 24;
    label(ctx, 'Your 3 fonts', ix, cy);
    cy += 10;
    top3.forEach((f, i) => {
      const fs = 26;
      text(ctx, `${i + 1}`, ix, cy + 28, '700 13px "Space Mono"', '#555555');
      let s2 = fs; ctx.font = fontCss(f, s2);
      while (s2 > 14 && ctx.measureText(f.font).width > iw - 110) { s2 -= 1; ctx.font = fontCss(f, s2); }
      text(ctx, f.font, ix + 24, cy + 30, fontCss(f, s2), COL.ink);
      text(ctx, `${f.match}%`, ix + iw, cy + 28, '700 13px "Space Mono"', COL.ink, 'right');
      cy += 40;
    });

    // most compatible font
    cy += 4;
    sunken(g, ix, cy, iw, 58, '#ffffff');
    label(ctx, 'Pairs best with', ix + 12, cy + 20);
    let s3 = 24; ctx.font = fontCss(pair, s3);
    while (s3 > 14 && ctx.measureText(pair.font).width > iw / 2) { s3 -= 1; ctx.font = fontCss(pair, s3); }
    text(ctx, pair.font, ix + 12, cy + 48, fontCss(pair, s3), COL.ink);
    text(ctx, pair.name, ix + iw - 12, cy + 47, 'italic 20px "Instrument Serif"', '#333333', 'right');

    // footer: OK / Cancel / Apply, like every Win95 dialog
    const by = y + h - 44;
    text(ctx, "WHAT'S YOUR TYPE?! v3", x + 16, by + 20, '400 11px Silkscreen', '#404040');
    button(g, ctx, x + w - 312, by, 92, 30, 'OK', true);
    button(g, ctx, x + w - 210, by, 92, 30, 'Cancel');
    button(g, ctx, x + w - 108, by, 92, 30, 'Apply');
  }

  /* ---------- fonts must be loaded before drawing on a canvas ---------- */
  function loadFonts(d) {
    const { top3, pair } = d.result;
    const specs = [
      '700 16px Silkscreen', '400 11px Silkscreen', '700 12px "Space Mono"', '400 12px "Space Mono"',
      'italic 32px "Instrument Serif"',
      ...[...top3, pair].map(f => `${f.weight} 40px "${f.font}"`),
    ];
    const all = Promise.all(specs.map(s => document.fonts.load(s).catch(() => null)));
    const timeout = new Promise(r => setTimeout(r, 3000)); // offline: draw with what we have
    return Promise.race([all, timeout]);
  }

  /* data: { name, avatar, result: WYT.resultFor(traits) } */
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

  const shortName = t => t.name.replace(/^The /, '');

  /* ---------- the screen ---------- */
  W.screens = W.screens || {};
  W.screens.card = {
    enter(el, state) {
      const h = W.h, T = W.type;
      const traits = W.traitsFrom(state.results);
      const result = W.resultFor(traits);
      const type = result.type;
      const avatar = state.avatar || W.DEFAULT_FACES[0];
      const name = state.name || 'Anon';
      const token = (this.token = {});

      // the share code for Compare (saved on this device, so it survives a reload)
      state.share = W.net.encode({ name, traits, avatar });
      W.net.saveMine(state.share);
      if (W.live.active) W.live.send({ type: 'card', share: state.share });

      const box = h('div', { class: 'card-box' }, h('p', { class: 'card-printing' }, 'Printing card...'));
      const dl = T.magButton(h('button', { disabled: true }), 'Download PNG', 'dl');
      const next = T.magButton(h('button', { class: 'big', onclick: () => W.next() }), 'Compare', 'compare');

      const title = T.ransom(shortName(type), 48, 'type' + type.font);
      title.classList.add('waiting');

      el.append(h('div', { class: 'stack card-stack' },
        T.sticker('You are', -4),
        title,
        T.human(type.line),
        box,
        isIOS() && T.label('Tip: long-press the card to save'),
        h('div', { class: 'actions' }, h('div', { class: 'row' }, dl, next))));

      W.renderCard({ name, avatar, result }).then(card => {
        if (this.token !== token) return; // left the screen already
        box.replaceChildren(h('img', {
          class: 'card-img', src: card.dataURL,
          alt: `Type Card: ${name} is ${type.name}. Fonts: ${result.top3.map(f => f.font).join(', ')}.`,
        }));
        // level up: the type name drops in letter by letter, confetti, jingle
        title.classList.remove('waiting');
        title.classList.add('drop');
        W.sound.play('levelup');
        setTimeout(() => W.fx.burst(title), 350);
        state.card = { name, traits, result, dataURL: card.dataURL };
        const file = `whats-your-type-${shortName(type).replace(/\s+/g, '-')}-${name.replace(/[^a-z0-9]+/gi, '-')}.png`;
        dl.disabled = false;
        dl.addEventListener('click', () => W.downloadCard(card, file));
      });
    },
    exit() { this.token = null; },
  };
})();
