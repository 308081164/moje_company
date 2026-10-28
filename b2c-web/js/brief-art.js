(function () {
  'use strict';

  var BASE = 'assets/brief/';
  var INK = '#2b261f';
  var GOLD = '#a67c42';

  function photo(name, cls) {
    return '<img class="' + cls + '" src="' + BASE + name + '" alt="" loading="lazy">';
  }

  function svg(inner) {
    return '<svg viewBox="0 0 320 200" fill="none" aria-hidden="true">'
      + '<rect x="1" y="1" width="318" height="198" rx="28" fill="#f7f1e6" stroke="#e4d8c4"/>'
      + '<ellipse cx="160" cy="170" rx="76" ry="7" fill="#e8ddc9"/>'
      + inner + '</svg>';
  }
  function ink(w) { return 'stroke="' + INK + '" stroke-width="' + (w || 2.4) + '" stroke-linecap="round" stroke-linejoin="round" fill="none"'; }
  function gold(w) { return 'stroke="' + GOLD + '" stroke-width="' + (w || 2.4) + '" stroke-linecap="round" stroke-linejoin="round" fill="none"'; }
  function link(cx, rot) { return '<ellipse cx="' + cx + '" cy="52" rx="16" ry="26" transform="rotate(' + (rot || -22) + ' ' + cx + ' 52)" fill="#fffaf0" ' + ink(2) + '/>'; }
  function flat(cx) { return '<ellipse cx="' + cx + '" cy="52" rx="18" ry="9" transform="rotate(-24 ' + cx + ' 52)" fill="#fffaf0" ' + ink(2) + '/>'; }
  function box(cx) { return '<rect x="' + (cx - 15) + '" y="32" width="30" height="30" rx="5" fill="#fffaf0" ' + ink(2) + '/>'; }
  function bead(cx) { return '<circle cx="' + cx + '" cy="52" r="13" fill="#fffaf0" ' + ink(2) + '/>'; }
  function chain(g) { return '<g transform="translate(20 36)">' + g + '</g>'; }

  var PHOTOS = {
    welcome: 'plating.jpg',
    ring: 'ring-close.jpg',
    measure: 'ring-close.jpg',
    necklace: 'pendant.jpg',
    collar: 'necklace.jpg',
    bracelet: 'bracelet.jpg',
    'bangle-id': 'bracelet.jpg',
    'bangle-circ': 'bracelet.jpg',
    'bangle-open': 'bracelet.jpg',
    earring: 'earring.jpg',
    brooch: 'gold-set.jpg',
    hair: 'pendant.jpg',
    'hair-clip': 'pendant.jpg',
    'hair-pin': 'pendant.jpg',
    'hair-chain': 'necklace.jpg',
    charm: 'pendant.jpg',
    other: 'gold-set.jpg',
    plating: 'plating.jpg',
    'plating-none': 'ring-gold.jpg',
    'plating-white': 'earring.jpg',
    'plating-yellow': 'ring-gold.jpg',
    'plating-rose': 'ring-close.jpg',
    'plating-split': 'plating.jpg',
    enamel: 'gemstone.jpg',
    stone: 'gemstone.jpg',
    cz: 'gemstone.jpg',
    moissanite: 'gemstone.jpg',
    corundum: 'gemstone.jpg',
    spinel: 'earring.jpg',
    glass: 'earring.jpg',
    lab: 'gemstone.jpg',
    'stone-other': 'gemstone.jpg',
    budget: 'budget.jpg',
    pure: 'ring-gold.jpg',
    review: 'plating.jpg'
  };

  var CHAIN_PHOTOS = {
    O: 'o.jpg',
    CROSS: 'anchor.jpg',
    CHOPARD: 'curb.jpg',
    WAVE: 'rope.jpg',
    TWIST: 'rope.jpg',
    BOX: 'curb.jpg',
    BEAD: 'bead.jpg',
    SNAKE: 'snake.jpg',
    CURB: 'curb.jpg',
    DIAMOND_CUT: 'curb.jpg',
    STAR: 'curb.jpg',
    OTHER: 'curb.jpg'
  };

  var CHAIN = {};
  var LEGACY_CHAIN = {
    O: svg(chain(link(34) + link(68) + link(102) + link(136) + link(170) + link(204) + link(238))),
    CROSS: svg(chain('<rect x="24" y="42" width="44" height="20" rx="10" fill="#fffaf0" ' + ink(2) + '/>'
      + '<ellipse cx="104" cy="52" rx="14" ry="22" fill="#fffaf0" ' + gold(2.4) + '/>'
      + '<rect x="148" y="42" width="44" height="20" rx="10" fill="#fffaf0" ' + ink(2) + '/>'
      + '<ellipse cx="228" cy="52" rx="14" ry="22" fill="#fffaf0" ' + gold(2.4) + '/>')),
    CHOPARD: svg(chain(box(34) + box(68) + box(102) + box(136) + box(170) + box(204) + box(238))),
    WAVE: svg(chain('<path d="M24 52c14-22 22 22 36 0s22 22 36 0 22 22 36 0 22 22 36 0 22 22 36 0 22 22 32 0" ' + gold(3) + '/>')),
    TWIST: svg(chain('<path d="M24 30c20 34 20 34 40 0s20-34 40 0 20 34 40 0 20 34 40 0 20 34 40 0" ' + ink(2.4) + '/><path d="M24 74c20-34 20-34 40 0s20 34 40 0 20-34 40 0 20 34 40 0 20 34 40 0" ' + gold(2.4) + '/>')),
    BOX: svg(chain(box(34) + box(70) + box(106) + box(142) + box(178) + box(214) + box(250))),
    BEAD: svg(chain(bead(34) + bead(66) + bead(98) + bead(130) + bead(162) + bead(194) + bead(226) + bead(258))),
    SNAKE: svg(chain('<path d="M20 38h240v28H20z" fill="#fffaf0" ' + ink(2) + '/>'
      + '<path d="M38 38l10 28M64 38l10 28M90 38l10 28M116 38l10 28M142 38l10 28M168 38l10 28M194 38l10 28M220 38l10 28M246 38l10 28" ' + gold(1.5) + '/>')),
    CURB: svg(chain(flat(38) + flat(72) + flat(106) + flat(140) + flat(174) + flat(208) + flat(242))),
    DIAMOND_CUT: svg(chain(flat(40) + '<path d="M40 38l5 12-5 12-5-12z" fill="' + GOLD + '"/>'
      + flat(98) + '<path d="M98 38l5 12-5 12-5-12z" fill="' + GOLD + '"/>'
      + flat(156) + '<path d="M156 38l5 12-5 12-5-12z" fill="' + GOLD + '"/>'
      + flat(214) + '<path d="M214 38l5 12-5 12-5-12z" fill="' + GOLD + '"/>')),
    STAR: svg(chain('<path d="M24 60h232" ' + ink(2.2) + '/>'
      + '<path d="M52 34l4 10 10 2-8 7 2 10-8-6-8 6 2-10-8-7 10-2zM120 34l4 10 10 2-8 7 2 10-8-6-8 6 2-10-8-7 10-2zM188 34l4 10 10 2-8 7 2 10-8-6-8 6 2-10-8-7 10-2z" fill="' + GOLD + '"/>')),
    OTHER: svg('<circle cx="160" cy="100" r="34" fill="#fffaf0" ' + ink(2) + '/><path d="M160 82v36M142 100h36" ' + gold(2) + '/>')
  };

  function img(key, cls) {
    if (CHAIN[key]) return CHAIN[key];
    var chainFile = CHAIN_PHOTOS[key];
    if (chainFile) return photo('chains/' + chainFile, cls);
    var name = PHOTOS[key] || PHOTOS.welcome;
    return photo(name, cls);
  }

  window.BRIEF_ART = {
    plate: function (key) { return img(key, 'brief-photo brief-photo--plate'); },
    mark: function (key) { return img(key, 'brief-photo brief-photo--mark'); }
  };
})();
