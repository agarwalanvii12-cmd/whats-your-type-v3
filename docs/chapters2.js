/* =========================================================
   chapters2.js · chapters 5 to 8
   5 architecture diagram (tap a box → its real code)
   6 flip cards: what breaks, what Remi does instead
   7 versions sliding away, showcase photos, reflection
   8 the video, the full checklist, "ding."
   ========================================================= */
(function () {
  'use strict';
  const W = window.WYT;
  const h = W.h;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const calm = W.docsCalm, play = W.docsPlay;
  const wait = ms => new Promise(r => setTimeout(r, calm() ? 0 : ms));

  /* =========================================================
     5 · BEHIND THE SCREEN
     ========================================================= */
  // short, real excerpts (trimmed with … where lines were skipped)
  const CODE = {
    phone: ['js/ai.js', 'the phone asks our server, never OpenAI',
`const TIMEOUT = 10000;

async function ask(payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  const r = await fetch('api/ai', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal: ctrl.signal,
  });
  …
}`],
    ai: ['api/ai.js', 'the key lives here, in Vercel settings',
`const key = process.env.OPENAI_API_KEY;
// only our own site may call this
if (origin && !origin.endsWith('://' + host)) {
  return res.status(403).json({ error: 'Not allowed' });
}
if (tooMany(ip)) return res.status(429).json({ error: 'Slow down' });
prompt = buildPrompt(body);   // the server writes the prompt
…
  .replace(/^\\s*\\d+[.)]\\s*/gm, '')  // drop numbering if it slips in
  .slice(0, 480);`],
    room: ['api/room.js', 'both phones post here, a few times a second',
`GET  /api/room                → { relay: true/false }
POST /api/room { action: ... }
  create {name}                → { code }
  join   {code, name}          → { host }
  send   {code, me, msg}       → { ok }
  poll   {code, me}            → { msgs, oppAgo }

const TTL = 3 * 60 * 60;   // seconds a room lives
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // no I or O`],
    gallery: ['api/gallery.js', 'pinned cards, stored as share codes only',
`// A card is stored as its share code (name,
// traits, drawing), so nothing else is kept.
GET  /api/gallery            → { cards: [...] }
POST /api/gallery { share }  → { ok: true }

const KEY = \`wyt3:wall:\${SESSION}\`;
const MAX = 60;
const LIMIT = 5;   // pins per person per 10 minutes`],
    turn: ['api/turn.js', 'relay servers for wifi that blocks phones',
`// PeerJS's own defaults, kept as a fallback
const BASE = [
  { urls: ['stun:stun.l.google.com:19302', …] },
  { urls: ['turn:eu-0.turn.peerjs.com:3478', …] },
];
…
res.status(200).json({
  iceServers: [...servers, ...BASE],
  relay: servers.length > 0,
});`],
    openai: ['api/ai.js', 'the one call to OpenAI',
`fetch('https://api.openai.com/v1/chat/completions', {
  headers: { Authorization: \`Bearer \${key}\` },
  body: JSON.stringify({
    model: MODEL,             // gpt-4o-mini
    messages: [{ role: 'system', content: SYSTEM },
               { role: 'user', content: prompt }],
    max_tokens: kind === 'reading' ? 170 : 120,
    temperature: 0.9,
  }),
  signal: ctrl.signal,      // gives up after 9s
});`],
    redis: ['api/room.js', 'one Redis command over HTTPS',
`const URL_ = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: \`Bearer \${TOKEN}\` },
    body: JSON.stringify(cmd),
  });
  return (await r.json()).result;
}`],
    peerjs: ['js/net.js', 'phone to phone, when there is no relay',
`// Room code = 4 letters. The host's peer id is "wyt3-ABCD".
const peer = new window.Peer(PREFIX + this.code, { debug: 0, config });
peer.on('open', () => { this.open = true; this.emit(); });
peer.on('connection', c => { … });
peer.on('error', e => {
  // code taken: try another
  if (e.type === 'unavailable-id') { this.host(name); return; }
  …
});
// If anything fails, the game carries on solo
// and compare-by-code still works.`],
  };

  const LINKS = [ // [from, to, kind]
    ['phone', 'ai'], ['phone', 'room'], ['phone', 'gallery'], ['phone', 'turn'],
    ['ai', 'openai'], ['room', 'redis'], ['gallery', 'redis'], ['turn', 'peerjs', 'soft'],
  ];

  function buildArch() {
    const arch = $('#arch'), svg = $('#arch-lines');
    const node = id => $(`[data-node="${id}"]`, arch);
    const NS = 'http://www.w3.org/2000/svg';

    function draw() {
      const box = arch.getBoundingClientRect();
      svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
      svg.replaceChildren();
      LINKS.forEach(([a, b, kind], i) => {
        const A = node(a).getBoundingClientRect(), B = node(b).getBoundingClientRect();
        const across = B.left >= A.right - 4;  // side by side (laptop) or stacked (phone)
        const x1 = (across ? A.right : A.left + A.width / 2) - box.left;
        const y1 = (across ? A.top + A.height / 2 : A.bottom) - box.top;
        const x2 = (across ? B.left : B.left + B.width / 2) - box.left;
        const y2 = (across ? B.top + B.height / 2 : B.top) - box.top;
        const d = across
          ? `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`
          : `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`;
        const wire = document.createElementNS(NS, 'path');
        wire.setAttribute('d', d);
        wire.setAttribute('class', 'wire' + (kind ? ' ' + kind : ''));
        const dots = document.createElementNS(NS, 'path');
        dots.setAttribute('d', d);
        dots.setAttribute('class', 'dots');
        dots.style.animationDelay = (i * -0.37) + 's';
        svg.append(wire, dots);
      });
    }
    // phone layout stacks the columns; only draw lines between side-by-side boxes there
    const redraw = () => { if (arch.offsetParent) draw(); };
    addEventListener('resize', redraw);
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(redraw);
    $('#arch img').addEventListener('load', redraw);
    W.onSeen(arch, () => { redraw(); arch.classList.add('live'); });

    $$('.node', arch).forEach(n => n.addEventListener('click', () => openCode(n.dataset.node, n)));
  }

  /* a Win95 window with the code, closes on ✕, Esc or a tap outside */
  function openCode(id, from) {
    const [file, note, code] = CODE[id];
    play('click');
    const close = () => { modal.remove(); document.removeEventListener('keydown', onKey); from.focus(); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    const closeBtn = h('button', { 'aria-label': 'Close', onclick: close });
    const modal = h('div', { class: 'modal code-modal', onclick: e => { if (e.target === modal) close(); } },
      h('section', { class: 'window code-win', role: 'dialog', 'aria-modal': 'true', 'aria-label': file },
        h('div', { class: 'title-bar' },
          h('div', { class: 'title-bar-text' }, file),
          h('div', { class: 'title-bar-controls' }, closeBtn)),
        h('div', { class: 'window-body' },
          h('pre', { class: 'code code-excerpt' }, code),
          h('p', { class: 'hand-note' }, h('span', { class: 'arrow', 'aria-hidden': 'true' }, '↑'), note))));
    document.body.append(modal);
    document.addEventListener('keydown', onKey);
    closeBtn.focus();
  }

  function buildLanes() {
    $$('.lane-ph').forEach(s => s.append(h('img', { src: W.docsIcon('phone', 3), alt: '' })));
  }

  /* =========================================================
     6 · WHEN THINGS BREAK
     ========================================================= */
  const BREAKS = [
    ['mic', 'no mic', 'tap your vibe instead', 'img/fallback/mic.png', 'Say hello with three tap buttons instead of the mic'],
    ['camera', 'no camera', 'draw yourself instead', 'img/fallback/cam.png', 'Camera not found. Draw yourself instead?'],
    ['none', 'AI slow or down', "10s timeout, then my own reading", 'img/screens/card.png', 'Type Card with an offline reading'],
    ['phone', 'bad wifi', 'Redis relay, then PeerJS, then compare by code', 'img/fallback/code.png', 'Compare by code: a QR code and a share code'],
    ['error', "time's up", "scores what's there", 'img/fallback/time.png', "Time's up sticker, then the quick question"],
  ];

  function buildFlips() {
    const ul = $('#flips');
    BREAKS.forEach(([icon, problem, fix, img, alt], i) => {
      const card = h('button', { class: 'flip', 'aria-pressed': 'false', 'aria-label': `${problem}: ${fix}` },
        h('span', { class: 'flip-in' },
          h('span', { class: 'flip-front' },
            h('img', { class: 'flip-icon', src: W.docsIcon(icon, 5), alt: '' }),
            h('span', { class: 'flip-problem' }, problem),
            h('span', { class: 'flip-hint label' }, 'tap')),
          h('span', { class: 'flip-back' },
            h('img', { class: 'flip-shot' + (img.includes('card') ? ' shot-low' : ''), src: img, alt, loading: 'lazy' }),
            h('span', { class: 'flip-fix' }, fix))));
      card.addEventListener('click', () => {
        const on = !card.classList.contains('on');
        card.classList.toggle('on', on);
        card.setAttribute('aria-pressed', String(on));
        play('click');
      });
      const li = h('li', {}, card);
      ul.append(li);
      // flip by itself once it scrolls in, one after another
      W.onSeen(li, async () => { await wait(250 + i * 260); card.classList.add('on'); card.setAttribute('aria-pressed', 'true'); play('tick'); });
    });
  }

  /* =========================================================
     7 · HOW IT STARTED
     ========================================================= */
  const VERSIONS = [
    { tag: 'v1', name: 'What The Font', where: 'GitHub Pages', what: 'variable fonts + sliders', img: 'img/versions/v1.png',
      url: 'https://agarwalanvii12-cmd.github.io/what-the-font/' },
    { tag: 'v2', name: "What's Your Type?", where: 'whats-your-type-ochre.vercel.app', what: 'scrapbook look · Zine Club, Report Card, Pencil Case', img: 'img/versions/v2.png',
      url: 'https://whats-your-type-ochre.vercel.app' },
    { tag: 'v3', name: 'the showcase', where: '6 Nov', what: 'Win95 · 2 players live', img: 'img/versions/v3.png',
      url: 'https://whats-your-type-v3-anvii.vercel.app' },
    { tag: 'v3+', name: 'post-showcase', where: 'after 6 Nov', what: 'camera portrait · voice vibe check', img: 'img/type-card.png', portrait: true },
  ];

  function buildVersions() {
    const stack = $('#v-stack'), dots = $('#v-dots');
    const cards = VERSIONS.map((v, i) => {
      const card = h('figure', { class: 'window v-card' + (v.portrait ? ' portrait' : ''), style: `--i:${i};--tilt:${[-2, 1.5, -1, 2][i]}deg` },
        h('div', { class: 'title-bar' }, h('div', { class: 'title-bar-text' }, `${v.tag} · ${v.name}`)),
        h('div', { class: 'window-body' },
          h('img', { src: v.img, alt: `${v.name}: ${v.what}`, loading: 'lazy' }),
          h('figcaption', {},
            h('span', { class: 'sticker', style: `--tilt:${i % 2 ? 3 : -4}deg` }, v.tag),
            h('span', { class: 'v-what' }, v.what),
            v.url ? h('a', { href: v.url, target: '_blank', rel: 'noopener', class: 'v-link label' }, v.where) : h('span', { class: 'v-link label' }, v.where))));
      stack.append(card);
      dots.append(h('li', {}, v.tag));
      return card;
    });
    // top card = current version; scrolling slides each one away to show the next
    const wrap = $('#versions');
    let shown = -1;
    function update() {
      const r = wrap.getBoundingClientRect();
      const travel = Math.max(1, r.height - innerHeight * 0.8);
      const p = Math.min(0.999, Math.max(0, -r.top / travel));
      const i = Math.floor(p * VERSIONS.length);
      if (i === shown) return;
      shown = i;
      cards.forEach((c, k) => { c.classList.toggle('gone', k < i); c.classList.toggle('top', k === i); });
      $$('li', dots).forEach((d, k) => d.classList.toggle('on', k <= i));
      play('click');
    }
    addEventListener('scroll', update, { passive: true });
    update();
  }

  function buildPhotos() {
    // photos listed in data-photos (files in docs/img/photos/); empty slots show a placeholder
    const ul = $('#photos');
    const files = (ul.dataset.photos || '').split(',').map(s => s.trim()).filter(Boolean);
    const count = Math.max(3, files.length);
    for (let n = 1; n <= count; n++) {
      const file = files[n - 1];
      const frame = h('div', { class: 'window-body photo-body' + (file ? ' has' : '') },
        file ? h('img', { src: `img/photos/${file}`, alt: `Showcase photo ${n}`, loading: 'lazy' }) : h('span', { class: 'label' }, 'photo coming'));
      ul.append(h('li', { style: `--tilt:${[-3, 2, -1.5][(n - 1) % 3]}deg` },
        h('figure', { class: 'window photo' },
          h('div', { class: 'title-bar' }, h('div', { class: 'title-bar-text' }, file || `showcase_0${n}.jpg`)),
          frame)));
    }
  }

  /* =========================================================
     8 · WATCH IT
     ========================================================= */
  function buildVideo() {
    const v = $('#video'), url = v.dataset.embed;
    if (url) {
      $('.video-body', v).replaceChildren(h('iframe', {
        src: url, title: 'A real game of What\'s Your Type?!', loading: 'lazy',
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true,
      }));
    }
  }

  function buildFinal() {
    const ul = $('#final-checks');
    W.DOCS_CHECKS.forEach(c => ul.append(h('li', {}, h('span', { class: 'box', 'aria-hidden': 'true' }), c.text)));
    W.onSeen(ul, async () => {
      for (const li of ul.children) { li.classList.add('done'); play('tick'); await wait(220); }
      await wait(300);
      $('#end-note')._run();
    });
  }

  buildArch();
  buildLanes();
  buildFlips();
  buildVersions();
  buildPhotos();
  buildVideo();
  buildFinal();
})();
