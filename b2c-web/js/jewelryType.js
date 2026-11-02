(function (global) {
  'use strict';

  var TYPES = [
    { code: 'RING', key: 'jewelry.ring' },
    { code: 'NECKLACE', key: 'jewelry.necklace' },
    { code: 'EARRING', key: 'jewelry.earring' },
    { code: 'BROOCH', key: 'jewelry.brooch' },
    { code: 'BRACELET', key: 'jewelry.bracelet' },
    { code: 'OTHER', key: 'jewelry.other' }
  ];

  var RING_UNITS = [
    { code: 'HK', key: 'shop.ring.unit.hk' },
    { code: 'US', key: 'shop.ring.unit.us' },
    { code: 'EU', key: 'shop.ring.unit.eu' },
    { code: 'UK', key: 'shop.ring.unit.uk' },
    { code: 'INNER_MM', key: 'shop.ring.unit.mm' },
    { code: 'OTHER', key: 'shop.ring.unit.other' }
  ];

  var CHAIN_STYLES = [
    { code: 'O', key: 'shop.chain.o' },
    { code: 'CROSS', key: 'shop.chain.cross' },
    { code: 'CHOPARD', key: 'shop.chain.chopard' },
    { code: 'WAVE', key: 'shop.chain.wave' },
    { code: 'TWIST', key: 'shop.chain.twist' },
    { code: 'BOX', key: 'shop.chain.box' },
    { code: 'BEAD', key: 'shop.chain.bead' },
    { code: 'SNAKE', key: 'shop.chain.snake' },
    { code: 'CURB', key: 'shop.chain.curb' },
    { code: 'DIAMOND_CUT', key: 'shop.chain.diamond' },
    { code: 'STAR', key: 'shop.chain.star' },
    { code: 'OTHER', key: 'shop.chain.other' }
  ];

  var BRACELET_MEASURES = [
    { code: 'CLOSED_MM', key: 'shop.bracelet.closed' },
    { code: 'EUROPE_CM', key: 'shop.bracelet.europe' },
    { code: 'OPEN_WRIST_CM', key: 'shop.bracelet.open' }
  ];

  function t(key, fallback) {
    if (global.I18N && global.I18N.t) {
      var v = global.I18N.t(key);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  function label(code) {
    var row = TYPES.find(function (x) { return x.code === code; });
    if (!row) {
      var extras = {
        COLLARBONE: 'jewelry.collarbone',
        HAIR: 'jewelry.hair',
        CHARM: 'jewelry.charm'
      };
      if (extras[code]) return t(extras[code], code);
      return code || '';
    }
    var fallbacks = {
      'jewelry.ring': 'Ring',
      'jewelry.necklace': 'Necklace',
      'jewelry.earring': 'Earrings',
      'jewelry.brooch': 'Brooch',
      'jewelry.bracelet': 'Bracelet',
      'jewelry.other': 'Other'
    };
    return t(row.key, fallbacks[row.key]);
  }

  function buyerSizeMeta(code) {
    if (code === 'RING') {
      return { visible: true, required: true, labelKey: 'shop.size.ring', placeholderKey: 'shop.size.ring.ph' };
    }
    if (code === 'NECKLACE' || code === 'BRACELET' || code === 'COLLARBONE') {
      return { visible: true, required: true, labelKey: 'shop.size.chain', placeholderKey: 'shop.size.chain.ph' };
    }
    if (code === 'EARRING' || code === 'BROOCH' || code === 'HAIR' || code === 'CHARM') {
      return { visible: false, required: false };
    }
    return { visible: false, required: false };
  }

  /** 商城详情页：按品类返回需要采集的生产规格字段 */
  function buyerOptionsMeta(code) {
    if (code === 'RING') {
      return {
        kind: 'RING',
        fields: ['ringUnit', 'buyerSize'],
        required: true
      };
    }
    if (code === 'NECKLACE') {
      return {
        kind: 'NECKLACE',
        fields: ['withChain', 'chainStyle', 'chainLength'],
        required: true
      };
    }
    if (code === 'COLLARBONE') {
      return {
        kind: 'COLLARBONE',
        fields: ['chainStyle', 'chainLength'],
        required: true
      };
    }
    if (code === 'BRACELET') {
      return {
        kind: 'BRACELET',
        fields: ['braceletMeasure', 'buyerSize'],
        required: true
      };
    }
    return { kind: 'NONE', fields: [], required: false };
  }

  function optionLabel(list, code, fallback) {
    var row = list.find(function (x) { return x.code === code; });
    return row ? t(row.key, fallback || code) : (fallback || code);
  }

  global.DUXURY_JEWELRY = {
    TYPES: TYPES,
    RING_UNITS: RING_UNITS,
    CHAIN_STYLES: CHAIN_STYLES,
    BRACELET_MEASURES: BRACELET_MEASURES,
    label: label,
    buyerSizeMeta: buyerSizeMeta,
    buyerOptionsMeta: buyerOptionsMeta,
    optionLabel: optionLabel
  };
})(typeof window !== 'undefined' ? window : this);
