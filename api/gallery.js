/* =========================================================
   api/gallery.js · the Card Wall

   Players can choose to pin their Type Card to a shared wall.
   The wall plays in the screensaver (attract mode) and in the
   Card Wall window. A card is stored as its share code (name,
   traits, drawing), so nothing else about the player is kept.

   Uses the same Upstash Redis as the live rooms.
   GET  /api/gallery            → { cards: [shareCode, ...] }  newest first, max 60
   POST /api/gallery { share }  → { ok: true }
   ========================================================= */

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'wyt3:wall';
const MAX = 60;
const LIMIT = 5, WINDOW_MS = 10 * 60 * 1000; // pins per person per 10 minutes

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

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
  if (!URL_ || !TOKEN) {
    return req.method === 'GET' ? res.status(200).json({ cards: [] }) : res.status(503).json({ error: 'Wall is not set up' });
  }
  try {
    if (req.method === 'GET') {
      const cards = await redis(['LRANGE', KEY, 0, MAX - 1]);
      return res.status(200).json({ cards: cards || [] });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });

    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    if (tooMany(ip)) return res.status(429).json({ error: 'Slow down' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const share = String(body.share || '');
    if (!/^[A-Za-z0-9_-]{20,900}$/.test(share)) return res.status(400).json({ error: 'Bad card' });

    await redis(['LREM', KEY, 0, share]);   // no duplicates
    await redis(['LPUSH', KEY, share]);
    await redis(['LTRIM', KEY, 0, MAX - 1]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ error: 'Wall storage error' });
  }
};
