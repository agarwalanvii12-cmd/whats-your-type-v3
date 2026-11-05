/* =========================================================
   fx.js · polish effects

   WYT.fx.shake()        screen shake + glitch (time ran out)
   WYT.fx.burst(el)      pixel confetti + starbursts from an element
   WYT.fx.init()         pixel cursors + twinkling sky starbursts

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

  W.fx = {
    shake, burst,
    init() { cursors(); sparkles(); },
  };
})();
