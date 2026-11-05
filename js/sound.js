/* =========================================================
   sound.js · Web Audio synth sounds (no audio files)

   WYT.sound.play('chime' | 'click' | 'tick' | 'ding' | 'bonk' | 'levelup')
   WYT.sound.unlock()      call on a tap (browsers block audio until then)
   WYT.sound.setMuted(b)   mute toggle, remembered on this device

   How it works: every sound is built from oscillators (pure tones:
   sine, triangle, square) shaped by a volume envelope, so it fades
   in and out instead of clicking. Everything runs through one
   master volume knob, which is what mute turns down.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});

  const VOLUME = 0.45;
  let ctx = null, master = null, echo = null;
  let muted = false;
  try { muted = localStorage.getItem('wyt-muted') === '1'; } catch (e) { /* private mode */ }

  /* ---------- setup (on the first tap) ---------- */
  function unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      master.connect(ctx.destination);

      // a soft echo, used by the chime and ding for a dreamy tail
      echo = ctx.createDelay();
      echo.delayTime.value = 0.16;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.28;
      const wet = ctx.createGain();
      wet.gain.value = 0.35;
      echo.connect(feedback).connect(echo);
      echo.connect(wet).connect(master);

      // iPhone needs a sound to actually start during the tap
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  /* ---------- building block: one note ----------
     freq      pitch in Hz
     at        start, seconds from now
     dur       length in seconds
     type      'sine' | 'triangle' | 'square' | 'sawtooth'
     vol       loudness 0..1
     slide     pitch to glide to by the end (optional)
     wet       also send to the echo
     cutoff    low-pass filter Hz, softens square waves (optional) */
  function note({ freq, at = 0, dur = 0.2, type = 'sine', vol = 0.5, slide, wet = false, cutoff }) {
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t0 + dur);

    // envelope: quick fade in, smooth fade out
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.012, dur / 4));
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    let out = osc.connect(amp);
    if (cutoff) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = cutoff;
      out = amp.connect(lp);
    }
    out.connect(master);
    if (wet) out.connect(echo);

    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // note name → Hz, e.g. hz('C5')
  const SEMI = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  function hz(name) {
    const m = /^([A-G])(#?)(\d)$/.exec(name);
    const n = SEMI[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12;
    return 440 * 2 ** (n / 12);
  }

  /* ---------- the sounds ---------- */
  const SOUNDS = {
    // Boot: a 3-note rising arpeggio, the last note rings out
    chime() {
      ['C5', 'E5', 'G5'].forEach((n, i) => {
        const last = i === 2;
        note({ freq: hz(n), at: i * 0.13, dur: last ? 1.4 : 0.5, type: 'triangle', vol: 0.4, wet: true });
        note({ freq: hz(n) * 2, at: i * 0.13, dur: last ? 1.0 : 0.3, type: 'sine', vol: 0.12, wet: true });
      });
      note({ freq: hz('C4'), at: 0.26, dur: 1.4, type: 'sine', vol: 0.18 }); // warm low note under it
    },

    // Button press: a tiny, dry blip
    click() {
      note({ freq: 1900, dur: 0.035, type: 'square', vol: 0.12, cutoff: 3500 });
      note({ freq: 900, dur: 0.03, type: 'sine', vol: 0.15 });
    },

    // Last 3 seconds of a timer: woodblock tock
    tick() {
      note({ freq: 1250, dur: 0.07, type: 'sine', vol: 0.45, slide: 1000 });
      note({ freq: 2500, dur: 0.03, type: 'triangle', vol: 0.12 });
    },

    // Challenge done: two-note bell
    ding() {
      note({ freq: hz('B5'), dur: 0.35, type: 'sine', vol: 0.35, wet: true });
      note({ freq: hz('E6'), at: 0.09, dur: 0.9, type: 'sine', vol: 0.4, wet: true });
      note({ freq: hz('E6') * 2.76, at: 0.09, dur: 0.25, type: 'sine', vol: 0.07 }); // bell shimmer
    },

    // Time's up / not allowed: low, grumpy and sliding down
    bonk() {
      note({ freq: 190, dur: 0.28, type: 'square', vol: 0.3, slide: 85, cutoff: 900 });
      note({ freq: 95, dur: 0.3, type: 'triangle', vol: 0.4, slide: 55 });
    },

    // Type Card reveal: a quick chiptune climb and a bright final chord
    levelup() {
      ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => {
        note({ freq: hz(n), at: i * 0.065, dur: 0.12, type: 'square', vol: 0.18, cutoff: 4200 });
      });
      ['C6', 'E6', 'G6'].forEach(n => {
        note({ freq: hz(n), at: 0.42, dur: 0.7, type: 'square', vol: 0.12, cutoff: 3800, wet: true });
      });
      note({ freq: hz('C4'), at: 0.42, dur: 0.7, type: 'triangle', vol: 0.3 });
    },
  };

  W.sound = {
    get muted() { return muted; },
    get ready() { return !!ctx && ctx.state === 'running'; },
    names: Object.keys(SOUNDS),
    unlock,
    setMuted(value) {
      muted = !!value;
      try { localStorage.setItem('wyt-muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
      if (master) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ctx.currentTime, 0.02);
    },
    play(name) {
      if (muted || !ctx || !SOUNDS[name]) return;
      if (ctx.state === 'suspended') ctx.resume();
      try { SOUNDS[name](); } catch (e) { console.warn('sound failed:', name, e); } // never break the game
    },
  };
})();
