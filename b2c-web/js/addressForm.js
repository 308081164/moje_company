(function (global) {
  'use strict';

  var CN_PROVINCES = [
    '北京市', '天津市', '上海市', '重庆市', '河北省', '山西省', '辽宁省', '吉林省', '黑龙江省',
    '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省', '河南省', '湖北省', '湖南省',
    '广东省', '海南省', '四川省', '贵州省', '云南省', '陕西省', '甘肃省', '青海省', '台湾省',
    '内蒙古自治区', '广西壮族自治区', '西藏自治区', '宁夏回族自治区', '新疆维吾尔自治区',
    '香港特别行政区', '澳门特别行政区'
  ];

  var PRIORITY_COUNTRIES = ['CN', 'US', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP', 'KR', 'SG', 'HK', 'TW', 'MO', 'IT', 'ES', 'NL', 'CH', 'MY', 'TH', 'VN', 'AE', 'NZ'];

  var NON_COUNTRY = new Set([
    'EU', 'UN', 'XA', 'XB', 'XC', 'XD', 'XE', 'XF', 'XG', 'XH', 'XI', 'XJ', 'XK', 'XL', 'XM', 'XN', 'XO', 'XP', 'XQ', 'XR', 'XS', 'XT', 'XU', 'XV', 'XW', 'XX', 'XY', 'XZ',
    'QO', 'QU', 'EZ', 'DG', 'IC', 'EA', 'CP', 'AC', 'TA', 'UK'
  ]);

  function t(key, fallback) {
    if (global.I18N && global.I18N.t) {
      var v = global.I18N.t(key);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function localeTag() {
    var loc = (global.I18N && global.I18N.current) ? global.I18N.current : 'en';
    if (loc === 'zh-CN' || loc === 'zh-TW' || loc === 'ja' || loc === 'ko') return loc;
    if (loc.indexOf('zh') >= 0) return 'zh-CN';
    return loc || 'en';
  }

  function countryList() {
    var codes = [];
    try {
      if (typeof Intl !== 'undefined' && Intl.supportedValuesOf) {
        codes = Intl.supportedValuesOf('region');
      }
    } catch (e) { /* ignore */ }
    if (!codes.length) {
      codes = ['CN', 'US', 'GB', 'FR', 'DE', 'JP', 'KR', 'AU', 'CA', 'SG', 'HK', 'TW', 'MO', 'IT', 'ES', 'IN', 'BR', 'MX'];
    }
    codes = codes.filter(function (c) {
      return c && c.length === 2 && !NON_COUNTRY.has(c);
    });
    var display;
    try {
      display = new Intl.DisplayNames([localeTag()], { type: 'region' });
    } catch (e2) {
      display = null;
    }
    var rows = codes.map(function (code) {
      var name = display ? display.of(code) : code;
      return { code: code, name: name || code };
    });
    rows.sort(function (a, b) { return a.name.localeCompare(b.name, localeTag()); });
    var priority = [];
    var rest = [];
    rows.forEach(function (r) {
      if (PRIORITY_COUNTRIES.indexOf(r.code) >= 0) priority.push(r);
      else rest.push(r);
    });
    priority.sort(function (a, b) {
      return PRIORITY_COUNTRIES.indexOf(a.code) - PRIORITY_COUNTRIES.indexOf(b.code);
    });
    return priority.concat(rest);
  }

  function renderFormHtml() {
    var countries = countryList();
    var countryOpts = countries.map(function (c) {
      return '<option value="' + esc(c.code) + '">' + esc(c.name) + ' (' + esc(c.code) + ')</option>';
    }).join('');
    var provOpts = CN_PROVINCES.map(function (p) {
      return '<option value="' + esc(p) + '">' + esc(p) + '</option>';
    }).join('');

    return (
      '<div class="address-form" id="buyAddressForm">' +
        '<label class="address-form__label" for="buyCountry">' + esc(t('addr.country', 'Country / region')) + '</label>' +
        '<select class="checkout__input address-form__select" id="buyCountry" required>' +
          '<option value="">' + esc(t('addr.country.ph', 'Select country or region')) + '</option>' +
          countryOpts +
        '</select>' +
        '<div class="address-form__row address-form__row--cn" id="buyCnRow" hidden>' +
          '<div class="address-form__col">' +
            '<label class="address-form__label" for="buyProvince">' + esc(t('addr.province', 'Province')) + '</label>' +
            '<select class="checkout__input" id="buyProvince"><option value="">' + esc(t('addr.province.ph', 'Select province')) + '</option>' + provOpts + '</select>' +
          '</div>' +
          '<div class="address-form__col">' +
            '<label class="address-form__label" for="buyCityCn">' + esc(t('addr.city', 'City')) + '</label>' +
            '<input class="checkout__input" id="buyCityCn" autocomplete="address-level2">' +
          '</div>' +
          '<div class="address-form__col">' +
            '<label class="address-form__label" for="buyDistrict">' + esc(t('addr.district', 'District')) + '</label>' +
            '<input class="checkout__input" id="buyDistrict" autocomplete="address-level3">' +
          '</div>' +
        '</div>' +
        '<div class="address-form__row address-form__row--intl" id="buyIntlRow">' +
          '<div class="address-form__col">' +
            '<label class="address-form__label" for="buyState">' + esc(t('addr.state', 'State / province')) + '</label>' +
            '<input class="checkout__input" id="buyState" autocomplete="address-level1">' +
          '</div>' +
          '<div class="address-form__col">' +
            '<label class="address-form__label" for="buyCityIntl">' + esc(t('addr.city', 'City')) + '</label>' +
            '<input class="checkout__input" id="buyCityIntl" autocomplete="address-level2">' +
          '</div>' +
        '</div>' +
        '<label class="address-form__label" for="buyPostal">' + esc(t('addr.postal', 'Postal / ZIP code')) + '</label>' +
        '<input class="checkout__input" id="buyPostal" autocomplete="postal-code">' +
        '<label class="address-form__label" for="buyAddressDetail">' + esc(t('addr.detail', 'Street address & details')) + '</label>' +
        '<textarea class="checkout__input address-form__detail" id="buyAddressDetail" rows="2" autocomplete="street-address"></textarea>' +
      '</div>'
    );
  }

  function syncCountryMode(form) {
    if (!form) return;
    var country = (form.querySelector('#buyCountry') || {}).value || '';
    var cn = country === 'CN';
    var cnRow = form.querySelector('#buyCnRow');
    var intlRow = form.querySelector('#buyIntlRow');
    if (cnRow) cnRow.hidden = !cn;
    if (intlRow) intlRow.hidden = cn;
  }

  function bind(form) {
    if (!form) return;
    var countryEl = form.querySelector('#buyCountry');
    if (countryEl) {
      countryEl.addEventListener('change', function () { syncCountryMode(form); });
      syncCountryMode(form);
    }
  }

  function val(id) {
    var el = document.getElementById(id);
    return el && el.value ? String(el.value).trim() : '';
  }

  function validateAndFormat() {
    var form = document.getElementById('buyAddressForm');
    if (!form) return { ok: false, message: t('addr.err.missing', 'Please complete the shipping address') };

    var country = val('buyCountry');
    if (!country) {
      return { ok: false, message: t('addr.err.country', 'Please select a country or region') };
    }

    var detail = val('buyAddressDetail');
    if (!detail) {
      return { ok: false, message: t('addr.err.detail', 'Please enter street address and details') };
    }

    var postal = val('buyPostal');
    var countryName = '';
    try {
      var dn = new Intl.DisplayNames([localeTag()], { type: 'region' });
      countryName = dn.of(country) || country;
    } catch (e) {
      countryName = country;
    }

    var lines = [];
    lines.push(t('addr.line.country', 'Country') + ': ' + countryName + ' (' + country + ')');

    if (country === 'CN') {
      var prov = val('buyProvince');
      var city = val('buyCityCn');
      var dist = val('buyDistrict');
      if (!prov || !city) {
        return { ok: false, message: t('addr.err.region', 'Please select province and enter city') };
      }
      lines.push(t('addr.line.province', 'Province') + ': ' + prov);
      lines.push(t('addr.line.city', 'City') + ': ' + city);
      if (dist) lines.push(t('addr.line.district', 'District') + ': ' + dist);
    } else {
      var state = val('buyState');
      var cityI = val('buyCityIntl');
      if (!state || !cityI) {
        return { ok: false, message: t('addr.err.region', 'Please enter state/province and city') };
      }
      lines.push(t('addr.line.state', 'State/Province') + ': ' + state);
      lines.push(t('addr.line.city', 'City') + ': ' + cityI);
    }

    if (postal) lines.push(t('addr.line.postal', 'Postal') + ': ' + postal);
    lines.push(t('addr.line.street', 'Address') + ': ' + detail);

    return { ok: true, shippingAddress: lines.join('\n') };
  }

  global.DUXURY_ADDRESS = {
    renderFormHtml: renderFormHtml,
    bind: bind,
    validateAndFormat: validateAndFormat,
    syncCountryMode: syncCountryMode
  };
})(typeof window !== 'undefined' ? window : this);
