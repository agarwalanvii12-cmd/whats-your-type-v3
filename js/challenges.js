/* =========================================================
   challenges.js · the 5 timed challenges

   Each challenge is an object:
     setup(stage, api)  build its UI inside the dialog
     draw(api)          (optional) runs every frame while playing
     score(api)         read the current state, return a result with
                        part: 0..1 toward the trait's high end
     teardown(api)      (optional) clean up listeners

   After the timed part, 2 quick personality questions (untimed).
   Trait = half the challenge + a quarter per question.

   One shared runner (below) handles the rest: the Win95 dialog,
   the 3-2-1 count-in, the countdown bar in the title bar, OK,
   time running out, the questions, the trait reveal, and saving
   to WYT.state.results[id] (with .trait = 0..1).
   If the timer runs out, the current state is scored as is.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});

  const round1 = n => Math.round(n * 10) / 10;
  const round2 = n => Math.round(n * 100) / 100;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* ======================================================
     1 · MAKE IT LOUD (10s)
     Weight + size sliders on a poster headline.
     high weight + size → B (Bold), else L (Light)
     ====================================================== */
  const loud = {
    setup(stage, api) {
      const { h, data: d } = api;
      const word = h('span', { class: 'loud-word' }, 'HELLO');
      const poster = h('div', { class: 'loud-poster' }, word);
      const slider = (label, min, max, value) => {
        const input = h('input', { type: 'range', min, max, value, step: 1, 'aria-label': label });
        return { input, row: h('label', { class: 'slider-row' }, h('span', { class: 'label' }, label), input) };
      };
      const wt = slider('Weight', 100, 900, 300);
      const sz = slider('Size', 0, 100, 25);
      stage.append(poster, wt.row, sz.row);

      d.wt = wt.input; d.sz = sz.input; d.moves = 0;
      const update = () => {
        const max = Math.min(130, poster.clientWidth / 3.9);
        word.style.fontWeight = wt.input.value;
        word.style.fontSize = 16 + (max - 16) * (sz.input.value / 100) + 'px';
      };
      [wt.input, sz.input].forEach(i => i.addEventListener('input', () => { d.moves++; update(); }));
      update();
      requestAnimationFrame(update);
    },
    score({ data: d }) {
      const weight = +d.wt.value, size = +d.sz.value;
      const loudness = ((weight - 100) / 800 + size / 100) / 2; // 0 quiet .. 1 very loud
      return { part: loudness, weight, size, loudness: round2(loudness), moves: d.moves };
    },
  };

  /* ======================================================
     2 · SNAP OR NOT (12s)
     Drag 4 shapes on a grid. A "snap to grid" checkbox is on.
     snap left on, or most shapes on the grid → G, else F
     ====================================================== */
  const NEUTRALS = ['#111111', '#000000', '#ffffff', '#f3ead3', '#fff3d6', '#c0c0c0', '#808080'];
  function shapeColors() {
    let list = W.type.palette().colors.filter(c => !NEUTRALS.includes(c));
    if (list.length < 4) list = ['#ff4fa3', '#ffd23f', '#3a86ff', '#9be15d'];
    return list.slice().sort(() => Math.random() - 0.5).slice(0, 4);
  }
  const SHAPES = {
    square: '<rect x="10" y="10" width="80" height="80"/>',
    circle: '<circle cx="50" cy="50" r="41"/>',
    triangle: '<polygon points="50,8 93,90 7,90"/>',
    diamond: '<polygon points="50,5 95,50 50,95 5,50"/>',
  };

  const snapOrNot = {
    setup(stage, api) {
      const { h, data: d } = api;
      const N = 6; // grid cells per side
      const board = h('div', { class: 'snap-board', style: `--n:${N}` });
      const snap = h('input', { type: 'checkbox', id: 'snap', checked: true });
      stage.append(board, h('div', { class: 'field-row snap-row' }, snap, h('label', { for: 'snap' }, 'Snap to grid')));
      Object.assign(d, { board, snap, N, moves: 0, shapes: [] });

      // start in messy, off-grid spots
      const colors = shapeColors();
      const used = new Set();
      Object.keys(SHAPES).forEach((kind, i) => {
        let cx, cy;
        do { cx = Math.floor(Math.random() * (N - 1)); cy = Math.floor(Math.random() * (N - 1)); } while (used.has(cx + ',' + cy));
        used.add(cx + ',' + cy);
        const s = { kind, x: cx + 0.25 + Math.random() * 0.5, y: cy + 0.25 + Math.random() * 0.5 };
        s.el = h('div', { class: 'shape', 'aria-label': kind });
        s.el.innerHTML = `<svg viewBox="0 0 100 100" fill="${colors[i]}" stroke="#111" stroke-width="6">${SHAPES[kind]}</svg>`;
        board.append(s.el);
        d.shapes.push(s);

        let start = null;
        s.el.addEventListener('pointerdown', e => {
          if (!api.active) return;
          e.preventDefault();
          s.el.setPointerCapture(e.pointerId);
          start = { px: e.clientX, py: e.clientY, x: s.x, y: s.y };
          s.el.classList.add('dragging');
        });
        s.el.addEventListener('pointermove', e => {
          if (!start) return;
          const cell = board.clientWidth / N;
          s.x = clamp(start.x + (e.clientX - start.px) / cell, 0, N - 1);
          s.y = clamp(start.y + (e.clientY - start.py) / cell, 0, N - 1);
          place(s);
        });
        const drop = () => {
          if (!start) return;
          start = null;
          s.el.classList.remove('dragging');
          if (snap.checked) { s.x = Math.round(s.x); s.y = Math.round(s.y); }
          d.moves++;
          place(s);
        };
        s.el.addEventListener('pointerup', drop);
        s.el.addEventListener('pointercancel', drop);
      });

      // positions are stored in grid cells, so they survive a resize
      const place = s => {
        s.el.style.left = (s.x / N) * 100 + '%';
        s.el.style.top = (s.y / N) * 100 + '%';
      };
      d.shapes.forEach(place);
    },
    score({ data: d }) {
      const onGrid = v => Math.abs(v - Math.round(v)) < 0.08;
      const aligned = d.shapes.filter(s => onGrid(s.x) && onGrid(s.y)).length;
      // half for leaving snap on, half for how many shapes sit on the grid
      const part = (d.snap.checked ? 0.5 : 0) + 0.5 * (aligned / 4);
      return { part, snap: d.snap.checked, aligned, moves: d.moves };
    },
  };

  /* ======================================================
     3 · RAPID FIRE (8s)
     5 this-or-that picks. Each option is set in its own font.
     majority retro → R, else N
     ====================================================== */
  const PAIRS = [
    [{ label: 'Floppy', font: '"VT323"', size: 1.5 },          { label: 'Cloud', font: 'Comfortaa', size: 1.05 }],
    [{ label: 'Serif', font: '"Playfair Display"', size: 1.2 }, { label: 'Sans', font: '"Work Sans"', size: 1.15 }],
    [{ label: 'CRT', font: '"VT323"', size: 1.6 },             { label: 'OLED', font: '"Space Grotesk"', size: 1.1 }],
    [{ label: 'Film', font: '"Special Elite"', size: 1.15 },   { label: 'Digital', font: '"Space Mono"', size: 0.95 }],
    [{ label: '1998', font: '"Press Start 2P"', size: 0.7 },   { label: '2026', font: 'Unbounded', size: 0.95 }],
  ]; // in each pair: [retro, new]

  const rapidFire = {
    setup(stage, api) {
      const { h, data: d } = api;
      d.picks = [];
      const counter = h('p', { class: 'label rf-count' });
      const box = h('div', { class: 'rf-pair' });
      stage.append(counter, box);

      const button = (opt, retro) => h('button', {
        class: 'rf-btn', style: `font-family:${opt.font};font-size:${opt.size * 28}px`,
        onclick: () => {
          if (!api.active) return;
          d.picks.push({ pick: opt.label, retro });
          show();
        },
      }, opt.label);

      const show = () => {
        const i = d.picks.length;
        if (i >= PAIRS.length) { api.finish(); return; }
        const [retro, fresh] = PAIRS[i];
        const sides = Math.random() < 0.5
          ? [button(retro, true), button(fresh, false)]
          : [button(fresh, false), button(retro, true)];
        counter.textContent = `${i + 1} / ${PAIRS.length}`;
        box.replaceChildren(sides[0], h('span', { class: 'rf-or' }, 'or'), sides[1]);
      };
      show();
    },
    score({ data: d }) {
      const answered = d.picks.length;
      const retro = d.picks.filter(p => p.retro).length;
      return { part: answered ? retro / answered : 0.5, retro, answered, picks: d.picks.map(p => p.pick) };
    },
  };

  /* ======================================================
     4 · EVEN IT OUT (12s)
     The word TYPE with lumpy spacing. Slide letters left/right.
     Gap bars under each gap turn green when they match.
     evenness ≥ 0.75 → K (Kerner), else V (Vibes)
     ====================================================== */
  const START_GAPS = [0.04, 0.62, 0.22];  // in em: lumpy on purpose
  const EVEN_TOLERANCE = 0.0625;           // a gap within this (em) of the average is "even"

  const evenItOut = {
    setup(stage, api) {
      const { h, data: d } = api;
      const box = h('div', { class: 'kern-box' });
      stage.append(box);
      const fontPx = Math.min(80, Math.floor(stage.clientWidth / 4.6));
      box.style.fontSize = fontPx + 'px';
      box.style.height = Math.round(fontPx * 1.8) + 'px';

      d.letters = [...'TYPE'].map(ch => h('span', { class: 'kern-letter' }, ch));
      d.bars = [0, 1, 2].map(() => h('i', { class: 'kern-bar' }));
      box.append(...d.letters, ...d.bars);
      Object.assign(d, { box, fontPx, moves: 0, ready: false, x: [], w: [] });

      const render = () => {
        d.letters.forEach((l, i) => { l.style.left = d.x[i] + 'px'; });
        const gaps = [0, 1, 2].map(j => d.x[j + 1] - (d.x[j] + d.w[j]));
        const mean = gaps.reduce((a, b) => a + b, 0) / 3;
        d.bars.forEach((b, j) => {
          b.style.left = d.x[j] + d.w[j] + 'px';
          b.style.width = Math.max(3, gaps[j]) + 'px';
          b.classList.toggle('ok', Math.abs(gaps[j] - mean) <= EVEN_TOLERANCE * fontPx);
        });
      };

      const place = () => {
        d.w = d.letters.map(l => l.offsetWidth);
        const total = d.w.reduce((a, b) => a + b, 0) + START_GAPS.reduce((a, b) => a + b, 0) * fontPx;
        let x = Math.max(0, (box.clientWidth - total) / 2);
        d.letters.forEach((l, i) => { d.x[i] = x; x += d.w[i] + (START_GAPS[i] || 0) * fontPx; });
        d.ready = true;
        render();
      };
      // wait for the font, so letter widths are measured correctly
      document.fonts.load(`900 ${fontPx}px "Playfair Display"`).then(place, place);

      d.letters.forEach((l, i) => {
        let start = null;
        l.addEventListener('pointerdown', e => {
          if (!api.active || !d.ready) return;
          e.preventDefault();
          l.setPointerCapture(e.pointerId);
          start = { px: e.clientX, x: d.x[i] };
          l.classList.add('dragging');
        });
        l.addEventListener('pointermove', e => {
          if (!start) return;
          const min = i > 0 ? d.x[i - 1] + d.w[i - 1] : 0;
          const max = i < 3 ? d.x[i + 1] - d.w[i] : box.clientWidth - d.w[i];
          d.x[i] = clamp(start.x + (e.clientX - start.px), min, max);
          render();
        });
        const drop = () => { if (start) { start = null; d.moves++; l.classList.remove('dragging'); } };
        l.addEventListener('pointerup', drop);
        l.addEventListener('pointercancel', drop);
      });
    },
    score({ data: d }) {
      const gaps = d.ready
        ? [0, 1, 2].map(j => (d.x[j + 1] - (d.x[j] + d.w[j])) / d.fontPx)
        : START_GAPS.slice();
      const spread = Math.max(...gaps) - Math.min(...gaps);
      const evenness = clamp(1 - spread / 0.5, 0, 1);
      return { part: evenness, evenness: round2(evenness), gaps: gaps.map(round2), moves: d.moves };
    },
  };

  /* ======================================================
     5 · TYPE YOUR NAME (10s)
     Pixel on-screen keyboard (a real keyboard works too).
     Letters appear live in your font so far.
     Records speed + backspaces for the card stats. No letter.
     ====================================================== */
  const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

  const typeYourName = {
    setup(stage, api) {
      const { h, T, data: d } = api;
      d.target = (api.state.name || 'Anon').toUpperCase().replace(/[^A-Z ]/g, '').trim() || 'ANON';
      Object.assign(d, { typed: '', keys: 0, backspaces: 0, firstAt: null });

      // your best font so far (from the first 4 traits)
      const so = W.traitsFrom(api.state.results);
      so[4] = 0.5;
      const type = W.resultFor(so).type;

      const out = h('div', { class: 'type-out', style: `font-family:"${type.font}";font-weight:${type.weight}` });
      const render = () => out.replaceChildren(d.typed, h('span', { class: 'caret' }));

      const press = k => {
        if (!api.active) return;
        if (k === 'DEL') {
          d.typed = d.typed.slice(0, -1);
          d.backspaces++;
        } else {
          if (d.firstAt == null) d.firstAt = performance.now();
          if (d.typed.length < 16) d.typed += k;
          d.keys++;
        }
        render();
        if (d.typed === d.target) setTimeout(api.finish, 250);
      };

      const key = (k, label = k, cls = '') =>
        h('button', { class: 'key ' + cls, 'data-sfx': 'none', onclick: () => { W.sound.play('click'); press(k); } }, label);
      const kb = h('div', { class: 'keyboard' },
        KEY_ROWS.map(row => h('div', { class: 'key-row' }, [...row].map(c => key(c)))),
        h('div', { class: 'key-row' }, key(' ', 'Space', 'wide'), key('DEL', 'Del', 'del')));

      stage.append(
        h('p', { class: 'type-target' }, h('span', { class: 'label' }, 'Type'), h('strong', {}, d.target)),
        out,
        h('p', { class: 'label type-font' }, 'Your font: ' + type.font),
        kb);
      render();

      // a real keyboard works too (laptop)
      d.onKey = e => {
        if (!api.active || e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === 'Backspace') { e.preventDefault(); press('DEL'); }
        else if (e.key === ' ') { e.preventDefault(); press(' '); }
        else if (/^[a-z]$/i.test(e.key)) press(e.key.toUpperCase());
      };
      document.addEventListener('keydown', d.onKey);
    },
    teardown({ data: d }) { document.removeEventListener('keydown', d.onKey); },
    score({ data: d }) {
      const secs = d.firstAt ? Math.max(0.5, (performance.now() - d.firstAt) / 1000) : 0;
      const speed = secs ? round1(d.keys / secs) : 0; // keys per second
      // quick = fast typing (most of it) + few backspaces
      const part = d.keys ? 0.7 * clamp(speed / 4, 0, 1) + 0.3 * (1 - clamp(d.backspaces / 4, 0, 1)) : 0.4;
      return { part, speed, keys: d.keys, backspaces: d.backspaces, correct: d.typed === d.target, typed: d.typed };
    },
    detail: r => `${r.speed} keys/sec · ${r.backspaces} backspace${r.backspaces === 1 ? '' : 's'}`,
  };

  /* ---------- the list (names, times, copy) ---------- */
  // questions: [question, answer for the LOW end, answer for the HIGH end]
  W.CHALLENGES = [
    { id: 1, trait: 0, name: 'Make It Loud', time: 25, hint: 'Drag to make it loud', ...loud,
      questions: [['At a party you are...', 'deep in a kitchen chat', 'on the dance floor'],
                  ['Your dream poster:', 'lots of white space', 'one giant word']] },
    { id: 2, trait: 1, name: 'Snap Or Not', time: 25, hint: 'Place the shapes', ...snapOrNot,
      questions: [['Your desktop is...', 'a beautiful mess', 'folders in folders'],
                  ['On a trip you...', 'wing it', 'have a spreadsheet']] },
    { id: 3, trait: 2, name: 'Rapid Fire', time: 25, hint: 'Pick fast', ...rapidFire,
      questions: [['Dream studio:', 'glass and screens', 'an old print shop'],
                  ['Music on...', 'a playlist', 'vinyl']] },
    { id: 4, trait: 3, name: 'Even It Out', time: 25, hint: 'Slide to even the gaps', ...evenItOut,
      questions: [['You spot a 1px gap.', 'nobody will see', 'fix it now'],
                  ['Your files are named...', 'final_final_v3', 'v03_2026-11-05']] },
    { id: 5, trait: 4, name: 'Type Your Name', time: 25, hint: 'Tap the keys', ...typeYourName,
      questions: [['Ideas arrive...', 'slow, fully formed', 'fast, all at once'],
                  ["You'd rather...", 'one more round', 'ship it today']] },
  ];

  /* A scale between the two ends of a trait, with a marker where you are.
     Shared with the card and compat screens. */
  function spectrum(i, v, who) {
    const t = W.TRAITS[i];
    const marker = W.h('i', { class: 'spec-dot', style: `left:${(v * 100).toFixed(0)}%` });
    return W.h('div', { class: 'spectrum' + (who ? ' ' + who : '') },
      W.h('span', { class: 'spec-end' + (v < 0.5 ? ' on' : '') }, t.low),
      W.h('span', { class: 'spec-track' }, marker),
      W.h('span', { class: 'spec-end' + (v >= 0.5 ? ' on' : '') }, t.high));
  }
  W.spectrum = spectrum;

  /* ======================================================
     THE RUNNER · one screen per challenge
     ====================================================== */
  function runner(c) {
    let raf = 0, countTimer = 0, phase = 'countin', api = null;

    return {
      enter(el, state) {
        const h = W.h, T = W.type;
        phase = 'countin';
        let startAt = 0, endAt = 0;

        const fill = h('i');
        const bar = h('div', { class: 'chal-bar', 'aria-hidden': 'true' }, fill);
        const stage = h('div', { class: 'chal-stage waiting' });
        const count = h('div', { class: 'chal-count' });
        const reveal = h('div', { class: 'chal-reveal', hidden: true });
        const ask = h('div', { class: 'chal-ask', hidden: true });
        const okBtn = T.magButton(h('button', {
          class: 'big', 'data-sfx': 'none',
          onclick: () => (phase === 'done' ? W.advance() : phase === 'play' && end('done')),
        }), 'OK', 'ok' + c.id);

        el.append(h('div', { class: 'stack chal-stack' },
          T.sticker(`${c.id}/5 · ${W.TRAITS[c.trait].name} · ${c.time}s`, c.id % 2 ? -4 : 3),
          T.ransom(c.name, 30, c.name),
          T.label(`Measures: ${W.TRAITS[c.trait].low} vs ${W.TRAITS[c.trait].high}`),
          h('div', { class: 'window chal-win' },
            h('div', { class: 'title-bar' },
              h('div', { class: 'title-bar-text' }, c.name),
              bar,
              h('div', { class: 'title-bar-controls' }, h('button', { 'aria-label': 'Help', 'data-bonk': true }))),
            h('div', { class: 'window-body chal-body' },
              T.label(c.hint),
              h('div', { class: 'chal-wrap' }, stage, count, ask, reveal))),
          h('div', { class: 'actions' }, okBtn)));

        api = {
          stage, state, h, T, data: {},
          get active() { return phase === 'play'; },
          elapsed: () => (startAt ? (performance.now() - startAt) / 1000 : 0),
          finish: () => { if (phase === 'play') end('done'); },
        };
        c.setup(stage, api);
        W.setTimer(c.time);

        // 3-2-1 count-in
        let n = 3;
        const show = () => count.replaceChildren(T.ransom(String(n), 84, 'count' + n, { align: 'center', level: 2 }));
        show();
        W.sound.play('tick');
        countTimer = setInterval(() => {
          n--;
          if (n > 0) { show(); W.sound.play('tick'); return; }
          clearInterval(countTimer);
          count.remove();
          stage.classList.remove('waiting');
          phase = 'play';
          startAt = performance.now();
          endAt = startAt + c.time * 1000;
          loop();
        }, 550);

        // every frame: timer, bar, challenge draw()
        const loop = () => {
          if (phase !== 'play') return;
          const left = (endAt - performance.now()) / 1000;
          W.setTimer(left);
          fill.style.width = clamp(left / c.time, 0, 1) * 100 + '%';
          bar.classList.toggle('urgent', left <= 3);
          if (c.draw) c.draw(api);
          if (left <= 0) { end('time'); return; }
          raf = requestAnimationFrame(loop);
        };

        // OK tapped, the challenge finished itself, or time ran out
        function end(why) {
          if (phase === 'done') return;
          cancelAnimationFrame(raf);
          clearInterval(countTimer);
          const seconds = round1(Math.min(c.time, api.elapsed()));
          phase = 'ask';
          stage.classList.remove('waiting');
          stage.classList.add('locked');
          stage.querySelectorAll('input, button').forEach(x => { x.disabled = true; });
          count.remove();
          W.setTimer(why === 'time' ? 0 : Math.max(0, (endAt - performance.now()) / 1000));
          if (why === 'time') fill.style.width = '0%';

          const result = Object.assign(c.score(api), { timedOut: why === 'time', seconds });
          if (c.teardown) c.teardown(api);
          W.sound.play(why === 'time' ? 'bonk' : 'ding');
          if (why === 'time') W.fx.shake();

          // 2 quick questions, then the trait reveal
          okBtn.disabled = true;
          T.magButton(okBtn, 'Pick one', 'pick' + c.id);
          const answers = [];
          const askNext = () => {
            const q = c.questions[answers.length];
            if (!q) { ask.hidden = true; finish(); return; }
            const pick = v => { answers.push(v); askNext(); };
            const options = [[q[1], 0], [q[2], 1]];
            if (Math.random() < 0.5) options.reverse();
            ask.replaceChildren(
              why === 'time' && answers.length === 0 && T.sticker("Time's up", -6),
              T.label(`Quick question ${answers.length + 1}/2`),
              T.human(q[0]),
              h('div', { class: 'ask-options' },
                options.map(([text, v]) => h('button', { class: 'ask-btn', onclick: () => pick(v) }, text))));
            ask.hidden = false;
          };
          askNext();

          function finish() {
            phase = 'done';
            const i = c.trait;
            result.answers = answers;
            result.trait = round2(clamp(0.5 * result.part + 0.25 * answers[0] + 0.25 * answers[1], 0, 1));
            state.results[c.id] = result;

            const word = W.traitWord(i, result.trait);
            reveal.replaceChildren(
              T.label(W.TRAITS[i].name),
              T.ransom(word, 52, 'reveal' + c.id + word, { align: 'center', level: 2 }),
              spectrum(i, result.trait),
              T.human(W.traitLine(i, result.trait)),
              c.detail && T.label(c.detail(result)));
            reveal.hidden = false;
            okBtn.disabled = false;
            T.magButton(okBtn, 'Next', 'next' + c.id);
            W.sound.play('ding');
            // live room: send my answer, show theirs, and let the host move us on
            W.live.roundDone('challenge' + c.id, result, { nextBtn: okBtn, reveal });
          }
        }
      },

      exit() {
        cancelAnimationFrame(raf);
        clearInterval(countTimer);
        if ((phase === 'countin' || phase === 'play') && c.teardown && api) c.teardown(api);
        phase = 'done';
        W.setTimer(null);
      },
    };
  }

  W.screens = W.screens || {};
  W.CHALLENGES.forEach(c => { W.screens['challenge' + c.id] = runner(c); });
})();
