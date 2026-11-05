/* =========================================================
   compat.js · the Compatibility screen

   No friend yet → SHARE: your code + QR + Copy, and a box
   to paste a friend's code (or their link).
   Friend loaded → MATCH: % match, verdict line, your two fonts
   as a pair, both mini cards, and trait by trait: why.

   Uses only the share codes (js/net.js), so it works offline.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});

  /* A small Win95 card for one player */
  function miniCard(p) {
    const h = W.h, T = W.type;
    const type = W.resultFor(p.traits).type;
    const av = W.avatarCanvas(p.avatar, 4);
    av.className = 'mini-avatar';
    return h('div', { class: 'window mini-card' },
      h('div', { class: 'title-bar' }, h('div', { class: 'title-bar-text' }, p.name)),
      h('div', { class: 'window-body mini-body' },
        av,
        h('p', { class: 'human mini-type' }, type.name),
        h('p', { class: 'mini-specimen', style: `font-family:"${type.font}";font-weight:${type.weight}` }, p.name),
        T.label(type.font)));
  }

  W.screens = W.screens || {};
  W.screens.compat = {
    enter(el, state) {
      this.el = el;
      this.state = state;
      // live room: their card can arrive a moment after mine
      this.onLive = () => { if (this.waiting && (state.friend || !W.live.active)) this.render(); };
      W.live.on(this.onLive);
      this.render();
    },

    render() {
      const el = this.el, state = this.state;
      el.replaceChildren();
      el.scrollTop = 0;
      const me = W.net.mine(state);
      this.waiting = false;
      if (!me) return this.renderNoCard();
      if (state.friend) return this.renderMatch(me, state.friend);
      if (W.live.active) { this.waiting = true; return this.renderWaiting(); }
      return this.renderShare(me);
    },

    /* live room: my card is done, theirs is on its way */
    renderWaiting() {
      const h = W.h, T = W.type;
      this.el.append(h('div', { class: 'stack' },
        T.sticker('Live room', -4),
        T.ransom('Almost', 40, 'almost'),
        T.human(`waiting for ${W.live.opp}'s card...`),
        T.magButton(h('button', { onclick: () => { W.live.leave(); this.render(); } }), 'Compare by code', 'fallback')));
    },

    /* nobody on this device has played yet */
    renderNoCard() {
      const h = W.h, T = W.type;
      this.el.append(h('div', { class: 'stack' },
        T.sticker('Compare', -4),
        T.ransom('Play first', 40, 'play first'),
        T.human('get your card, then swap codes.'),
        T.magButton(h('button', { class: 'big', onclick: () => W.go('lobby') }), 'Play solo')));
    },

    /* your code + QR, and a box for theirs */
    renderShare(me) {
      const h = W.h, T = W.type, state = this.state;
      const url = W.net.shareURL(me.share);

      const codeBox = h('textarea', { class: 'code-box', readonly: true, rows: 3, 'aria-label': 'Your share code' });
      codeBox.value = me.share;
      const copied = h('span', { class: 'label copied', 'aria-live': 'polite' });
      const copyBtn = h('button', {
        onclick: async () => {
          const ok = await W.net.copy(me.share, codeBox);
          copied.textContent = ok ? 'Copied!' : 'Select and copy';
        },
      }, 'Copy code');

      const qr = W.net.qrImage(url);
      const qrBox = qr
        ? h('a', { class: 'qr', href: url, 'aria-label': 'Your share link' }, qr)
        : T.label('QR needs the internet. The code still works.');

      const input = h('textarea', {
        class: 'code-box', rows: 3, placeholder: 'Paste their code or link',
        'aria-label': "Friend's code", autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false',
      });
      const error = h('p', { class: 'label error', 'aria-live': 'polite' });
      const compare = T.magButton(h('button', {
        class: 'big', 'data-sfx': 'none',
        onclick: () => {
          const friend = W.net.decode(input.value);
          if (!friend) {
            W.sound.play('bonk');
            error.textContent = "That code didn't work";
            return;
          }
          W.sound.play('ding');
          state.friend = friend;
          this.render();
        },
      }), 'Compare', 'compare-go');

      this.el.append(h('div', { class: 'stack compat-stack' },
        T.sticker('Compare by code', -4),
        T.ransom('Find your match', 34, 'find your match'),
        T.human('swap codes with a friend.'),

        h('div', { class: 'window share-win' },
          h('div', { class: 'title-bar' }, h('div', { class: 'title-bar-text' }, 'Your code')),
          h('div', { class: 'window-body share-body' },
            qrBox,
            h('div', { class: 'share-side' },
              T.label('Scan or copy'),
              codeBox,
              h('div', { class: 'row' }, copyBtn),
              copied))),

        h('div', { class: 'window share-win' },
          h('div', { class: 'title-bar' }, h('div', { class: 'title-bar-text' }, "Friend's code")),
          h('div', { class: 'window-body share-body col' }, input, error)),

        compare,
        h('div', { class: 'row' },
          T.magButton(h('button', { onclick: () => W.rematchSolo() }), 'Rematch', 'rematch-solo'),
          T.magButton(h('button', { onclick: () => { state.friend = null; W.go('lobby'); } }), 'Lobby', 'lobby'))));
    },

    /* the result */
    renderMatch(me, friend) {
      const h = W.h, T = W.type, state = this.state;
      const m = W.compatibility(me.traits, friend.traits);
      const tA = W.resultFor(me.traits).type, tB = W.resultFor(friend.traits).type;
      W.sound.play(m.score >= 85 ? 'levelup' : 'ding');
      if (m.score >= 85) setTimeout(() => W.fx.burst(this.el.querySelector('.compat-stack .ransom')), 200);

      // trait by trait: both of you on one scale, and the points it earned
      const rows = W.TRAITS.map((t, i) => h('div', { class: 'axis-row' },
        h('div', { class: 'axis-top' },
          h('span', { class: 'axis-name' }, t.name),
          h('span', { class: 'axis-same' }, `best ${m.best[i]}`),
          h('span', { class: 'axis-pts' }, `${m.parts[i]}/${m.max[i]}`)),
        h('div', { class: 'axis-scale' },
          h('span', {}, t.low),
          h('span', { class: 'axis-track' },
            h('i', { class: 'dot me', style: `left:${me.traits[i] * 100}%`, title: me.name }),
            h('i', { class: 'dot them', style: `left:${friend.traits[i] * 100}%`, title: friend.name })),
          h('span', {}, t.high))));

      this.el.append(h('div', { class: 'stack compat-stack' },
        T.sticker(`${me.name} × ${friend.name}`, -3),
        T.ransom(m.score + '%', 84, 'score' + m.score, { mixCase: false }),
        T.human(m.verdict),
        h('p', { class: 'pair-line' },
          h('span', { style: `font-family:"${tA.font}";font-weight:${tA.weight}` }, tA.font),
          h('span', { class: 'pair-x' }, ' × '),
          h('span', { style: `font-family:"${tB.font}";font-weight:${tB.weight}` }, tB.font)),
        me.share === friend.share && T.sticker("That's you!", 4),
        h('div', { class: 'mini-pair' }, miniCard(me), miniCard(friend)),
        h('div', { class: 'window axis-win' },
          h('div', { class: 'title-bar' }, h('div', { class: 'title-bar-text' }, 'Why')),
          h('div', { class: 'window-body axis-body' },
            h('p', { class: 'axis-key' },
              h('i', { class: 'dot me' }), ` ${me.name}  `, h('i', { class: 'dot them' }), ` ${friend.name}`),
            rows)),
        W.live.connected
          ? [
              T.magButton(h('button', { class: 'big', onclick: () => W.live.rematch() }), 'Rematch', 'rematch'),
              T.magButton(h('button', { onclick: () => { W.live.leave(); state.friend = null; W.go('lobby'); } }), 'Leave room', 'leave'),
            ]
          : [
              T.magButton(h('button', { class: 'big', onclick: () => { state.friend = null; this.render(); } }), 'Try another code', 'another'),
              h('div', { class: 'row' },
                T.magButton(h('button', { onclick: () => W.rematchSolo() }), 'Rematch', 'rematch-solo'),
                T.magButton(h('button', { onclick: () => { state.friend = null; W.go('lobby'); } }), 'Lobby', 'lobby')),
            ]));
    },

    exit() { W.live.off(this.onLive); },
  };
})();
