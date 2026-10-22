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

  function t(key, fallback) {
    if (global.I18N && global.I18N.t) {
      var v = global.I18N.t(key);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  function label(code) {
    var row = TYPES.find(function (x) { return x.code === code; });
    if (!row) return code || '';
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
    if (code === 'NECKLACE' || code === 'BRACELET') {
      return { visible: true, required: false, labelKey: 'shop.size.chain', placeholderKey: 'shop.size.chain.ph' };
    }
    if (code === 'EARRING' || code === 'BROOCH') {
      return { visible: false, required: false };
    }
    return { visible: false, required: false };
  }

  global.DUXURY_JEWELRY = {
    TYPES: TYPES,
    label: label,
    buyerSizeMeta: buyerSizeMeta
  };
})(typeof window !== 'undefined' ? window : this);
