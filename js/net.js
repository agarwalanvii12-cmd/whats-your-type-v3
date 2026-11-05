/* =========================================================
   net.js · share codes (step 6) + PeerJS live rooms (step 7)

   SHARE CODE · the compare-by-code fallback. Works with zero
   network: everything about your card is packed into one short
   text code (and a QR of a link with that code in it).

   What's inside, byte by byte:
     1  version (1)
     1  Type Code: 4 bits, one per axis (0 = first letter)
     1+ name: length, then UTF-8 bytes (max 12 characters)
     3  6 stats, 4 bits each (0..15)
     …  avatar, run-length packed: each byte = 3 bits "how many
        in a row" (1..8) + 5 bits "which colour" (0 = empty)
     1  checksum, so a broken paste is caught
   Then base64url (letters, digits, - and _), safe in a URL.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});
  const CELLS = 24 * 24;
  const VERSION = 1;

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

  /* card: { name, code, avatar, stats: [{label, value}] } → "AQ..." */
  function encode(card) {
    const bytes = [VERSION];

    let bits = 0;
    [...card.code].forEach((ch, i) => { if (ch === W.AXES[i].letters[1]) bits |= 1 << i; });
    bytes.push(bits);

    const name = new TextEncoder().encode([...(card.name || 'Anon')].slice(0, 12).join(''));
    bytes.push(name.length, ...name);

    const q = (card.stats || []).map(s => Math.round(clamp01(s.value) * 15));
    while (q.length < 6) q.push(0);
    bytes.push((q[0] << 4) | q[1], (q[2] << 4) | q[3], (q[4] << 4) | q[5]);

    const cells = card.avatar && card.avatar.length === CELLS ? card.avatar : new Array(CELLS).fill(-1);
    for (let i = 0; i < CELLS;) {
      const v = cells[i];
      let run = 1;
      while (i + run < CELLS && cells[i + run] === v && run < 8) run++;
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
      if (b[p++] !== VERSION) return null;
      const bits = b[p++];
      const code = W.AXES.map((axis, i) => axis.letters[(bits >> i) & 1]).join('');

      const len = b[p++];
      if (len > 48) return null;
      const name = new TextDecoder().decode(new Uint8Array(b.slice(p, p + len)));
      p += len;

      const q = [];
      for (let k = 0; k < 3; k++) { q.push(b[p] >> 4, b[p] & 15); p++; }
      const labels = W.cardStats({}, {}).map(s => s.label);
      const stats = labels.map((label, i) => ({ label, value: q[i] / 15 }));

      const avatar = [];
      while (avatar.length < CELLS && p < b.length) {
        const run = (b[p] >> 5) + 1, v = (b[p] & 31) - 1;
        p++;
        if (v > 27) return null;
        for (let k = 0; k < run; k++) avatar.push(v);
      }
      if (avatar.length !== CELLS || p !== b.length) return null;

      return { name: name || 'Anon', code, avatar, stats, share: str };
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
