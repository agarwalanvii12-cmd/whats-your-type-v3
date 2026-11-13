/* =========================================================
   api/ai.js · Vercel serverless function for the AI write-ups

   The OpenAI key lives ONLY here, as a Vercel environment
   variable (OPENAI_API_KEY). It is never in the repo and never
   reaches the browser.

   The browser can't send its own prompt: it sends small,
   checked data (name, 5 numbers, font names from our list) and
   this file builds the prompt. So nobody can use it as a free
   general-purpose AI.

   POST /api/ai
     { kind: 'questions' }                    → 10 fresh this-or-that questions
     { kind: 'reading', name, traits[5], type, fonts[3], pair, palette, clues }
     { kind: 'compat',  a: {name, traits, type}, b: {...}, score }
   → { text }   (for 'questions', text is JSON: { questions: [...] })
   ========================================================= */

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const LIMIT = 30;                   // requests per person...
const WINDOW_MS = 10 * 60 * 1000;   // ...per 10 minutes

const TRAITS = [
  ['Introvert', 'Extrovert'], ['Free spirit', 'Planner'], ['Futurist', 'Nostalgic'],
  ['Big picture', 'Detail-obsessed'], ['Slow burner', 'Fast mover'],
];
const PALETTES = ['Pop', 'Pastel', 'Complementary', 'Sunset', 'Triadic', 'Monochrome', 'Paint 95'];
// the rapid-fire options, so only real picks get through
const PICKS = ['Floppy', 'Cloud', 'Serif', 'Sans', 'CRT', 'OLED', 'Film', 'Digital', '1998', '2026'];
const GAP_STYLES = new Map([ // measured in the browser by how long they kept adjusting
  ['eyeballed', 'eyeballed it and shipped it'],
  ['balanced', 'tidied the gaps at a steady pace'],
  ['obsessed', 'obsessed over every single gap'],
]);
const FONTS = [
  'Playfair Display', 'Press Start 2P', 'Archivo Black', 'Anton', 'Monoton', 'Silkscreen',
  'Unbounded', 'Rubik Glitch', 'EB Garamond', 'Special Elite', 'Work Sans', 'VT323',
  'Josefin Sans', 'Caveat', 'Space Grotesk', 'Comfortaa', 'Space Mono', 'Instrument Serif',
];
const TYPES = [
  'The Editor-in-Chief', 'The Arcade Kid', 'The Swiss Machine', 'The Billboard Brat', 'The Neon Sign',
  'The Pixel Punk', 'The Future Shaper', 'The Chaos Engine', 'The Old Soul', 'The Typewriter Poet',
  'The Quiet Modernist', 'The Terminal Dreamer', 'The Art Deco Ghost', 'The Scrapbook Heart',
  'The Soft Futurist', 'The Cloud Doodler', 'The Code Poet', 'The Gallery Whisperer',
];

const SYSTEM =
  'You are Remi, a tiny pixel typewriter who types personality readings in a retro Windows 95 ' +
  'typography quiz at a design school showcase. You read designers through the choices they make. ' +
  'Voice: Gen Z, warm, confident, a little chaotic, never mean. Plain text only: no emojis, no hashtags, ' +
  'no em dashes, no lists or numbering, no quotes around the answer. Talk to the player as "you". ' +
  'Never mention AI, models, prompts, scores or percentages.';

