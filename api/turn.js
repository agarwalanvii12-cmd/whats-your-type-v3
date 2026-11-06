/* =========================================================
   api/turn.js · relay servers for live rooms

   Live rooms connect phones directly (WebRTC). Some wifi,
   like campus wifi, blocks that. A TURN "relay" server passes
   the messages along instead. This returns the list of servers
   to try, with relay logins kept in Vercel settings, not in git.

   Set ONE of these in Vercel → Settings → Environment Variables:
     METERED_DOMAIN + METERED_API_KEY   (free at metered.ca)
     TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL   (any TURN provider)
   Without them, rooms still work on wifi that allows direct links.
   ========================================================= */

// PeerJS's own defaults, kept as a fallback
const BASE = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
];

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const servers = [];
  const env = process.env;
  try {
    if (env.METERED_DOMAIN && env.METERED_API_KEY) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch(
        `https://${env.METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${encodeURIComponent(env.METERED_API_KEY)}`,
        { signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) {
        const list = await r.json();
        if (Array.isArray(list)) servers.push(...list);
      }
    } else if (env.TURN_URLS && env.TURN_USERNAME && env.TURN_CREDENTIAL) {
      servers.push({
        urls: env.TURN_URLS.split(',').map(s => s.trim()).filter(Boolean),
        username: env.TURN_USERNAME,
        credential: env.TURN_CREDENTIAL,
      });
    }
  } catch (e) { /* fall back to the defaults below */ }
  res.status(200).json({ iceServers: [...servers, ...BASE], relay: servers.length > 0 });
};
