/* =========================================================
   icons.js · pixel icons drawn in code (original art)
   Each icon is a list of text rows. One letter = one pixel.
   The letter picks a colour from PAL. "." = see-through.
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});

  const PAL = {
    k: '#000000', w: '#ffffff', g: '#c0c0c0', d: '#808080',
    y: '#ffff00', o: '#808000', b: '#000080', B: '#0000ff',
    p: '#ff6fa8', P: '#f4c6d7', r: '#ff0000', c: '#00ffff',
  };

  // CD: drawn with maths (a ring with rainbow sheen)
  function cdRows() {
    const rows = [];
    for (let y = 0; y < 16; y++) {
      let s = '';
      for (let x = 0; x < 16; x++) {
        const dx = x - 7.5, dy = y - 7.5, dist = Math.hypot(dx, dy);
        let c = '.';
        if (dist < 7.6) {
          if (dist < 1.6) c = '.';
          else if (dist < 2.6) c = 'd';
          else if (dist > 6.6) c = 'k';
          else {
            const a = Math.atan2(dy, dx);
            c = a > -2.4 && a < -1.4 ? 'c'
              : a >= -1.4 && a < -0.7 ? 'y'
              : a > 0.6 && a < 1.5 ? 'p'
              : 'w';
          }
        }
        s += c;
      }
      rows.push(s);
    }
    return rows;
  }

  const ICONS = {
    folder: [
      '................',
      '................',
      '.kkkkk..........',
      'kyyyyyk.........',
      'kyyyyyykkkkkkkk.',
      'kywwwwwwwwwwwwok',
      'kyyyyyyyyyyyyyok',
      'kyyyyyyyyyyyyyok',
      'kyyyyyyyyyyyyyok',
      'kyyyyyyyyyyyyyok',
      'kyyyyyyyyyyyyyok',
      'kyyyyyyyyyyyyyok',
      'kyyyyyyyyyyyyyok',
      'kooooooooooooook',
      '.kkkkkkkkkkkkkk.',
      '................',
    ],
    floppy: [
      'kkkkkkkkkkkkkkk.',
      'kBBBgggggggBBBk.',
      'kBBBgggkkggBBBk.',
      'kBBBgggkkggBBBk.',
      'kBBBgggggggBBBkk',
      'kBBBBBBBBBBBBBBk',
      'kBBBBBBBBBBBBBBk',
      'kBwwwwwwwwwwwwBk',
      'kBwkkkkkkkkkwwBk',
      'kBwwwwwwwwwwwwBk',
      'kBwkkkkkkwwwwwBk',
      'kBwwwwwwwwwwwwBk',
      'kBwwwwwwwwwwwwBk',
      'kBwwwwwwwwwwwwBk',
      'kkkkkkkkkkkkkkkk',
      '................',
    ],
    cd: cdRows(),
    trash: [
      '................',
      '......kkkk......',
      '.kkkkkkkkkkkkkk.',
      '.kggggggggggggk.',
      '.kkkkkkkkkkkkkk.',
      '..kgdgdgdgdgdk..',
      '..kgdgdgdgdgdk..',
      '..kgdgdgdgdgdk..',
      '..kgdgdgdgdgdk..',
      '..kgdgdgdgdgdk..',
      '..kgdgdgdgdgdk..',
      '..kgdgdgdgdgdk..',
      '..kgdgdgdgdgdk..',
      '..kgdgdgdgdgdk..',
      '...kkkkkkkkkk...',
      '................',
    ],
    help: [
      '................',
      '..kkkkkkkkkkkk..',
      '..kbbbbbbbbbbk..',
      '..kbbbwwwwbbbk..',
      '..kbbwwbbwwbbk..',
      '..kbbbbbbwwbbk..',
      '..kbbbbbwwbbbk..',
      '..kbbbbwwbbbbk..',
      '..kbbbbwwbbbbk..',
      '..kbbbbbbbbbbk..',
      '..kbbbbwwbbbbk..',
      '..kbbbbbbbbbbk..',
      '..kkkkkkkkkkkk..',
      '................',
      '................',
      '................',
    ],
    heart: [
      '.kk.kk.',
      'kwpkppk',
      'kpppppk',
      '.kpppk.',
      '..kpk..',
      '...k...',
    ],
    pencil: [
      '...........kk...',
      '..........kppk..',
      '.........kpppk..',
      '........kgkpk...',
      '.......kyygk....',
      '......kyyyk.....',
      '.....kyyyk......',
      '....kyyyk.......',
      '...kyyyk........',
      '..kwyyk.........',
      '..kwwk..........',
      '.kwwk...........',
      '.kkk............',
      '.k..............',
    ],
    bucket: [
      '.....kkk........',
      '....k...k.......',
      '...kkkkkkk......',
      '..kwwwwwwwk.....',
      '.kwwwwwwwwwk....',
      'kgwwwwwwwwwgk...',
      'kggwwwwwwwggkBB.',
      '.kggwwwwwggk.BBB',
      '..kggwwwggk..BBB',
      '...kggggggk...BB',
      '....kkkkkk....B.',
    ],
    eraser: [
      '........kkkkkkk.',
      '.......kppppppkk',
      '......kppppppkwk',
      '.....kppppppkwwk',
      '....kppppppkwwk.',
      '...kkkkkkkkwwk..',
      '..kwwwwwwkwwk...',
      '.kwwwwwwkwwk....',
      'kwwwwwwkwwk.....',
      'kwwwwwwkwk......',
      'kkkkkkkkk.......',
    ],
    speaker: [
      '.....k......',
      '....kk...k..',
      'kkkkdk....k.',
      'kwwkdk.k..k.',
      'kwwkdk..k..k',
      'kwwkdk..k..k',
      'kwwkdk.k..k.',
      'kkkkdk....k.',
      '....kk...k..',
      '.....k......',
    ],
    speakerMuted: [
      '.....k......',
      '....kk......',
      'kkkkdk.r...r',
      'kwwkdk..r.r.',
      'kwwkdk...r..',
      'kwwkdk...r..',
      'kwwkdk..r.r.',
      'kkkkdk.r...r',
      '....kk......',
      '.....k......',
    ],
  };

  const cache = {};

  // Returns a PNG data URL of the icon, each pixel drawn as a scale×scale square
  W.iconURL = function (name, scale = 3) {
    const key = name + '@' + scale;
    if (cache[key]) return cache[key];
    const rows = ICONS[name];
    if (!rows) return '';
    const cols = Math.max(...rows.map(r => r.length));
    const cv = document.createElement('canvas');
    cv.width = cols * scale;
    cv.height = rows.length * scale;
    const ctx = cv.getContext('2d');
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (!PAL[ch]) return;
        ctx.fillStyle = PAL[ch];
        ctx.fillRect(x * scale, y * scale, scale, scale);
      });
    });
    return (cache[key] = cv.toDataURL());
  };
})();
