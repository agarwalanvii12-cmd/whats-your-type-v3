/* =========================================================
   main.js · screen state machine + desktop, taskbar, boot

   States and transitions (W.go / W.next, in ORDER below):
     boot        → lobby        Play solo or 2 players (lobby shows that path)
     lobby       → draw         Play solo, or the host's Start
     lobby       → compat       Compare a code, or a friend's link
     draw        → hello        Done, or Next after time runs out
     hello       → challenge2   Next, after the voice and 2 quick questions
                                (hello is Challenge 1, the Energy trait)
     challenge2..5 → next one   Next, after the 2 quick questions
     challenge5  → palette
     palette     → card
     card        → compat       Compare
     compat      → lobby        Lobby, Play again, Rematch (rooms)
     compat      → draw         Rematch (solo)
   In a room the host moves both players along the same order
   (ROUNDS in net.js). Any screen → lobby or boot from the Start menu.

   Every screen is an object { enter(el, state), exit() }.
   enter() draws the screen into the Paint window (el).
   Other files register their screens on WYT.screens before
   this file runs.

   Dev shortcut: open index.html#draw (or #card etc.) to
   skip straight to that screen.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});
  const T = W.type; // ransom, sticker, human, label (js/type.js)
  const $ = sel => document.querySelector(sel);

  const ORDER = [
    'boot', 'lobby', 'draw', 'hello',
    'challenge2', 'challenge3', 'challenge4', 'challenge5',
    'palette', 'card', 'compat',
  ];
  const LABELS = {
    boot: 'Boot', lobby: 'Lobby', draw: 'Draw yourself', hello: 'Challenge 1',
    challenge2: 'Challenge 2', challenge3: 'Challenge 3',
    challenge4: 'Challenge 4', challenge5: 'Challenge 5',
    palette: 'Palette', card: 'Type Card', compat: 'Compatibility',
  };

  /* ---------- game state (shared by every screen) ---------- */
  W.state = { name: '', mode: 'solo', avatar: null, results: {}, card: null };
  W.resetGame = function () {
    W.state.avatar = null;
    W.state.results = {};
    W.state.card = null;
    W.state.avatarSnapped = false; // came from the camera at any point this game
    W.state.questions = null;      // 2 random pool questions per trait (picked when needed)
    W.state.aiQuestions = null;    // fresh AI-written ones, if they arrive in time
    if (W.ai) W.ai.prepareQuestions(W.state);
  };

  /* ---------- tiny helper to build HTML elements ---------- */
  // h('button', { class: 'big', onclick: fn }, 'OK')
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
  W.h = h;

  /* ---------- the state machine ---------- */
  W.screens = W.screens || {};
  let current = null;

  W.go = function (name) {
    const next = W.screens[name];
    if (!next) return;
    const prev = current && W.screens[current];
    if (prev && prev.exit) prev.exit();

    current = name;
    document.body.dataset.screen = name;
    closeStartMenu();
    W.setTimer(null);

    const el = $('#screen');
    el.replaceChildren();
    el.scrollTop = 0;

    $('#status-step').textContent = `Step ${ORDER.indexOf(name)} of ${ORDER.length - 1}`;
    $('#status-name').textContent = LABELS[name];
    $('#status-mode').textContent = W.state.mode;

    next.enter(el, W.state);
    if (W.live) W.live.onEnter(name);
    // Win95-style wipe as each new screen appears
    el.classList.remove('swap-in');
    void el.offsetWidth;
    el.classList.add('swap-in');
  };
  W.next = () => W.go(ORDER[ORDER.indexOf(current) + 1] || 'lobby');
  W.current = () => current;

  // Countdown in the Paint title bar. W.setTimer(7.2) shows 0:08. null hides it.
  // It also ticks once per second in the last 3 seconds.
  let lastTick = null;
  W.setTimer = function (seconds) {
    const t = $('#title-timer');
    if (seconds == null) { t.hidden = true; t.classList.remove('urgent'); lastTick = null; return; }
    const s = Math.max(0, Math.ceil(seconds));
    if (s >= 1 && s <= 3 && s !== lastTick) W.sound.play('tick');
    lastTick = s;
    t.hidden = false;
    t.textContent = `0:${String(s).padStart(2, '0')}`;
    t.classList.toggle('urgent', s <= 3);
  };

  /* ---------- BOOT ---------- */
  const BOOT_LINES = [
    'Starting up...', 'Loading pixels...', 'Kerning letters...',
    'Warming up CRT...', 'Mixing palette...', 'Ready.',
  ];

  function buildBootTitle() {
    const box = $('#boot-title');
    box.replaceChildren(
      T.ransom("What's your type?!", 46, 'boot', { dark: true, align: 'center' }),
    );
  }

  W.screens.boot = {
    enter() {
      const boot = $('#boot'), fill = $('#boot-fill'), bar = $('#boot-bar');
      // pick solo or 2 players right here, once loading is done
      const status = $('#boot-status'), tap = $('#boot-picks');
      boot.hidden = false;
      boot.classList.remove('ready');
      tap.hidden = true;
      fill.style.width = '0%';
      W.fx.pixelReveal($('#boot-logo'), 'heart', 9); // heart appears pixel by pixel
      let line = -1;

      let pct = 0;
      this.timer = setInterval(() => {
        pct = Math.min(100, pct + 4 + Math.random() * 9);
        // snap to whole blocks so it looks chunky
        fill.style.width = Math.floor(pct / 8) * 8 + (pct >= 100 ? 4 : 0) + '%';
        bar.setAttribute('aria-valuenow', Math.round(pct));
        const nextLine = Math.floor((pct / 100) * (BOOT_LINES.length - 1));
        if (nextLine !== line) { line = nextLine; W.fx.typeOut(status, BOOT_LINES[line]); } // typewriter
        if (pct >= 100) {
          clearInterval(this.timer);
          this.timer = null;
          boot.classList.add('ready');
          tap.hidden = false;
          $('#boot-solo').focus();
        }
      }, 240);

      // the lobby then shows only what that choice needs
      this.onTap = e => {
        const btn = e.target.closest('.boot-pick');
        if (!btn || !boot.classList.contains('ready')) return;
        W.sound.unlock();
        W.sound.play('chime');
        W.state.pick = btn.id === 'boot-duo' ? 'duo' : 'solo';
        W.go('lobby');
      };
      boot.addEventListener('click', this.onTap);
    },
    exit() {
      clearInterval(this.timer);
      $('#boot').removeEventListener('click', this.onTap);
      $('#boot').hidden = true;
    },
  };

  /* ---------- LOBBY ---------- */
  const cleanName = s => s.replace(/[^\p{L}\p{N} '._-]/gu, '').trim().slice(0, 12);

  W.screens.lobby = {
    enter(el, state) {
      this.el = el;
      this.state = state;
      this.joinOpen = !!state.joinCode;
      this.onLive = () => { if (W.current() === 'lobby') this.render(); };
      W.live.on(this.onLive);
      this.render();
    },
    exit() { W.live.off(this.onLive); },

    render() {
      const el = this.el, state = this.state, L = W.live;
      el.replaceChildren();

      const input = h('input', {
        type: 'text', id: 'player-name', maxlength: '12',
        autocomplete: 'off', enterkeyhint: 'go', placeholder: 'Your name',
        value: state.name,
      });
      input.addEventListener('input', () => { state.name = input.value; });
      const myName = () => (state.name = cleanName(input.value) || 'Anon');

      const solo = T.magButton(h('button', {
        class: 'big',
        onclick: () => {
          myName();
          state.mode = 'solo';
          W.resetGame();
          W.go('draw');
        },
      }), 'Play solo');
      input.addEventListener('keydown', e => { if (e.key === 'Enter') solo.click(); });
      const create = T.magButton(h('button', { onclick: () => L.host(myName()) }), 'Create room', 'create');
      const join = T.magButton(h('button', { onclick: () => { this.joinOpen = true; this.render(); } }), 'Join room', 'join');
      // the start button turns green once there's a name
      const nameReady = () => [solo, create].forEach(b => b.classList.toggle('ready', input.value.trim() !== ''));
      input.addEventListener('input', nameReady);
      nameReady();
      // switch between solo and 2 players without going back
      const swap = (to, label) => h('button', { class: 'swap-btn', onclick: () => { state.pick = to; this.render(); } }, label);

      // Opened a friend's link before playing? Say who's waiting.
      const invite = state.friend && h('div', { class: 'invite' },
        T.sticker(`${state.friend.name} sent a code`, 3, 'tag'),
        T.human('play to compare.'));
      // Played before on this device? You can compare straight away.
      const enterCode = W.net.loadMine() && T.magButton(
        h('button', { onclick: () => W.go('compat') }), 'Compare a code', 'enter-code');

      const head = [
        invite,
        T.sticker('Design personality test', -4),
        T.ransom("What's your type?", 32, 'lobby'),
        // the pun, right under the title
        h('p', { class: 'human pun lobby-pun' },
          h('span', { class: 'pun-1' }, 'not your dating type lol.'),
          h('span', { class: 'pun-2' }, 'your own ', h('span', { class: 'cycle-font' }, 'typeface'))),
        h('div', { class: 'lobby-intro' },
          W.mascot("hi, i'm Remi. i'll type up your type."),
          T.label('Find your design personality + fonts')),
        L.status === 'idle' && howItWorks(),
      ];
      const pinned = L.status === 'idle' && !this.joinOpen;
      const nameField = h('div', { class: pinned ? 'field name-inline' : 'field' },
        h('label', { for: 'player-name', class: 'label' }, 'Your name'), input);

      let body;
      if (L.status !== 'idle') {
        body = [this.roomPanel()];
      } else if (this.joinOpen) {
        body = [nameField, this.joinPanel(myName)];
      } else {
        // name + start buttons live in the pinned bar, so they're never cut off.
        // Picked on the first screen? Show only that path, plus a way to switch.
        const rooms = h('div', { class: 'row' }, create, join);
        const start = state.pick === 'duo' ? [rooms, swap('solo', 'Play solo instead')]
          : state.pick === 'solo' ? [solo, swap('duo', 'Play with a friend instead')]
          : [solo, rooms];
        body = [
          enterCode,
          h('div', { class: 'actions' },
            L.error && h('p', { class: 'label error' }, L.error),
            nameField,
            ...start),
        ].filter(Boolean);
      }
      el.append(h('div', { class: 'stack' }, head, body));
    },

    /* type the 4-letter room code */
    joinPanel(myName) {
      const state = this.state;
      const code = h('input', {
        type: 'text', class: 'room-input', maxlength: '4', placeholder: 'ABCD',
        autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false',
        'aria-label': 'Room code', value: state.joinCode || '',
      });
      const err = h('p', { class: 'label error' });
      const go = () => {
        const c = code.value.toUpperCase().replace(/[^A-Z]/g, '');
        if (c.length !== 4) { err.textContent = 'Room codes have 4 letters'; W.sound.play('bonk'); return; }
        state.joinCode = null;
        W.live.join(c, myName());
      };
      code.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      setTimeout(() => code.focus(), 50);
      return h('div', { class: 'window room-win' },
        h('div', { class: 'title-bar' }, h('div', { class: 'title-bar-text' }, 'Join room')),
        h('div', { class: 'window-body room-body' },
          h('label', { class: 'label' }, 'Room code', code),
          err,
          T.magButton(h('button', { class: 'big', onclick: go }), 'Join', 'join-go'),
          T.magButton(h('button', { onclick: () => { this.joinOpen = false; state.joinCode = null; this.render(); } }), 'Cancel', 'join-cancel')));
    },

    /* the room: code + QR while waiting, then both players */
    roomPanel() {
      const L = W.live;
      const leave = T.magButton(h('button', { onclick: () => L.leave() }), L.connected ? 'Leave room' : 'Cancel', 'leave');
      let inner;

      if (L.status === 'hosting' && !L.open) {
        inner = [T.human('opening room...')];
      } else if (L.status === 'hosting') {
        const url = location.origin + location.pathname + '#r=' + L.code;
        const qr = W.net.qrImage(url);
        inner = [
          T.label('Room code'),
          T.ransom(L.code, 60, 'room' + L.code, { mixCase: false, align: 'center', level: 2 }),
          qr && h('div', { class: 'qr' }, qr),
          T.human(L.open ? 'waiting for a friend...' : 'opening room...'),
          T.label('Friend taps Join room'),
        ];
      } else if (L.status === 'joining') {
        inner = [T.human(`connecting to ${L.code}...`)];
      } else {
        const you = L.role === 'host' ? 'host' : 'guest';
        const them = L.role === 'host' ? 'guest' : 'host';
        inner = [
          T.label(`Room ${L.code}`),
          h('ul', { class: 'players' },
            h('li', {}, h('strong', {}, L.me), ` (you, ${you})`),
            h('li', {}, h('strong', {}, L.opp || '...'), ` (${them})`)),
          L.role === 'host'
            ? T.magButton(h('button', { class: 'big ready', disabled: !L.opp, onclick: () => L.startRound('draw') }), 'Start', 'start')
            : T.human(`waiting for ${L.opp || 'the host'} to start.`),
        ];
      }
      return h('div', { class: 'window room-win' },
        h('div', { class: 'title-bar' }, h('div', { class: 'title-bar-text' }, 'Room')),
        h('div', { class: 'window-body room-body' }, inner, leave));
    },
  };

  /* Solo rematch: same name, straight back to drawing */
  W.rematchSolo = function () {
    W.state.friend = null;
    W.state.mode = 'solo';
    W.resetGame();
    W.go('draw');
  };

  /* ---------- WIN95 ERROR DIALOG (connection problems) ---------- */
  W.showError = function (kind, why) {
    document.querySelector('.modal')?.remove();
    const close = () => modal.remove();
    const text = {
      connect: 'play solo now. compare by code at the end.',
      lost: 'keep going solo. compare by code at the end.',
      left: 'start a new room, or play solo.',
    }[kind];
    const buttons = kind === 'connect'
      ? [h('button', {
          onclick: () => {
            close();
            W.state.name = cleanName(W.state.name || '') || 'Anon';
            W.state.mode = 'solo';
            W.resetGame();
            W.go('draw');
          },
        }, 'Play solo'), h('button', { onclick: close }, 'OK')]
      : [h('button', { onclick: close }, 'OK')];
    const modal = h('div', { class: 'modal' },
      h('div', { class: 'window dialog', role: 'alertdialog', 'aria-label': 'Connection' },
        h('div', { class: 'title-bar' },
          h('div', { class: 'title-bar-text' }, 'Connection'),
          h('div', { class: 'title-bar-controls' }, h('button', { 'aria-label': 'Close', onclick: close }))),
        h('div', { class: 'window-body error-body' },
          h('img', { src: W.iconURL('error', 3), alt: '', class: 'pixel' }),
          h('div', {}, h('p', { class: 'error-why' }, why), T.human(text)),
          h('div', { class: 'row end' }, buttons))));
    document.body.append(modal);
    W.sound.play('bonk');
    modal.querySelector('.row button').focus();
  };

  /* "How it works" in 3 steps (lobby + Help) */
  function howItWorks() {
    const steps = [
      ['Draw yourself', '25 seconds, pixel style'],
      ['Play 5 mini challenges', '+ 2 quick questions each'],
      ['Get your type', 'personality, 3 fonts, friend match'],
    ];
    return h('ol', { class: 'how', 'aria-label': 'How it works' },
      steps.map(([title, sub], i) => h('li', {},
        h('span', { class: 'how-n' }, String(i + 1)),
        h('span', { class: 'how-text' }, h('strong', {}, title), h('span', {}, sub)))));
  }
  W.howItWorks = howItWorks;

  /* ---------- ABOUT DIALOG ---------- */
  function openAbout() {
    if ($('.modal')) return;
    const close = () => modal.remove();
    const ok = h('button', { onclick: close }, 'OK');
    const modal = h('div', { class: 'modal', onclick: e => { if (e.target === modal) close(); } },
      h('div', { class: 'window dialog', role: 'dialog', 'aria-label': 'About' },
        h('div', { class: 'title-bar' },
          h('div', { class: 'title-bar-text' }, 'About'),
          h('div', { class: 'title-bar-controls' },
            h('button', { 'aria-label': 'Close', onclick: close }))),
        h('div', { class: 'window-body about' },
          h('img', { src: W.iconURL('heart', 8), alt: '', class: 'pixel' }),
          T.ransom("What's your type?!", 22, 'about', { align: 'center', level: 2 }),
          T.human('a personality test for designers.'),
          howItWorks(),
          T.label('Your 5 traits'),
          h('p', { class: 'about-traits' }, W.TRAITS.map(t => `${t.low} or ${t.high}`).join(' · ')),
          T.sticker('ID2116 · Anvii', -3),
          h('div', { class: 'row end' }, ok))));
    document.body.append(modal);
    ok.focus();
  }

  /* ---------- SOUND TEST DIALOG ---------- */
  function openSoundTest() {
    if ($('.modal')) return;
    W.sound.unlock();
    const close = () => modal.remove();
    const modal = h('div', { class: 'modal', onclick: e => { if (e.target === modal) close(); } },
      h('div', { class: 'window dialog', role: 'dialog', 'aria-label': 'Sound test' },
        h('div', { class: 'title-bar' },
          h('div', { class: 'title-bar-text' }, 'Sound test'),
          h('div', { class: 'title-bar-controls' },
            h('button', { 'aria-label': 'Close', onclick: close }))),
        h('div', { class: 'window-body about' },
          T.human(W.sound.muted ? 'sound is muted.' : 'tap to hear.'),
          h('div', { class: 'sound-grid' },
            W.sound.names.map(n => h('button', { 'data-sfx': n }, n))),
          h('div', { class: 'row end' }, h('button', { onclick: close }, 'OK')))));
    document.body.append(modal);
  }

  /* ---------- TOOL WINDOWS: Colors + Fonts ----------
     Laptop (wide): docked to the right of Paint. Minimise sends a
     window to the taskbar; tap its taskbar button (or the menu) to bring it back.
     Phone / narrow: each opens from the menu bar as a pop-up. */
  const WINS = {
    colors: { el: '#palette-win', menu: '#menu-colors', label: 'Colors' },
    fonts:  { el: '#fonts-win',   menu: '#menu-fonts',  label: 'Fonts' },
  };
  const wide = () => window.matchMedia('(min-width: 1100px)').matches;
  let minimised = {};
  try { minimised = JSON.parse(localStorage.getItem('wyt-min') || '{}'); } catch (e) { /* ignore */ }

  function closePopups() {
    Object.keys(WINS).forEach(id => {
      document.body.classList.remove('open-' + id);
      $(WINS[id].menu).setAttribute('aria-expanded', 'false');
    });
  }
  function renderTaskWins() {
    $('#task-wins').replaceChildren(...Object.keys(WINS).filter(id => minimised[id]).map(id =>
      h('button', { class: 'task-btn', onclick: () => restoreWin(id) }, WINS[id].label)));
    Object.keys(WINS).forEach(id => $(WINS[id].el).classList.toggle('minimised', !!minimised[id]));
  }
  function saveMin() { try { localStorage.setItem('wyt-min', JSON.stringify(minimised)); } catch (e) { /* ignore */ } }
  function minimiseWin(id) { minimised[id] = true; saveMin(); closePopups(); renderTaskWins(); }
  function restoreWin(id) {
    minimised[id] = false; saveMin(); renderTaskWins();
    if (!wide()) { closePopups(); document.body.classList.add('open-' + id); $(WINS[id].menu).setAttribute('aria-expanded', 'true'); }
  }

  function buildToolWindows() {
    // palettes
    const pal = $('#palette-list');
    const renderPalettes = () => pal.replaceChildren(...T.PALETTES.map(p => {
      const on = p.id === T.palette().id;
      return h('button', {
        class: 'pal-row' + (on ? ' on' : ''), role: 'radio', 'aria-checked': String(on),
        onclick: () => { T.setPalette(p.id); renderPalettes(); renderSets(); },
      },
        h('span', { class: 'pal-swatches' }, p.colors.map(c => h('span', { class: 'pal-swatch', style: `background:${c}` }))),
        h('span', { class: 'pal-name' }, p.name),
        h('span', { class: 'pal-note' }, p.note));
    }));

    // font sets: each row shows a few sample letters in its fonts
    const sets = $('#fontset-list');
    const renderSets = () => sets.replaceChildren(...T.FONT_SETS.map(fs => {
      const on = fs.id === T.fontSet().id;
      const sample = fs.fonts.slice(0, 6).map((f, i) => h('span', {
        class: 'set-letter',
        style: `font-family:${f.family};font-weight:${f.weight};font-style:${f.style};font-size:${(f.scale * 22).toFixed(0)}px`,
      }, 'Aa'[i % 2]));
      return h('button', {
        class: 'pal-row' + (on ? ' on' : ''), role: 'radio', 'aria-checked': String(on),
        onclick: () => { T.setFontSet(fs.id); renderSets(); },
      },
        h('span', { class: 'set-sample' }, sample),
        h('span', { class: 'pal-name' }, fs.name),
        h('span', { class: 'pal-note' }, fs.note));
    }));
    renderPalettes();
    renderSets();
    T.magButton($('#shuffle-btn'), 'Shuffle', 'shuffle');
    $('#shuffle-btn').addEventListener('click', () => T.shuffle());

    // window buttons + menu items
    Object.entries(WINS).forEach(([id, w]) => {
      const el = $(w.el);
      el.querySelector('[data-min]').addEventListener('click', () => minimiseWin(id));
      el.querySelector('[data-close]').addEventListener('click', closePopups);
      $(w.menu).addEventListener('click', e => {
        e.stopPropagation();
        if (wide()) { restoreWin(id); return; }
        const open = !document.body.classList.contains('open-' + id);
        closePopups();
        if (open) restoreWin(id);
      });
    });
    renderTaskWins();
  }

  /* ---------- DESKTOP ICONS ---------- */
  const DESK = [
    ['folder', 'Card Wall'],
    ['floppy', 'Floppy (A:)'],
    ['cd', 'Fonts CD'],
    ['help', 'Help'],
    ['trash', 'Trash'],
  ];
  function buildIcons() {
    const list = $('#icons');
    DESK.forEach(([icon, label]) => {
      const btn = h('button', { class: 'icon' },
        h('img', { src: W.iconURL(icon, 3), alt: '' }),
        h('span', {}, label));
      btn.addEventListener('click', e => {
        e.stopPropagation();
        list.querySelectorAll('.icon').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        if (icon === 'help') openAbout();
        if (icon === 'folder') W.fx.attract.show();
      });
      list.append(h('li', {}, btn));
    });
    $('#desktop').addEventListener('click', () =>
      list.querySelectorAll('.icon').forEach(b => b.classList.remove('selected')));
  }

  /* ---------- TASKBAR: start menu, mute, clock ---------- */
  function closeStartMenu() {
    $('#start-menu').hidden = true;
    $('#start-btn').setAttribute('aria-expanded', 'false');
  }
  function buildTaskbar() {
    const startBtn = $('#start-btn'), menu = $('#start-menu');
    $('#start-icon').src = W.iconURL('heart', 3);

    startBtn.addEventListener('click', e => {
      e.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      startBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', e => {
      if (!menu.hidden && !menu.contains(e.target)) closeStartMenu();
    });
    menu.addEventListener('click', e => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      closeStartMenu();
      if (action === 'new') W.go('lobby');
      if (action === 'restart') W.go('boot');
      if (action === 'about') openAbout();
      if (action === 'wall') W.fx.attract.show();
      if (action === 'sounds') openSoundTest();
    });

    // Mute
    const muteBtn = $('#mute-btn');
    const renderMute = () => {
      const m = W.sound.muted;
      $('#mute-icon').src = W.iconURL(m ? 'speakerMuted' : 'speaker', 2);
      muteBtn.setAttribute('aria-pressed', String(m));
      muteBtn.setAttribute('aria-label', m ? 'Unmute' : 'Mute');
    };
    muteBtn.addEventListener('click', () => { W.sound.setMuted(!W.sound.muted); renderMute(); });
    renderMute();

    // Clock
    const clock = $('#clock');
    const tick = () => {
      clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };
    tick();
    setInterval(tick, 10000);
  }

  /* ---------- START ---------- */
  function init() {
    $('#title-icon').src = W.iconURL('heart', 2);
    buildBootTitle();
    W.wallpaper.init();
    W.fx.init();
    T.magButton($('#boot-solo'), 'Play solo', 'boot-solo');
    T.magButton($('#boot-duo'), '2 players', 'boot-duo');
    buildToolWindows();
    buildIcons();
    buildTaskbar();

    $('#menu-help').addEventListener('click', openAbout);
    // Every button makes a sound: data-sfx picks it, decorative Win95 buttons bonk,
    // everything else clicks. (The boot screen plays its own chime.)
    document.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || b.disabled || b.closest('#boot')) return;
      W.sound.play(b.dataset.sfx || (b.hasAttribute('data-bonk') ? 'bonk' : 'click'));
    });

    // Audio may only start after a tap; every tap is a chance to unlock it
    document.addEventListener('pointerdown', () => W.sound.unlock());
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeStartMenu(); closePopups(); $('.modal')?.remove(); } });

    // Dev shortcut: #draw, #challenge3, #card ...
    // Opened from a room QR (#r=ABCD)? Go to the lobby with Join ready.
    const room = location.hash.match(/^#r=([A-Za-z]{4})$/);
    if (room) {
      history.replaceState(null, '', location.pathname + location.search);
      W.state.joinCode = room[1].toUpperCase();
      W.state.pick = 'duo';
      W.go('lobby');
      return;
    }

    // Opened from a friend's QR / link (#c=CODE)?
    const link = location.hash.match(/^#c=([A-Za-z0-9_-]+)/);
    if (link) {
      history.replaceState(null, '', location.pathname + location.search);
      const friend = W.net.decode(link[1]);
      if (friend) {
        W.state.friend = friend;
        // already have a card on this device → compare now; otherwise play first
        W.go(W.net.loadMine() ? 'compat' : 'lobby');
        return;
      }
    }

    const jump = location.hash.slice(1);
    if (jump && jump !== 'boot' && W.screens[jump]) {
      W.state.name = W.state.name || 'Tester';
      W.go(jump);
    } else {
      W.go('boot');
    }
  }

  init();
})();
