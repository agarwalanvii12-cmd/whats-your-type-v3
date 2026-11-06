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
     { kind: 'reading', name, traits[5], type, fonts[3], pair, palette }
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
const FONTS = [
  'Playfair Display', 'Press Start 2P', 'Archivo Black', 'Anton', 'Monoton', 'Silkscreen',
  'Unbounded', 'Rubik Glitch', 'EB Garamond', 'Special Elite', 'Work Sans', 'VT323',
  'Josefin Sans', 'Caveat', 'Space Grotesk', 'Comfortaa',
];
const TYPES = [
  'The Editor-in-Chief', 'The Arcade Kid', 'The Swiss Machine', 'The Billboard Brat', 'The Neon Sign',
  'The Pixel Punk', 'The Future Shaper', 'The Chaos Engine', 'The Old Soul', 'The Typewriter Poet',
  'The Quiet Modernist', 'The Terminal Dreamer', 'The Art Deco Ghost', 'The Scrapbook Heart',
  'The Soft Futurist', 'The Cloud Doodler',
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
    return (
      `Player: ${name}. Personality traits: ${describe(traits)}. ` +
      `Their design type: ${type}. Their top fonts: ${fonts.join(', ')}. ` +
      `The font that pairs best with them: ${pair}. Their chosen colour palette: ${palette}. ` +
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
    return (
      'Write 10 quick this-or-that questions for a designer personality quiz played by ' +
      'design students at a showcase. Gen Z tone, funny, about studio life, crits, Figma, ' +
      'moodboards, deadlines, group projects. 2 questions for each of these 5 scales, in this order: ' +
      TRAITS.map((t, i) => `${i + 1}) ${t[0]} vs ${t[1]}`).join('; ') + '. ' +
      'Each question: max 34 characters. Each answer: max 30 characters. ' +
      'Reply as JSON only: {"questions":[[["question","answer for the FIRST end","answer for the SECOND end"],' +
      '[...]], ...5 pairs]}.'
    );
  }
  return bad('kind');
}

/* the questions come back as JSON: check the shape and clean every string */
function cleanQuestions(raw) {
  const tidy = v => String(v || '').replace(/\s*[\u2014\u2013]\s*/g, ', ').replace(/\s+/g, ' ').trim().slice(0, 60);
  const qs = JSON.parse(raw).questions;
  if (!Array.isArray(qs) || qs.length !== 5) bad('shape');
  return qs.map(pair => {
    if (!Array.isArray(pair) || pair.length < 2) bad('shape');
    return pair.slice(0, 2).map(q => {
      if (!Array.isArray(q) || q.length < 3) bad('shape');
      const out = q.slice(0, 3).map(tidy);
      if (out.some(x => !x)) bad('empty');
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
