/* =========================================================
   voice-check.js · Challenge 1, "say hello" (p5.js + p5.sound)

   The mic moves the HELLO poster, its sliders and a Win95 level
   meter, then the reading becomes ONE discrete answer: introvert,
   ambivert or extrovert. Only that word reaches the quiz, stored
   like a button answer, so the same answers always give the same
   result. Then the 2 quick Energy questions. Audio never leaves
   this file.

   States:
     loading → ready → starting → room → listening → confirm → asking → done
     ready → tap → asking                (Tap instead, or Skip)
     starting / room / listening → tap   (denied, silence, noise)
     tap → starting                      (Try mic again)
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});

  /* ---------- thresholds (tune these first) ----------
     Levels are RMS from p5.Amplitude, 0..1. */
  const ROOM_MS = 600;            // listen to the room before asking for hello
  const LISTEN_MS = 2000;         // length of the hello recording
  const NOISY_FLOOR = 0.05;       // room louder than this: too noisy to judge
  const SILENCE_LEVEL = 0.012;    // below this a frame counts as nobody talking
  const SPEECH_OVER_FLOOR = 2;    // a speech frame is this many times the room level
  const MIN_SPEECH_SHARE = 0.15;  // need speech in this share of frames
  const LOUD_LEVEL = 0.08;        // average speech level at or above this: loud
  const MIN_VOICED_FRAMES = 6;    // too few pitch readings counts as flat
  const EXPRESSIVE_SEMITONES = 2; // pitch range at or above this: expressive
  const MIN_PITCH = 90, MAX_PITCH = 500; // Hz range searched for a voice
  const MIN_CLARITY = 0.6;        // how periodic a frame must be to have a pitch
  const NEAR_BEST = 0.9;          // prefer the shortest lag this close to the best
  const METER_FULL = 0.25;        // level that fills the meter
  const REST_QUIET = 250, REST_LOUD = 800;   // where Weight settles after the reading
  const REST_FLAT = 36, REST_EXPRESSIVE = 58; // where Size settles (px)

  const P5_SOUND = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.1/addons/p5.sound.min.js';

  /* ---------- measuring (no p5, so it's easy to test) ---------- */

  /* Pitch by autocorrelation: a voice repeats itself every period, so compare
     the wave with shifted copies of itself and find the shift that matches best.
     Returns Hz, or null if the frame isn't clearly voiced. */
  function estimatePitch(buf, sampleRate) {
    const minLag = Math.floor(sampleRate / MAX_PITCH);
    const maxLag = Math.min(Math.floor(sampleRate / MIN_PITCH), Math.floor(buf.length / 2));
    const scores = [];
    let best = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let shared = 0, a = 0, b = 0;
      for (let i = 0; i + lag < buf.length; i++) {
        shared += buf[i] * buf[i + lag];
        a += buf[i] * buf[i];
        b += buf[i + lag] * buf[i + lag];
      }
      const score = a && b ? shared / Math.sqrt(a * b) : 0; // -1..1, ignores volume
      scores.push(score);
      if (score > best) best = score;
    }
    if (best < MIN_CLARITY) return null;
    // A wave also matches itself at 2× its period, so take the first strong peak:
    // otherwise voices get read an octave too low.
    for (let k = 1; k < scores.length - 1; k++) {
      if (scores[k] >= best * NEAR_BEST && scores[k] >= scores[k - 1] && scores[k] >= scores[k + 1]) {
        return sampleRate / (minLag + k);
      }
    }
    return null;
  }

  /* How much the pitch moves, in semitones, from the 20th to 80th percentile.
     Movement rather than absolute pitch: how high a voice sits is mostly anatomy,
     and the percentiles shrug off the odd octave error. */
  function pitchMovement(pitches) {
    if (pitches.length < MIN_VOICED_FRAMES) return 0;
    const sorted = pitches.slice().sort((a, b) => a - b);
    const at = q => sorted[Math.floor((sorted.length - 1) * q)];
    return 12 * Math.log2(at(0.8) / at(0.2));
  }

  /* The whole 2×2: raw measurements in, discrete reading out. */
  function classify({ floor, levels, frames, pitches }) {
    if (floor >= NOISY_FLOOR) return { status: 'noisy' };
    if (!frames || levels.length / frames < MIN_SPEECH_SHARE) return { status: 'silence' };
    const average = levels.reduce((a, b) => a + b, 0) / levels.length;
    return {
      status: 'ok',
      loudness: average >= LOUD_LEVEL ? 'loud' : 'quiet',
      pitch: pitchMovement(pitches) >= EXPRESSIVE_SEMITONES ? 'expressive' : 'flat',
    };
  }

  // quiet + flat = introvert, loud + expressive = extrovert, mixed = ambivert
  function answerFor(loudness, pitch) {
    if (loudness === 'quiet' && pitch === 'flat') return 'introvert';
    if (loudness === 'loud' && pitch === 'expressive') return 'extrovert';
    return 'ambivert';
  }

  /* ---------- load p5.sound only when this screen opens ----------
     It hooks every new sketch, so solo and rooms never run it until here. */
  let soundLib = null;
  function loadSoundLib() {
    if (!soundLib) {
      soundLib = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = P5_SOUND;
        s.onload = resolve;
        s.onerror = () => { soundLib = null; reject(new Error('p5.sound failed to load')); };
        document.head.append(s);
      });
    }
    return soundLib;
  }

  const TAP_VIBES = [
    ['Quiet + low-key', { loudness: 'quiet', pitch: 'flat' }],
    ['Bit of both', { loudness: 'quiet', pitch: 'expressive' }],
    ['Loud + lively', { loudness: 'loud', pitch: 'expressive' }],
  ];
  const WHY_TAP = {
    denied: 'Mic is off. Tap your vibe:',
    silence: "Didn't catch that. Tap your vibe:",
    noisy: 'Too noisy in here. Tap your vibe:',
    unavailable: 'No mic check here. Tap your vibe:',
    choice: 'Tap your vibe:',
  };

  /* ---------- the screen ---------- */
  W.screens = W.screens || {};
  W.screens.hello = {
    enter(el, state) {
      const h = W.h, T = W.type;
      const self = this;
      const token = (this.token = {});
      let phase = 'loading';
      let mic = null, amp = null, fft = null, sketch = null;
      let phaseAt = 0, floorLevels = [], levels = [], frames = 0, pitches = [];
      let shownLevel = 0, weight = 300, size = 40; // eased values for the poster
      let targetSize = 40, restWeight = null;

      const holder = h('div', { class: 'vibe-canvas' });
      const status = h('p', { class: 'chal-hint vibe-status', 'aria-live': 'polite' }, 'Warming up the mic...');
      const slider = label => {
        const input = h('input', { type: 'range', min: 0, max: 100, value: 30, disabled: true, 'aria-label': label });
        return { input, row: h('label', { class: 'slider-row' }, h('span', { class: 'label' }, label), input) };
      };
      const wt = slider('Weight'), sz = slider('Size');
      const actions = h('div', { class: 'actions' });
      const reveal = h('div', { class: 'chal-reveal', hidden: true });

      el.append(h('div', { class: 'stack chal-stack' },
        T.sticker('Challenge 1/5 · vibe check', -4),
        T.ransom('Say hello', 30, 'say hello'),
        T.human('we guess your energy. purely for fun.'),
        h('div', { class: 'window chal-win' },
          h('div', { class: 'title-bar' }, h('div', { class: 'title-bar-text' }, 'Sound Recorder')),
          h('div', { class: 'window-body chal-body' }, status,
            h('div', { class: 'chal-wrap' }, h('div', { class: 'chal-stage' }, holder, wt.row, sz.row), reveal))),
        actions));

      /* every choice lives in the pinned bar, so nothing can hide off screen */
      function setActions(...list) {
        actions.replaceChildren(...list.map(row => h('div', { class: 'row' }, row.map(([label, fn, attrs]) =>
          T.magButton(h('button', { class: 'big', onclick: fn, ...attrs }), label, 'vibe' + label)))));
      }
      const say = text => { status.textContent = text; };

      function stopMic() {
        if (mic) { try { mic.stop(); } catch (e) { /* already stopped */ } }
        mic = null;
      }

      function showReady() {
        phase = 'ready';
        say('Say hello. Watch it react.');
        setActions([['Tap instead', () => showTap('choice'), { 'data-vibe': 'tap' }], ['🎤 Say hello', startMic, { 'data-vibe': 'mic', class: 'big ready' }]]);
      }

      function showTap(why) {
        stopMic();
        phase = 'tap';
        say(WHY_TAP[why]);
        const again = why !== 'choice' && why !== 'unavailable'
          ? [['Try mic again', startMic, { 'data-vibe': 'retry' }]] : [];
        setActions(
          ...TAP_VIBES.map(([label, read]) => [[label, () => finish({ ...read, source: 'tap' }), { 'data-vibe': 'pick' }]]),
          [...again, ['Skip', () => finish(null), { 'data-vibe': 'skip' }]]);
      }

      function startMic() {
        if (!sketch) return showTap('unavailable');
        phase = 'starting';
        restWeight = null;
        say('Allow the mic...');
        setActions([['Tap instead', () => showTap('choice'), { 'data-vibe': 'tap' }]]);
        try {
          // iOS: audio must start inside this tap. userStartAudio() only waits for
          // the next tap, so resume the context here as well.
          sketch.userStartAudio();
          sketch.getAudioContext().resume();
          mic = new p5.AudioIn();
          amp = new p5.Amplitude();
          fft = new p5.FFT(0, 1024);
          const current = mic;
          mic.start(() => {
            if (self.token !== token || current !== mic || phase !== 'starting') return;
            amp.setInput(mic);
            fft.setInput(mic);
            floorLevels = []; levels = []; pitches = []; frames = 0;
            phase = 'room';
            phaseAt = performance.now();
            say('Shh. Checking the room...');
          }, () => { if (self.token === token && current === mic) showTap('denied'); });
        } catch (e) {
          showTap('denied'); // no mic support at all, or not on https
        }
      }

      function endListening() {
        const floor = floorLevels.reduce((a, b) => a + b, 0) / (floorLevels.length || 1);
        stopMic();
        const read = classify({ floor, levels, frames, pitches });
        if (read.status !== 'ok') return showTap(read.status);
        settle(read);
        confirm(read);
      }

      // Rest the sliders where this reading belongs: the player never drags them.
      function settle(read) {
        restWeight = read.loudness === 'loud' ? REST_LOUD : REST_QUIET;
        targetSize = read.pitch === 'expressive' ? REST_EXPRESSIVE : REST_FLAT;
      }

      // Show the reading and let them fix it: noisy rooms and misreads happen.
      function confirm(read) {
        phase = 'confirm';
        W.sound.play('ding');
        const other = read.loudness === 'loud' ? 'quiet' : 'loud';
        say(`Sounds like: ${read.loudness} & ${read.pitch}. That right?`);
        setActions([
          [`Nah, I'm ${other}`, () => finish({ loudness: other, pitch: read.pitch, source: 'override' }), { 'data-vibe': 'nah' }],
          ['Yep', () => finish({ loudness: read.loudness, pitch: read.pitch, source: 'mic' }), { 'data-vibe': 'yep', class: 'big ready' }],
        ]);
      }

      // Store the one discrete answer, then the 2 questions. null means skipped.
      function finish(read) {
        phase = 'asking';
        stopMic();
        if (read) {
          state.results.voice = { ...read, answer: answerFor(read.loudness, read.pitch) };
          settle(read);
          W.sound.play('ding');
        } else {
          delete state.results.voice;
        }
        say(read ? `Noted: ${state.results.voice.answer} energy.` : 'Skipped. No judgement.');
        const Q = W.quickQuestions, ask = (self.ask = Q.sheet());
        setActions([['Answer the question', () => Q.nudge(ask), { 'data-vibe': 'answer' }]]);
        Q.ask(ask, state, 0, false, answers => complete(read, answers));
      }

      // Same shape as every other challenge: the voice is the "challenge" half.
      // Skipped? The two questions decide on their own.
      function complete(read, answers) {
        phase = 'done';
        const voice = read ? state.results.voice.answer : null;
        const part = read ? W.VOICE_VALUE[voice] : (answers[0] + answers[1]) / 2;
        const trait = Math.round(W.traitScore(part, answers) * 100) / 100;
        const result = { part, answers, trait, voice, source: read ? read.source : 'skip' };
        state.results[1] = result;

        const word = W.traitWord(0, trait);
        reveal.replaceChildren(
          T.label(W.TRAITS[0].name),
          T.ransom(word, 52, 'reveal1' + word, { align: 'center', level: 2 }),
          W.spectrum(0, trait),
          T.human(W.traitLine(0, trait)));
        reveal.hidden = false;
        const next = T.magButton(h('button', { class: 'big ready', 'data-sfx': 'none', onclick: () => W.advance() }), 'Next', 'vibe-next');
        actions.replaceChildren(next);
        W.sound.play('ding');
        W.live.roundDone('hello', result, { nextBtn: next, reveal }); // live room: the host moves us on
      }

      /* ----- p5: the poster and the meter ----- */
      function makeSketch() {
        new p5(p => {
          sketch = p;
          const CW = 300, CH = 150, POSTER = 110;
          p.setup = () => {
            p.createCanvas(CW, CH).parent(holder);
            p.frameRate(30);
            if (self.token === token && phase === 'loading') showReady();
          };
          p.draw = () => {
            let level = 0;
            if ((phase === 'room' || phase === 'listening') && amp) level = amp.getLevel();

            if (phase === 'room') {
              floorLevels.push(level);
              if (performance.now() - phaseAt >= ROOM_MS) {
                phase = 'listening';
                phaseAt = performance.now();
                say('Now say hello!');
              }
            } else if (phase === 'listening') {
              frames++;
              const floor = floorLevels.reduce((a, b) => a + b, 0) / (floorLevels.length || 1);
              if (level >= Math.max(SILENCE_LEVEL, floor * SPEECH_OVER_FLOOR)) {
                levels.push(level);
                const pitch = estimatePitch(fft.waveform(), p.sampleRate());
                if (pitch) {
                  pitches.push(pitch);
                  // higher voice, bigger letters: 100-300 Hz across the size range
                  targetSize = 26 + 40 * Math.max(0, Math.min(1, Math.log2(pitch / 100) / Math.log2(3)));
                }
              }
              if (performance.now() - phaseAt >= LISTEN_MS) endListening();
            }

            // ease everything so the poster breathes instead of jittering
            shownLevel = p.lerp(shownLevel, Math.min(1, level / METER_FULL), 0.35);
            const live = phase === 'room' || phase === 'listening';
            if (live || restWeight !== null) {
              weight = p.lerp(weight, live ? 100 + 800 * shownLevel : restWeight, live ? 0.3 : 0.12);
              size = p.lerp(size, targetSize, live ? 0.2 : 0.12);
              wt.input.value = ((weight - 100) / 8).toFixed(0);
              sz.input.value = (((size - 26) / 40) * 100).toFixed(0);
            }

            p.background('#f3ead3');
            const ctx = p.drawingContext;
            ctx.font = `${Math.round(weight / 10) * 10} ${size.toFixed(1)}px "Work Sans", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#111111';
            ctx.fillText('HELLO', CW / 2, POSTER / 2);

            // Win95 level meter: a sunken track with chunky blocks
            p.noStroke();
            p.fill('#808080'); p.rect(0, POSTER, CW, CH - POSTER);
            p.fill('#ffffff'); p.rect(6, POSTER + 8, CW - 12, CH - POSTER - 16);
            const blocks = 24, bw = (CW - 20) / blocks;
            const lit = Math.round(shownLevel * blocks);
            for (let i = 0; i < lit; i++) {
              p.fill(i > blocks * 0.8 ? '#e8402a' : '#000080');
              p.rect(10 + i * bw, POSTER + 12, bw - 2, CH - POSTER - 24);
            }
          };
        }, holder);
        self.p5 = sketch;
      }

      // Buttons work straight away; the mic option appears once p5.sound is ready.
      setActions([['Tap instead', () => showTap('choice'), { 'data-vibe': 'tap' }]]);
      Promise.all([loadSoundLib(), document.fonts.load('400 40px "Work Sans"').catch(() => null)])
        .then(() => { if (self.token === token) makeSketch(); })
        .catch(() => { if (self.token === token && phase === 'loading') showTap('unavailable'); });

      this.stop = stopMic;
    },

    exit() {
      this.token = null;
      if (this.stop) this.stop();
      if (this.ask) { this.ask.remove(); this.ask = null; }
      if (this.p5) { this.p5.remove(); this.p5 = null; }
    },
  };

  W.voiceCheck = { _test: { estimatePitch, pitchMovement, classify, answerFor } };
})();
