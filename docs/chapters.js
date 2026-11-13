/* =========================================================
   chapters.js · chapters 3 and up
   Uses helpers from docs.js (W.h, W.onSeen, W.docsType,
   W.docsPlay, W.docsIcon, W.docsCalm) and the real maths
   from js/types.js (W.traitScore, W.traitsFrom, W.resultFor,
   W.rankFonts), so every number on the page is real.
   ========================================================= */
(function () {
  'use strict';
  const W = window.WYT;
  const h = W.h, P = W.PROMPTS;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const calm = W.docsCalm, play = W.docsPlay;
  const wait = ms => new Promise(r => setTimeout(r, calm() ? 0 : ms));

  /* ---------- one example player, used by chapters 3 and 4 ----------
     [challenge part, quick question 1, quick question 2] per trait,
     scored exactly like the game: W.traitScore = 0.5c + 0.25q1 + 0.25q2 */
  const NAME = 'Mia';
  const PARTS = [[1, 1, 0], [0.2, 0, 1], [0.9, 1, 1], [0.8, 1, 0], [0.6, 1, 1]];
  const results = { palette: 'pop' };
  PARTS.forEach(([c, a, b], i) => { results[i + 1] = { trait: W.traitScore(c, [a, b]) }; });
  const traits = W.traitsFrom(results);           // + the Pop palette nudge
  const result = W.resultFor(traits);
  const top3 = result.top3.map(f => f.font);
  const pct = v => Math.round(v * 100);

  // what Mia did, in the game's own words (the rows of the runs in chapter 3)
  const DID = [
    ['mic', 'say hello', 'loud + expressive'],
    ['hand', 'reading order', 'headline first'],
    ['hand', 'rapid fire', 'Floppy, Serif, Film'],
    ['drag', 'mind the gap', 'fixed every gap'],
    ['keys', 'type your name', 'fast, 1 typo'],
    ['hand', 'palette', 'Pop'],
  ];

  /* =========================================================
     3 · SAME ANSWERS, SAME YOU
     ========================================================= */
  function miniCard() {
    const t = result.type;
    return h('div', { class: 'window mini-card' },
      h('div', { class: 'title-bar' }, h('div', { class: 'title-bar-text' }, 'Type Card')),
      h('div', { class: 'window-body' },
        h('p', { class: 'label' }, 'you are'),
        h('p', { class: 'mc-type', style: `font-family:"${t.font}";font-weight:${t.weight}` }, t.name),
        h('p', { class: 'mc-line' }, t.line),
        h('div', { class: 'mc-bars' }, W.TRAITS.map((tr, i) =>
          h('div', { class: 'mc-bar' }, h('span', {}, tr.name), h('i', {}, h('b', { style: `left:${pct(traits[i])}%` }))))),
        h('ol', { class: 'mc-fonts' }, result.top3.map(f =>
          h('li', {}, h('span', { class: 'label' }, f.roleName), h('span', { style: `font-family:"${f.font}";font-weight:${f.weight}` }, f.font), h('b', {}, f.match + '%')))),
        h('p', { class: 'mc-pair' }, h('span', { class: 'label' }, 'pairs with'), ' ', result.pair.font)),
      h('p', { class: 'stamp', 'aria-hidden': 'true' }, 'same type.', h('br'), 'every time.'));
  }

  function buildRuns() {
    const runs = $$('.run');
    const parts = runs.map(run => {
      const rows = DID.map(([icon, what, ans]) => h('li', {},
        h('img', { src: W.docsIcon(icon, 2), alt: '' }), h('span', { class: 'r-what' }, what), h('b', {}, ans)));
      const list = h('ol', { class: 'run-rows' }, rows);
      const card = miniCard();
      run.append(h('p', { class: 'run-tag sticker', style: `--tilt:${run.dataset.run === 'A' ? -4 : 3}deg` }, 'game ' + run.dataset.run),
        list, h('div', { class: 'run-arrow', 'aria-hidden': 'true' }, '↓'), card);
      return { run, rows, card };
    });

    let busy = false;
    async function go() {
      if (busy) return;
      busy = true;
      $('#runs').classList.remove('done');
      parts.forEach(p => { p.rows.forEach(r => r.classList.remove('on')); p.card.classList.remove('on'); });
      // two separate games, played at different speeds
      await Promise.all(parts.map(async (p, k) => {
        await wait(k ? 300 : 0);
        for (const r of p.rows) { await wait(k ? 520 : 380); r.classList.add('on'); play('tick'); }
        await wait(400);
        p.card.classList.add('on');
      }));
      await wait(500);
      $('#runs').classList.add('done');      // stamp both
      play('ding');
      $$('#type-chips li').forEach(li => li.classList.toggle('me', li.dataset.font === result.type.font));
      await wait(600);
      $('#ch3-note')._run();
      busy = false;
    }
    W.onSeen($('#runs'), go);
    $('[data-replay="runs"]').addEventListener('click', () => { play('click'); go(); });

    // all 18 types, each in its own font
    $('#type-chips').append(...W.FONTS.map(f =>
      h('li', { 'data-font': f.font, style: `font-family:"${f.font}";font-weight:${f.weight}` }, f.name.replace('The ', ''))));
  }

  /* =========================================================
     4 · WHAT REMI READS: the pipeline
     ========================================================= */

  // 1 · your answers
  function stAnswers(body) {
    const items = [['hand', 'tap'], ['pencil', 'draw'], ['camera', 'snap'], ['mic', 'voice'], ['drag', 'drag'], ['keys', 'type']];
    const ul = $('#answer-icons');
    ul.append(...items.map(([icon, word]) => h('li', {}, h('img', { src: W.docsIcon(icon, 4), alt: '' }), h('span', {}, word))));
    return async () => { for (const li of ul.children) { li.classList.add('on'); play('tick'); await wait(140); } };
  }

  // 2 · 5 numbers
  function stNumbers() {
    const box = $('#trait-bars');
    const rows = W.TRAITS.map((t, i) => {
      const fill = h('i'), num = h('b', {}, '0.00');
      box.append(h('div', { class: 'tb' },
        h('span', { class: 'tb-name' }, t.name),
        h('span', { class: 'tb-low' }, t.low), h('span', { class: 'tb-bar' }, fill), h('span', { class: 'tb-high' }, t.high), num));
      return { fill, num, v: traits[i] };
    });
    const [c, a, b] = PARTS[0];
    $('.formula').after(h('p', { class: 'worked' },
      `energy = 0.5 × ${c} + 0.25 × ${a} + 0.25 × ${b} = ${W.traitScore(c, [a, b]).toFixed(2)}`, h('span', {}, ' + Pop palette nudge')));
    return async () => {
      for (const r of rows) {
        r.fill.style.width = pct(r.v) + '%';
        r.num.textContent = r.v.toFixed(2);
        play('tick');
        await wait(220);
      }
    };
  }

  // 3 · closest of 18 fonts (plotted on 2 of the 5 traits, measured on all 5)
  function stFonts() {
    const ranked = W.rankFonts(traits);
    const best = ranked[0];
    const S = 100, pad = 8;
    const x = v => pad + v * (S - pad * 2), y = v => S - pad - v * (S - pad * 2);
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${S} ${S}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `18 fonts plotted by energy and era. Closest to you: ${best.font}, ${best.name}.`);
    const el = (tag, attrs, text) => {
      const e = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
      if (text) e.textContent = text;
      svg.append(e);
      return e;
    };
    el('rect', { x: pad, y: pad, width: S - pad * 2, height: S - pad * 2, class: 'fm-frame' });
    const line = el('line', { x1: x(traits[0]), y1: y(traits[2]), x2: x(best.p[0]), y2: y(best.p[2]), class: 'fm-line' });
    const dots = W.FONTS.map(f => {
      const isBest = f.font === best.font;
      const g = el('g', { class: 'fm-dot' + (isBest ? ' best' : '') });
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', x(f.p[0])); c.setAttribute('cy', y(f.p[2])); c.setAttribute('r', isBest ? 2.6 : 1.8);
      const t = document.createElementNS(ns, 'text');
      const right = f.p[0] > 0.6; // labels on the right half point left, so they stay inside the box
      t.setAttribute('x', x(f.p[0]) + (right ? -3 : 3)); t.setAttribute('y', y(f.p[2]) + 1.2);
      if (right) t.setAttribute('text-anchor', 'end');
      t.setAttribute('style', `font-family:"${f.font}";font-weight:${f.weight}`);
      t.textContent = f.font;
      g.append(c, t);
      return g;
    });
    const you = el('g', { class: 'fm-you' });
    const yc = document.createElementNS(ns, 'rect');
    yc.setAttribute('x', x(traits[0]) - 2.5); yc.setAttribute('y', y(traits[2]) - 2.5); yc.setAttribute('width', 5); yc.setAttribute('height', 5);
    const yt = document.createElementNS(ns, 'text');
    yt.setAttribute('x', x(traits[0])); yt.setAttribute('y', y(traits[2]) + 7); yt.setAttribute('text-anchor', 'middle');
    yt.textContent = 'you';
    you.append(yc, yt);

    const map = $('#font-map');
    map.append(
      h('div', { class: 'fm-wrap' },
        h('span', { class: 'fm-axis fm-y' }, 'futurist ↔ nostalgic'),
        svg,
        h('span', { class: 'fm-axis fm-x' }, 'introvert ↔ extrovert')),
      h('div', { class: 'fm-side' },
        h('p', { class: 'label' }, 'closest to you'),
        h('p', { class: 'fm-best', style: `font-family:"${best.font}";font-weight:${best.weight}` }, best.name),
        h('ol', { class: 'fm-rank' }, ranked.slice(0, 4).map(f => h('li', {}, h('span', {}, f.font), h('b', {}, f.match + '%')))),
        h('p', { class: 'fm-note' }, 'distance on all 5 traits')));
    return async () => {
      for (const d of dots) { d.classList.add('on'); await wait(45); }
      you.classList.add('on');
      await wait(400);
      line.classList.add('on');
      map.classList.add('found');
      play('ding');
    };
  }

  // 4 · my prompt: what the phone sends, then the server's prompt with each ${slot} filling in
  function stPrompt() {
    const payload = {
      kind: 'reading', name: NAME,
      traits: traits.map(v => +v.toFixed(2)),
      type: result.type.name, fonts: top3, pair: result.pair.font, palette: 'Pop',
      clues: { portrait: 'drew', strokes: 14, colours: 3, voice: 'loud expressive', voiceHow: 'mic',
        readOrder: ['headline', 'subhead', 'details'], retro: ['Floppy', 'Serif', 'CRT', 'Film', '1998'],
        gapStyle: 'obsessed', gapSeconds: 9, gapMoves: 6, typeSpeed: 4, backspaces: 1, timeouts: 0 },
    };
    // pretty JSON, with each list kept on one line
    $('#sent-json').textContent = JSON.stringify(payload, null, 1)
      .replace(/\[[^\]{}]*\]/g, m => m.replace(/\s+/g, ' ').replace('[ ', '[').replace(' ]', ']'));

    // the server turns the clues into short checked lines (describeClues in api/ai.js)
    const clues = [
      'Self-portrait: drew it by hand, 14 strokes in 3 colours, finished before time ran out.',
      'Say hello: loud and expressive, read from their voice.',
      'Poster hierarchy: made people read the headline, then the subhead, then the details (by the book).',
      'Rapid fire this-or-that: picked Floppy, Serif, CRT, Film, 1998.',
      'Told the spacing on a sign looked off, they obsessed over every single gap (9s, 6 adjustments).',
      'Typed their own name at 4 keys a second with 1 backspaces.',
    ].map(l => '- ' + l).join('\n');
    const values = {
      name: NAME, type: result.type.name, 'fonts[0]': top3[0], 'fonts[1]': top3[1], 'fonts[2]': top3[2],
      pair: result.pair.font, palette: 'Pop', 'describe(traits)': P.describe(traits), clues,
    };

    const pre = $('#prompt-text');
    const slots = [];
    P.reading.split(/(\{\{[^}]+\}\})/).forEach(part => {
      const m = /^\{\{(.+)\}\}$/.exec(part);
      if (!m) { pre.append(part); return; }
      const s = h('span', { class: 'slot' }, '${' + m[1] + '}');
      s.dataset.key = m[1];
      slots.push(s);
      pre.append(s);
    });
    pre.after(h('p', { class: 'prompt-meta label' }, `${P.model} · temperature ${P.temperature} · ${P.readingTokens} tokens max`));

    return async () => {
      for (const s of slots) {
        s.classList.add('filling');
        const v = values[s.dataset.key];
        await W.docsType(s, v, null, v.length > 80 ? 5 : 22);
        s.classList.remove('filling');
        s.classList.add('filled');
        await wait(120);
      }
    };
  }

  // 5 · my reading (an example, typed by Remi)
  function stReading() {
    const text = `${NAME}, you obsessed over two tiny gaps for 9 seconds, so your Figma layers are 100% named and grouped. ` +
      `Picking Floppy and Film, then typing your name at 4 keys a second? Nostalgic speedrunner, it's giving. ` +
      `Let ${top3[0]} do the shouting and keep ${top3[2]} calm underneath.`;
    const paper = h('p', { class: 'remi-text' });
    const remi = W.mascot(null, 4);
    $('#reading-out').append(
      h('div', { class: 'tw-wrap side-wrap reading-wrap' }, h('span', { class: 'sticker example-sticker', style: '--tilt:-5deg' }, 'example'), h('div', { class: 'tw-paper' }, paper), remi));
    return () => W.docsType(paper, text, remi);
  }

  function buildPipe() {
    const runners = {
      answers: stAnswers(), numbers: stNumbers(), fonts: stFonts(), prompt: stPrompt(), reading: stReading(),
    };
    $$('.station').forEach(st => W.onSeen(st, () => { st.classList.add('seen'); runners[st.dataset.st](); }));
  }

  /* ---------- the system prompt, with hand-written notes ---------- */
  function marked(text, marks) {
    // marks: [[phrase, n]] → text with <mark data-n> around each phrase
    const frag = document.createDocumentFragment();
    let rest = text;
    marks.forEach(([phrase, n]) => {
      const i = rest.indexOf(phrase);
      if (i < 0) { console.warn('docs: phrase not found', phrase); return; }
      frag.append(rest.slice(0, i), h('mark', { 'data-n': n }, phrase));
      rest = rest.slice(i + phrase.length);
    });
    frag.append(rest);
    return frag;
  }

  const SYS_NOTES = [
    'who I am: a Win95 quiz voice',
    'no emojis, no lists, no em dashes',
    "never say I'm AI",
    '3 sentences, 60 words max, so I can type it live',
  ];

  function buildSystem() {
    const pre = $('#sys-text');
    pre.append(marked(P.system, [
      ['You are Remi, a tiny pixel typewriter who types personality readings in a retro Windows 95 typography quiz', 1],
      ['no emojis, no hashtags, no em dashes, no lists or numbering', 2],
      ['Never mention AI, models, prompts, scores or percentages.', 3],
    ]));
    pre.append(h('span', { class: 'sys-also' }, '\n\n+ every reading prompt ends with:\n'),
      marked('Write exactly 3 short sentences, 60 words max in total.', [['Write exactly 3 short sentences, 60 words max in total.', 4]]));

    const notes = $('#sys-notes');
    notes.append(...SYS_NOTES.map((t, i) => h('li', { 'data-n': i + 1 }, h('span', { class: 'arrow', 'aria-hidden': 'true' }, '←'), t)));

    // on a laptop, each note sits level with the line it points at
    const sheet = $('.sys-sheet');
    const place = () => {
      const wide = window.innerWidth >= 900;
      let last = -Infinity;
      $$('li', notes).forEach(li => {
        if (!wide) { li.style.top = ''; return; }
        const mark = $(`mark[data-n="${li.dataset.n}"]`, pre);
        let top = mark.getBoundingClientRect().top - sheet.getBoundingClientRect().top - 6;
        top = Math.max(top, last + li.offsetHeight + 8);   // never overlap the note above
        li.style.top = top + 'px';
        last = top;
      });
    };
    addEventListener('resize', place);
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(place);

    W.onSeen($('#sys'), async () => {
      for (const li of notes.children) {
        li.classList.add('on');
        $(`mark[data-n="${li.dataset.n}"]`, pre).classList.add('on');
        play('tick');
        await wait(500);
      }
    });
  }

  /* ---------- the other two prompts, in small windows that open ---------- */
  function promptWindow(title, text, note) {
    const pre = h('pre', { class: 'prompt' });
    text.split(/(\{\{[^}]+\}\})/).forEach(part => {
      const m = /^\{\{(.+)\}\}$/.exec(part);
      pre.append(m ? h('span', { class: 'slot' }, '${' + m[1] + '}') : part);
    });
    const d = h('details', { class: 'window prompt-win' },
      h('summary', { class: 'title-bar' }, h('span', { class: 'title-bar-text' }, title), h('span', { class: 'open-hint' }, 'open')),
      h('div', { class: 'window-body' }, pre, h('p', { class: 'hand-note' }, h('span', { class: 'arrow', 'aria-hidden': 'true' }, '↑'), note)));
    d.addEventListener('toggle', () => play('click'));
    return d;
  }
  function buildMore() {
    $('#more-prompts').append(
      promptWindow('compatibility prompt', P.compat, 'only names, types and numbers. 35 words max.'),
      promptWindow('questions prompt', P.questions, 'JSON only, so my code can check every answer'));
  }

  buildRuns();
  buildPipe();
  buildSystem();
  buildMore();
})();
