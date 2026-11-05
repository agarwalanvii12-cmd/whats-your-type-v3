/* =========================================================
   sound.js · Web Audio synth sounds (built in step 2)
   For now: just the mute state, saved on this device.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});

  let muted = false;
  try { muted = localStorage.getItem('wyt-muted') === '1'; } catch (e) { /* private mode */ }

  W.sound = {
    get muted() { return muted; },
    setMuted(value) {
      muted = !!value;
      try { localStorage.setItem('wyt-muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
    },
    // Step 2: create the AudioContext on the first tap
    unlock() {},
    // Step 2: 'chime' | 'click' | 'tick' | 'ding' | 'bonk' | 'levelup'
    play(name) {},
  };
})();
