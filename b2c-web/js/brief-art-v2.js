(function () {
  'use strict';

  var INK = '#1c1915';
  var GOLD = '#a67c42';
  var ROSE = '#c4897b';

  function ink(w) { return 'stroke="' + INK + '" stroke-width="' + (w || 2.6) + '" stroke-linecap="round" stroke-linejoin="round" fill="none"'; }
  function gold(w) { return 'stroke="' + GOLD + '" stroke-width="' + (w || 2.6) + '" stroke-linecap="round" stroke-linejoin="round" fill="none"'; }
  function plate(inner) {
    return '<svg viewBox="0 0 320 200" fill="none" aria-hidden="true">'
      + '<rect x="1" y="1" width="318" height="198" rx="30" fill="#fbf8f1" stroke="#ece2d0"/>'
      + '<rect x="14" y="14" width="292" height="172" rx="22" fill="none" stroke="#f0e6d6" stroke-dasharray="3 6"/>'
      + inner + '</svg>';
  }
  function mark(inner) {
    return '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">' + inner + '</svg>';
  }

  function stone(x, y, r, fill) {
    return '<path d="M' + x + ' ' + (y - r) + 'l' + (r * 0.82) + ' ' + (r * 0.5) + 'l-' + (r * 0.82) + ' ' + (r * 1.35) + 'l-' + (r * 0.82) + ' -' + (r * 1.35) + 'z" fill="' + fill + '" ' + ink(2) + '/>'
      + '<path d="M' + (x - r * 0.82) + ' ' + (y - r * 0.5) + 'h' + (r * 1.64) + 'M' + (x - r * 0.28) + ' ' + (y - r) + 'l' + (r * 0.28) + ' ' + (r * 1.85) + 'l' + (r * 0.28) + ' -' + (r * 1.85) + '" ' + gold(1.2) + '/>';
  }

  function ringDraw(cx, cy, s) {
    return '<g transform="translate(' + cx + ' ' + cy + ') scale(' + s + ')">'
      + '<ellipse cx="0" cy="10" rx="34" ry="22" fill="none" ' + ink(3) + '/>'
      + '<ellipse cx="0" cy="10" rx="19" ry="11" fill="none" ' + ink(1.4) + '/>'
      + '<path d="M-18 -6l9-18h18l9 18" fill="none" ' + gold(2.2) + '/>'
      + '<circle cx="0" cy="-27" r="8" fill="none" ' + gold(2.2) + '/>'
      + '<path d="M-4 -31l4 8 4-8" ' + ink(1.2) + '/>'
      + '</g>';
  }

  function sparkle(x, y) {
    return '<path d="M' + x + ' ' + (y - 7) + 'l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="' + GOLD + '"/>';
  }

  function stoneScene(kind) {
    var fill = '#f4f8fb';
    var extra = '';
    if (kind === 'cz') extra = sparkle(128, 80) + sparkle(186, 76);
    else if (kind === 'moissanite') extra = sparkle(122, 74) + sparkle(198, 88) + sparkle(152, 58);
    else if (kind === 'corundum') fill = '#7ea0c4';
    else if (kind === 'spinel') fill = '#d9e7f0';
    else if (kind === 'glass') fill = '#e9f6f2';
    else if (kind === 'lab') fill = '#ffffff';
    return '<g>' + stone(160, 104, 42, fill) + extra + '</g>';
  }

  function chain(g) {
    return '<g transform="translate(28 64)">' + g + '</g>';
  }
  function roundLink(cx, filled) {
    return '<ellipse cx="' + cx + '" cy="40" rx="16" ry="24" transform="rotate(-24 ' + cx + ' 40)" fill="none" ' + (filled ? gold(2.6) : ink(2.6)) + '/>';
  }
  function boxLink(cx, filled) {
    return '<rect x="' + cx + '" y="22" width="30" height="30" rx="4" fill="none" ' + (filled ? gold(2.6) : ink(2.6)) + '/>';
  }
  function bead(cx, filled) {
    return '<circle cx="' + cx + '" cy="40" r="12" fill="none" ' + (filled ? gold(2.6) : ink(2.6)) + '/>';
  }
  function flatLink(cx, filled) {
    return '<ellipse cx="' + cx + '" cy="40" rx="17" ry="9" transform="rotate(-26 ' + cx + ' 40)" fill="none" ' + (filled ? gold(2.6) : ink(2.6)) + '/>';
  }

  var plates = {
    welcome: plate(ringDraw(160, 102, 1.5)),
    ring: plate(ringDraw(160, 102, 1.7)),
    necklace: plate('<path d="M76 54c20 54 148 54 168 0" ' + ink(3) + '/>'
      + '<path d="M148 114l12 28 12-28z" fill="none" ' + gold(2.4) + '/>'),
    brooch: plate('<path d="M160 46l16 30 32 4-24 22 6 32-30-16-30 16 6-32-24-22 32-4z" fill="none" ' + ink(2.6) + '/>'
      + '<circle cx="160" cy="88" r="8" fill="none" ' + gold(2) + '/>'),
    earring: plate('<circle cx="116" cy="62" r="8" fill="none" ' + ink(2.6) + '/><path d="M116 70c0 18 10 34 10 52" ' + gold(2.6) + '/>'
      + '<circle cx="198" cy="84" r="20" fill="none" ' + ink(2.6) + '/><circle cx="198" cy="84" r="7" fill="none" ' + gold(2) + '/>'),
    bracelet: plate('<ellipse cx="160" cy="106" rx="78" ry="42" fill="none" ' + ink(3.4) + '/>'
      + '<ellipse cx="160" cy="106" rx="54" ry="26" fill="none" ' + ink(1.6) + '/>'),
    collar: plate('<path d="M54 118c28-64 184-64 212 0" ' + ink(3.4) + '/>'
      + '<circle cx="70" cy="122" r="6" fill="none" ' + gold(2) + '/><circle cx="250" cy="122" r="6" fill="none" ' + gold(2) + '/>'),
    hair: plate('<path d="M70 150c20-78 160-78 180 0" ' + ink(3) + '/>'
      + '<path d="M142 62h36l-8 48h-20z" fill="none" ' + gold(2.6) + '/>'),
    charm: plate('<circle cx="160" cy="58" r="10" fill="none" ' + ink(2.6) + '/><rect x="124" y="78" width="72" height="64" rx="16" fill="none" ' + gold(2.6) + '/>'),
    other: plate('<circle cx="160" cy="100" r="42" fill="none" ' + ink(2.6) + '/><path d="M160 78v44M138 100h44" ' + gold(2.6) + '/>'),
    measure: plate('<path d="M92 150c8-70 40-80 50-80s30 20 36 80" fill="none" ' + ink(2.6) + '/>'
      + '<path d="M118 96c18 10 36 10 54 0" ' + gold(3) + '/>'
      + '<path d="M206 150h86M210 150v-8M232 150v-14M254 150v-8M276 150v-14" ' + ink(1.6) + '/>'),
    plating: plate(ringDraw(118, 102, 1.15) + '<ellipse cx="222" cy="104" rx="40" ry="28" fill="none" ' + ink(2.6) + '/><path d="M182 104h80" ' + gold(2.6) + '/>'),
    enamel: plate('<path d="M96 150l64-84 64 84z" fill="none" ' + ink(2.6) + '/>'
      + '<path d="M118 150l42-54 42 54z" fill="none" ' + gold(2.6) + '/>'),
    stone: plate(stoneScene('lab')),
    budget: plate(ringDraw(78, 120, 0.55) + ringDraw(160, 112, 0.9) + ringDraw(246, 100, 1.25)),
    pure: plate('<circle cx="148" cy="104" r="40" fill="none" ' + ink(2.6) + '/>'
      + '<path d="M196 70l28 18-10 36" fill="none" ' + gold(2.6) + '/>'),
    review: plate(ringDraw(112, 106, 1.15) + '<path d="M196 110l16 16 36-40" ' + gold(3) + '/>'),
    metal: plate(ringDraw(160, 102, 1.4)),
    'plating-none': plate('<ellipse cx="160" cy="108" rx="72" ry="38" fill="none" ' + ink(2.6) + '/>'),
    'plating-white': plate('<ellipse cx="160" cy="108" rx="72" ry="38" fill="none" ' + ink(2.6) + '/><path d="M96 108h128" ' + gold(1.6) + '/>'),
    'plating-yellow': plate('<ellipse cx="160" cy="108" rx="72" ry="38" fill="none" ' + gold(2.6) + '/>'),
    'plating-rose': plate('<ellipse cx="160" cy="108" rx="72" ry="38" fill="none" ' + ink(2.6) + '/><path d="M118 92a72 30 0 0 1 84 0" ' + gold(2.6) + '/>'),
    'plating-split': plate('<ellipse cx="160" cy="108" rx="72" ry="38" fill="none" ' + ink(2.6) + '/><path d="M160 70v76" ' + gold(2.6) + '/>'),
    cz: plate(stoneScene('cz')),
    moissanite: plate(stoneScene('moissanite')),
    corundum: plate(stoneScene('corundum')),
    spinel: plate(stoneScene('spinel')),
    glass: plate(stoneScene('glass')),
    lab: plate(stoneScene('lab')),
    'stone-other': plate('<circle cx="160" cy="104" r="38" fill="none" ' + ink(2.6) + '/><path d="M160 84v40M140 104h40" ' + gold(2.6) + '/>'),
    'bangle-id': plate('<ellipse cx="150" cy="106" rx="72" ry="42" fill="none" ' + ink(4) + '/>'
      + '<path d="M94 106h112M94 92v28M206 92v28" ' + gold(2) + '/>'),
    'bangle-circ': plate('<ellipse cx="150" cy="106" rx="72" ry="42" fill="none" ' + ink(4) + '/>'
      + '<path d="M150 64a42 42 0 1 1-1 0" ' + gold(2) + '/><path d="M190 70l10-12M190 70l-14-2" ' + gold(2) + '/>'),
    'bangle-open': plate('<path d="M88 108c10-42 122-42 140 0" fill="none" ' + ink(8) + '/>'
      + '<circle cx="216" cy="112" r="24" ' + gold(2, 'stroke-dasharray="3 3"') + '/>'),
    'hair-clip': plate('<path d="M70 150c16-70 150-70 176 0" ' + ink(2.6) + '/><path d="M130 84h60l-10 30H140z" fill="none" ' + gold(2.6) + '/><path d="M138 114h44" ' + ink(1.8) + '/>'),
    'hair-pin': plate('<path d="M90 150c20-80 120-80 140 0" ' + ink(2.6) + '/><path d="M168 44v92" ' + gold(3) + '/><circle cx="168" cy="40" r="9" fill="none" ' + gold(2.2) + '/>'),
    'hair-chain': plate('<path d="M84 132c24-48 128-48 156 0" ' + ink(2.6) + '/>'
      + '<circle cx="120" cy="108" r="7" fill="none" ' + gold(2.4) + '/><circle cx="150" cy="94" r="7" fill="none" ' + gold(2.4) + '/><circle cx="180" cy="108" r="7" fill="none" ' + gold(2.4) + '/>'),
    O: plate(chain(roundLink(40, false) + roundLink(70, true) + roundLink(100, false) + roundLink(130, true) + roundLink(160, false) + roundLink(190, true) + roundLink(220, false))),
    CROSS: plate(chain('<rect x="8" y="30" width="42" height="22" rx="11" fill="none" ' + ink(2.6) + '/>'
      + '<ellipse cx="72" cy="41" rx="14" ry="20" fill="none" ' + gold(2.6) + '/>'
      + '<rect x="98" y="30" width="42" height="22" rx="11" fill="none" ' + ink(2.6) + '/>'
      + '<ellipse cx="162" cy="41" rx="14" ry="20" fill="none" ' + gold(2.6) + '/>'
      + '<rect x="188" y="30" width="42" height="22" rx="11" fill="none" ' + ink(2.6) + '/>')),
    CHOPARD: plate(chain(boxLink(8, false) + boxLink(38, true) + boxLink(68, false) + boxLink(98, true) + boxLink(128, false) + boxLink(158, true) + boxLink(188, false) + boxLink(218, true))),
    WAVE: plate(chain('<path d="M0 40c14-22 24 22 38 0s24 22 38 0 24 22 38 0 24 22 38 0 24 22 38 0 24 22 38 0 24 22 32 0" ' + gold(3.4) + '/>')),
    TWIST: plate(chain('<path d="M0 22c22 36 22 36 44 0s22-36 44 0 22 36 44 0 22 36 44 0 22 36 44 0" ' + ink(2.6) + '/><path d="M0 58c22-36 22-36 44 0s22 36 44 0 22-36 44 0 22 36 44 0 22 36 44 0" ' + gold(2.6) + '/>')),
    BOX: plate(chain(boxLink(16, false) + boxLink(54, true) + boxLink(92, false) + boxLink(130, true) + boxLink(168, false) + boxLink(206, true))),
    BEAD: plate(chain(bead(24, false) + bead(56, true) + bead(88, false) + bead(120, true) + bead(152, false) + bead(184, true) + bead(216, false))),
    SNAKE: plate(chain('<path d="M0 28h248v28H0z" fill="none" ' + ink(2.6) + '/>'
      + '<path d="M16 28l10 28M40 28l10 28M64 28l10 28M88 28l10 28M112 28l10 28M136 28l10 28M160 28l10 28M184 28l10 28M208 28l10 28" ' + gold(1.6) + '/>')),
    CURB: plate(chain(flatLink(30, false) + flatLink(62, true) + flatLink(94, false) + flatLink(126, true) + flatLink(158, false) + flatLink(190, true) + flatLink(222, false))),
    DIAMOND_CUT: plate(chain(flatLink(34, false) + '<path d="M34 30l6 10-6 10-6-10z" fill="none" ' + gold(2) + '/>'
      + flatLink(88, false) + '<path d="M88 30l6 10-6 10-6-10z" fill="none" ' + gold(2) + '/>'
      + flatLink(142, false) + '<path d="M142 30l6 10-6 10-6-10z" fill="none" ' + gold(2) + '/>'
      + flatLink(196, false) + '<path d="M196 30l6 10-6 10-6-10z" fill="none" ' + gold(2) + '/>')),
    STAR: plate(chain('<path d="M8 44h240" ' + ink(2.2) + '/>'
      + '<path d="M30 26l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1zM80 26l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1zM130 26l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1zM180 26l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1zM230 26l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="' + GOLD + '"/>')),
    OTHER: plate('<circle cx="160" cy="100" r="36" fill="none" ' + gold(2.6) + '/><path d="M160 82v36M142 100h36" ' + ink(2.2) + '/>')
  };
  plates.chain = plates.O;

  function miniChain(kind) {
    var body = {
      O: roundLink(18, false) + roundLink(34, true) + roundLink(50, false),
      CROSS: '<rect x="6" y="28" width="18" height="10" rx="5" fill="none" ' + ink(2) + '/><ellipse cx="34" cy="33" rx="7" ry="11" fill="none" ' + gold(2) + '/><rect x="44" y="28" width="14" height="10" rx="5" fill="none" ' + ink(2) + '/>',
      CHOPARD: boxLink(4, false) + boxLink(20, true) + boxLink(36, false),
      WAVE: '<path d="M6 34c7-10 11 10 18 0s11 10 18 0 11 10 16 0" ' + gold(3) + '/>',
      TWIST: '<path d="M8 24c9 20 9 20 18 0s9-20 18 0 9 20 18 0" ' + ink(2) + '/><path d="M8 44c9-20 9-20 18 0s9 20 18 0 9 20 18 0" ' + gold(2) + '/>',
      BOX: boxLink(8, false) + boxLink(26, true) + boxLink(44, false),
      BEAD: bead(18, false) + bead(34, true) + bead(50, false),
      SNAKE: '<path d="M6 26h52v14H6z" fill="none" ' + ink(2) + '/><path d="M14 26l6 14M26 26l6 14M38 26l6 14M50 26l6 14" ' + gold(1.4) + '/>',
      CURB: flatLink(18, false) + flatLink(34, true) + flatLink(50, false),
      DIAMOND_CUT: flatLink(20, false) + '<path d="M20 26l4 6-4 6-4-6z" fill="' + GOLD + '"/>' + flatLink(44, false) + '<path d="M44 26l4 6-4 6-4-6z" fill="' + GOLD + '"/>',
      STAR: '<path d="M8 42h48" ' + ink(2) + '/><path d="M18 22l3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1zM46 22l3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1z" fill="' + GOLD + '"/>',
      OTHER: '<circle cx="32" cy="32" r="12" fill="none" ' + gold(2.2) + '/><path d="M32 24v16M24 32h16" ' + ink(2) + '/>'
    };
    return mark(body[kind] || body.OTHER);
  }

  var marks = {
    welcome: mark(ringDraw(32, 36, 0.6)),
    ring: mark(ringDraw(32, 36, 0.62)),
    necklace: mark('<path d="M12 22c8 18 32 18 40 0" ' + ink(2) + '/><path d="M26 40l6 12 6-12z" fill="none" ' + gold(2) + '/>'),
    brooch: mark('<path d="M32 12l6 10 12 2-9 8 2 12-11-6-11 6 2-12-9-8 12-2z" fill="none" ' + ink(2) + '/>'),
    earring: mark('<circle cx="22" cy="18" r="4" fill="none" ' + ink(2) + '/><path d="M22 22c0 10 4 16 4 24" ' + gold(2) + '/><path d="M36 24h14l4 8c0 6-4 10-11 10s-11-4-11-10z" fill="none" ' + ink(2) + '/>'),
    bracelet: mark('<ellipse cx="32" cy="34" rx="20" ry="12" fill="none" ' + ink(2.6) + '/>'),
    collar: mark('<path d="M10 42c8-20 36-20 44 0" ' + ink(2.4) + '/>'),
    hair: mark('<path d="M12 48c6-24 34-24 40 0" ' + ink(2) + '/><path d="M28 20h8l-2 16h-4z" fill="none" ' + gold(2) + '/>'),
    charm: mark('<circle cx="32" cy="16" r="5" fill="none" ' + ink(2) + '/><rect x="20" y="26" width="24" height="24" rx="6" fill="none" ' + gold(2) + '/>'),
    other: mark('<circle cx="32" cy="32" r="14" fill="none" ' + ink(2) + '/><path d="M32 24v16M24 32h16" ' + gold(2) + '/>'),
    measure: mark('<path d="M24 50c2-22 8-24 8-24s4 6 6 24" ' + ink(2) + '/><path d="M22 30h18" ' + gold(2.2) + '/>'),
    plating: mark('<ellipse cx="32" cy="34" rx="18" ry="10" fill="none" ' + ink(2) + '/>'),
    enamel: mark('<path d="M16 48l16-28 16 28z" fill="none" ' + ink(2) + '/><path d="M22 48l10-16 10 16z" fill="none" ' + gold(1.6) + '/>'),
    stone: mark(stone(32, 34, 14, '#ffffff')),
    budget: mark('<ellipse cx="18" cy="40" rx="8" ry="5" fill="none" ' + ink(1.8) + '/><ellipse cx="36" cy="32" rx="10" ry="7" fill="none" ' + gold(2) + '/>'),
    pure: mark('<circle cx="28" cy="34" r="12" fill="none" ' + ink(2) + '/><path d="M40 24l8 6" ' + gold(2) + '/>'),
    review: mark('<path d="M16 34l10 10 22-24" ' + gold(3) + '/>'),
    metal: mark(ringDraw(32, 36, 0.6)),
    'plating-none': mark('<ellipse cx="32" cy="34" rx="18" ry="10" fill="none" ' + ink(2) + '/>'),
    'plating-white': mark('<ellipse cx="32" cy="34" rx="18" ry="10" fill="none" ' + ink(2) + '/>'),
    'plating-yellow': mark('<ellipse cx="32" cy="34" rx="18" ry="10" fill="none" ' + gold(2) + '/>'),
    'plating-rose': mark('<ellipse cx="32" cy="34" rx="18" ry="10" fill="none" ' + ink(2) + '/><path d="M18 30a16 7 0 0 1 28 0" ' + gold(2) + '/>'),
    'plating-split': mark('<ellipse cx="32" cy="34" rx="18" ry="10" fill="none" ' + ink(2) + '/><path d="M32 24v20" ' + gold(2) + '/>'),
    cz: mark(stone(32, 34, 16, '#f4f8fb')),
    moissanite: mark(stone(32, 34, 16, '#f4f8fb')),
    corundum: mark(stone(32, 34, 16, '#7ea0c4')),
    spinel: mark(stone(32, 34, 16, '#d9e7f0')),
    glass: mark(stone(32, 34, 16, '#e9f6f2')),
    lab: mark(stone(32, 34, 16, '#ffffff')),
    'stone-other': mark('<circle cx="32" cy="32" r="14" fill="none" ' + ink(2) + '/><path d="M32 24v16M24 32h16" ' + gold(2) + '/>'),
    'bangle-id': mark('<ellipse cx="32" cy="32" rx="18" ry="12" fill="none" ' + ink(2) + '/><path d="M18 32h28" ' + gold(2) + '/>'),
    'bangle-circ': mark('<ellipse cx="32" cy="32" rx="18" ry="12" fill="none" ' + ink(2) + '/><path d="M32 20a12 12 0 1 1-1 0" ' + gold(1.8) + '/>'),
    'bangle-open': mark('<path d="M16 36c4-16 28-16 34 0" fill="none" ' + ink(3) + '/>'),
    'hair-clip': mark('<path d="M14 46c4-20 32-20 36 0" ' + ink(2) + '/><path d="M24 24h16l-2 10H26z" fill="none" ' + gold(2) + '/>'),
    'hair-pin': mark('<path d="M16 48c6-22 26-22 32 0" ' + ink(2) + '/><path d="M32 14v28" ' + gold(2) + '/>'),
    'hair-chain': mark('<path d="M12 40c8-16 32-16 40 0" ' + ink(2) + '/><circle cx="24" cy="32" r="4" fill="none" ' + gold(2) + '/><circle cx="40" cy="32" r="4" fill="none" ' + gold(2) + '/>')
  };
  ['O', 'CROSS', 'CHOPARD', 'WAVE', 'TWIST', 'BOX', 'BEAD', 'SNAKE', 'CURB', 'DIAMOND_CUT', 'STAR', 'OTHER'].forEach(function (key) {
    marks[key] = miniChain(key);
  });

  window.BRIEF_ART = {
    plate: function (key) { return plates[key] || plates.welcome; },
    mark: function (key) { return marks[key] || marks.other; }
  };
})();
