/* =========================================================
   main.js · screen state machine + desktop, taskbar, boot
   Flow: boot → lobby → draw → challenge1..5 → card → compat

   Every screen is an object { enter(el, state), exit() }.
   enter() draws the screen into the Paint window (el).
   Other files can register real screens on WYT.screens
   before this file runs; anything missing gets a placeholder.

   Dev shortcut: open index.html#draw (or #card etc.) to
   skip straight to that screen.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});
  const T = W.type; // ransom, sticker, human, label (js/type.js)
  const $ = sel => document.querySelector(sel);

  const ORDER = [
    'boot', 'lobby', 'draw',
    'challenge1', 'challenge2', 'challenge3', 'challenge4', 'challenge5',
    'card', 'compat',
  ];
  const LABELS = {
    boot: 'Boot', lobby: 'Lobby', draw: 'Draw yourself',
    challenge1: 'Challenge 1', challenge2: 'Challenge 2', challenge3: 'Challenge 3',
    challenge4: 'Challenge 4', challenge5: 'Challenge 5',
    card: 'Type Card', compat: 'Compatibility',
  };

  /* ---------- game state (shared by every screen) ---------- */
  W.state = { name: '', mode: 'solo', avatar: null, results: {}, card: null };
  W.resetGame = function () {
    W.state.avatar = null;
    W.state.results = {};
    W.state.card = null;
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
      Object.assign(T.sticker('v3', 8), { className: 'sticker pill s1' }),
      Object.assign(T.sticker('2 players', -6, 'tag'), { className: 'sticker tag s2' }),
    );
  }

  W.screens.boot = {
    enter() {
      const boot = $('#boot'), fill = $('#boot-fill'), bar = $('#boot-bar');
      const status = $('#boot-status'), tap = $('#boot-tap');
      boot.hidden = false;
      boot.classList.remove('ready');
      tap.hidden = true;
      fill.style.width = '0%';

      let pct = 0;
      this.timer = setInterval(() => {
        pct = Math.min(100, pct + 4 + Math.random() * 9);
        // snap to whole blocks so it looks chunky
        fill.style.width = Math.floor(pct / 8) * 8 + (pct >= 100 ? 4 : 0) + '%';
        bar.setAttribute('aria-valuenow', Math.round(pct));
        status.textContent = BOOT_LINES[Math.floor((pct / 100) * (BOOT_LINES.length - 1))];
        if (pct >= 100) {
          clearInterval(this.timer);
          this.timer = null;
          boot.classList.add('ready');
          tap.hidden = false;
          tap.focus();
        }
      }, 180);

      this.onTap = () => {
        if (!boot.classList.contains('ready')) return;
        W.sound.unlock();
        W.sound.play('chime');
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
      const input = h('input', {
        type: 'text', id: 'player-name', maxlength: '12',
        autocomplete: 'off', enterkeyhint: 'go', placeholder: 'Your name',
        value: state.name,
      });
      const solo = h('button', {
        class: 'big',
        onclick: () => {
          state.name = cleanName(input.value) || 'Anon';
          state.mode = 'solo';
          W.resetGame();
          W.go('draw');
        },
      });
      T.magButton(solo, 'Play solo');
      input.addEventListener('keydown', e => { if (e.key === 'Enter') solo.click(); });

      el.append(h('div', { class: 'stack' },
        T.sticker('MBTI for designers', -4),
        T.ransom("What's your type?", 40, 'lobby'),
        T.human('draw. play. get typed.'),
        h('div', { class: 'field' },
          h('label', { for: 'player-name', class: 'label' }, 'Your name'),
          input),
        solo,
        h('div', { class: 'row' },
          T.magButton(h('button', { disabled: true }), 'Create room'),
          T.magButton(h('button', { disabled: true }), 'Join room')),
        h('p', { class: 'label muted' }, 'Rooms coming soon'),
      ));
    },
  };

  /* ---------- PLACEHOLDERS (replaced in later steps) ---------- */
  function placeholder({ tag, tilt = -4, title, quip, box, button, onNext, enterSound, sfx }) {
    return {
      enter(el) {
        if (enterSound) W.sound.play(enterSound);
        el.append(h('div', { class: 'stack' },
          T.sticker(tag, tilt),
          T.ransom(title, 40, title),
          quip && T.human(quip),
          h('div', { class: 'placeholder' }, box()),
          T.magButton(h('button', { class: 'big', 'data-sfx': sfx, onclick: onNext || (() => W.next()) }), button),
        ));
      },
    };
  }

  const fallbacks = {
    draw: placeholder({
      tag: '15 seconds', title: 'Draw yourself', quip: 'you are the mascot.',
      box: () => T.label('24 × 24 canvas soon'), button: 'Done',
    }),
    card: placeholder({
      tag: 'Your result', tilt: 3, title: 'Type card', quip: 'who are you, really?', enterSound: 'levelup',
      box: () => [T.ransom('????', 64, 'code', { mixCase: false, align: 'center', level: 2 }), T.label('Type code')],
      button: 'Compare',
    }),
    compat: placeholder({
      tag: 'You × friend', tilt: 3, title: 'Compatibility', quip: 'a classic pairing?',
      box: () => T.label('% match soon'), button: 'Play again', onNext: () => W.go('lobby'),
    }),
  };
  W.CHALLENGES.forEach(c => {
    fallbacks['challenge' + c.id] = placeholder({
      tag: `Challenge ${c.id}/5 · ${c.time}s`, tilt: c.id % 2 ? -4 : 3,
      title: c.name, quip: c.quip, box: () => T.label(c.hint), button: 'OK', sfx: 'ding',
    });
  });
  for (const [name, scr] of Object.entries(fallbacks)) {
    if (!W.screens[name]) W.screens[name] = scr;
  }

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
          T.human('MBTI, but for designers.'),
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

  /* ---------- COLORS WINDOW (palettes) ----------
     Laptop (wide): always docked to the right of Paint.
     Phone / narrow: opens from the Colors menu as a pop-up. */
  function setPaletteOpen(open) {
    document.body.classList.toggle('palette-open', open);
    $('#menu-colors').setAttribute('aria-expanded', String(open));
  }
  function buildPalettes() {
    const list = $('#palette-list');
    const render = () => {
      list.replaceChildren(...T.PALETTES.map(p => {
        const on = p.id === T.palette().id;
        return h('button', {
          class: 'pal-row' + (on ? ' on' : ''), role: 'radio', 'aria-checked': String(on),
          onclick: () => { T.setPalette(p.id); render(); },
        },
          h('span', { class: 'pal-swatches' },
            p.colors.map(c => h('span', { class: 'pal-swatch', style: `background:${c}` }))),
          h('span', { class: 'pal-name' }, p.name),
          h('span', { class: 'pal-note' }, p.note));
      }));
    };
    render();
    $('#menu-colors').addEventListener('click', e => {
      e.stopPropagation();
      setPaletteOpen(!document.body.classList.contains('palette-open'));
    });
    $('#palette-close').addEventListener('click', () => setPaletteOpen(false));
  }

  /* ---------- DESKTOP ICONS ---------- */
  const DESK = [
    ['folder', 'My Types'],
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
    $('#boot-logo').src = W.iconURL('heart', 9);
    $('#title-icon').src = W.iconURL('heart', 2);
    buildBootTitle();
    W.wallpaper.init();
    T.magButton($('#boot-tap'), 'Tap to start', 'boot-tap');
    buildPalettes();
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
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeStartMenu(); setPaletteOpen(false); $('.modal')?.remove(); } });

    // Dev shortcut: #draw, #challenge3, #card ...
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
