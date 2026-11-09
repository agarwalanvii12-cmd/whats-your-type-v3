/* =========================================================
   net.js · share codes (step 6) + PeerJS live rooms (step 7)

   SHARE CODE · the compare-by-code fallback. Works with zero
   network: everything about your card is packed into one short
   text code (and a QR of a link with that code in it).

   What's inside, byte by byte:
     1  version (2, or 3 when the avatar has non-Paint colours)
     1+ name: length, then UTF-8 bytes (max 12 characters)
     3  your 5 traits, 4 bits each (0..15), last 4 bits unused
     v3 only: 1 colour count, then 3 bytes (RGB) per colour
     …  avatar, run-length packed: each byte = 3 bits "how many
        in a row" (1..8) + 5 bits "which colour" (0 = empty)
     1  checksum, so a broken paste is caught
   Then base64url (letters, digits, - and _), safe in a URL.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});
  const CELLS = 24 * 24;

  const clamp01 = v => Math.max(0, Math.min(1, v || 0));

  function toB64url(bytes) {
    let s = '';
    bytes.forEach(b => { s += String.fromCharCode(b); });
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64url(str) {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    return Array.from(bin, c => c.charCodeAt(0));
  }

  /* A snapped portrait can use colours outside the 28 Paint colours, but a run
     byte only has room for 31 colours. So version 3 lists the colours this avatar
     uses (most-used first); any beyond 31 merge into their closest listed colour. */
  const MAX_TABLE = 31;
  const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  function colourTable(cells) {
    const counts = new Map();
    cells.forEach(v => { if (v >= 0) counts.set(v, (counts.get(v) || 0) + 1); });
    const used = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a));
    const kept = used.slice(0, MAX_TABLE);
    const slot = new Map(kept.map((v, i) => [v, i]));
    used.slice(MAX_TABLE).forEach(v => {
      const c = rgbOf(W.avatarColor(v));
      let best = 0, bestD = Infinity;
      kept.forEach((k, i) => {
        const d = rgbOf(W.avatarColor(k)).reduce((sum, x, j) => sum + (x - c[j]) ** 2, 0);
        if (d < bestD) { bestD = d; best = i; }
      });
      slot.set(v, best);
    });
    return { kept, slot };
  }

  /* card: { name, traits: [5 numbers 0..1], avatar } → "Ag..." */
  function encode(card) {
    const cells = card.avatar && card.avatar.length === CELLS ? card.avatar : new Array(CELLS).fill(-1);
    const extended = cells.some(v => v > 27);   // only snapped portraits need v3
    const bytes = [extended ? 3 : 2];

    const name = new TextEncoder().encode([...(card.name || 'Anon')].slice(0, 12).join(''));
    bytes.push(name.length, ...name);

    const q = (card.traits || []).map(v => Math.round(clamp01(v) * 15));
    while (q.length < 6) q.push(0);
    bytes.push((q[0] << 4) | q[1], (q[2] << 4) | q[3], (q[4] << 4) | q[5]);

    let packed = cells;
    if (extended) {
      const { kept, slot } = colourTable(cells);
      bytes.push(kept.length);
      kept.forEach(v => bytes.push(...rgbOf(W.avatarColor(v))));
      packed = cells.map(v => (v < 0 ? -1 : slot.get(v)));
    }
    for (let i = 0; i < CELLS;) {
      const v = packed[i];
      let run = 1;
      while (i + run < CELLS && packed[i + run] === v && run < 8) run++;
      bytes.push(((run - 1) << 5) | (v + 1));
      i += run;
    }

    bytes.push(bytes.reduce((a, b) => (a + b) & 255, 0));
    return toB64url(bytes);
  }

  /* "AQ..." (or a whole link with #c=...) → card, or null if it doesn't check out */
  function decode(input) {
    try {
      let str = String(input || '').trim();
      const m = str.match(/[#?&]c=([A-Za-z0-9_-]+)/);
      if (m) str = m[1];
      str = str.replace(/\s+/g, '');
      if (!/^[A-Za-z0-9_-]{12,}$/.test(str)) return null;

      const b = fromB64url(str);
      const check = b.pop();
      if (b.reduce((a, x) => (a + x) & 255, 0) !== check) return null;

      let p = 0;
      const version = b[p++];
      if (version !== 2 && version !== 3) return null;

      const len = b[p++];
      if (len > 48) return null;
      const name = new TextDecoder().decode(new Uint8Array(b.slice(p, p + len)));
      p += len;

      const q = [];
      for (let k = 0; k < 3; k++) { q.push(b[p] >> 4, b[p] & 15); p++; }
      const traits = q.slice(0, 5).map(n => n / 15);

      // v3: the colours this avatar uses come first
      let table = null;
      if (version === 3) {
        const n = b[p++];
        if (n > MAX_TABLE) return null;
        table = [];
        for (let k = 0; k < n; k++, p += 3) {
          const hex = '#' + [b[p], b[p + 1], b[p + 2]].map(x => x.toString(16).padStart(2, '0')).join('');
          table.push(W.avatarColorIndex(hex));
        }
      }

      const avatar = [];
      while (avatar.length < CELLS && p < b.length) {
        const run = (b[p] >> 5) + 1;
        let v = (b[p] & 31) - 1;
        p++;
        if (table) {
          if (v >= table.length) return null;
          if (v >= 0) v = table[v];
        } else if (v > 27) return null;
        for (let k = 0; k < run; k++) avatar.push(v);
      }
      if (avatar.length !== CELLS || p !== b.length) return null;

      return { name: name || 'Anon', traits, avatar, share: str };
    } catch (e) {
      return null;
    }
  }

  /* ---------- my own card, kept on this device ---------- */
  const KEY = 'wyt-my-card';
  function saveMine(share) { try { localStorage.setItem(KEY, share); } catch (e) { /* private mode */ } }
  function loadMine() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }

  // My card for comparing: from this game, or the last one played on this device
  function mine(state) {
    return decode((state && state.share) || loadMine());
  }

  // A link that opens the game with this code ready to compare
  function shareURL(share) {
    return location.origin + location.pathname + '#c=' + share;
  }

  // QR code image (needs the QR library; returns null if it didn't load)
  function qrImage(text) {
    if (typeof window.qrcode !== 'function') return null;
    try {
      const qr = window.qrcode(0, 'L');
      qr.addData(text);
      qr.make();
      const img = new Image();
      img.src = qr.createDataURL(4, 2);
      img.alt = 'QR code of your share link';
      return img;
    } catch (e) {
      return null;
    }
  }

  // Copy text, even on plain-http pages where the clipboard API is blocked
  async function copy(text, fallbackEl) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      if (!fallbackEl) return false;
      fallbackEl.focus();
      fallbackEl.select();
      try { return document.execCommand('copy'); } catch (e2) { return false; }
    }
  }

  W.net = { encode, decode, saveMine, loadMine, mine, shareURL, qrImage, copy };
})();

