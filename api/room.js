/* =========================================================
   api/room.js · live rooms through our own server

   Campus wifi (like NUS) blocks phones from connecting to each
   other directly. So instead, both phones post their messages
   here and check for new ones a few times a second. Phones can
   always reach the website, so this always works.

   Storage: a small Redis database from Vercel → Storage
   (Upstash). Vercel adds its address + token as env vars:
   KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL
   + UPSTASH_REDIS_REST_TOKEN). Rooms expire after 3 hours.

   GET  /api/room                      → { relay: true/false }
   POST /api/room { action: ... }
     create {name}                      → { code }
     join   {code, name}                → { host }      (host's name)
     send   {code, me, msg}             → { ok }        (me = 'host' | 'guest')
     poll   {code, me}                  → { msgs, oppAgo }
     leave  {code, me}                  → { ok }
   ========================================================= */

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL = 3 * 60 * 60;                       // seconds a room lives
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';    // no I or O
const MAX_MSG = 6000;                          // bytes per message (an avatar is ~1.7k)

// one Redis command, or several in one go (as a transaction)
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
async function multi(cmds) {
  const r = await fetch(URL_ + '/multi-exec', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error('redis');
  return j.map(x => x.result);
}

const cleanName = n => String(n || '').replace(/[^\p{L}\p{N} '._-]/gu, '').trim().slice(0, 12) || 'Anon';
const cleanCode = c => String(c || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
const other = me => (me === 'host' ? 'guest' : 'host');
const key = (code, part) => `wyt3:${code}:${part}`;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ relay: !!(URL_ && TOKEN) });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!URL_ || !TOKEN) return res.status(503).json({ error: 'Rooms storage is not set up' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; }
  catch (e) { return res.status(400).json({ error: 'Bad request' }); }

  try {
    const now = Date.now();

    if (body.action === 'create') {
      const name = cleanName(body.name);
      for (let tries = 0; tries < 8; tries++) {
        const code = Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
        const ok = await redis(['SET', key(code, 'host'), name, 'NX', 'EX', TTL]);
        if (ok === 'OK') {
          await redis(['SET', key(code, 'seen:host'), String(now), 'EX', TTL]);
          return res.status(200).json({ code });
        }
      }
      return res.status(503).json({ error: 'No free room codes' });
    }

    const code = cleanCode(body.code);
    if (code.length !== 4) return res.status(400).json({ error: 'Bad code' });

    if (body.action === 'join') {
      const [host, guest] = await multi([['GET', key(code, 'host')], ['GET', key(code, 'guest')]]);
      if (!host) return res.status(404).json({ error: `No room called ${code}` });
      if (guest) return res.status(409).json({ error: `Room ${code} is full` });
      await multi([
        ['SET', key(code, 'guest'), cleanName(body.name), 'EX', TTL],
        ['SET', key(code, 'seen:guest'), String(now), 'EX', TTL],
        ['DEL', key(code, 'to:guest')],
      ]);
      return res.status(200).json({ host });
    }

    const me = body.me === 'host' || body.me === 'guest' ? body.me : null;
    if (!me) return res.status(400).json({ error: 'Bad player' });

    if (body.action === 'send') {
      const msg = JSON.stringify(body.msg || null);
      if (msg.length > MAX_MSG) return res.status(413).json({ error: 'Too big' });
      await multi([
        ['RPUSH', key(code, 'to:' + other(me)), msg],
        ['EXPIRE', key(code, 'to:' + other(me)), TTL],
        ['SET', key(code, 'seen:' + me), String(now), 'EX', TTL],
      ]);
      return res.status(200).json({ ok: true });
    }

    if (body.action === 'poll') {
      const [msgs, , , theirSeen] = await multi([
        ['LRANGE', key(code, 'to:' + me), 0, -1],
        ['DEL', key(code, 'to:' + me)],
        ['SET', key(code, 'seen:' + me), String(now), 'EX', TTL],
        ['GET', key(code, 'seen:' + other(me))],
      ]);
      const list = (msgs || []).map(m => { try { return JSON.parse(m); } catch (e) { return null; } }).filter(Boolean);
      return res.status(200).json({ msgs: list, oppAgo: theirSeen ? now - Number(theirSeen) : null });
    }

    if (body.action === 'leave') {
      await multi([
        ['RPUSH', key(code, 'to:' + other(me)), JSON.stringify({ type: 'bye' })],
        ['EXPIRE', key(code, 'to:' + other(me)), TTL],
        ['DEL', key(code, me), key(code, 'seen:' + me), key(code, 'to:' + me)],
      ]);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Bad action' });
  } catch (e) {
    return res.status(502).json({ error: 'Rooms storage error' });
  }
};