/* ---------- checking the input ---------- */
function bad(msg) { const e = new Error(msg); e.bad = true; throw e; }
const cleanName = n => String(n || '').replace(/[^\p{L}\p{N} '._-]/gu, '').trim().slice(0, 12) || 'Anon';
function cleanTraits(t) {
  if (!Array.isArray(t) || t.length !== 5) bad('traits');
  return t.map(v => {
    const n = Number(v);
    if (!Number.isFinite(n)) bad('traits');
    return Math.max(0, Math.min(1, n));
  });
}
const oneOf = (v, list) => (list.includes(v) ? v : bad('value'));
const describe = traits => traits
  .map((v, i) => `${TRAITS[i][0]} ${Math.round((1 - v) * 100)}% / ${TRAITS[i][1]} ${Math.round(v * 100)}%`)
  .join('; ');

/* What they actually did, as short checked lines. Every field is optional. */
function describeClues(c) {
  c = c && typeof c === 'object' ? c : {};
  const num = (v, lo, hi) => { const n = Number(v); return v != null && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null; };
  const pick = (v, list) => (list.includes(v) ? v : null);
  const text = v => String(v || '').replace(/[^\p{L}\p{N} '.,!?&+/:()_-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const out = [];

  const portrait = pick(c.portrait, ['snapped', 'drew', 'default']);
  const strokes = num(c.strokes, 0, 999), colours = num(c.colours, 0, 40);
  if (portrait === 'snapped') out.push('Self-portrait: skipped drawing and snapped a webcam selfie, turned into pixels.');
  if (portrait === 'default') out.push('Self-portrait: drew nothing and took the default smiley.');
  if (portrait === 'drew') out.push(`Self-portrait: drew it by hand, ${strokes} strokes in ${colours} colours` +
    (c.ranOutDrawing === true ? ', still drawing when time ran out.' : ', finished before time ran out.'));

  const voice = pick(c.voice, ['quiet flat', 'quiet expressive', 'loud flat', 'loud expressive']);
  const how = pick(c.voiceHow, ['mic', 'override', 'tap', 'skip']);
  if (how === 'skip') out.push('Say hello: skipped the mic check.');
  else if (voice) out.push(`Say hello: ${voice.replace(' ', ' and ')}` +
    { mic: ', read from their voice.', override: ', after correcting what the mic heard.', tap: ', tapped instead of speaking.' }[how || 'mic']);

  const roles = Array.isArray(c.readOrder) ? c.readOrder.map(r => pick(r, ['headline', 'subhead', 'details'])) : [];
  if (roles.length === 3 && roles.every(Boolean)) {
    const classic = roles.join() === 'headline,subhead,details';
    out.push(`Poster hierarchy: made people read the ${roles.join(', then the ')}` +
      (classic ? ' (by the book).' : roles[0] === 'headline' ? ' (headline first, then freestyled).' : ' (broke the usual order).'));
  }

  const picks = Array.isArray(c.retro) ? c.retro.map(p => pick(p, PICKS)).filter(Boolean).slice(0, 5) : [];
  if (picks.length) out.push(`Rapid fire this-or-that: picked ${picks.join(', ')}.`);

  if (GAP_STYLES.has(c.gapStyle)) {
    const secs = num(c.gapSeconds, 0, 30), moves = num(c.gapMoves, 0, 99);
    out.push(moves ? `Told the spacing on a sign looked off, they ${GAP_STYLES.get(c.gapStyle)} (${secs}s, ${moves} adjustment${moves === 1 ? '' : 's'}).`
      : 'Told the spacing on a sign looked off, they shipped it without touching a thing.');
  }

  const speed = num(c.typeSpeed, 0, 20), backs = num(c.backspaces, 0, 99);
  if (speed) out.push(`Typed their own name at ${speed} keys a second with ${backs || 0} backspaces.`);
  else if (speed === 0) out.push('Hit OK before typing their own name.');

  const timeouts = num(c.timeouts, 0, 4);
  if (timeouts) out.push(`Let the timer run out on ${timeouts} challenge${timeouts === 1 ? '' : 's'}.`);

  const said = (Array.isArray(c.said) ? c.said : []).slice(0, 10)
    .map(s => s && typeof s === 'object' && text(s.q) && text(s.a) ? `${text(s.q)} "${text(s.a)}"` : null).filter(Boolean);
  if (said.length) out.push(`Quick answers they picked: ${said.join('; ')}.`);

  return out.map(line => '- ' + line).join('\n');
}

/* ---------- the prompts ---------- */
function buildPrompt(body) {
  if (body.kind === 'reading') {
    const name = cleanName(body.name);
    const traits = cleanTraits(body.traits);
    const type = oneOf(body.type, TYPES);
    const fonts = (Array.isArray(body.fonts) ? body.fonts : []).slice(0, 3).map(f => oneOf(f, FONTS));
    if (fonts.length !== 3) bad('fonts');
    const pair = oneOf(body.pair, FONTS);
    const palette = PALETTES.includes(body.palette) ? body.palette : 'Pop';
    const clues = describeClues(body.clues);
    return (
      `Read this designer from what they actually did in the game, not just from their result.\n\n` +
      `Player: ${name}\n` +
      `Result: ${type}. Fonts: headline ${fonts[0]}, subheader ${fonts[1]}, body text ${fonts[2]}. ` +
      `Best pairing: ${pair}. Colour palette: ${palette}.\n` +
      `Traits: ${describe(traits)}\n` +
      (clues ? `What they did:\n${clues}\n` : '') +
      `\nWrite exactly 3 short sentences, 60 words max in total, as plain sentences (no numbering).\n` +
      'Sentence 1: a bold, specific guess about how they are as a designer in real life ' +
      '(crits, deadlines, group projects, their files or their desktop), backed by one or two things they did. Name the actual choice.\n' +
      'Sentence 2: call out a funny contradiction or tell in their choices, roast-lite and kind.\n' +
      'Sentence 3: one tip for using their fonts, naming at least one of them.\n' +
      'Gen Z voice: casual and confident, slang only where it fits (lowkey, ate, no notes, it\'s giving, ' +
      'main character, the way you...). Do not restate the type name, list traits or invent anything not listed above.'
    );
  }
  if (body.kind === 'compat') {
    const person = p => ({
      name: cleanName(p && p.name),
      traits: cleanTraits(p && p.traits),
      type: oneOf(p && p.type, TYPES),
    });
    const a = person(body.a), b = person(body.b);
    const score = Math.round(Math.max(0, Math.min(100, Number(body.score) || 0)));
    return (
      `Two designers. ${a.name} is ${a.type} (${describe(a.traits)}). ` +
      `${b.name} is ${b.type} (${describe(b.traits)}). Their match score is ${score}%. ` +
      'In 1 or 2 short sentences (max 35 words), say playfully how they would work ' +
      'together on a poster: who does what, and where they might clash.'
    );
  }
  if (body.kind === 'questions') {
    const example = TRAITS.map((t, i) => `{"scale": ${i + 1}, "question": string, "${t[0]}": string, "${t[1]}": string}`);
    return (
      'Write 10 quick this-or-that questions for a designer personality quiz played by ' +
      'design students at a showcase. Gen Z tone, funny, about studio life, crits, Figma, ' +
      'moodboards, deadlines, group projects. 2 new questions for each of these 5 scales: ' +
      TRAITS.map((t, i) => `scale ${i + 1} = ${t[0]} vs ${t[1]}`).join('; ') + '. ' +
      'Each question has two answers, each written under the name of the personality it fits: ' +
      'the answer under "Futurist" must sound like a futurist, the one under "Nostalgic" like a nostalgic person, and so on. ' +
      'Question: max 34 characters. Each answer: max 30 characters. No placeholders. ' +
      'Reply with JSON only: {"questions": [ 10 objects, 2 per scale, shaped like: ' + example.join(' / ') + ' ] }'
    );
  }
  return bad('kind');
}

/* The questions come back as JSON. Models vary the layout a bit, so accept the
   common shapes, then check everything and clean every string. */
function cleanQuestions(raw) {
  const tidy = v => String(v || '').replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').trim().slice(0, 60);
  // one question → [question, first answer, second answer]
  const triple = q => {
    if (Array.isArray(q)) return q.length >= 3 ? q.slice(0, 3) : null;
    if (q && typeof q === 'object') {
      const text = q.question || q.q || q.text || q.prompt;
      const answers = q.answers || q.options || q.choices ||
        [q.first || q.a || q.low || q.left || q.option1, q.second || q.b || q.high || q.right || q.option2];
      if (text && Array.isArray(answers) && answers.length >= 2) return [text, answers[0], answers[1]];
    }
    return null;
  };
  const parsed = JSON.parse(raw);
  let list = Array.isArray(parsed) ? parsed : parsed.questions || Object.values(parsed).find(Array.isArray);
  if (!Array.isArray(list)) bad('shape');
  // a scale written as an object holding its questions → just the questions
  list = list.map(p => (p && !Array.isArray(p) && typeof p === 'object' && !triple(p) ? Object.values(p).find(Array.isArray) || p : p));
  // best case: answers written under the trait names, e.g. {"scale":3, "Futurist": "...", "Nostalgic": "..."}
  const findKey = (q, word) => Object.keys(q).find(k => k.toLowerCase().replace(/[^a-z]/g, '') === word.toLowerCase().replace(/[^a-z]/g, ''));
  if (list.length === 10 && list.every(q => q && typeof q === 'object' && !Array.isArray(q))) {
    const named = TRAITS.map((t, i) => list
      .filter(q => Number(q.scale) === i + 1)
      .map(q => {
        const lo = findKey(q, t[0]), hi = findKey(q, t[1]);
        const text = q.question || q.q || q.text;
        return lo && hi && text ? [text, q[lo], q[hi]] : null;
      }));
    if (named.every(g => g.length === 2 && g.every(Boolean))) list = named;
  }
  // 10 single questions: group by their "scale" number if they have one, else in order
  if (list.length === 10 && list.every(q => triple(q))) {
    const byScale = [1, 2, 3, 4, 5].map(n => list.filter(q => q && Number(q.scale) === n));
    list = byScale.every(g => g.length === 2) ? byScale : [0, 1, 2, 3, 4].map(i => [list[2 * i], list[2 * i + 1]]);
  }
  if (list.length !== 5) bad('shape');
  return list.map(pair => {
    if (!Array.isArray(pair) || pair.length < 2) bad('shape');
    return pair.slice(0, 2).map(q => {
      const t = triple(q);
      if (!t) bad('shape');
      const out = t.map(tidy);
      // no empty strings, no "..." placeholders, and the two answers must differ
      if (out.some(x => !x || /^[\s.\u2026]*$/.test(x) || /\.\.\.$/.test(x) && x.length < 6)) bad('empty');
      if (out[1].toLowerCase() === out[2].toLowerCase()) bad('same');
      return out;
    });
  });
}

/* ---------- a simple per-person limit (best effort) ---------- */
const hits = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > LIMIT;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(503).json({ error: 'AI is not set up' });

  // only our own site may call this
  const origin = req.headers.origin || '';
  const host = req.headers.host || '';
  const extra = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (origin && !origin.endsWith('://' + host) && !extra.includes(origin)) {
    return res.status(403).json({ error: 'Not allowed' });
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (tooMany(ip)) return res.status(429).json({ error: 'Slow down' });

  let prompt, kind;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    kind = body.kind;
    prompt = buildPrompt(body);
  } catch (e) {
    return res.status(400).json({ error: 'Bad request' });
  }
  const isQuiz = kind === 'questions';

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
        max_tokens: isQuiz ? 900 : kind === 'reading' ? 170 : 120,
        temperature: 0.9,
        ...(isQuiz ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) return res.status(502).json({ error: 'AI did not answer' });
    const data = await r.json();
    if (isQuiz) {
      try {
        const questions = cleanQuestions(data.choices[0].message.content);
        return res.status(200).json({ text: JSON.stringify({ questions }) });
      } catch (e) {
        return res.status(502).json({ error: 'Bad questions' });
      }
    }
    const text = String((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '')
      .trim()
      .replace(/\s*[—–]\s*/g, ', ')   // house rule: no em dashes
      .replace(/^["'“]+|["'”]+$/g, '')
      .replace(/^\s*\d+[.)]\s*/gm, '')  // drop numbering if it slips in
      .replace(/\s*\n+\s*/g, ' ')
      .slice(0, 480);
    if (!text) return res.status(502).json({ error: 'Empty answer' });
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(504).json({ error: 'AI took too long' });
  } finally {
    clearTimeout(timer);
  }
};

// exported for local tests
module.exports.buildPrompt = buildPrompt;
module.exports.cleanQuestions = cleanQuestions;
module.exports.describeClues = describeClues;
