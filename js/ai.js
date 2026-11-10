/* =========================================================
   ai.js · AI write-ups (via our own /api/ai function)

   The browser never holds an API key. It asks /api/ai (a Vercel
   function that keeps the key secret) for:
     reading(name, result)   a 2-sentence personality reading
     compat(me, them, score) a line on how two people would work together
   If there's no answer in time (offline, local testing, no key set),
   we write our own line from the traits, so the game never waits on AI.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});
  const TIMEOUT = 10000;

  async function ask(payload) {
    if (location.protocol === 'file:') return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      const r = await fetch('api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (!r.ok) return null;
      const j = await r.json();
      return typeof j.text === 'string' && j.text.trim() ? j.text.trim() : null;
    } catch (e) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* our own reading: your two strongest traits + your type's line */
  function localReading(name, result) {
    const strongest = result.traits
      .map((v, i) => ({ i, v, pull: Math.abs(v - 0.5) }))
      .sort((a, b) => b.pull - a.pull)
      .slice(0, 2);
    const lines = strongest.map(s => cap(W.traitLine(s.i, s.v)));
    return `${name}, ${lines[0].charAt(0).toLowerCase() + lines[0].slice(1)} ${lines[1]} ` +
      `Set headlines in ${result.top3[0].font} and body text in ${result.top3[2].font}.`;
  }

  // check AI questions: 5 traits × 2 × [question, low answer, high answer], short strings
  function validQuestions(qs) {
    const ok = s => typeof s === 'string' && s.trim().length > 0 && s.length <= 60;
    return Array.isArray(qs) && qs.length === 5 &&
      qs.every(pair => Array.isArray(pair) && pair.length === 2 &&
        pair.every(q => Array.isArray(q) && q.length === 3 && q.every(ok)));
  }

  W.ai = {
    /* Ask for a fresh, Gen Z-flavoured question set at the start of a game.
       If it arrives before a challenge's questions, those are used. */
    prepareQuestions(state) {
      const game = state.results; // only use answers for the game that asked
      ask({ kind: 'questions' }).then(text => {
        if (!text || state.results !== game) return;
        try {
          const qs = JSON.parse(text).questions;
          if (validQuestions(qs)) state.aiQuestions = qs;
        } catch (e) { /* keep the pool */ }
      });
    },

    /* → { text, ai: true/false } */
    async reading(name, result) {
      const text = await ask({
        kind: 'reading', name, traits: result.traits, type: result.type.name,
        fonts: result.top3.map(f => f.font), pair: result.pair.font,
        palette: W.type.palette().name,
        voice: W.state.results.voice ? W.state.results.voice.answer : null,
        kern: W.state.results[4] ? W.state.results[4].style : null,
      });
      return text ? { text, ai: true } : { text: localReading(name, result), ai: false };
    },
    async compat(me, them, score) {
      const person = p => ({ name: p.name, traits: p.traits, type: W.resultFor(p.traits).type.name });
      const text = await ask({ kind: 'compat', a: person(me), b: person(them), score });
      return text ? { text, ai: true } : null;
    },
  };
})();