/* =========================================================
   LIVE ROOMS · PeerJS (WebRTC), host is the referee

   Room code = 4 letters. The host's peer id is "wyt3-ABCD".
   Messages (all small JSON):
     hello  {name}            say who you are
     ping / pong {t}          measure the round trip, for fair starts
     start  {round, delay}    host: everyone go to this round in <delay> ms
     result {round, data}     I finished this round, here's what I picked
     avatar {pixels}          my drawing (576 palette numbers)
     card   {share}           my finished card as a share code
     rematch                  back to the room
     bye                      I'm leaving (closing the page, Leave room)
   A heartbeat ping every 2.5s: 9s of silence counts as the friend gone.
   If anything fails, the game carries on solo and compare-by-code still works.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});

  const PREFIX = 'wyt3-';
  const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O (look like 1 and 0)
  const CONNECT_TIMEOUT = 8000;
  const JOIN_TIMEOUT = 14000; // joining may go through a relay server, which takes longer

  /* Which servers to use to find each other (and relay through, if the
     wifi blocks direct links). Fetched once from our /api/turn function. */
  let iceConfig = null;
  function getIce() {
    if (!iceConfig) {
      const fallback = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' },
        { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }] };
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      iceConfig = fetch('api/turn', { signal: ctrl.signal })
        .then(r => (r.ok ? r.json() : null))
        .then(j => (j && Array.isArray(j.iceServers) ? { iceServers: j.iceServers } : fallback))
        .catch(() => fallback)
        .finally(() => clearTimeout(t));
    }
    return iceConfig;
  }
  const START_DELAY = 1200;                    // ms between "Start" and everyone starting
  const HEARTBEAT = 2500, SILENCE = 9000;      // ping often; this long without a word = gone
  const ROUNDS = ['draw', 'challenge1', 'challenge2', 'challenge3', 'challenge4', 'challenge5', 'palette', 'card'];

  const newCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');

  /* ---------- SERVER RELAY (for wifi that blocks direct links) ----------
     When the site runs on Vercel with rooms storage set up (api/room.js),
     phones talk through our server instead of directly. RelayConn looks
     like a PeerJS connection (open / data / close), so nothing else changes. */
  let relayCheck = null;
  function useRelay() {
    if (!relayCheck) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      relayCheck = fetch('api/room', { signal: ctrl.signal })
        .then(r => (r.ok ? r.json() : null))
        .then(j => !!(j && j.relay))
        .catch(() => false)
        .finally(() => clearTimeout(t));
    }
    return relayCheck;
  }
  async function roomApi(body) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    try {
      const r = await fetch('api/room', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: ctrl.signal,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { const e = new Error(j.error || 'Room error'); e.status = r.status; throw e; }
      return j;
    } finally {
      clearTimeout(t);
    }
  }
  const nap = ms => new Promise(r => setTimeout(r, ms));

  class RelayConn {
    constructor(code, me) {
      Object.assign(this, { code, me, open: false, polling: false, handlers: {}, queue: Promise.resolve(), fails: 0 });
    }
    on(ev, fn) { this.handlers[ev] = fn; }
    fire(ev, x) { if (this.handlers[ev]) this.handlers[ev](x); }
    // guest: we're in, start talking
    start() { this.open = true; this.fire('open'); this.listen(); }
    // host: wait for the guest's first message, then we're "open"
    async listen() {
      if (this.polling) return;
      this.polling = true;
      while (this.polling) {
        try {
          const r = await roomApi({ action: 'poll', code: this.code, me: this.me });
          this.fails = 0;
          for (const m of r.msgs || []) {
            if (!this.open) { this.open = true; this.fire('open'); }
            this.fire('data', m);
          }
        } catch (e) {
          if (++this.fails > 20) { this.polling = false; this.fire('close'); return; }
        }
        await nap(this.open ? 350 : 800);
      }
    }
    send(msg) {
      if (!this.open) return;
      // keep messages in order: each send waits for the one before
      this.queue = this.queue.then(() => roomApi({ action: 'send', code: this.code, me: this.me, msg })).catch(() => {});
    }
    close() {
      if (!this.polling && !this.open) return;
      this.polling = false;
      this.open = false;
      roomApi({ action: 'leave', code: this.code, me: this.me }).catch(() => {});
    }
  }

  const live = {
    status: 'idle',   // idle | hosting | joining | connected
    role: null,       // 'host' | 'guest'
    code: null,
    me: '',
    opp: null,        // their name
    oppAvatar: null,
    oppResults: {},
    myResults: {},
    round: null,
    rtt: 0,
    error: null,
    peer: null,
    conn: null,
    timer: 0,
    ui: null,         // { round, nextBtn, reveal } for the round on screen
    listeners: new Set(),

    get active() { return this.status === 'connected' && W.state.mode === 'live'; },
    get connected() { return this.status === 'connected'; },

    on(fn) { this.listeners.add(fn); },
    off(fn) { this.listeners.delete(fn); },
    emit() { this.listeners.forEach(fn => { try { fn(); } catch (e) { console.warn(e); } }); },

    send(msg) { if (this.conn && this.conn.open) this.conn.send(msg); },

    /* ---------- set up ---------- */
    ready() {
      if (typeof window.Peer !== 'function') { this.fail('PeerJS did not load (no internet?)'); return false; }
      return true;
    },

    host(name) {
      this.leave(true);
      Object.assign(this, { status: 'hosting', role: 'host', me: name, code: newCode(), error: null, open: false });
      this.timer = setTimeout(() => { if (!this.open) this.fail('Could not open a room'); }, CONNECT_TIMEOUT);

      const code = this.code;
      useRelay().then(relay => {
        if (this.status !== 'hosting' || this.code !== code) return; // cancelled meanwhile
        if (relay) { this.hostRelay(name, code); return; }
        if (!this.ready()) return;
        getIce().then(config => {
          if (this.status !== 'hosting' || this.code !== code) return;
          this.makeHostPeer(name, config);
        });
      });
      this.emit();
    },

    // host through our server: get a room code, then wait for the guest's hello
    hostRelay(name, tempCode) {
      roomApi({ action: 'create', name })
        .then(r => {
          if (this.status !== 'hosting' || this.code !== tempCode) return;
          this.code = r.code;
          this.open = true;
          this.relay = true;
          clearTimeout(this.timer);
          const c = new RelayConn(r.code, 'host');
          this.attach(c);
          c.listen();
          this.emit();
        })
        .catch(() => { if (this.status === 'hosting') this.fail('Could not open a room'); });
    },

    makeHostPeer(name, config) {
      const peer = (this.peer = new window.Peer(PREFIX + this.code, { debug: 0, config }));
      peer.on('open', () => { this.open = true; clearTimeout(this.timer); this.emit(); });
      peer.on('connection', c => {
        if (this.conn) { c.on('open', () => c.close()); return; } // room is full (2 players)
        this.attach(c);
      });
      peer.on('error', e => {
        if (e.type === 'unavailable-id' && this.status === 'hosting') { this.host(name); return; } // code taken: try another
        if (this.status !== 'connected') this.fail(e.type === 'network' ? 'No connection to the room server' : 'Room error');
      });
    },

    join(code, name) {
      this.leave(true);
      Object.assign(this, { status: 'joining', role: 'guest', me: name, code, error: null });
      this.timer = setTimeout(() => {
        if (this.status === 'joining') this.fail(`Couldn't reach room ${code}. This wifi may block it: try a phone hotspot.`);
      }, JOIN_TIMEOUT);

      useRelay().then(relay => {
        if (this.status !== 'joining' || this.code !== code) return; // cancelled meanwhile
        if (relay) { this.joinRelay(code, name); return; }
        if (!this.ready()) return;
        this.joinPeer(code);
      });
      this.emit();
    },

    // join through our server
    joinRelay(code, name) {
      roomApi({ action: 'join', code, name })
        .then(r => {
          if (this.status !== 'joining' || this.code !== code) return;
          this.relay = true;
          this.opp = r.host;
          const c = new RelayConn(code, 'guest');
          this.attach(c);
          c.start();
        })
        .catch(e => {
          if (this.status !== 'joining') return;
          this.fail(e.status === 404 ? `No room called ${code}` : e.status === 409 ? `Room ${code} is full` : 'Could not connect');
        });
    },

    // join directly (PeerJS), used when there's no server relay
    joinPeer(code) {
      getIce().then(config => {
        if (this.status !== 'joining' || this.code !== code) return; // cancelled meanwhile
        const peer = (this.peer = new window.Peer({ debug: 0, config }));
        peer.on('open', () => this.attach(peer.connect(PREFIX + code, { reliable: true })));
        peer.on('error', e => {
          if (this.status === 'connected') return;
          this.fail(e.type === 'peer-unavailable' ? `No room called ${code}` : 'Could not connect');
        });
      });
      this.emit();
    },

    attach(c) {
      this.conn = c;
      c.on('open', () => {
        clearTimeout(this.timer);
        this.status = 'connected';
        this.lastSeen = performance.now();
        this.send({ type: 'hello', name: this.me });
        this.send({ type: 'ping', t: performance.now() });
        clearInterval(this.beat);
        this.beat = setInterval(() => {
          if (performance.now() - this.lastSeen > SILENCE) { this.lost(); return; }
          this.send({ type: 'ping', t: performance.now() });
        }, HEARTBEAT);
        this.emit();
      });
      c.on('data', m => this.receive(m));
      c.on('close', () => this.lost());
      c.on('error', () => this.lost());
    },

    /* ---------- messages ---------- */
    receive(m) {
      if (!m || typeof m !== 'object') return;
      this.lastSeen = performance.now();
      switch (m.type) {
        case 'bye':
          this.lost();
          return;
        case 'hello':
          this.opp = String(m.name || 'Friend').slice(0, 12);
          break;
        case 'ping':
          this.send({ type: 'pong', t: m.t });
          break;
        case 'pong':
          this.rtt = performance.now() - m.t;
          break;
        case 'start':
          if (this.role === 'guest' && ROUNDS.includes(m.round)) {
            setTimeout(() => this.begin(m.round), Math.max(0, (m.delay || 0) - this.rtt / 2));
          }
          break;
        case 'result':
          this.oppResults[m.round] = m.data || {};
          this.refreshRound();
          break;
        case 'avatar':
          if (Array.isArray(m.pixels) && m.pixels.length === 576) this.oppAvatar = m.pixels;
          this.refreshRound();
          break;
        case 'card': {
          const friend = W.net.decode(m.share);
          if (friend) W.state.friend = friend;
          break;
        }
        case 'rematch':
          W.state.friend = null;
          W.go('lobby');
          break;
      }
      this.emit();
    },

    /* ---------- the referee ---------- */
    // host: tell everyone to start a round, then start it here after the same delay
    startRound(round) {
      if (this.role !== 'host' || !this.connected) return;
      this.send({ type: 'start', round, delay: START_DELAY });
      setTimeout(() => this.begin(round), START_DELAY);
    },
    // everyone: go to the round's screen
    begin(round) {
      if (round === 'draw') {
        W.state.mode = 'live';
        W.state.name = this.me;
        W.state.friend = null;
        W.resetGame();
        this.oppResults = {};
        this.myResults = {};
        this.oppAvatar = null;
      }
      this.round = round;
      this.ui = null;
      W.go(round);
    },
    // host's Next button
    hostNext() {
      const r = this.round;
      if (this.role !== 'host' || !(r in this.myResults) || !(r in this.oppResults)) return;
      const next = ROUNDS[ROUNDS.indexOf(r) + 1];
      if (next) this.startRound(next);
    },

    /* A screen calls this when its round ends. Returns false in solo mode. */
    roundDone(round, data, ui) {
      if (!this.active) return false;
      this.myResults[round] = data;
      this.send({ type: 'result', round, data });
      if (round === 'draw') this.send({ type: 'avatar', pixels: W.state.avatar });
      this.ui = Object.assign({ round }, ui);
      this.refreshRound();
      return true;
    },

    /* ---------- what you see during a live round ---------- */
    // a pill at the top of each round: "Rafa: playing..." → "Rafa ✓ done"
    onEnter(screen) {
      document.querySelector('.opp-pill')?.remove();
      if (!this.active || !ROUNDS.includes(screen) || screen === 'card') return;
      const pill = W.h('div', { class: 'opp-pill', 'aria-live': 'polite' });
      document.getElementById('screen').prepend(pill);
      this.refreshRound();
    },

    refreshRound() {
      const r = this.round;
      const pill = document.querySelector('.opp-pill');
      const theirs = this.oppResults[r];
      if (pill) {
        const av = this.oppAvatar && W.avatarCanvas(this.oppAvatar, 1);
        if (av) av.className = 'opp-avatar';
        pill.classList.toggle('done', theirs !== undefined);
        pill.replaceChildren(av || '', theirs !== undefined ? `${this.opp} ✓ done` : `${this.opp}: playing...`);
      }

      const u = this.ui;
      if (!u || u.round !== r) return;
      const T = W.type;

      // show what they picked next to yours
      if (theirs !== undefined && u.reveal && !u.reveal.querySelector('.opp-answer')) {
        const id = Number(String(r).replace('challenge', ''));
        const c = W.CHALLENGES[id - 1];
        if (c && Number.isFinite(theirs.trait)) {
          const word = W.traitWord(c.trait, theirs.trait);
          u.reveal.append(Object.assign(T.sticker(`${this.opp}: ${word}`, 3), { className: 'sticker pill opp-answer' }));
        }
      }

      // the Next button: only the host moves everyone on, once both are done
      if (u.nextBtn) {
        if (!this.active) { u.nextBtn.disabled = false; T.magButton(u.nextBtn, 'Next', 'next-solo'); return; }
        if (this.role === 'host') {
          const both = theirs !== undefined;
          u.nextBtn.disabled = !both;
          T.magButton(u.nextBtn, both ? 'Next' : `Waiting for ${this.opp}`, 'host-next' + both);
        } else {
          u.nextBtn.disabled = true;
          T.magButton(u.nextBtn, 'Host starts next', 'guest-wait');
        }
      }
    },

    /* ---------- endings ---------- */
    rematch() {
      W.state.friend = null;
      this.send({ type: 'rematch' });
      W.go('lobby');
    },

    fail(why) {
      this.leave(true);
      this.error = why;
      this.emit();
      if (W.showError) W.showError('connect', why);
    },

    lost() {
      if (this.status !== 'connected') return;
      const inGame = W.state.mode === 'live';
      const who = this.opp || 'Your friend';
      this.leave(true);
      W.state.mode = 'solo';
      this.refreshRound(); // unlocks Next so you can carry on solo
      this.emit();
      if (W.showError) W.showError(inGame ? 'lost' : 'left', `${who} left.`);
    },

    leave(quiet) {
      clearTimeout(this.timer);
      clearInterval(this.beat);
      const conn = this.conn, peer = this.peer;
      try { if (conn && conn.open) conn.send({ type: 'bye' }); } catch (e) { /* closing anyway */ }
      Object.assign(this, { status: 'idle', role: null, conn: null, peer: null, opp: null, open: false, relay: false });
      setTimeout(() => { // give "bye" a moment to arrive
        try { if (conn) conn.close(); } catch (e) { /* already closed */ }
        try { if (peer) peer.destroy(); } catch (e) { /* already gone */ }
      }, 200);
      if (W.state && W.state.mode === 'live') W.state.mode = 'solo';
      if (!quiet) this.emit();
    },
  };

  W.live = live;
  // Next on a finished round: the host moves both players on; solo just goes on.
  W.advance = () => (live.active ? live.hostNext() : W.next());
  window.addEventListener('pagehide', () => live.leave(true));
})();
