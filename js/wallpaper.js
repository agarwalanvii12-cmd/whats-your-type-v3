/* =========================================================
   wallpaper.js · pixel-art desktop wallpaper (original art)
   A blue sky in chunky bands, puffy pixel clouds, two rolling
   green hills and a few tiny flowers. Drawn small, then
   scaled up with crisp pixels. Redraws when the window resizes.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});
  const PX = 4; // one wallpaper pixel = 4 screen pixels

  const SKY_TOP = [38, 104, 224];
  const SKY_LOW = [150, 206, 255];
  const HILL_BACK = '#6cc644', HILL_BACK_TOP = '#8fdc5e';
  const HILL_FRONT = '#3f9e2a', HILL_FRONT_TOP = '#5cbf38', HILL_FRONT_DARK = '#2f8420';
  const FLOWERS = ['#ff4fa3', '#ffd23f', '#ffffff', '#b388ff'];

  const lerp = (a, b, t) => a + (b - a) * t;

  function draw(canvas) {
    const cw = window.innerWidth, ch = window.innerHeight;
    const w = Math.ceil(cw / PX), h = Math.ceil(ch / PX);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const r = W.type.rng('sky'); // same clouds every time

    // 1. Sky: gradient snapped to bands
    const horizon = Math.round(h * 0.62);
    const bands = 9;
    for (let y = 0; y < horizon; y++) {
      const t = Math.floor((y / horizon) * bands) / (bands - 1);
      const c = SKY_TOP.map((v, i) => Math.round(lerp(v, SKY_LOW[i], t)));
      ctx.fillStyle = `rgb(${c})`;
      ctx.fillRect(0, y, w, 1);
    }
    ctx.fillStyle = `rgb(${SKY_LOW})`;
    ctx.fillRect(0, horizon, w, h - horizon);

    // 2. Clouds: clusters of pixel circles, white with a soft blue belly
    const clouds = Math.max(4, Math.round(w / 55));
    for (let i = 0; i < clouds; i++) {
      const cx = (i + 0.2 + r() * 0.6) * (w / clouds);
      const cy = h * (0.08 + r() * 0.38);
      const size = 5 + r() * 7;
      const puffs = [];
      const n = 4 + Math.floor(r() * 3);
      for (let p = 0; p < n; p++) {
        puffs.push({
          x: cx + (p - (n - 1) / 2) * size * 0.9,
          y: cy - (p > 0 && p < n - 1 ? r() * size * 0.7 : 0),
          r: size * (p > 0 && p < n - 1 ? 0.9 + r() * 0.4 : 0.7),
        });
      }
      const flatBottom = cy + size * 0.55;
      const x0 = Math.floor(cx - n * size), x1 = Math.ceil(cx + n * size);
      const y0 = Math.floor(cy - size * 2.2), y1 = Math.ceil(flatBottom);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (y > flatBottom) continue;
          const inside = puffs.some(p => (x - p.x) ** 2 + (y - p.y) ** 2 <= p.r ** 2);
          if (!inside) continue;
          ctx.fillStyle = y > flatBottom - 2 ? '#d6e8ff' : '#ffffff';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    // 3. Back hill: one wide, gentle wave
    const backTop = x => horizon - h * 0.06 - Math.sin((x / w) * Math.PI * 1.3 + 0.6) * h * 0.07;
    for (let x = 0; x < w; x++) {
      const top = Math.round(backTop(x));
      ctx.fillStyle = HILL_BACK_TOP;
      ctx.fillRect(x, top, 1, 2);
      ctx.fillStyle = HILL_BACK;
      ctx.fillRect(x, top + 2, 1, h - top);
    }

    // 4. Front hill: a big rolling curve with a lighter grassy edge
    const frontTop = x =>
      h * 0.74 - Math.sin((x / w) * Math.PI * 0.9 - 0.4) * h * 0.11 + Math.sin(x / 9) * 0.8;
    for (let x = 0; x < w; x++) {
      const top = Math.round(frontTop(x));
      ctx.fillStyle = HILL_FRONT_TOP;
      ctx.fillRect(x, top, 1, 3);
      ctx.fillStyle = HILL_FRONT;
      ctx.fillRect(x, top + 3, 1, h - top);
      // little darker grass tufts
      if (r() < 0.12) {
        ctx.fillStyle = HILL_FRONT_DARK;
        ctx.fillRect(x, top + 5 + Math.floor(r() * (h - top)), 1, 2);
      }
    }

    // 5. Tiny flowers on the front hill
    const flowers = Math.round(w / 6);
    for (let i = 0; i < flowers; i++) {
      const x = Math.floor(r() * w);
      const top = Math.round(frontTop(x));
      const y = top + 4 + Math.floor(r() * (h - top - 6));
      ctx.fillStyle = pickColor(r);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const pickColor = r => FLOWERS[Math.floor(r() * FLOWERS.length)];

  W.wallpaper = {
    init() {
      const canvas = document.getElementById('wallpaper');
      if (!canvas) return;
      let timer = null;
      draw(canvas);
      window.addEventListener('resize', () => {
        clearTimeout(timer);
        timer = setTimeout(() => draw(canvas), 150);
      });
    },
  };
})();
