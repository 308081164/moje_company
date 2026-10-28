(function () {
  'use strict';

  var INK = '#2b2118';
  var GOLD = '#b98a4a';
  var PAPER = '#fffaf0';
  var ROSE = '#c98f7c';

  function plate(inner) {
    return '<svg viewBox="0 0 320 200" fill="none" aria-hidden="true">'
      + '<rect x="1" y="1" width="318" height="198" rx="30" fill="' + PAPER + '" stroke="#e9d9bd"/>'
      + '<ellipse cx="160" cy="168" rx="76" ry="8" fill="#e8d9bd"/>'
      + inner + '</svg>';
  }
  function mark(inner) {
    return '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">' + inner + '</svg>';
  }
  function edge() { return 'stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"'; }

  function ringDraw(cx, cy, s) {
    return '<g transform="translate(' + cx + ' ' + cy + ') scale(' + s + ')">'
      + '<path d="M-34 10a34 22 0 1 1 68 0 34 22 0 1 1 -68 0" fill="#efe7da" ' + edge() + '/>'
      + '<path d="M-18 -6l9-18h18l9 18" fill="#efe7da" ' + edge() + '/>'
      + '<circle cx="0" cy="-27" r="9" fill="#f6fbff" stroke="' + GOLD + '" stroke-width="2"/>'
      + '<path d="M-4 -31l4 8 4-8" stroke="' + INK + '" stroke-width="1.2"/>'
      + '</g>';
  }

  function stone(x, y, r, fill) {
    return '<path d="M' + x + ' ' + (y - r) + 'l' + (r * 0.85) + ' ' + (r * 0.5) + 'l-' + (r * 0.85) + ' ' + (r * 1.35) + 'l-' + (r * 0.85) + ' -' + (r * 1.35) + 'z" fill="' + fill + '" ' + edge() + '/>'
      + '<path d="M' + (x - r * 0.85) + ' ' + (y - r * 0.5) + 'h' + (r * 1.7) + '" stroke="' + GOLD + '" stroke-width="1.3"/>';
  }

  function sparkle(x, y, color) {
    return '<path d="M' + x + ' ' + (y - 8) + 'l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="' + (color || GOLD) + '"/>';
  }

  function stoneScene(kind) {
    var fill = '#f5f8fb';
    var extra = '';
    if (kind === 'cz') extra = sparkle(130, 82, '#7eb6e0') + sparkle(186, 72, '#d98aa8');
    else if (kind === 'moissanite') extra = sparkle(124, 76, '#c65c82') + sparkle(190, 88, '#5b9ed1') + sparkle(156, 58, '#78b76e');
    else if (kind === 'corundum') fill = '#82a6c8';
    else if (kind === 'spinel') fill = '#dde8f0';
    else if (kind === 'glass') fill = '#eaf6f1';
    else if (kind === 'lab') fill = '#ffffff';
    return '<g>' + stone(160, 104, 44, fill) + extra + '</g>';
  }

  function chain(g) {
    return '<g transform="translate(28 64)">' + g + '</g>';
  }
  function link(cx, cy, rx, ry, rot, fill) {
    return '<ellipse cx="' + cx + '" cy="' + (cy || 40) + '" rx="' + rx + '" ry="' + ry + '" transform="rotate(' + (rot || 0) + ' ' + cx + ' ' + (cy || 40) + ')" fill="' + (fill || '#efe7da') + '" ' + edge() + '/>';
  }
  function box(cx, fill) {
    return '<rect x="' + cx + '" y="22" width="30" height="30" rx="4" fill="' + (fill || '#efe7da') + '" ' + edge() + '/>';
  }
  function bead(cx, fill) {
    return '<circle cx="' + cx + '" cy="40" r="12" fill="' + (fill || '#efe7da') + '" ' + edge() + '/>'
      + '<path d="M' + (cx - 4) + ' 32a8 8 0 0 1 8 0" stroke="#fff" stroke-width="2" stroke-linecap="round"/>';
  }

  var plates = {
    welcome: plate(ringDraw(160, 102, 1.5)),
    ring: plate(ringDraw(160, 102, 1.7)),
    necklace: plate('<path d="M76 54c20 54 148 54 168 0" stroke="' + INK + '" stroke-width="3" fill="none" stroke-linecap="round"/>'
      + '<path d="M148 114l12 28 12-28z" fill="#f6fbff" ' + edge() + '/>'
      + '<circle cx="118" cy="86" r="4" fill="' + GOLD + '"/><circle cx="160" cy="102" r="4" fill="' + GOLD + '"/><circle cx="202" cy="86" r="4" fill="' + GOLD + '"/>'),
    brooch: plate('<path d="M160 46l16 30 32 4-24 22 6 32-30-16-30 16 6-32-24-22 32-4z" fill="#efe7da" ' + edge() + '/>'
      + '<circle cx="160" cy="88" r="9" fill="#82a6c8" ' + edge() + '/>'),
    earring: plate('<circle cx="116" cy="62" r="8" fill="#efe7da" ' + edge() + '/><path d="M116 70c0 18 10 34 10 52" stroke="' + GOLD + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
      + '<path d="M180 58h36l8 22c0 12-10 20-26 20s-26-8-26-20z" fill="#efe7da" ' + edge() + '/>'
      + '<circle cx="126" cy="134" r="9" fill="#f6fbff" ' + edge() + '/>'),
    bracelet: plate('<ellipse cx="160" cy="106" rx="78" ry="42" fill="#efe7da" ' + edge() + '/>'
      + '<ellipse cx="160" cy="106" rx="54" ry="26" fill="none" stroke="' + INK + '" stroke-width="1.6"/>'),
    collar: plate('<path d="M54 118c28-64 184-64 212 0" stroke="' + INK + '" stroke-width="3.4" fill="none" stroke-linecap="round"/>'
      + '<circle cx="70" cy="122" r="6" fill="' + GOLD + '"/><circle cx="250" cy="122" r="6" fill="' + GOLD + '"/>'),
    hair: plate('<path d="M70 150c20-78 160-78 180 0" stroke="' + INK + '" stroke-width="3" fill="none" stroke-linecap="round"/>'
      + '<path d="M142 62h36l-8 48h-20z" fill="#efe7da" ' + edge() + '/>'),
    charm: plate('<circle cx="160" cy="58" r="10" fill="#efe7da" ' + edge() + '/><rect x="124" y="78" width="72" height="64" rx="16" fill="#efe7da" ' + edge() + '/>'
      + '<circle cx="160" cy="110" r="10" fill="#f6fbff" ' + edge() + '/>'),
    other: plate('<circle cx="160" cy="100" r="42" fill="#efe7da" ' + edge() + '/><path d="M160 78v44M138 100h44" stroke="' + GOLD + '" stroke-width="2.6"/>'),
    measure: plate('<path d="M92 150c8-70 40-80 50-80s30 20 36 80" fill="#efe7da" ' + edge() + '/>'
      + '<path d="M118 96c18 10 36 10 54 0" stroke="' + GOLD + '" stroke-width="3" fill="none" stroke-linecap="round"/>'
      + '<path d="M206 150h86M210 150v-8M232 150v-14M254 150v-8M276 150v-14" stroke="' + INK + '" stroke-width="1.6"/>'),
    plating: plate(ringDraw(118, 102, 1.15) + '<ellipse cx="222" cy="104" rx="40" ry="28" fill="#f4f7fb" ' + edge() + '/>'),
    enamel: plate('<path d="M96 150l64-84 64 84z" fill="#efe7da" ' + edge() + '/>'
      + '<path d="M118 150l42-54 42 54z" fill="#82a6c8" ' + edge() + '/>'),
    stone: plate(stoneScene('lab')),
    budget: plate(ringDraw(78, 120, 0.55) + ringDraw(160, 112, 0.9) + ringDraw(246, 100, 1.25)),
    pure: plate('<circle cx="148" cy="104" r="40" fill="#e7c56a" ' + edge() + '/>'
      + '<path d="M196 70l28 18-10 36" fill="#f6fbff" ' + edge() + '/>'),
    review: plate(ringDraw(112, 106, 1.15) + '<path d="M196 110l16 16 36-40" stroke="' + GOLD + '" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
    metal: plate(ringDraw(160, 102, 1.4)),
    'plating-none': plate('<ellipse cx="160" cy="108" rx="72" ry="38" fill="#e7c56a" ' + edge() + '/>'),
    'plating-white': plate('<ellipse cx="160" cy="108" rx="72" ry="38" fill="#f4f7fb" ' + edge() + '/>'),
    'plating-yellow': plate('<ellipse cx="160" cy="108" rx="72" ry="38" fill="#e7c56a" ' + edge() + '/>'),
    'plating-rose': plate('<ellipse cx="160" cy="108" rx="72" ry="38" fill="' + ROSE + '" ' + edge() + '/>'),
    'plating-split': plate('<path d="M88 108a72 38 0 0 1 144 0H88z" fill="#f4f7fb" ' + edge() + '/><path d="M88 108h144a72 38 0 0 1-144 0z" fill="#e7c56a" ' + edge() + '/>'),
    cz: plate(stoneScene('cz')),
    moissanite: plate(stoneScene('moissanite')),
    corundum: plate(stoneScene('corundum')),
    spinel: plate(stoneScene('spinel')),
    glass: plate(stoneScene('glass')),
    lab: plate(stoneScene('lab')),
    'stone-other': plate('<circle cx="160" cy="104" r="38" fill="#efe7da" ' + edge() + '/><path d="M160 84v40M140 104h40" stroke="' + GOLD + '" stroke-width="2.6"/>'),
    'bangle-id': plate('<ellipse cx="150" cy="106" rx="72" ry="42" fill="#efe7da" ' + edge() + '/>'
      + '<path d="M94 106h112M94 92v28M206 92v28" stroke="' + GOLD + '" stroke-width="2"/>'),
    'bangle-circ': plate('<ellipse cx="150" cy="106" rx="72" ry="42" fill="#efe7da" ' + edge() + '/>'
      + '<path d="M150 64a42 42 0 1 1-1 0" stroke="' + GOLD + '" stroke-width="2" fill="none"/><path d="M190 70l10-12M190 70l-14-2" stroke="' + GOLD + '" stroke-width="2" fill="none"/>'),
    'bangle-open': plate('<path d="M88 108c10-42 122-42 140 0" fill="none" stroke="' + INK + '" stroke-width="8" stroke-linecap="round"/>'
      + '<circle cx="216" cy="112" r="24" fill="none" stroke="' + GOLD + '" stroke-width="2" stroke-dasharray="3 3"/>'),
    'hair-clip': plate('<path d="M70 150c16-70 150-70 176 0" stroke="' + INK + '" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M130 84h60l-10 30H140z" fill="#efe7da" ' + edge() + '/>'),
    'hair-pin': plate('<path d="M90 150c20-80 120-80 140 0" stroke="' + INK + '" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M168 44v92" stroke="' + GOLD + '" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="168" cy="40" r="9" fill="#f6fbff" ' + edge() + '/>'),
    'hair-chain': plate('<path d="M84 132c24-48 128-48 156 0" stroke="' + INK + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
      + '<circle cx="120" cy="108" r="7" fill="#efe7da" ' + edge() + '/><circle cx="150" cy="94" r="7" fill="#efe7da" ' + edge() + '/><circle cx="180" cy="108" r="7" fill="#efe7da" ' + edge() + '/>'),
    O: plate(chain(link(40, 40, 16, 24, -24, '#efe7da') + link(70, 40, 16, 24, -24, '#f6fbff') + link(100, 40, 16, 24, -24, '#efe7da') + link(130, 40, 16, 24, -24, '#f6fbff') + link(160, 40, 16, 24, -24, '#efe7da') + link(190, 40, 16, 24, -24, '#f6fbff') + link(220, 40, 16, 24, -24, '#efe7da'))),
    CROSS: plate(chain('<rect x="8" y="30" width="42" height="22" rx="11" fill="#efe7da" ' + edge() + '/>'
      + '<ellipse cx="72" cy="41" rx="14" ry="20" fill="#efe7da" ' + edge() + '/>'
      + '<rect x="98" y="30" width="42" height="22" rx="11" fill="#efe7da" ' + edge() + '/>'
      + '<ellipse cx="162" cy="41" rx="14" ry="20" fill="#efe7da" ' + edge() + '/>'
      + '<rect x="188" y="30" width="42" height="22" rx="11" fill="#efe7da" ' + edge() + '/>')),
    CHOPARD: plate(chain(box(8, '#efe7da') + box(38, '#e7dcc4') + box(68, '#efe7da') + box(98, '#e7dcc4') + box(128, '#efe7da') + box(158, '#e7dcc4') + box(188, '#efe7da') + box(218, '#e7dcc4'))),
    WAVE: plate(chain('<path d="M0 40c14-22 24 22 38 0s24 22 38 0 24 22 38 0 24 22 38 0 24 22 38 0 24 22 38 0 24 22 32 0" stroke="' + GOLD + '" stroke-width="3.4" fill="none" stroke-linecap="round"/>')),
    TWIST: plate(chain('<path d="M0 22c22 36 22 36 44 0s22-36 44 0 22 36 44 0 22 36 44 0 22 36 44 0" stroke="' + INK + '" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M0 58c22-36 22-36 44 0s22 36 44 0 22-36 44 0 22 36 44 0 22 36 44 0" stroke="' + GOLD + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>')),
    BOX: plate(chain(box(16, '#efe7da') + box(54, '#e7dcc4') + box(92, '#efe7da') + box(130, '#e7dcc4') + box(168, '#efe7da') + box(206, '#e7dcc4'))),
    BEAD: plate(chain(bead(24, '#efe7da') + bead(56, '#e7dcc4') + bead(88, '#efe7da') + bead(120, '#e7dcc4') + bead(152, '#efe7da') + bead(184, '#e7dcc4') + bead(216, '#efe7da'))),
    SNAKE: plate(chain('<path d="M0 28h248v28H0z" fill="#efe7da" ' + edge() + '/>'
      + '<path d="M16 28l10 28M40 28l10 28M64 28l10 28M88 28l10 28M112 28l10 28M136 28l10 28M160 28l10 28M184 28l10 28M208 28l10 28" stroke="' + GOLD + '" stroke-width="1.6"/>')),
    CURB: plate(chain(link(30, 40, 17, 9, -26, '#efe7da') + link(62, 40, 17, 9, -26, '#e7dcc4') + link(94, 40, 17, 9, -26, '#efe7da') + link(126, 40, 17, 9, -26, '#e7dcc4') + link(158, 40, 17, 9, -26, '#efe7da') + link(190, 40, 17, 9, -26, '#e7dcc4') + link(222, 40, 17, 9, -26, '#efe7da'))),
    DIAMOND_CUT: plate(chain(link(34, 40, 17, 9, -26, '#efe7da') + '<path d="M34 30l6 10-6 10-6-10z" fill="' + GOLD + '"/>'
      + link(88, 40, 17, 9, -26, '#efe7da') + '<path d="M88 30l6 10-6 10-6-10z" fill="' + GOLD + '"/>'
      + link(142, 40, 17, 9, -26, '#efe7da') + '<path d="M142 30l6 10-6 10-6-10z" fill="' + GOLD + '"/>'
      + link(196, 40, 17, 9, -26, '#efe7da') + '<path d="M196 30l6 10-6 10-6-10z" fill="' + GOLD + '"/>')),
    STAR: plate(chain('<path d="M8 44h240" stroke="' + INK + '" stroke-width="2.2"/>'
      + '<path d="M30 26l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1zM80 26l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1zM130 26l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1zM180 26l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1zM230 26l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="' + GOLD + '"/>')),
    OTHER: plate('<circle cx="160" cy="100" r="36" fill="#efe7da" ' + edge() + '/><path d="M160 82v36M142 100h36" stroke="' + INK + '" stroke-width="2.2"/>')
  };
  plates.chain = plates.O;

  function miniChain(kind) {
    var body = {
      O: link(18, 32, 8, 12, -24, '#efe7da') + link(34, 32, 8, 12, -24, '#f6fbff') + link(50, 32, 8, 12, -24, '#efe7da'),
      CROSS: '<rect x="6" y="28" width="18" height="10" rx="5" fill="#efe7da" ' + edge() + '/><ellipse cx="34" cy="33" rx="7" ry="11" fill="#efe7da" ' + edge() + '/><rect x="44" y="28" width="14" height="10" rx="5" fill="#efe7da" ' + edge() + '/>',
      CHOPARD: box(4, '#efe7da') + box(20, '#e7dcc4') + box(36, '#efe7da'),
      WAVE: '<path d="M6 34c7-10 11 10 18 0s11 10 18 0 11 10 16 0" stroke="' + GOLD + '" stroke-width="3" fill="none" stroke-linecap="round"/>',
      TWIST: '<path d="M8 24c9 20 9 20 18 0s9-20 18 0 9 20 18 0" stroke="' + INK + '" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M8 44c9-20 9-20 18 0s9 20 18 0 9 20 18 0" stroke="' + GOLD + '" stroke-width="2" fill="none" stroke-linecap="round"/>',
      BOX: box(8, '#efe7da') + box(26, '#e7dcc4') + box(44, '#efe7da'),
      BEAD: bead(18, '#efe7da') + bead(34, '#e7dcc4') + bead(50, '#efe7da'),
      SNAKE: '<path d="M6 26h52v14H6z" fill="#efe7da" ' + edge() + '/><path d="M14 26l6 14M26 26l6 14M38 26l6 14M50 26l6 14" stroke="' + GOLD + '" stroke-width="1.2"/>',
      CURB: link(18, 32, 10, 6, -26, '#efe7da') + link(34, 32, 10, 6, -26, '#e7dcc4') + link(50, 32, 10, 6, -26, '#efe7da'),
      DIAMOND_CUT: link(20, 32, 10, 6, -26, '#efe7da') + '<path d="M20 26l4 6-4 6-4-6z" fill="' + GOLD + '"/>' + link(44, 32, 10, 6, -26, '#efe7da') + '<path d="M44 26l4 6-4 6-4-6z" fill="' + GOLD + '"/>',
      STAR: '<path d="M8 42h48" stroke="' + INK + '" stroke-width="1.8"/><path d="M18 22l3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1zM46 22l3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1z" fill="' + GOLD + '"/>',
      OTHER: '<circle cx="32" cy="32" r="12" fill="#efe7da" ' + edge() + '/><path d="M32 24v16M24 32h16" stroke="' + INK + '" stroke-width="2"/>'
    };
    return mark(body[kind] || body.OTHER);
  }

  var marks = {
    welcome: mark(ringDraw(32, 36, 0.6)),
    ring: mark(ringDraw(32, 36, 0.62)),
    necklace: mark('<path d="M12 22c8 18 32 18 40 0" stroke="' + INK + '" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M26 40l6 12 6-12z" fill="#f6fbff" ' + edge() + '/>'),
    brooch: mark('<path d="M32 12l6 10 12 2-9 8 2 12-11-6-11 6 2-12-9-8 12-2z" fill="#efe7da" ' + edge() + '/>'),
    earring: mark('<circle cx="22" cy="18" r="4" fill="#efe7da" ' + edge() + '/><path d="M22 22c0 10 4 16 4 24" stroke="' + GOLD + '" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M36 24h14l4 8c0 6-4 10-11 10s-11-4-11-10z" fill="#efe7da" ' + edge() + '/>'),
    bracelet: mark('<ellipse cx="32" cy="34" rx="20" ry="12" fill="#efe7da" ' + edge() + '/>'),
    collar: mark('<path d="M10 42c8-20 36-20 44 0" stroke="' + INK + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>'),
    hair: mark('<path d="M12 48c6-24 34-24 40 0" stroke="' + INK + '" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M28 20h8l-2 16h-4z" fill="#efe7da" ' + edge() + '/>'),
    charm: mark('<circle cx="32" cy="16" r="5" fill="#efe7da" ' + edge() + '/><rect x="20" y="26" width="24" height="24" rx="6" fill="#efe7da" ' + edge() + '/>'),
    other: mark('<circle cx="32" cy="32" r="14" fill="#efe7da" ' + edge() + '/><path d="M32 24v16M24 32h16" stroke="' + GOLD + '" stroke-width="2"/>'),
    measure: mark('<path d="M24 50c2-22 8-24 8-24s4 6 6 24" stroke="' + INK + '" stroke-width="2" fill="none"/><path d="M22 30h18" stroke="' + GOLD + '" stroke-width="2.2"/>'),
    plating: mark('<ellipse cx="32" cy="34" rx="18" ry="10" fill="#f4f7fb" ' + edge() + '/>'),
    enamel: mark('<path d="M16 48l16-28 16 28z" fill="#efe7da" ' + edge() + '/><path d="M22 48l10-16 10 16z" fill="#82a6c8"/>'),
    stone: mark(stone(32, 34, 14, '#ffffff')),
    budget: mark('<ellipse cx="18" cy="40" rx="8" ry="5" fill="#efe7da" ' + edge() + '/><ellipse cx="36" cy="32" rx="10" ry="7" fill="#efe7da" ' + edge() + '/>'),
    pure: mark('<circle cx="28" cy="34" r="12" fill="#e7c56a" ' + edge() + '/><path d="M40 24l8 6" stroke="' + GOLD + '" stroke-width="2"/>'),
    review: mark('<path d="M16 34l10 10 22-24" stroke="' + GOLD + '" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
    metal: mark(ringDraw(32, 36, 0.6)),
    'plating-none': mark('<ellipse cx="32" cy="34" rx="18" ry="10" fill="#e7c56a" ' + edge() + '/>'),
    'plating-white': mark('<ellipse cx="32" cy="34" rx="18" ry="10" fill="#f4f7fb" ' + edge() + '/>'),
    'plating-yellow': mark('<ellipse cx="32" cy="34" rx="18" ry="10" fill="#e7c56a" ' + edge() + '/>'),
    'plating-rose': mark('<ellipse cx="32" cy="34" rx="18" ry="10" fill="' + ROSE + '" ' + edge() + '/>'),
    'plating-split': mark('<path d="M14 32a18 10 0 0 1 36 0H14z" fill="#f4f7fb" ' + edge() + '/><path d="M14 34h36a18 10 0 0 1-36 0z" fill="#e7c56a" ' + edge() + '/>'),
    cz: mark(stone(32, 34, 16, '#f5f8fb')),
    moissanite: mark(stone(32, 34, 16, '#f5f8fb')),
    corundum: mark(stone(32, 34, 16, '#82a6c8')),
    spinel: mark(stone(32, 34, 16, '#dde8f0')),
    glass: mark(stone(32, 34, 16, '#eaf6f1')),
    lab: mark(stone(32, 34, 16, '#ffffff')),
    'stone-other': mark('<circle cx="32" cy="32" r="14" fill="#efe7da" ' + edge() + '/><path d="M32 24v16M24 32h16" stroke="' + GOLD + '" stroke-width="2"/>'),
    'bangle-id': mark('<ellipse cx="32" cy="32" rx="18" ry="12" fill="#efe7da" ' + edge() + '/><path d="M18 32h28" stroke="' + GOLD + '" stroke-width="2"/>'),
    'bangle-circ': mark('<ellipse cx="32" cy="32" rx="18" ry="12" fill="#efe7da" ' + edge() + '/><path d="M32 20a12 12 0 1 1-1 0" stroke="' + GOLD + '" stroke-width="1.8" fill="none"/>'),
    'bangle-open': mark('<path d="M16 36c4-16 28-16 34 0" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>'),
    'hair-clip': mark('<path d="M14 46c4-20 32-20 36 0" stroke="' + INK + '" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M24 24h16l-2 10H26z" fill="#efe7da" ' + edge() + '/>'),
    'hair-pin': mark('<path d="M16 48c6-22 26-22 32 0" stroke="' + INK + '" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M32 14v28" stroke="' + GOLD + '" stroke-width="2" fill="none" stroke-linecap="round"/>'),
    'hair-chain': mark('<path d="M12 40c8-16 32-16 40 0" stroke="' + INK + '" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="24" cy="32" r="4" fill="#efe7da" ' + edge() + '/><circle cx="40" cy="32" r="4" fill="#efe7da" ' + edge() + '/>')
  };
  ['O', 'CROSS', 'CHOPARD', 'WAVE', 'TWIST', 'BOX', 'BEAD', 'SNAKE', 'CURB', 'DIAMOND_CUT', 'STAR', 'OTHER'].forEach(function (key) {
    marks[key] = miniChain(key);
  });

  window.BRIEF_ART = {
    plate: function (key) { return plates[key] || plates.welcome; },
    mark: function (key) { return marks[key] || marks.other; }
  };
})();
