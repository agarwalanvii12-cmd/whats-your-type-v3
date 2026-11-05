/* =========================================================
   types.js · the 16 types (scoring + compatibility in step 5)
   Code letters: Bold/Light · Grid/Freeform · Retro/New · Kerner/Vibes
   ========================================================= */
(function () {
  'use strict';
  const W = (window.WYT = window.WYT || {});

  W.AXES = [
    { name: 'Volume',    letters: ['B', 'L'], words: ['Bold', 'Light'] },
    { name: 'Structure', letters: ['G', 'F'], words: ['Grid', 'Freeform'] },
    { name: 'Era',       letters: ['R', 'N'], words: ['Retro', 'New'] },
    { name: 'Precision', letters: ['K', 'V'], words: ['Kerner', 'Vibes'] },
  ];

  // Placeholders from BRIEF.md. Anvii will rename these.
  W.TYPES = {
    BGRK: { name: 'The Letterpress Boss', font: 'Playfair Display', weight: 900 },
    BGRV: { name: 'The Arcade Cabinet',   font: 'Press Start 2P',   weight: 400 },
    BGNK: { name: 'The Swiss Machine',    font: 'Archivo Black',    weight: 400 },
    BGNV: { name: 'The Billboard Brat',   font: 'Anton',            weight: 400 },
    BFRK: { name: 'The Neon Diner',       font: 'Monoton',          weight: 400 },
    BFRV: { name: 'The Pixel Punk',       font: 'Silkscreen',       weight: 400 },
    BFNK: { name: 'The Chrome Kid',       font: 'Unbounded',        weight: 400 },
    BFNV: { name: 'The Chaos Engine',     font: 'Rubik Glitch',     weight: 400 },
    LGRK: { name: 'The Old Soul',         font: 'EB Garamond',      weight: 400 },
    LGRV: { name: 'The Typewriter Poet',  font: 'Special Elite',    weight: 400 },
    LGNK: { name: 'The Quiet Modernist',  font: 'Work Sans',        weight: 300 },
    LGNV: { name: 'The Terminal Dreamer', font: 'VT323',            weight: 400 },
    LFRK: { name: 'The Art Deco Ghost',   font: 'Josefin Sans',     weight: 300 },
    LFRV: { name: 'The Scrapbook Heart',  font: 'Caveat',           weight: 400 },
    LFNK: { name: 'The Soft Futurist',    font: 'Space Grotesk',    weight: 300 },
    LFNV: { name: 'The Cloud Doodler',    font: 'Comfortaa',        weight: 400 },
  };
})();
