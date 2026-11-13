/* =========================================================
   docs.js · the documentation site, guided by Remi

   Reuses the app's own scripts (loaded before this file):
     icons.js   Remi's pixel art + pixel icons (W.iconURL)
     type.js    ransom headings, mag letters, stickers (W.type)
     fx.js      Remi himself (W.mascot), pixel reveal, typeOut
     sound.js   tick + ding while Remi types (W.sound)
     types.js   the real traits, 18 fonts and result maths
     wallpaper  the pixel desktop behind chapter 2

   Pieces:
     notes      .note[data-lines] → paper strip + Remi, typed on scroll
     titles     .ch-title[data-ransom-text] → live ransom heading
     chapters   which one is on screen → taskbar, checklist, progress
     sound      off by default, tray button turns it on
   ========================================================= */
(function () {
  'use strict';
  const W = window.WYT;
  const T = W.type;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* the app's tiny element helper (lives in main.js, which runs the whole game) */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else if (v !== false && v != null) el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(kid));
    }
    return el;
  }
  W.h = W.h || h;

  /* ---------- extra pixel icons for the input chips (same palette as icons.js) ---------- */
  const CHIP_ICONS = {
    mic: [
      '....kkkk....', '...kwwwwk...', '...kwddwk...', '...kwwwwk...', '...kwddwk...',
      '.k.kwwwwk.k.', '.k..kkkk..k.', '..k......k..', '...kkkkkk...', '.....kk.....', '...kkkkkk...',
    ],
    camera: [
      '...kkkk.....', 'kkkkddkkkkkk', 'kggggggggggk', 'kgggkkkkgygk', 'kggkwBBwkggk', 'kggkBbbBkggk',
      'kggkBbbBkggk', 'kggkwBBwkggk', 'kgggkkkkgggk', 'kkkkkkkkkkkk',
    ],
    keys: [
      'kkkkkkkkkkkkkk', 'kwkwkwkwkwkwdk', 'kkkkkkkkkkkkkk', 'kdwkwkwkwkwkwk', 'kkkkkkkkkkkkkk',
      'kwkwwwwwwwwkwk', 'kkkkkkkkkkkkkk',
    ],
    drag: [
      '.....k......', '....kwk.....', '...kwwwk....', '.....k......', '.k...k...k..', 'kwkkkkkkkwk.',
      '.k...k...k..', '.....k......', '...kwwwk....', '....kwk.....', '.....k......',
    ],
    phone: [
      '.kkkkkkk.', 'kdddddddk', 'kdBBBBBdk', 'kdBccBBdk', 'kdBBBBBdk', 'kdBBBBBdk', 'kdBBBBBdk', 'kdBBBBBdk',
      'kdBBBBBdk', 'kdddddddk', 'kdddkdddk', 'kdddddddk', '.kkkkkkk.',
    ],
    none: [
      '..kkkkkkkk..', '.kQQQQQQQQk.', '.kQkkkkkkQk.', '.kQQQQQQQQk.', '.kQkkkkkQQk.', '.kQQQQQQQQk.',
      '.kQkkkkkkQk.', '.kQQQQQQQQk.', '.kkkkkkkkkk.',
    ],
  };
  const chipCache = {};
  function iconURL(name, scale = 3) {
    if (!CHIP_ICONS[name]) return W.iconURL(name, scale);
    const key = name + scale;
    if (chipCache[key]) return chipCache[key];
    const rows = CHIP_ICONS[name], pal = W.ICON_PAL;
    const cv = document.createElement('canvas');
    cv.width = Math.max(...rows.map(r => r.length)) * scale;
    cv.height = rows.length * scale;
    const ctx = cv.getContext('2d');
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (!pal[ch]) return;
      ctx.fillStyle = pal[ch];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }));
    return (chipCache[key] = cv.toDataURL());
  }
  W.docsIcon = iconURL;

  /* ---------- sound: off until the viewer turns it on ---------- */
  let soundOn = false;
  const play = name => { if (soundOn) W.sound.play(name); };
  W.docsPlay = play;
  W.docsCalm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setSound(on) {
    soundOn = on;
    if (on) {
      W.sound.unlock();                       // this runs inside the tap, so audio may start
      if (W.sound.muted) W.sound.setMuted(false);
      W.sound.play('click');
    }
    const btn = $('#mute-btn');
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? "Turn Remi's typing sounds off" : "Turn Remi's typing sounds on");
    $('#mute-icon').src = W.iconURL(on ? 'speaker' : 'speakerMuted', 2);
  }

  /* ---------- Remi types ----------
     typeInto(el, text, remi) types one line letter by letter.
     Reduced motion: the text just appears. */
  async function typeInto(el, text, remi, ms = 38) {
    if (calm()) { el.textContent = text; return; }
    const caret = h('span', { class: 'caret' });
    remi && remi.classList.add('typing');
    for (let i = 1; i <= text.length; i++) {
      el.replaceChildren(text.slice(0, i), caret);
      if (i % 4 === 0) play('tick');
      await wait(text[i - 1] === '.' ? ms * 5 : ms);
    }
    el.replaceChildren(text);
    remi && remi.classList.remove('typing');
  }
  W.docsType = typeInto;

  /* A note: paper strip coming out of Remi, one <p> per line */
  function buildNote(note) {
    const lines = JSON.parse(note.dataset.lines || '[]');
    const paper = h('div', { class: 'tw-paper note-paper' });
    const ps = lines.map(line => {
      // reserve the space so nothing jumps while typing; screen readers get the full line
      const p = h('p', { class: 'note-line', 'aria-label': line }, h('span', { class: 'ghost', 'aria-hidden': 'true' }, line));
      paper.append(p);
      return p;
    });
    const remi = W.mascot(null, note.classList.contains('note-small') ? 3 : 4);
    note.classList.add('tw-wrap');
    note.replaceChildren(paper, remi);
    note._run = async () => {
      if (note._done) return;
      note._done = true;
      for (const p of ps) {
        const line = p.getAttribute('aria-label');
        const out = h('span', { class: 'typed', 'aria-hidden': 'true' });
        p.append(out);
        await typeInto(out, line, remi);
        await wait(calm() ? 0 : 280);
      }
      play('ding');
      note.dispatchEvent(new CustomEvent('typed'));
    };
  }
  W.buildNote = buildNote;

  /* ---------- ransom titles + mag links (made live by type.js) ---------- */
  function titleSize(text, max) {
    const longest = Math.max(1, ...text.split(/\s+/).map(w => w.length));
    return `min(${max}px, calc((100vw - 48px) / ${(longest * 1.15).toFixed(2)}))`;
  }
  function buildTitles() {
    $$('[data-ransom-text]').forEach(box => {
      const text = box.dataset.ransomText;
      const dark = box.hasAttribute('data-dark');
      const r = T.ransom(text, 64, box.dataset.seed, { dark, align: dark ? 'center' : 'left', level: 2 });
      r.style.fontSize = titleSize(text, dark ? 58 : 66);
      if (!calm()) r.classList.add('waiting');
      box.replaceChildren(r);
    });
    $$('[data-mag]').forEach(a => {
      a.setAttribute('aria-label', a.textContent);
      a.replaceChildren(T.mag(a.dataset.mag, 'docs-' + a.dataset.mag));
    });
  }
  function dropTitle(box) {
    const r = $('.ransom', box);
    if (!r || !r.classList.contains('waiting')) return;
    r.classList.remove('waiting');
    r.classList.add('drop');
    play('click');
  }

  /* ---------- reveal on scroll (one observer for everything) ---------- */
  const revealers = new Map(); // element → function to run once it's on screen
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const fn = revealers.get(e.target);
      revealers.delete(e.target);
      io.unobserve(e.target);
      fn && fn();
    });
  }, { rootMargin: '0px 0px -30% 0px', threshold: 0 }); // fires once its top is 70% up the screen (works for tall things too)
  function onSeen(el, fn) { revealers.set(el, fn); io.observe(el); }
  W.onSeen = onSeen;

  /* ---------- chapters, taskbar, checklist ---------- */
  const CHECKS = [
    { text: 'LLM connected', ch: 'ch4' },
    { text: '4+ personality types', ch: 'ch3' },
    { text: '3+ ways to answer', ch: 'ch2' },
    { text: 'same answers, same result', ch: 'ch3' },
    { text: 'recovery paths', ch: 'ch6' },
    { text: 'architecture mapped', ch: 'ch5' },
  ];
  W.DOCS_CHECKS = CHECKS;
  const chapters = $$('.chapter');
  const reached = new Set();
  let current = null;

  function goTo(id) {
    const el = document.getElementById(id);
    if (!el) return;
    closeStart();
    el.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
  }

  function buildChecklist() {
    const list = $('#check-list');
    CHECKS.forEach((c, i) => {
      list.append(h('li', {},
        h('button', { class: 'check-item', 'data-i': i, onclick: () => goTo(c.ch) },
          h('span', { class: 'box', 'aria-hidden': 'true' }), h('span', { class: 'check-text' }, c.text))));
    });
    // laptop: tap Remi in the corner · phone: tap the checklist in the taskbar tray
    const toggle = $('#check-toggle'), tray = $('#check-tray');
    toggle.append(W.mascot(null, 3));
    let open = false;
    const setOpen = v => {
      open = v;
      $('#checklist').classList.toggle('closed', !open);
      document.body.classList.toggle('check-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      tray.setAttribute('aria-expanded', String(open));
    };
    setOpen(window.innerWidth >= 900);
    const flip = e => { e.stopPropagation(); setOpen(!open); play('click'); };
    toggle.addEventListener('click', flip);
    tray.addEventListener('click', flip);
    // on a phone, tapping a checklist item jumps there and folds the list away
    list.addEventListener('click', () => { if (window.innerWidth < 900) setOpen(false); });
  }

  function tickChecks() {
    let n = 0;
    $$('.check-item').forEach(btn => {
      const c = CHECKS[btn.dataset.i];
      const done = reached.has(c.ch);
      if (done && !btn.classList.contains('done')) {
        btn.classList.add('done', 'just');
        setTimeout(() => btn.classList.remove('just'), 900);
        play('tick');
      }
      btn.setAttribute('aria-label', c.text + (done ? ', done' : ''));
      if (done) n++;
    });
    $('#check-count').textContent = $('#check-tray-n').textContent = `${n}/${CHECKS.length}`;
    $('#check-tray').classList.toggle('done', n === CHECKS.length);
    $('#checklist').classList.toggle('all-done', n === CHECKS.length);
  }

  function setChapter(sec) {
    if (current === sec) return;
    current = sec;
    const i = chapters.indexOf(sec);
    $('#task-btn').textContent = `${i} · ${sec.dataset.title}`;
    $$('#start-items button').forEach(b => b.classList.toggle('here', b.dataset.go === sec.id));
    chapters.slice(0, i + 1).forEach(c => reached.add(c.id));
    tickChecks();
  }

  function watchChapters() {
    // the chapter crossing the middle of the screen is "current"
    const mid = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setChapter(e.target); });
    }, { rootMargin: '-45% 0px -54% 0px' });
    chapters.forEach(c => mid.observe(c));
  }

  /* Start menu = chapter list */
  function closeStart() {
    $('#start-menu').hidden = true;
    $('#start-btn').setAttribute('aria-expanded', 'false');
  }
  function buildStart() {
    const items = $('#start-items');
    chapters.forEach((c, i) => items.append(
      h('button', { role: 'menuitem', 'data-go': c.id, onclick: () => goTo(c.id) },
        h('span', { class: 'menu-n' }, String(i)), c.dataset.title)));
    $('#start-icon').src = W.iconURL('heart', 2);
    $('#start-btn').addEventListener('click', e => {
      e.stopPropagation();
      const open = $('#start-menu').hidden;
      $('#start-menu').hidden = !open;
      $('#start-btn').setAttribute('aria-expanded', String(open));
      if (open) $('#start-items button')?.focus();
      play('click');
    });
    document.addEventListener('click', e => { if (!e.target.closest('#start-menu')) closeStart(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeStart(); });
  }

  function progress() {
    const max = document.documentElement.scrollHeight - innerHeight;
    $('#progress').style.width = (max > 0 ? (scrollY / max) * 100 : 0).toFixed(1) + '%';
  }

  function clock() {
    const d = new Date();
    $('#clock').textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  /* ---------- 0 · boot ---------- */
  function boot() {
    W.fx.pixelReveal($('#boot-logo'), 'heart', 9);
    const lines = ['Starting up...', 'Loading pixels...', 'Kerning letters...', 'Waking Remi...', 'Ready.'];
    const fill = $('#boot-fill'), status = $('#boot-status');
    const box = $('#ch0 .boot-title');
    dropTitle(box);
    const startNote = () => $('#ch0 .note')._run();
    if (calm()) { fill.style.width = '100%'; status.textContent = 'Ready.'; startNote(); return; }
    let pct = 0, line = -1;
    const t = setInterval(() => {
      pct = Math.min(100, pct + 6 + Math.random() * 10);
      fill.style.width = Math.floor(pct / 8) * 8 + (pct >= 100 ? 4 : 0) + '%';
      const next = Math.floor((pct / 100) * (lines.length - 1));
      if (next !== line) { line = next; W.fx.typeOut(status, lines[line]); }
      if (pct >= 100) { clearInterval(t); setTimeout(startNote, 300); }
    }, 200);
  }

  /* ---------- 1 · algorithm + LLM split ---------- */
  // the same answers as the screenshots: Mia, Pop palette
  const EXAMPLE = { 1: { trait: 0.8 }, 2: { trait: 0.3 }, 3: { trait: 0.85 }, 4: { trait: 0.4 }, 5: { trait: 0.7 }, palette: 'pop' };
  W.DOCS_EXAMPLE = EXAMPLE;

  function buildSplit() {
    const crunch = $('#crunch');
    const rows = W.TRAITS.map(t => {
      const bar = h('i'), num = h('b', {}, '0.00');
      crunch.append(h('div', { class: 'crow' }, h('span', { class: 'cname' }, t.name), h('span', { class: 'cbar' }, bar), num));
      return { bar, num };
    });
    const out = h('p', { class: 'cout' }, h('span', { class: 'label' }, 'closest font'), h('span', { class: 'cresult' }, '?'));
    crunch.append(out);

    const paper = h('p', { class: 'remi-text' });
    const remi = W.mascot(null, 4);
    $('#remi-side').append(h('div', { class: 'tw-wrap side-wrap' }, h('div', { class: 'tw-paper' }, paper), remi),
      h('p', { class: 'label example-tag' }, 'example reading'));

    const traits = W.traitsFrom(EXAMPLE);
    const result = W.resultFor(traits);
    const reading = 'Mia, you light up the room and the moodboard. Monoton for headlines, no notes.';

    let running = false;
    async function run() {
      if (running) return;
      running = true;
      paper.textContent = '';
      $('.cresult', out).textContent = '?';
      out.classList.remove('on');
      if (!calm()) {
        // crunch: numbers spin, then settle on the real values
        const t0 = performance.now();
        await new Promise(done => {
          const spin = () => {
            const k = Math.min(1, (performance.now() - t0) / 1800);
            rows.forEach((r, i) => {
              const v = k < 1 ? Math.random() * (1 - k) + traits[i] * k : traits[i];
              r.bar.style.width = (v * 100).toFixed(0) + '%';
              r.num.textContent = v.toFixed(2);
            });
            if (k < 1) { if (Math.random() < 0.3) play('tick'); requestAnimationFrame(spin); } else done();
          };
          spin();
        });
      } else {
        rows.forEach((r, i) => { r.bar.style.width = traits[i] * 100 + '%'; r.num.textContent = traits[i].toFixed(2); });
      }
      const res = $('.cresult', out);
      res.textContent = result.type.name;
      res.style.fontFamily = `"${result.type.font}"`;
      out.classList.add('on');
      play('ding');
      await wait(calm() ? 0 : 500);
      await typeInto(paper, reading, remi);
      running = false;
    }
    onSeen($('#split'), run);
    $('[data-replay="split"]').addEventListener('click', () => { if (!running) { play('click'); run(); } });
  }

  /* ---------- 2 · sticky phone, screens swap on scroll ---------- */
  const SCREENS = [
    ['boot', 'tap anywhere. I wake up.', [['hand', 'tap']]],
    ['lobby', 'solo, or bring a friend.', [['hand', 'tap']]],
    ['draw', 'draw yourself. or snap a pic.', [['pencil', 'touch'], ['camera', 'camera']]],
    ['hello', 'say hi. I guess your energy.', [['mic', 'voice']]],
    ['challenge2', 'tap the lines in reading order.', [['hand', 'tap']]],
    ['challenge3', 'five quick picks. old or new?', [['hand', 'tap']]],
    ['challenge4', 'fix the gaps, or ship it.', [['drag', 'drag']]],
    ['challenge5', 'type your name. fast or careful?', [['keys', 'keys']]],
    ['palette', 'pick colours. they nudge you.', [['hand', 'tap']]],
    ['card', 'and then I type you up.', [['none', 'none']]],
  ];
  const ALT = {
    boot: 'Boot screen with a ransom-note title and two buttons',
    lobby: 'Lobby: type your name, play solo or make a room',
    draw: 'Draw yourself: a pixel canvas with a doodled face',
    hello: 'Say hello: a sound recorder that reacts to your voice',
    challenge2: 'Make it read: tap poster lines in reading order',
    challenge3: 'Rapid fire: Floppy or Cloud',
    challenge4: 'Mind the gap: fix the spacing or ship it',
    challenge5: 'Type your name on a keyboard, timed',
    palette: 'Pick your palette from seven colour sets',
    card: 'Type Card: Neon Sign, with Remi typing a reading',
  };

  function buildPlay() {
    const stepsEl = $('#steps');
    const img = $('#phone-img'), note = $('#play-note'), chip = $('#play-chip');
    const remi = W.mascot(null, 4);
    const line = h('p', { class: 'remi-text' });
    note.append(h('div', { class: 'tw-wrap side-wrap' }, h('div', { class: 'tw-paper' }, line), remi));

    // preload so swaps are instant
    SCREENS.forEach(([name]) => { const i = new Image(); i.src = `img/screens/${name}.png`; });

    let shown = -1, typingToken = 0;
    async function show(i) {
      if (i === shown) return;
      shown = i;
      const [name, text, chips] = SCREENS[i];
      const swap = () => {
        img.src = `img/screens/${name}.png`;
        img.alt = ALT[name];
        img.classList.remove('out');
      };
      if (calm()) swap(); else { img.classList.add('out'); setTimeout(swap, 140); }
      $('#play-step').textContent = `Step ${i + 1} of ${SCREENS.length}`;
      $('#play-name').textContent = name;
      chip.replaceChildren(...chips.map(([icon, word]) =>
        h('span', { class: 'chip-item' }, h('img', { src: iconURL(icon, 3), alt: '' }), word)));
      $('#ch2').classList.toggle('show-card', name === 'card');
      const mine = ++typingToken;
      line.textContent = '';
      if (calm()) { line.textContent = text; return; }
      await wait(160);
      if (mine !== typingToken) return;
      // type, but stop if the viewer has already scrolled on
      remi.classList.add('typing');
      for (let k = 1; k <= text.length; k++) {
        if (mine !== typingToken) return;
        line.replaceChildren(text.slice(0, k), h('span', { class: 'caret' }));
        if (k % 4 === 0) play('tick');
        await wait(34);
      }
      if (mine === typingToken) { line.textContent = text; remi.classList.remove('typing'); }
    }

    SCREENS.forEach((s, i) => stepsEl.append(h('li', { 'data-i': i })));
    const stepIO = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) show(Number(e.target.dataset.i)); });
    }, { rootMargin: '-50% 0px -50% 0px' });
    $$('li', stepsEl).forEach(li => stepIO.observe(li));
    show(0);

    W.wallpaper.init();
  }

  /* ---------- start ---------- */
  function init() {
    $$('.note').forEach(buildNote);
    buildTitles();
    buildChecklist();
    buildStart();
    watchChapters();
    buildSplit();
    buildPlay();

    // titles drop in and notes type out as they scroll into view
    $$('.ch-title').forEach(t => onSeen(t, () => dropTitle(t)));
    $$('.note').forEach(n => { if (!n.closest('#ch0') && !n.hasAttribute('data-manual')) onSeen(n, () => n._run()); });

    setSound(false);
    $('#mute-btn').addEventListener('click', () => setSound(!soundOn));

    addEventListener('scroll', progress, { passive: true });
    addEventListener('resize', progress);
    progress();
    clock();
    setInterval(clock, 15000);

    // wait for the fonts so the ransom tiles measure right, then boot
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(boot);
  }

  init();
})();
