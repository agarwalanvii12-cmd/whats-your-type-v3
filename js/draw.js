/* =========================================================
   draw.js · "Draw yourself" in 15 seconds

   A 24×24 pixel canvas (p5.js), a Paint-style tool column
   (pencil, fill bucket, eraser, clear) and the classic
   28-colour Paint palette. A 3-2-1 count-in, then a 15s
   countdown in the title bar. At 0 the canvas locks.

   Undo button (or Cmd/Ctrl+Z) steps back one stroke.
   Leave the canvas empty and you get one of 3 default smileys.
   Snap (camera-portrait.js) fills the canvas with a pixel portrait.

   Phases: countin → drawing ⇄ camera → locked

   The drawing is saved as WYT.state.avatar: 576 numbers,
   one per pixel, row by row. Each number is a position in
   WYT.AVATAR_COLORS (0..27 are the Paint colours), or -1 for
   an empty (white) pixel.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});

  const SIZE = 24;          // pixels per side
  const SECONDS = 25;       // drawing time
  const COUNT_IN = 3;       // 3-2-1 before the clock starts

  // The classic 28-colour Paint palette (top row, then bottom row)
  W.PAINT28 = [
    '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080',
    '#800080', '#808040', '#004040', '#0080ff', '#004080', '#8000ff', '#804000',
    '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff',
    '#ff00ff', '#ffff80', '#00ff80', '#80ffff', '#8080ff', '#ff0080', '#ff8040',
  ];
  const ROW_A = W.PAINT28.slice(0, 14), ROW_B = W.PAINT28.slice(14);

  /* Every colour an avatar pixel can be. Numbers 0..27 are the Paint colours
     above (all a drawing ever uses); snapped portraits also use the colours of
     the Colors palettes, which are added after them, in a fixed order. */
  W.AVATAR_COLORS = W.PAINT28.slice();
  W.avatarColorIndex = function (hex) {
    let i = W.AVATAR_COLORS.indexOf(hex);
    if (i < 0) i = W.AVATAR_COLORS.push(hex) - 1;
    return i;
  };
  W.avatarColor = i => W.AVATAR_COLORS[i] || '#ffffff';
  W.type.PALETTES.forEach(p => p.colors.forEach(W.avatarColorIndex));

  // Turn an avatar into a picture (used later by the Type Card and compat screens)
  W.avatarCanvas = function (avatar, scale = 4) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = SIZE * scale;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    (avatar || []).forEach((c, i) => {
      if (c < 0) return;
      ctx.fillStyle = W.avatarColor(c);
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

  /* ---------- 3 default faces (if the canvas is left empty) ----------
     A round face in a skin colour with a black outline, plus features.
     Numbers are positions in PAINT28: 0 black, 14 white, 16 red,
     17 yellow, 23 mint, 25 periwinkle. */
  function face(skin, features) {
    const cells = new Array(SIZE * SIZE).fill(-1);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const d = Math.hypot(x - 11.5, y - 11.5);
        if (d <= 10.6) cells[y * SIZE + x] = d > 9.6 ? 0 : skin;
      }
    }
    for (const [color, x0, x1, y0, y1 = y0] of features) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cells[y * SIZE + x] = color;
    }
    return cells;
  }
  // features: [colour, x from, x to, y from, y to]
  const FACES = [
    // 1. classic yellow smiley
    face(17, [
      [0, 8, 9, 7, 10], [0, 14, 15, 7, 10],
      [0, 6, 6, 13], [0, 7, 7, 14], [0, 8, 8, 15], [0, 9, 14, 16], [0, 15, 15, 15],
      [0, 16, 16, 14], [0, 17, 17, 13],
    ]),
    // 2. periwinkle wink with blush and an open smile
    face(25, [
      [0, 7, 10, 9], [0, 14, 15, 7, 10],
      [16, 5, 7, 12], [16, 16, 18, 12],
      [0, 8, 15, 14], [0, 8, 8, 15], [16, 9, 14, 15], [0, 15, 15, 15],
      [0, 9, 9, 16], [16, 10, 13, 16], [0, 14, 14, 16], [0, 10, 13, 17],
    ]),
    // 3. mint face in sunglasses with a toothy grin
    face(23, [
      [0, 5, 18, 8], [0, 6, 10, 9, 10], [0, 13, 17, 9, 10], [14, 7, 7, 9], [14, 14, 14, 9],
      [0, 7, 16, 15], [0, 8, 8, 16], [14, 9, 14, 16], [0, 15, 15, 16], [0, 9, 14, 17],
    ]),
  ];
  W.DEFAULT_FACES = FACES;

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

      // undo: a stack of earlier versions of the canvas
      const history = [];
      let pending = null; // snapshot taken at the start of a stroke, saved once it changes something
      const remember = snap => {
        history.push(snap);
        if (history.length > 40) history.shift();
        undoBtn.disabled = false;
      };
      let undos = 0;
      const undo = () => {
        if (phase !== 'drawing' || !history.length) return;
        undos++;
        cells.splice(0, cells.length, ...history.pop());
        dirty = true;
        undoBtn.disabled = !history.length;
      };

      /* ----- tools column ----- */
      const toolBtn = (id, label) => h('button', {
        class: 'tool-btn', 'aria-label': label, title: label, 'data-tool': id,
        onclick: () => {
          if (id === 'undo') return undo();
          if (id === 'clear') {
            if (phase !== 'drawing' || cells.every(c => c < 0)) return;
            remember(cells.slice());
            cells.fill(-1); dirty = true;
            return;
          }
          tool = id;
          tools.querySelectorAll('[data-tool]').forEach(b =>
            b.classList.toggle('pressed', b.dataset.tool === tool));
        },
      }, h('img', { src: W.iconURL({ clear: 'trash', fill: 'bucket' }[id] || id, 2), alt: '' }));

      const tools = h('div', { class: 'tools', role: 'toolbar', 'aria-label': 'Tools' },
        toolBtn('pencil', 'Pencil'), toolBtn('fill', 'Fill'), toolBtn('eraser', 'Eraser'),
        toolBtn('undo', 'Undo'), toolBtn('clear', 'Clear'));
      tools.querySelector('[data-tool=pencil]').classList.add('pressed');
      const undoBtn = tools.querySelector('[data-tool=undo]');
      undoBtn.disabled = true;

      // Cmd/Ctrl+Z on a laptop
      this.onKey = e => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      };
      document.addEventListener('keydown', this.onKey);

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
        onclick: () => (phase === 'locked' ? W.advance() : finish('done')),
      }), 'Done', 'draw-done');

      // Snap: the clock pauses while the camera window is open, and the
      // portrait lands on the canvas as one undoable step to paint over.
      const snapBtn = T.magButton(h('button', {
        class: 'big', disabled: true,
        onclick: () => {
          if (phase !== 'drawing') return;
          const openedAt = performance.now();
          const left = endsAt - openedAt;
          phase = 'camera';
          W.cameraPortrait.open({
            onDone: portrait => {
              if (phase !== 'camera') return;
              startedAt += performance.now() - openedAt; // camera time doesn't count
              endsAt = performance.now() + left;
              phase = 'drawing';
              if (portrait) {
                remember(cells.slice());
                cells.splice(0, cells.length, ...portrait);
                state.avatarSnapped = true; doneBtn.classList.add('ready');
                dirty = true;
              }
            },
          });
        },
      }), '📷 Snap', 'draw-snap');

      el.append(h('div', { class: 'stack draw-stack' },
        h('div', { class: 'draw-head' },
          T.ransom('Draw yourself', 34, 'Draw yourself'),
          T.sticker(`${SECONDS} seconds`, 5)),
        T.human('draw your face. it goes on your Type Card.'),
        h('div', { class: 'draw-area' }, tools, holder),
        h('div', { class: 'palette-bar' }, current, grid),
        h('div', { class: 'actions' }, h('div', { class: 'row' }, snapBtn, doneBtn)),
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
        if (cells[i] === v) return;
        if (pending) { remember(pending); pending = null; doneBtn.classList.add('ready'); }
        cells[i] = v;
        dirty = true;
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
              const before = cells.slice();
              if (flood(cells, i, color)) { remember(before); dirty = true; strokes++; doneBtn.classList.add('ready'); }
              return;
            }
            pending = cells.slice();
            drawing = true;
            lastCell = i;
            paint(i);
          });
          cv.addEventListener('pointermove', e => {
            if (!drawing || phase !== 'drawing') return;
            const i = cellAt(e);
            if (i !== lastCell) { lineCells(lastCell, i).forEach(paint); lastCell = i; }
          });
          const up = () => { if (drawing) strokes++; drawing = false; pending = null; };
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
            p.fill(W.avatarColor(cells[i]));
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
        overlay.replaceChildren(h('div', { class: 'count-box' },
          T.ransom(String(n), 84, 'count' + n, { align: 'center', level: 2 }),
          h('p', { class: 'count-hint' }, 'Draw your face!')));
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
        snapBtn.disabled = false;
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
        undoBtn.disabled = true;
        snapBtn.disabled = true;
        W.setTimer(why === 'time' ? 0 : Math.max(0, (endsAt - performance.now()) / 1000));
        if (why === 'time') W.fx.shake();

        const used = startedAt ? Math.min(SECONDS, (performance.now() - startedAt) / 1000) : 0;

        // Nothing drawn? Hand them one of the default smileys.
        const empty = cells.every(c => c < 0);
        if (empty) cells.splice(0, cells.length, ...FACES[Math.floor(Math.random() * FACES.length)]);

        state.avatar = cells.slice();
        state.drawStats = {
          seconds: Math.round(used * 10) / 10,
          strokes,
          filled: cells.filter(c => c >= 0).length,
          colors: new Set(cells.filter(c => c >= 0)).size,
          ranOut: why === 'time',
          defaultFace: empty,
          snapped: !!state.avatarSnapped,
          undos,
        };

        // live room: wait here until the host starts the next round
        if (W.live.active) {
          W.sound.play(why === 'time' ? 'bonk' : 'ding');
          overlay.hidden = false;
          overlay.replaceChildren(T.sticker(empty ? "Here's a smile" : why === 'time' ? "Time's up" : 'Done!', -6));
          W.live.roundDone('draw', state.drawStats, { nextBtn: doneBtn });
          return;
        }

        if (empty) {
          W.sound.play(why === 'time' ? 'bonk' : 'ding');
          overlay.hidden = false;
          overlay.replaceChildren(T.sticker("Here's a smile", -6));
          doneBtn.classList.add('ready'); T.magButton(doneBtn, 'Next', 'draw-next');
        } else if (why === 'time') {
          W.sound.play('bonk');
          overlay.hidden = false;
          overlay.replaceChildren(T.sticker("Time's up", -8));
          doneBtn.classList.add('ready'); T.magButton(doneBtn, 'Next', 'draw-next');
        } else {
          W.sound.play('ding');
          W.next();
        }
      }
    },

    exit() {
      clearInterval(this.countTimer);
      W.cameraPortrait.close();
      document.removeEventListener('keydown', this.onKey);
      if (this.p5) { this.p5.remove(); this.p5 = null; }
      W.setTimer(null);
    },
  };
})();
