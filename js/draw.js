/* =========================================================
   draw.js · "Draw yourself" in 15 seconds

   A 24×24 pixel canvas (p5.js), a Paint-style tool column
   (pencil, fill bucket, eraser, clear) and the classic
   28-colour Paint palette. A 3-2-1 count-in, then a 15s
   countdown in the title bar. At 0 the canvas locks.

   The drawing is saved as WYT.state.avatar: 576 numbers,
   one per pixel, row by row. Each number is a position in
   WYT.PAINT28 (0..27), or -1 for an empty (white) pixel.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});

  const SIZE = 24;          // pixels per side
  const SECONDS = 15;       // drawing time
  const COUNT_IN = 3;       // 3-2-1 before the clock starts

  // The classic 28-colour Paint palette (top row, then bottom row)
  W.PAINT28 = [
    '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080',
    '#800080', '#808040', '#004040', '#0080ff', '#004080', '#8000ff', '#804000',
    '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff',
    '#ff00ff', '#ffff80', '#00ff80', '#80ffff', '#8080ff', '#ff0080', '#ff8040',
  ];
  const ROW_A = W.PAINT28.slice(0, 14), ROW_B = W.PAINT28.slice(14);

  // Turn an avatar into a picture (used later by the Type Card and compat screens)
  W.avatarCanvas = function (avatar, scale = 4) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = SIZE * scale;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    (avatar || []).forEach((c, i) => {
      if (c < 0) return;
      ctx.fillStyle = W.PAINT28[c];
      ctx.fillRect((i % SIZE) * scale, Math.floor(i / SIZE) * scale, scale, scale);
    });
    return cv;
  };

  /* ---------- flood fill (the bucket) ---------- */
  function flood(cells, start, color) {
    const target = cells[start];
    if (target === color) return 0;
    const stack = [start];
    let n = 0;
    while (stack.length) {
      const i = stack.pop();
      if (cells[i] !== target) continue;
      cells[i] = color;
      n++;
      const x = i % SIZE, y = Math.floor(i / SIZE);
      if (x > 0) stack.push(i - 1);
      if (x < SIZE - 1) stack.push(i + 1);
      if (y > 0) stack.push(i - SIZE);
      if (y < SIZE - 1) stack.push(i + SIZE);
    }
    return n;
  }

  // Every cell on a straight line between two cells (so fast swipes leave no gaps)
  function lineCells(a, b) {
    let x0 = a % SIZE, y0 = Math.floor(a / SIZE);
    const x1 = b % SIZE, y1 = Math.floor(b / SIZE);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const out = [];
    for (;;) {
      out.push(y0 * SIZE + x0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return out;
  }

  /* ---------- the screen ---------- */
  W.screens = W.screens || {};
  W.screens.draw = {
    enter(el, state) {
      const h = W.h, T = W.type;
      const self = this;

      // drawing state
      const cells = new Array(SIZE * SIZE).fill(-1);
      let tool = 'pencil';
      let color = 0;              // black
      let phase = 'countin';      // 'countin' → 'drawing' → 'locked'
      let endsAt = 0;
      let startedAt = 0;
      let strokes = 0;
      let drawing = false, lastCell = -1;
      let dirty = true;

      /* ----- tools column ----- */
      const toolBtn = (id, label) => h('button', {
        class: 'tool-btn', 'aria-label': label, title: label, 'data-tool': id,
        onclick: () => {
          if (id === 'clear') {
            if (phase !== 'drawing') return;
            cells.fill(-1); dirty = true;
            return;
          }
          tool = id;
          tools.querySelectorAll('[data-tool]').forEach(b =>
            b.classList.toggle('pressed', b.dataset.tool === tool));
        },
      }, h('img', { src: W.iconURL(id === 'clear' ? 'trash' : id, 2), alt: '' }));

      const tools = h('div', { class: 'tools', role: 'toolbar', 'aria-label': 'Tools' },
        toolBtn('pencil', 'Pencil'), toolBtn('fill', 'Fill'), toolBtn('eraser', 'Eraser'),
        toolBtn('clear', 'Clear'));
      tools.querySelector('[data-tool=fill] img').src = W.iconURL('bucket', 2);
      tools.querySelector('[data-tool=pencil]').classList.add('pressed');

      /* ----- palette ----- */
      const current = h('div', { class: 'current-color', 'aria-hidden': 'true' });
      const swatch = (hex, i) => h('button', {
        class: 'swatch', style: `background:${hex}`, 'aria-label': `Colour ${i + 1}`,
        'data-sfx': 'none',
        onclick: () => {
          color = i;
          if (tool === 'eraser') tools.querySelector('[data-tool=pencil]').click();
          renderCurrent();
        },
      });
      const grid = h('div', { class: 'swatches' },
        ROW_A.map((c, i) => swatch(c, i)), ROW_B.map((c, i) => swatch(c, i + 14)));
      const renderCurrent = () => {
        current.style.background = W.PAINT28[color];
        grid.querySelectorAll('.swatch').forEach((b, i) => b.classList.toggle('on', i === color));
      };
      renderCurrent();

      /* ----- canvas + overlay ----- */
      const holder = h('div', { class: 'draw-canvas' });
      const overlay = h('div', { class: 'draw-overlay' });
      holder.append(overlay);

      const doneBtn = T.magButton(h('button', {
        class: 'big', 'data-sfx': 'none',
        onclick: () => (phase === 'locked' ? W.next() : finish('done')),
      }), 'Done', 'draw-done');

      el.append(h('div', { class: 'stack draw-stack' },
        h('div', { class: 'draw-head' },
          T.ransom('Draw yourself', 34, 'Draw yourself'),
          T.sticker(`${SECONDS} seconds`, 5)),
        T.human('you are the mascot.'),
        h('div', { class: 'draw-area' }, tools, holder),
        h('div', { class: 'palette-bar' }, current, grid),
        doneBtn,
      ));

      /* ----- p5 sketch: draws the grid ----- */
      const cellAt = e => {
        const r = self.p5.canvas.getBoundingClientRect();
        const x = Math.min(SIZE - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * SIZE)));
        const y = Math.min(SIZE - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * SIZE)));
        return y * SIZE + x;
      };
      const paint = i => {
        const v = tool === 'eraser' ? -1 : color;
        if (cells[i] !== v) { cells[i] = v; dirty = true; }
      };

      this.p5 = new p5(p => {
        let cell = 10;
        const fit = () => {
          cell = Math.max(6, Math.floor(holder.clientWidth / SIZE));
          p.resizeCanvas(cell * SIZE, cell * SIZE);
          dirty = true;
        };

        p.setup = () => {
          const c = p.createCanvas(SIZE * 10, SIZE * 10);
          c.parent(holder);
          p.noSmooth();
          p.frameRate(30);
          fit();

          const cv = c.elt;
          cv.addEventListener('pointerdown', e => {
            if (phase !== 'drawing') return;
            e.preventDefault();
            cv.setPointerCapture(e.pointerId);
            const i = cellAt(e);
            if (tool === 'fill') {
              if (flood(cells, i, color)) { dirty = true; strokes++; }
              return;
            }
            drawing = true;
            lastCell = i;
            paint(i);
          });
          cv.addEventListener('pointermove', e => {
            if (!drawing || phase !== 'drawing') return;
            const i = cellAt(e);
            if (i !== lastCell) { lineCells(lastCell, i).forEach(paint); lastCell = i; }
          });
          const up = () => { if (drawing) strokes++; drawing = false; };
          cv.addEventListener('pointerup', up);
          cv.addEventListener('pointercancel', up);
        };

        p.windowResized = fit;

        p.draw = () => {
          if (phase === 'drawing') {
            const left = (endsAt - performance.now()) / 1000;
            W.setTimer(left);
            if (left <= 0) finish('time');
          }
          if (!dirty) return;
          dirty = false;

          p.background(255);
          p.noStroke();
          for (let i = 0; i < cells.length; i++) {
            if (cells[i] < 0) continue;
            p.fill(W.PAINT28[cells[i]]);
            p.rect((i % SIZE) * cell, Math.floor(i / SIZE) * cell, cell, cell);
          }
          // faint grid while drawing, gone once locked
          if (phase !== 'locked') {
            p.stroke(0, 0, 0, 22);
            p.strokeWeight(1);
            for (let k = 1; k < SIZE; k++) {
              p.line(k * cell + 0.5, 0, k * cell + 0.5, p.height);
              p.line(0, k * cell + 0.5, p.width, k * cell + 0.5);
            }
          }
        };
      }, holder);

      /* ----- 3-2-1, then go ----- */
      const showCount = n => {
        overlay.replaceChildren(T.ransom(String(n), 96, 'count' + n, { align: 'center', level: 2 }));
      };
      W.setTimer(SECONDS);
      let n = COUNT_IN;
      showCount(n);
      W.sound.play('tick');
      this.countTimer = setInterval(() => {
        n--;
        if (n > 0) { showCount(n); W.sound.play('tick'); return; }
        clearInterval(this.countTimer);
        overlay.replaceChildren();
        overlay.hidden = true;
        W.sound.play('click');
        phase = 'drawing';
        startedAt = performance.now();
        endsAt = startedAt + SECONDS * 1000;
      }, 700);

      /* ----- finish: Done tapped, or time ran out ----- */
      function finish(why) {
        if (phase === 'locked') return;
        clearInterval(self.countTimer);
        phase = 'locked';
        drawing = false;
        dirty = true;
        holder.classList.add('locked');
        W.setTimer(why === 'time' ? 0 : Math.max(0, (endsAt - performance.now()) / 1000));

        const used = startedAt ? Math.min(SECONDS, (performance.now() - startedAt) / 1000) : 0;
        state.avatar = cells.slice();
        state.drawStats = {
          seconds: Math.round(used * 10) / 10,
          strokes,
          filled: cells.filter(c => c >= 0).length,
          colors: new Set(cells.filter(c => c >= 0)).size,
          ranOut: why === 'time',
        };

        if (why === 'time') {
          W.sound.play('bonk');
          overlay.hidden = false;
          overlay.replaceChildren(T.sticker("Time's up", -8));
          T.magButton(doneBtn, 'Next', 'draw-next');
        } else {
          W.sound.play('ding');
          W.next();
        }
      }
    },

    exit() {
      clearInterval(this.countTimer);
      if (this.p5) { this.p5.remove(); this.p5 = null; }
      W.setTimer(null);
    },
  };
})();
