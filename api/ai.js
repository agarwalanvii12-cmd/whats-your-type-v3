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
     { kind: 'reading', name, traits[5], type, fonts[3], pair, palette, voice, kern }
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
const VOICES = ['introvert', 'ambivert', 'extrovert'];
const KERN_STYLES = new Map([ // measured in the browser by how long they kept adjusting
  ['eyeballed', 'eyeballed it and moved on'],
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
  'You are the voice of a retro Windows 95 style typography personality quiz at a ' +
  'design school showcase. Be warm, witty and specific to the data. Plain text only: ' +
  'no emojis, no em dashes, no lists, no quotes around the answer. Talk to the player as "you". ' +
  'Never mention AI, models or prompts.';

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
    const voice = VOICES.includes(body.voice) ? `Their "say hello" vibe check sounded ${body.voice}. ` : '';
    const kern = KERN_STYLES.has(body.kern) ? `Given a kerning task, they ${KERN_STYLES.get(body.kern)}. ` : '';
    return (
      `Player: ${name}. Personality traits: ${describe(traits)}. ` +
      `Their design type: ${type}. Their fonts: headline ${fonts[0]}, subheader ${fonts[1]}, body text ${fonts[2]}. ` +
      `The font that pairs best with them: ${pair}. Their chosen colour palette: ${palette}. ${voice}${kern}` +
      'In 2 short sentences (max 45 words), Gen Z tone but kind: describe their designer ' +
      'personality (how they work and show up), then one playful tip for using their fonts.'
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
        max_tokens: isQuiz ? 900 : 120,
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
      .slice(0, 400);
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
