/* =========================================================
   palette.js · "Pick your palette" (after challenge 5)

   The last personality pick: which colour palette would you
   dress your fonts in? It nudges your traits a little (see
   WYT.PALETTE_NUDGE in types.js), recolours the whole game,
   and shows up on your Type Card.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});

  W.screens = W.screens || {};
  W.screens.palette = {
    enter(el, state) {
      const h = W.h, T = W.type;
      const type = W.resultFor(W.traitsFrom(state.results)).type; // your font so far
      let picked = state.results.palette || null;
      let sent = false; // live room: my pick has gone to the friend

      const next = T.magButton(h('button', {
        class: 'big', disabled: !picked,
        onclick: () => {
          if (!picked) return;
          if (sent) { W.advance(); return; }           // host moves both players on
          if (W.live.active) { sent = true; W.live.roundDone('palette', { palette: picked }, { nextBtn: next }); return; }
          W.next();
        },
      }), 'Next', 'pal-next');

      const grid = h('div', { class: 'pal-pick' });
      const render = () => grid.replaceChildren(...T.PALETTES.map(p => {
        const colours = p.colors.filter(c => !['#111111', '#000000', '#ffffff', '#f3ead3', '#fff3d6', '#c0c0c0', '#808080'].includes(c));
        const on = p.id === picked;
        return h('button', {
          class: 'pal-card' + (on ? ' on' : ''), 'aria-pressed': String(on),
          onclick: () => {
            if (sent) return; // already sent in a live room
            picked = p.id;
            state.results.palette = p.id;
            T.setPalette(p.id);
            next.disabled = false;
            render();
          },
        },
          // your font, dressed in this palette
          h('span', { class: 'pal-sample', style: `font-family:"${type.font}";font-weight:${type.weight}` },
            [...'Aa'].map((ch, i) => h('span', {
              style: `background:${colours[i % colours.length] || p.colors[i]};color:${T.inkFor(colours[i % colours.length] || p.colors[i])}`,
            }, ch))),
          h('span', { class: 'pal-swatches' }, p.colors.map(c => h('span', { class: 'pal-swatch', style: `background:${c}` }))),
          h('span', { class: 'pal-name' }, p.name),
          h('span', { class: 'pal-note' }, p.note));
      }));
      render();

      el.append(h('div', { class: 'stack' },
        T.sticker('Last one', -4),
        T.ransom('Pick your palette', 34, 'pick palette'),
        T.human('for your fonts. it says a lot about you.'),
        grid,
        h('div', { class: 'actions' }, next)));
    },
  };
})();
