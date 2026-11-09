/* =========================================================
   camera-portrait.js · turn a webcam snap into pixel art

   Opens a Win95 camera window over the drawing screen (p5.js),
   and hands the drawing screen a 24×24 grid of avatar colours.

   States:
     requesting → preview → countdown → captured → done
     captured → requesting   (Retake)
     any → error → done      (no camera: draw instead)
     any → done              (Cancel)

   Privacy: the photo only ever exists in this browser tab. The
   stream stops the moment the snap is taken, and only the small
   grid of colour numbers leaves this file.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});

  const GRID = 24;             // portrait size in cells, same as the drawing
  const SAMPLES = 4;           // each cell averages SAMPLES × SAMPLES pixels
  const VIEW = 264;            // canvas size (11px per cell)
  const COUNT_MS = 800;        // one beat of the 3-2-1
  const START_TIMEOUT = 15000; // give up if the camera never starts
  const MIN_CONTRAST = 24;     // don't stretch a nearly flat image
  const BLACK_POINT = 16;      // stretch into this range, so skin doesn't blow out
  const WHITE_POINT = 225;     // to pure white and lose the eyes
  const VIDEO = { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } };

  /* ---------- pixel maths (no p5, so it's easy to test) ---------- */

  // Average each cell of a square RGBA buffer down to one [r, g, b].
  function sampleGrid(pixels, size) {
    const step = size / GRID, out = [];
    for (let cy = 0; cy < GRID; cy++) {
      for (let cx = 0; cx < GRID; cx++) {
        const sum = [0, 0, 0];
        let n = 0;
        for (let y = Math.floor(cy * step); y < Math.floor((cy + 1) * step); y++) {
          for (let x = Math.floor(cx * step); x < Math.floor((cx + 1) * step); x++) {
            const i = (y * size + x) * 4;
            sum[0] += pixels[i]; sum[1] += pixels[i + 1]; sum[2] += pixels[i + 2];
            n++;
          }
        }
        out.push(sum.map(v => v / n));
      }
    }
    return out;
  }

  // Spread brightness across the full range. Palettes only have 8-16 colours, so
  // a dim webcam frame would otherwise collapse into two or three of them.
  // Uses the 5th-95th percentile so one bright window can't flatten the face.
  function stretch(cells) {
    const luma = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    const sorted = cells.map(luma).sort((a, b) => a - b);
    const lo = sorted[Math.floor(sorted.length * 0.05)];
    const hi = sorted[Math.floor(sorted.length * 0.95)];
    if (hi - lo < MIN_CONTRAST) return cells;
    return cells.map(c => c.map(v => Math.max(0, Math.min(255, BLACK_POINT + ((v - lo) * (WHITE_POINT - BLACK_POINT)) / (hi - lo)))));
  }

  // Colour distance weighted for how eyes see ("redmean"): closer to what looks
  // similar than plain RGB distance, and cheap enough for 576 cells.
  function colourDistance(a, b) {
    const rMean = (a[0] + b[0]) / 2;
    const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    return (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db;
  }

  // Each cell → position of its nearest colour in the palette.
  function quantise(cells, paletteHex) {
    const rgb = paletteHex.map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
    return cells.map(c => {
      let best = 0, bestD = Infinity;
      rgb.forEach((p, i) => {
        const d = colourDistance(c, p);
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    });
  }

  /* ---------- the camera window ---------- */
  let open_ = null; // the window that's open, if any

  function open({ onDone }) {
    if (open_) return;
    const h = W.h, T = W.type;
    const paletteHex = T.palette().colors;
    let phase = 'requesting';
    let sketch = null, capture = null, preflight = null, watchdog = 0, countTimer = 0;
    let grid = null;       // the captured grid (avatar colour numbers)
    let attempt = 0;       // ignores a camera that arrives after Cancel or Retake

    const holder = h('div', { class: 'cam-view' });
    const overlay = h('div', { class: 'cam-overlay' });
    const status = h('p', { class: 'label cam-status', 'aria-live': 'polite' });
    const buttons = h('div', { class: 'row cam-buttons' });
    const body = h('div', { class: 'window-body cam-body' }, holder, status, buttons);
    holder.append(overlay);
    const modal = h('div', { class: 'cam-modal' },
      h('div', { class: 'window cam-win', role: 'dialog', 'aria-label': 'Camera' },
        h('div', { class: 'title-bar' },
          h('div', { class: 'title-bar-text' }, 'Snap yourself - Camera'),
          h('div', { class: 'title-bar-controls' }, h('button', { 'aria-label': 'Close', onclick: () => finish(null) }))),
        body));
    document.body.append(modal);

    const setButtons = (...list) => buttons.replaceChildren(...list.map(([label, fn, big]) =>
      h('button', { class: big ? 'big' : '', onclick: fn }, label)));

    const stopTracks = s => { if (s) s.getTracks().forEach(t => t.stop()); };
    function stopCamera() {
      clearTimeout(watchdog);
      stopTracks(preflight);
      preflight = null;
      if (capture) {
        stopTracks(capture.elt.srcObject);
        capture.remove();
        capture = null;
      }
    }

    function finish(result) {
      if (!open_) return;
      attempt++;
      clearInterval(countTimer);
      stopCamera();
      if (sketch) sketch.remove();
      modal.remove();
      open_ = null;
      if (onDone) onDone(result);
    }

    function fail(reason) {
      stopCamera();
      phase = 'error';
      const blocked = reason === 'NotAllowedError' || reason === 'SecurityError';
      body.replaceChildren(
        h('div', { class: 'cam-error' },
          h('img', { src: W.iconURL('error', 3), alt: '', class: 'pixel' }),
          h('p', {}, blocked ? 'Camera blocked. Draw yourself instead?' : 'Camera not found. Draw yourself instead?')),
        h('div', { class: 'row cam-buttons' }, h('button', { class: 'big', onclick: () => finish(null) }, 'Draw')));
      W.sound.play('bonk');
    }

    async function start() {
      const mine = ++attempt;
      grid = null;
      phase = 'requesting';
      overlay.replaceChildren();
      status.textContent = 'Allow the camera to snap';
      setButtons(['Cancel', () => finish(null)]);
      sketch.smooth();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return fail('NotFoundError');
      try {
        // p5's createCapture has no failure callback, so ask once here to catch
        // "denied" and "no camera". Held open until p5's own stream is running,
        // so the browser doesn't prompt twice.
        preflight = await navigator.mediaDevices.getUserMedia({ video: VIDEO, audio: false });
      } catch (e) {
        if (mine === attempt) fail(e.name);
        return;
      }
      if (mine !== attempt) { stopTracks(preflight); preflight = null; return; } // cancelled while asking

      watchdog = setTimeout(() => { if (mine === attempt) fail('NotFoundError'); }, START_TIMEOUT);
      capture = sketch.createCapture({ video: VIDEO, audio: false }, () => {
        if (mine !== attempt) return;
        clearTimeout(watchdog);
        stopTracks(preflight);
        preflight = null;
        phase = 'preview';
        status.textContent = `Palette: ${T.palette().name}`;
        setButtons(['Cancel', () => finish(null)], ['Snap', beginCount, true]);
      });
      capture.hide();
    }

    function beginCount() {
      if (phase !== 'preview') return;
      phase = 'countdown';
      setButtons();
      let n = 3;
      const show = () => {
        overlay.replaceChildren(T.ransom(String(n), 84, 'cam' + n, { align: 'center', level: 2 }));
        W.sound.play('tick');
      };
      show();
      countTimer = setInterval(() => {
        n--;
        if (n > 0) { show(); return; }
        clearInterval(countTimer);
        overlay.replaceChildren();
        takeSnap();
      }, COUNT_MS);
    }

    // The centred square of the video, as source coordinates.
    function crop() {
      const vw = capture.elt.videoWidth, vh = capture.elt.videoHeight, side = Math.min(vw, vh);
      return { sx: (vw - side) / 2, sy: (vh - side) / 2, side };
    }

    function takeSnap() {
      const size = GRID * SAMPLES, { sx, sy, side } = crop();
      const g = sketch.createGraphics(size, size);
      g.pixelDensity(1);
      g.translate(size, 0);
      g.scale(-1, 1);          // mirrored, to match the preview they just saw
      g.image(capture, 0, 0, size, size, sx, sy, side, side);
      g.loadPixels();
      const cells = stretch(sampleGrid(g.pixels, size));
      g.remove();
      stopCamera();            // the camera goes off the moment the snap is taken

      grid = quantise(cells, paletteHex).map(i => W.avatarColorIndex(paletteHex[i]));
      phase = 'captured';
      sketch.noSmooth();
      W.sound.play('ding');
      status.textContent = 'Paint over it after';
      setButtons(['Retake', start], ['Use it', () => finish(grid), true]);
    }

    new p5(p => {
      sketch = p; // p5 can run setup() before new p5() returns
      p.setup = () => {
        p.pixelDensity(2);
        p.createCanvas(VIEW, VIEW).parent(holder);
        p.frameRate(30);
        start();
      };
      p.draw = () => {
        p.background(0);
        if (phase === 'captured' && grid) {
          // crisp blocks, the same size the drawing canvas will show them
          const cell = VIEW / GRID;
          p.noStroke();
          grid.forEach((c, i) => {
            p.fill(W.avatarColor(c));
            p.rect((i % GRID) * cell, Math.floor(i / GRID) * cell, cell + 0.5, cell + 0.5);
          });
        } else if ((phase === 'preview' || phase === 'countdown') && capture && capture.elt.videoWidth) {
          const { sx, sy, side } = crop();
          p.push();
          p.translate(VIEW, 0);
          p.scale(-1, 1);        // mirror, so it behaves like a mirror
          p.image(capture, 0, 0, VIEW, VIEW, sx, sy, side, side);
          p.pop();
        }
      };
    }, holder);

    open_ = { finish };
  }

  W.cameraPortrait = {
    open,
    // leaving the screen: shut the camera without reporting a result
    close() { if (open_) open_.finish(null); },
    _test: { sampleGrid, stretch, quantise },
  };
})();
