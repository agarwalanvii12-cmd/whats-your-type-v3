/* =========================================================
   fx.js · polish effects

   WYT.fx.shake()        screen shake + glitch (time ran out)
   WYT.fx.burst(el)      pixel confetti + starbursts from an element
   WYT.fx.pixelReveal()  draw a pixel icon one pixel at a time (boot logo)
   WYT.fx.typeOut()      typewriter text (boot status lines)
   WYT.fx.attract        idle screensaver of sample Type Cards
   WYT.fx.init()         pixel cursors, sky starbursts, attract mode

   Everything respects "reduce motion" in the phone/computer settings.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});
  const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* time's up: the Paint window jolts and glitches for a moment */
  function shake() {
    if (calm()) return;
    const win = document.getElementById('paint');
    win.classList.remove('shake');
    void win.offsetWidth; // restart the animation if it's already running
    win.classList.add('shake');
    setTimeout(() => win.classList.remove('shake'), 500);
  }

  /* celebration: pixel squares and starbursts fly out of an element */
  function burst(el, count = 22) {
    if (calm() || !el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const colors = W.type.palette().colors;
    for (let i = 0; i < count; i++) {
      const star = i % 6 === 0;
      const p = document.createElement(star ? 'img' : 'span');
      p.className = 'fx-px' + (star ? ' star' : '');
      if (star) { p.src = W.iconURL('burst', 2); p.alt = ''; }
      else p.style.background = colors[i % colors.length];
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 90 + Math.random() * 110;
      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
      p.style.setProperty('--s', (star ? 1 : 0.6 + Math.random() * 0.8).toFixed(2));
      p.style.animationDelay = Math.random() * 120 + 'ms';
      document.body.append(p);
      setTimeout(() => p.remove(), 1300);
    }
  }

  /* pixel cursors (only where there's a mouse) */
  function cursors() {
    const root = document.documentElement.style;
    root.setProperty('--cursor', `url(${W.iconURL('arrow', 2)}) 0 0, auto`);
    root.setProperty('--cursor-hand', `url(${W.iconURL('hand', 2)}) 10 0, pointer`);
    root.setProperty('--cursor-pencil', `url(${W.iconURL('pencil', 2)}) 2 26, crosshair`);
  }

  /* a few twinkling starbursts in the sky (laptop only, see CSS) */
  function sparkles() {
    const box = document.createElement('div');
    box.className = 'sparkles';
    box.setAttribute('aria-hidden', 'true');
    const r = W.type.rng('sparkles');
    for (let i = 0; i < 9; i++) {
      const big = i % 3 === 0;
      const img = document.createElement('img');
      img.src = W.iconURL(big ? 'burst' : 'sparkle', 3);
      img.alt = '';
      img.style.left = 4 + r() * 92 + '%';
      img.style.top = 3 + r() * 48 + '%';
      img.style.animationDelay = (r() * 3).toFixed(2) + 's';
      img.style.animationDuration = (1.6 + r() * 1.6).toFixed(2) + 's';
      box.append(img);
    }
    document.getElementById('wallpaper').after(box); // just above the sky
  }

  /* boot logo: a pixel icon appears one pixel at a time, then pulses */
  function pixelReveal(canvas, name, scale, ms = 800) {
    const rows = W.iconRows(name), pal = W.ICON_PAL;
    const cols = Math.max(...rows.map(r => r.length));
    canvas.width = cols * scale;
    canvas.height = rows.length * scale;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const px = [];
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) px.push([x, y, pal[ch]]); }));
    if (calm()) { px.forEach(([x, y, c]) => { ctx.fillStyle = c; ctx.fillRect(x * scale, y * scale, scale, scale); }); return; }
    px.sort(() => Math.random() - 0.5);
    canvas.classList.remove('pulse');
    const start = performance.now();
    let drawn = 0;
    const step = now => {
      const target = Math.min(px.length, Math.ceil(((now - start) / ms) * px.length));
      for (; drawn < target; drawn++) {
        const [x, y, c] = px[drawn];
        ctx.fillStyle = c;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
      if (drawn < px.length) requestAnimationFrame(step);
      else canvas.classList.add('pulse');
    };
    requestAnimationFrame(step);
  }

  /* typewriter: text appears one letter at a time, with a caret */
  function typeOut(el, text, msPerChar = 28) {
    clearInterval(el._typing);
    if (calm()) { el.textContent = text; return; }
    let i = 0;
    el.textContent = '';
    el._typing = setInterval(() => {
      i++;
      el.textContent = text.slice(0, i);
      if (i >= text.length) clearInterval(el._typing);
    }, msPerChar);
  }

  /* ---------- ATTRACT MODE ----------
     Left alone on the lobby for a while (e.g. on the showcase laptop),
     the screen cycles through sample Type Cards. Any tap wakes it up. */
  const IDLE_MS = 40000, SWAP_MS = 4500;
  const SAMPLES = [
    { name: 'Ada',  face: 0, traits: [0.2, 0.85, 0.9, 0.9, 0.2] },
    { name: 'Rafa', face: 2, traits: [0.95, 0.15, 0.3, 0.1, 0.9] },
    { name: 'Mia',  face: 1, traits: [0.3, 0.6, 0.15, 0.7, 0.6] },
    { name: 'Jun',  face: 0, traits: [0.8, 0.8, 0.9, 0.5, 0.85] },
  ];
  const attract = {
    last: performance.now(), on: false, cards: [], rendered: {}, i: 0, el: null, swap: 0,
    init() {
      const wake = () => { this.last = performance.now(); };
      ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'].forEach(ev =>
        document.addEventListener(ev, wake, { passive: true, capture: true }));
      setInterval(() => {
        const idle = performance.now() - this.last > IDLE_MS;
        const calmLobby = W.current && W.current() === 'lobby' && !(W.live && W.live.status !== 'idle') &&
          !document.querySelector('.modal') && document.visibilityState === 'visible';
        if (idle && calmLobby && !this.on) this.show();
      }, 2000);
    },
    async show() {
      if (this.on) return;
      this.on = true;
      const h = W.h, T = W.type;
      const img = h('img', { class: 'attract-card', alt: '' });
      const caption = h('p', { class: 'human attract-caption' });
      const tag = h('p', { class: 'sticker attract-tag' }, 'Card wall');
      this.el = h('div', { class: 'attract', role: 'dialog', 'aria-label': 'Sample Type Cards. Tap to play.' },
        h('div', { class: 'attract-inner' },
          T.ransom("What's your type?!", 40, 'boot', { dark: true, align: 'center' }),
          tag, img, caption,
          h('p', { class: 'attract-tap' }, 'Tap to play')));
      const close = e => {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
      };
      this.el.addEventListener('pointerdown', close);
      this.onKey = e => close(e);
      document.addEventListener('keydown', this.onKey, { capture: true });
      document.body.append(this.el);

      // the Card Wall (cards players pinned) first, then the built-in samples
      this.cards = [];
      this.i = 0;
      const wall = await fetch('api/gallery').then(r => (r.ok ? r.json() : { cards: [] })).catch(() => ({ cards: [] }));
      const people = (wall.cards || []).map(c => W.net.decode(c)).filter(Boolean).slice(0, 12)
        .map(p => ({ name: p.name, avatar: p.avatar, traits: p.traits, pinned: true }));
      if (people.length < 3) SAMPLES.forEach(s => people.push({ name: s.name, avatar: W.DEFAULT_FACES[s.face], traits: s.traits }));
      tag.textContent = (wall.cards || []).length ? `Card wall · ${(wall.cards || []).length} pinned` : 'Sample cards';
      for (const p of people) {
        if (!this.on) return;
        const key = p.name + p.traits.join() + p.avatar.join('');
        if (!this.rendered[key]) {
          const result = W.resultFor(p.traits);
          const card = await W.renderCard({ name: p.name, avatar: p.avatar, result });
          this.rendered[key] = { src: card.dataURL, text: `${p.name} is ${result.type.name.replace(/^The /, 'the ')}.` };
        }
        this.cards.push(this.rendered[key]);
        if (this.cards.length === 1) this.next(img, caption);
      }
      this.swap = setInterval(() => this.next(img, caption), SWAP_MS);
    },
    next(img, caption) {
      if (!this.cards.length) return;
      const c = this.cards[this.i++ % this.cards.length];
      img.classList.remove('in');
      void img.offsetWidth;
      img.src = c.src;
      img.classList.add('in');
      caption.textContent = c.text;
    },
    hide() {
      this.on = false;
      clearInterval(this.swap);
      document.removeEventListener('keydown', this.onKey, { capture: true });
      this.el?.remove();
      this.el = null;
      this.last = performance.now();
    },
  };

  /* ---------- POINT, the mascot ----------
     A 3D lavender pixel cursor with a face, burning with pixel flames.
     The flames flicker and Point blinks now and then.
     W.mascot('text') → element with Point + a speech bubble. */
  const POINT_FRAMES = ['point1', 'point2', 'point1', 'point2', 'point1', 'point3'];
  let pointStep = 0;
  setInterval(() => {
    if (calm()) return;
    pointStep = (pointStep + 1) % POINT_FRAMES.length;
    const src = W.iconURL(POINT_FRAMES[pointStep], 3);
    document.querySelectorAll('.point-img').forEach(img => { img.src = src; });
  }, 260);
  W.mascot = function (say) {
    const h = W.h;
    return h('div', { class: 'mascot' },
      h('img', { class: 'point-img', src: W.iconURL('point1', 3), alt: 'Point, a pixel cursor on fire' }),
      say && h('p', { class: 'kern-say' }, say));
  };

  W.fx = {
    shake, burst, pixelReveal, typeOut, attract,
    init() { cursors(); sparkles(); attract.init(); },
  };
})();
