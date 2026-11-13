/* =========================================================
   ai.js · AI write-ups (via our own /api/ai function)

   The browser never holds an API key. It asks /api/ai (a Vercel
   function that keeps the key secret) for:
     reading(name, result)   Remi's reading: 3 Gen Z sentences that guess
                             your personality from what you actually did
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

  /* ---------- clues: what you actually did, in small checked pieces ----------
     Only enums, numbers and the quick-answer words you tapped. The server
     checks every field again. Never the photo, the audio or your drawing. */
  function cluesFrom(state) {
    const r = state.results, d = state.drawStats || {};
    const said = Object.values(r.said || {}).flat().slice(0, 10);
    return {
      portrait: d.snapped ? 'snapped' : d.defaultFace ? 'default' : d.strokes != null ? 'drew' : null,
      strokes: d.strokes, colours: d.colors, ranOutDrawing: !!d.ranOut,
      voice: r.voice ? `${r.voice.loudness} ${r.voice.pitch}` : null,
      voiceHow: r.voice ? r.voice.source : r[1] ? 'skip' : null,
      readOrder: r[2] && r[2].roles,
      retro: r[3] && r[3].picks,
      gapStyle: r[4] && r[4].style, gapSeconds: r[4] && r[4].spent, gapMoves: r[4] && r[4].moves,
      typeSpeed: r[5] && r[5].speed, backspaces: r[5] && r[5].backspaces,
      timeouts: [2, 3, 4, 5].filter(i => r[i] && r[i].timedOut).length,
      said,
    };
  }

  /* ---------- our own reading, when the AI can't answer ----------
     Same idea in templates: two of your most telling moves, then a font tip.
     The order below is how telling each clue is. */
  const RETRO = ['Floppy', 'Serif', 'CRT', 'Film', '1998'];
  function localReading(name, result, c) {
    const lines = [];
    const add = (when, text) => { if (when && lines.length < 2) lines.push(text); };
    const retro = (c.retro || []).filter(p => RETRO.includes(p)).length;
    const said = c.said[c.said.length - 1];
    add(c.gapStyle === 'obsessed', `you spent ${c.gapSeconds}s on two gaps, detail-obsessed and honestly? respect.`);
    add(c.gapStyle === 'eyeballed', 'you shipped that sign without blinking, big picture energy, no notes.');
    add(c.readOrder && c.readOrder[0] === 'details', 'putting the fine print first is a choice and you made it with your chest.');
    add(c.portrait === 'snapped', 'you skipped the drawing and went straight for the selfie, main character move.');
    add(c.backspaces >= 3, `${c.backspaces} backspaces on your own name? the perfectionism is showing.`);
    add(c.typeSpeed >= 3 && c.backspaces === 0, `${c.typeSpeed} keys a second, zero typos, you type like the deadline is in 5 minutes.`);
    add(c.retro && retro >= 4, `you picked the old stuff ${retro} times out of 5, living in 1998 and it's working.`);
    add(c.retro && c.retro.length >= 3 && retro <= 1, 'you picked the future almost every time, early adopter behaviour.');
    add(c.voice === 'loud expressive', 'that hello was LOUD, the whole studio heard you arrive.');
    add(c.voice === 'quiet flat', 'that hello was a whisper, mysterious and we see you.');
    add(c.colours >= 6, `${c.colours} colours on one tiny face, maximalist and we love to see it.`);
    add(c.timeouts >= 2, `you let the clock run out ${c.timeouts} times, time is a construct apparently.`);
    add(said, `you really said "${said && said.a}" with your whole chest.`);
    // never empty: fall back to your strongest trait
    if (!lines.length) {
      const s = result.traits.map((v, i) => ({ i, v, pull: Math.abs(v - 0.5) })).sort((a, b) => b.pull - a.pull)[0];
      lines.push(W.traitLine(s.i, s.v).toLowerCase());
    }
    const [head, , body] = result.top3.map(f => f.font);
    return `${name}, ${lines.join(' Also, ')} ` +
      `Your move: ${head} for headlines, ${body} for body text, and let ${result.pair.font} crash the party.`;
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
      const clues = cluesFrom(W.state);
      const text = await ask({
        kind: 'reading', name, traits: result.traits, type: result.type.name,
        fonts: result.top3.map(f => f.font), pair: result.pair.font,
        palette: W.type.palette().name, clues,
      });
      return text ? { text, ai: true } : { text: localReading(name, result, clues), ai: false };
    },
    _test: { cluesFrom, localReading },
    async compat(me, them, score) {
      const person = p => ({ name: p.name, traits: p.traits, type: W.resultFor(p.traits).type.name });
      const text = await ask({ kind: 'compat', a: person(me), b: person(them), score });
      return text ? { text, ai: true } : null;
    },
  };
})();
