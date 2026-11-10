/* =========================================================
   challenges.js · timed challenges 2 to 5
   (Challenge 1 is the "say hello" voice check in voice-check.js.)

   Each challenge is an object:
     setup(stage, api)  build its UI inside the dialog
     draw(api)          (optional) runs every frame while playing
     score(api)         read the current state, return a result with
                        part: 0..1 toward the trait's high end
     teardown(api)      (optional) clean up listeners

   After the timed part, 2 quick personality questions (untimed),
   AI-written per game when available, else picked at random from a pool.
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
     2 · MAKE IT READ (25s)  · visual hierarchy
     3 lines of a poster, each in a different font. Tap them in the
     order you'd want people to read them: 1st = huge, 3rd = small.
     Classic order (headline, then subhead, then details) → Planner,
     a reshuffled hierarchy → Free spirit.
     ====================================================== */
  const HEAD_FONTS = [['Anton', 400, 'normal'], ['Archivo Black', 400, 'normal'], ['Bagel Fat One', 400, 'normal'], ['Bungee', 400, 'normal']];
  const SUB_FONTS = [['Playfair Display', 400, 'italic'], ['DM Serif Display', 400, 'italic'], ['Fraunces', 300, 'italic']];
  const BODY_FONTS = [['Space Mono', 400, 'normal'], ['Work Sans', 400, 'normal'], ['VT323', 400, 'normal']];
  const POSTERS = [
    ['OPEN STUDIO', 'friday, 7pm', 'free drinks · bring a friend'],
    ['GIG TONIGHT', 'doors at 8', 'level 2 · cash only'],
    ['THRIFT POP-UP', 'everything must go', 'sat 10am · block 5'],
  ];
  const SIZES = [46, 24, 15]; // px for 1st, 2nd, 3rd place
  const anyOf = list => list[Math.floor(Math.random() * list.length)];

  const makeItRead = {
    setup(stage, api) {
      const { h, data: d } = api;
      const words = anyOf(POSTERS);
      const fonts = [anyOf(HEAD_FONTS), anyOf(SUB_FONTS), anyOf(BODY_FONTS)];
      // 0 = headline, 1 = subhead, 2 = details (the "classic" order)
      d.items = words.map((text, i) => ({ i, text, font: fonts[i] }));
      d.order = [];
      const fontCss = ([f, w, st]) => `font-family:"${f}";font-weight:${w};font-style:${st}`;

      const poster = h('div', { class: 'read-poster' });
      const tray = h('div', { class: 'read-tray' });
      const reset = h('button', { class: 'read-reset', onclick: () => { if (api.active) { d.order = []; render(); } } }, 'Reset');
      // buttons first, so they never move while the poster grows underneath
      stage.append(tray, poster, reset);

      const render = () => {
        poster.replaceChildren(...[0, 1, 2].map(slot => {
          const it = d.items[d.order[slot]];
          return it
            ? h('p', { class: 'read-line', style: `${fontCss(it.font)};font-size:${SIZES[slot]}px` }, it.text)
            : h('p', { class: 'read-slot' }, `${slot + 1}${['st', 'nd', 'rd'][slot]} read`);
        }));
        tray.replaceChildren(...d.trayOrder.map(idx => {
          const it = d.items[idx];
          const used = d.order.includes(idx);
          return h('button', {
            class: 'read-pick', disabled: used, style: fontCss(it.font),
            onclick: () => {
              if (!api.active || used) return;
              d.order.push(idx);
              render();
              if (d.order.length === 3) setTimeout(api.finish, 600);
            },
          }, it.text);
        }));
      };
      d.trayOrder = [0, 1, 2].sort(() => Math.random() - 0.5);
      render();
    },
    score({ data: d }) {
      // anything not placed goes in the order it sat in the tray
      const order = d.order.concat(d.trayOrder.filter(i => !d.order.includes(i)));
      let swaps = 0;
      for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) if (order[a] > order[b]) swaps++;
      return { part: 1 - swaps / 3, order: order.map(i => d.items[i].text), placed: d.order.length };
    },
    detail: r => `you read: ${r.order.join(' > ')}`,
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
     4 · MIND THE GAP (30s) · fix it or ship it
     The spacing on a sign looks off. Slide the words to fix it,
     or ship it as it is. The score is mostly how long you keep
     refining: shipping fast reads as Big picture, fussing over
     every gap reads as Detail-obsessed. The clock stops at your
     last adjustment, so sitting and waiting doesn't count as care.
     ====================================================== */
  const GAP_WORDS = ['MIND', 'THE', 'GAP'];
  const GAP_START = [0.12, 1.15]; // in em: lumpy on purpose
  const GAP_EVEN = 0.1;           // a gap within this (em) of the average counts as even
  const GAP_QUICK = 5;            // last adjustment by this second: eyeballed it
  const GAP_SLOW = 20;            // still adjusting at this second: obsessed
  const GAP_MANY_MOVES = 8;       // this many adjustments counts as a lot
  const GAP_EYEBALLED = 0.33;     // part below this: the "eyeballed" style
  const GAP_OBSESSED = 0.66;      // part from this up: the "obsessed" style

  const mindTheGap = {
    setup(stage, api) {
      const { h, data: d } = api;
      const box = h('div', { class: 'gap-box' });
      stage.append(box);
      const fontPx = Math.min(56, Math.floor(stage.clientWidth / 9.6));
      box.style.fontSize = fontPx + 'px';
      box.style.height = Math.round(fontPx * 2.1) + 'px';

      const n = GAP_WORDS.length;
      d.words = GAP_WORDS.map(w => h('span', { class: 'gap-word' }, w));
      d.bars = GAP_WORDS.slice(1).map(() => h('i', { class: 'gap-bar' }));
      box.append(...d.words, ...d.bars);
      Object.assign(d, { box, fontPx, n, moves: 0, lastAt: 0, ready: false, x: [], w: [] });

      const gapsPx = () => d.bars.map((_, j) => d.x[j + 1] - (d.x[j] + d.w[j]));
      const render = () => {
        d.words.forEach((el, i) => { el.style.left = d.x[i] + 'px'; });
        const gaps = gapsPx();
        const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        d.bars.forEach((b, j) => {
          b.style.left = d.x[j] + d.w[j] + 'px';
          b.style.width = Math.max(3, gaps[j]) + 'px';
          b.classList.toggle('ok', Math.abs(gaps[j] - mean) <= GAP_EVEN * fontPx);
        });
      };

      const place = () => {
        d.w = d.words.map(el => el.offsetWidth);
        const total = d.w.reduce((a, b) => a + b, 0) + GAP_START.reduce((a, b) => a + b, 0) * fontPx;
        let x = Math.max(0, (box.clientWidth - total) / 2);
        d.words.forEach((el, i) => { d.x[i] = x; x += d.w[i] + (GAP_START[i] || 0) * fontPx; });
        d.ready = true;
        render();
      };
      // wait for the font, so word widths are measured correctly
      document.fonts.load(`900 ${fontPx}px "Playfair Display"`).then(place, place);

      d.words.forEach((el, i) => {
        let start = null;
        el.addEventListener('pointerdown', e => {
          if (!api.active || !d.ready) return;
          e.preventDefault();
          el.setPointerCapture(e.pointerId);
          start = { px: e.clientX, x: d.x[i] };
          el.classList.add('dragging');
        });
        el.addEventListener('pointermove', e => {
          if (!start) return;
          const min = i > 0 ? d.x[i - 1] + d.w[i - 1] : 0;
          const max = i < n - 1 ? d.x[i + 1] - d.w[i] : box.clientWidth - d.w[i];
          d.x[i] = clamp(start.x + (e.clientX - start.px), min, max);
          render();
        });
        const drop = () => {
          if (!start) return;
          start = null;
          d.moves++;
          d.lastAt = api.elapsed();
          el.classList.remove('dragging');
          api.ready();
        };
        el.addEventListener('pointerup', drop);
        el.addEventListener('pointercancel', drop);
      });
    },
    score({ data: d }) {
      const gaps = d.ready
        ? d.bars.map((_, j) => (d.x[j + 1] - (d.x[j] + d.w[j])) / d.fontPx)
        : GAP_START.slice();
      const evenness = clamp(1 - (Math.max(...gaps) - Math.min(...gaps)) / 0.8, 0, 1);
      const pace = clamp((d.lastAt - GAP_QUICK) / (GAP_SLOW - GAP_QUICK), 0, 1);
      const fuss = clamp(d.moves / GAP_MANY_MOVES, 0, 1);
      // time matters most. Shipping it untouched is pure eyeballing.
      const part = d.moves ? 0.6 * pace + 0.2 * fuss + 0.2 * evenness : 0;
      const style = part >= GAP_OBSESSED ? 'obsessed' : part < GAP_EYEBALLED ? 'eyeballed' : 'balanced';
      return { part, style, spent: round1(d.lastAt), evenness: round2(evenness), gaps: gaps.map(round2), moves: d.moves };
    },
    detail: r => (r.moves ? `fixed it for ${r.spent}s · ${r.moves} move${r.moves === 1 ? '' : 's'}` : 'shipped it as it was'),
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
  // Each challenge feeds one trait (index into WYT.TRAITS).
  // The 2 questions after it come from the game's question set (AI or the pool).
  W.CHALLENGES = [
    { id: 2, trait: 1, name: 'Make It Read',   time: 25, hint: 'Tap lines in reading order',     ...makeItRead },
    { id: 3, trait: 2, name: 'Rapid Fire',     time: 25, hint: 'Tap the one you vibe with',      ...rapidFire },
    { id: 4, trait: 3, name: 'Mind The Gap',   time: 30, hint: 'Gaps look off. Fix or ship?',    okLabel: 'Ship it', ...mindTheGap },
    { id: 5, trait: 4, name: 'Type Your Name', time: 25, hint: 'Type your name, fast',           ...typeYourName },
  ];

  // this game's questions: AI-written if they arrived, else 2 random from the pool
  function questionsFor(state, trait) {
    if (state.aiQuestions && state.aiQuestions[trait]) return state.aiQuestions[trait];
    if (!state.questions) state.questions = W.pickQuestions();
    return state.questions[trait];
  }

  /* ----- the 2 quick questions, shared with the voice check -----
     A Win95 window pinned to the bottom of the screen (on <body>), so
     it can never be hidden or scrolled away. Calls done(answers). */
  const quickSheet = () => W.h('div', { class: 'window ask-sheet', role: 'dialog', 'aria-label': 'Quick question' });
  function nudgeSheet(ask) {
    if (!ask.isConnected) document.body.append(ask);
    ask.classList.remove('nudge'); void ask.offsetWidth; ask.classList.add('nudge');
  }
  function askQuestions(ask, state, trait, timesUp, done) {
    const h = W.h, T = W.type, answers = [];
    const askNext = () => {
      const q = questionsFor(state, trait)[answers.length];
      if (!q) { ask.remove(); done(answers); return; }
      const pick = v => { answers.push(v); askNext(); };
      const options = [[q[1], 0], [q[2], 1]];
      if (Math.random() < 0.5) options.reverse();
      ask.replaceChildren(
        h('div', { class: 'title-bar' },
          h('div', { class: 'title-bar-text' }, `Quick question ${answers.length + 1}/2`)),
        h('div', { class: 'window-body ask-body' }, ...[ // (skip empty bits, or they'd print as "false")
          timesUp && answers.length === 0 && T.sticker("Time's up", -6),
          T.human(q[0]),
          h('div', { class: 'ask-options' },
            options.map(([text, v]) => h('button', { class: 'ask-btn', onclick: () => pick(v) }, text))),
          T.label('No wrong answers'),
        ].filter(Boolean)));
      if (!ask.isConnected) document.body.append(ask);
    };
    askNext();
  }
  W.quickQuestions = { sheet: quickSheet, ask: askQuestions, nudge: nudgeSheet };

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
        const ask = quickSheet();
        this.ask = ask;
        const okBtn = T.magButton(h('button', {
          class: 'big', 'data-sfx': 'none',
          onclick: () => {
            if (phase === 'done') W.advance();
            else if (phase === 'play') end('done');
            else if (phase === 'ask') nudgeSheet(ask); // safety net: bring the question back into view
          },
        }), c.okLabel || 'OK', 'ok' + c.id);

        el.append(h('div', { class: 'stack chal-stack' },
          T.sticker(`Challenge ${c.id}/5 · ${c.time}s`, c.id % 2 ? -4 : 3),
          T.ransom(c.name, 30, c.name),
          // what this one says about you, as a question
          T.human(`${W.TRAITS[c.trait].low.toLowerCase()} or ${W.TRAITS[c.trait].high.toLowerCase()}?`),
          h('div', { class: 'window chal-win' },
            h('div', { class: 'title-bar' },
              h('div', { class: 'title-bar-text' }, c.name),
              bar,
              h('div', { class: 'title-bar-controls' }, h('button', { 'aria-label': 'Help', 'data-bonk': true }))),
            h('div', { class: 'window-body chal-body' },
              h('p', { class: 'chal-hint' }, c.hint),
              h('div', { class: 'chal-wrap' }, stage, count, reveal))),
          h('div', { class: 'actions' }, okBtn)));

        api = {
          stage, state, h, T, data: {},
          get active() { return phase === 'play'; },
          elapsed: () => (startAt ? (performance.now() - startAt) / 1000 : 0),
          finish: () => { if (phase === 'play') end('done'); },
          ready: () => okBtn.classList.add('ready'), // turns OK green
        };
        c.setup(stage, api);
        W.setTimer(c.time);

        // 3-2-1 count-in
        let n = 3;
        // the count-in shows what to do, big
        const show = () => count.replaceChildren(h('div', { class: 'count-box' },
          T.ransom(String(n), 72, 'count' + n, { align: 'center', level: 2 }),
          h('p', { class: 'count-hint' }, c.hint)));
        show();
        W.sound.play('tick');
        countTimer = setInterval(() => {
          n--;
          if (n > 0) { show(); W.sound.play('tick'); return; }
          clearInterval(countTimer);
          count.remove();
          stage.classList.remove('waiting');
          // small phones: bring the playable part into view
          const win = stage.closest('.chal-win');
          if (win && win.getBoundingClientRect().bottom > window.innerHeight - 140) win.scrollIntoView({ block: 'start' }); // instant, so taps don't land mid-scroll
          phase = 'play';
          startAt = performance.now();
          endAt = startAt + c.time * 1000;
          loop();
        }, 900);

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
          T.magButton(okBtn, 'Answer the question', 'pick' + c.id);
          okBtn.classList.remove('ready');
          askQuestions(ask, state, c.trait, why === 'time', finish);

          function finish(answers) {
            phase = 'done';
            const i = c.trait;
            result.answers = answers;
            result.trait = round2(clamp(W.traitScore(result.part, answers), 0, 1));
            state.results[c.id] = result;

            const word = W.traitWord(i, result.trait);
            reveal.replaceChildren(...[ // (skip empty bits, or they'd print as "undefined")
              T.label(W.TRAITS[i].name),
              T.ransom(word, 52, 'reveal' + c.id + word, { align: 'center', level: 2 }),
              spectrum(i, result.trait),
              T.human(W.traitLine(i, result.trait)),
              c.detail && T.label(c.detail(result)),
            ].filter(Boolean));
            reveal.hidden = false;
            okBtn.disabled = false;
            okBtn.classList.add('ready');
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
        if (this.ask) this.ask.remove();
        phase = 'done';
        W.setTimer(null);
      },
    };
  }

  W.screens = W.screens || {};
  W.CHALLENGES.forEach(c => { W.screens['challenge' + c.id] = runner(c); });
})();
