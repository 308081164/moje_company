(function (global) {
  'use strict';

  /**
   * 通用收货地址：国家 → 省/州 → 城市（级联下拉，与独立站结账一致）。
   * 地理数据自托管于 /js/geo/（country-state-city 精简导出）。
   */

  var PRIORITY_COUNTRIES = ['CN', 'US', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP', 'KR', 'SG', 'HK', 'TW', 'MO', 'IT', 'ES', 'NL', 'CH', 'MY', 'TH', 'VN', 'AE', 'NZ'];

  var CN_STATE_ZH = {
    BJ: '北京市', TJ: '天津市', SH: '上海市', CQ: '重庆市',
    HE: '河北省', SX: '山西省', NM: '内蒙古自治区', LN: '辽宁省', JL: '吉林省', HL: '黑龙江省',
    JS: '江苏省', ZJ: '浙江省', AH: '安徽省', FJ: '福建省', JX: '江西省', SD: '山东省',
    HA: '河南省', HB: '湖北省', HN: '湖南省', GD: '广东省', GX: '广西壮族自治区', HI: '海南省',
    SC: '四川省', GZ: '贵州省', YN: '云南省', XZ: '西藏自治区', SN: '陕西省', GS: '甘肃省',
    QH: '青海省', NX: '宁夏回族自治区', XJ: '新疆维吾尔自治区', TW: '台湾省',
    HK: '香港特别行政区', MO: '澳门特别行政区'
  };

  var DEFAULT_IDS = {
    form: 'buyAddressForm',
    country: 'buyCountry',
    regionRow: 'buyRegionRow',
    state: 'buyState',
    city: 'buyCity',
    cityCustom: 'buyCityCustom',
    postal: 'buyPostal',
    detail: 'buyAddressDetail'
  };

  var countriesCache = null;
  var statesCache = {};
  var citiesCache = {};
  var geoBase = '';

  function t(key, fallback) {
    if (global.I18N && global.I18N.t) {
      var v = global.I18N.t(key);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function localeTag() {
    var loc = (global.I18N && global.I18N.current) ? global.I18N.current : 'en';
    if (loc === 'zh-CN' || loc === 'zh-TW' || loc === 'ja' || loc === 'ko') return loc;
    if (loc.indexOf('zh') >= 0) return 'zh-CN';
    return loc || 'en';
  }

  function isZhLocale() {
    return String(localeTag()).indexOf('zh') === 0;
  }

  function resolveIds(opts) {
    var prefix = opts && opts.idPrefix ? String(opts.idPrefix) : '';
    if (!prefix) return Object.assign({}, DEFAULT_IDS);
    return {
      form: prefix + 'AddressForm',
      country: prefix + 'Country',
      regionRow: prefix + 'RegionRow',
      state: prefix + 'State',
      city: prefix + 'City',
      cityCustom: prefix + 'CityCustom',
      postal: prefix + 'Postal',
      detail: prefix + 'AddressDetail'
    };
  }

  function detectGeoBase() {
    if (geoBase) return geoBase;
    try {
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        var src = scripts[i].src || '';
        if (/addressForm\.js/i.test(src)) {
          geoBase = src.replace(/[^/]*addressForm\.js[^/]*$/i, 'geo/');
          return geoBase;
        }
      }
    } catch (e) { /* ignore */ }
    geoBase = 'js/geo/';
    return geoBase;
  }

  function fetchJson(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error('geo ' + res.status);
      return res.json();
    });
  }

  function loadCountries() {
    if (countriesCache) return Promise.resolve(countriesCache);
    return fetchJson(detectGeoBase() + 'countries.json').then(function (rows) {
      countriesCache = Array.isArray(rows) ? rows : [];
      return countriesCache;
    });
  }

  function loadStates(countryCode) {
    if (!countryCode) return Promise.resolve([]);
    if (statesCache[countryCode]) return Promise.resolve(statesCache[countryCode]);
    return fetchJson(detectGeoBase() + 'states/' + encodeURIComponent(countryCode) + '.json')
      .then(function (rows) {
        statesCache[countryCode] = Array.isArray(rows) ? rows : [];
        return statesCache[countryCode];
      })
      .catch(function () {
        statesCache[countryCode] = [];
        return [];
      });
  }

  function loadCities(countryCode) {
    if (!countryCode) return Promise.resolve([]);
    if (citiesCache[countryCode]) return Promise.resolve(citiesCache[countryCode]);
    return fetchJson(detectGeoBase() + 'cities/' + encodeURIComponent(countryCode) + '.json')
      .then(function (rows) {
        citiesCache[countryCode] = Array.isArray(rows) ? rows : [];
        return citiesCache[countryCode];
      })
      .catch(function () {
        citiesCache[countryCode] = [];
        return [];
      });
  }

  function localizedCountryName(code, fallback) {
    try {
      var dn = new Intl.DisplayNames([localeTag()], { type: 'region' });
      return dn.of(code) || fallback || code;
    } catch (e) {
      return fallback || code;
    }
  }

  function localizedStateName(countryCode, state) {
    if (!state) return '';
    if (countryCode === 'CN' && isZhLocale() && CN_STATE_ZH[state.c]) {
      return CN_STATE_ZH[state.c];
    }
    return state.n || state.c;
  }

  function countryOptionsHtml(selected) {
    return loadCountries().then(function (rows) {
      var display = rows.map(function (r) {
        return { code: r.c, name: localizedCountryName(r.c, r.n) };
      });
      display.sort(function (a, b) { return a.name.localeCompare(b.name, localeTag()); });
      var head = [];
      var rest = [];
      display.forEach(function (r) {
        if (PRIORITY_COUNTRIES.indexOf(r.code) >= 0) head.push(r);
        else rest.push(r);
      });
      head.sort(function (a, b) {
        return PRIORITY_COUNTRIES.indexOf(a.code) - PRIORITY_COUNTRIES.indexOf(b.code);
      });
      return head.concat(rest).map(function (r) {
        var sel = selected && selected === r.code ? ' selected' : '';
        return '<option value="' + esc(r.code) + '"' + sel + '>' + esc(r.name) + ' (' + esc(r.code) + ')</option>';
      }).join('');
    });
  }

  function renderFormHtml(opts) {
    var ids = resolveIds(opts);
    return (
      '<div class="address-form" id="' + esc(ids.form) + '" data-address-form="1">' +
        '<label class="address-form__label" for="' + esc(ids.country) + '">' + esc(t('addr.country', 'Country / region')) + '</label>' +
        '<select class="checkout__input address-form__select" id="' + esc(ids.country) + '" required>' +
          '<option value="">' + esc(t('addr.country.ph', 'Select country or region')) + '</option>' +
        '</select>' +
        '<div class="address-form__row" id="' + esc(ids.regionRow) + '">' +
          '<div class="address-form__col">' +
            '<label class="address-form__label" for="' + esc(ids.state) + '">' + esc(t('addr.state', 'State / province')) + '</label>' +
            '<select class="checkout__input" id="' + esc(ids.state) + '" disabled>' +
              '<option value="">' + esc(t('addr.state.ph', 'Select state / province')) + '</option>' +
            '</select>' +
            '<input class="checkout__input address-form__state-custom" id="' + esc(ids.state) + 'Custom" hidden autocomplete="address-level1" placeholder="' + esc(t('addr.state.custom', 'Enter state / province')) + '">' +
          '</div>' +
          '<div class="address-form__col">' +
            '<label class="address-form__label" for="' + esc(ids.city) + '">' + esc(t('addr.city', 'City')) + '</label>' +
            '<select class="checkout__input" id="' + esc(ids.city) + '" disabled>' +
              '<option value="">' + esc(t('addr.city.ph', 'Select city')) + '</option>' +
            '</select>' +
            '<input class="checkout__input address-form__city-custom" id="' + esc(ids.cityCustom) + '" hidden autocomplete="address-level2" placeholder="' + esc(t('addr.city.custom', 'Enter city')) + '">' +
          '</div>' +
        '</div>' +
        '<label class="address-form__label" for="' + esc(ids.postal) + '">' + esc(t('addr.postal', 'Postal / ZIP code')) + '</label>' +
        '<input class="checkout__input" id="' + esc(ids.postal) + '" autocomplete="postal-code" required maxlength="20" placeholder="' + esc(t('addr.postal.ph', 'Required')) + '">' +
        '<label class="address-form__label" for="' + esc(ids.detail) + '">' + esc(t('addr.detail', 'Street address & details')) + '</label>' +
        '<textarea class="checkout__input address-form__detail" id="' + esc(ids.detail) + '" rows="2" autocomplete="street-address"></textarea>' +
      '</div>'
    );
  }

  function el(form, suffix) {
    return form ? form.querySelector('[id$="' + suffix + '"]') : null;
  }

  function setOptions(select, placeholder, items, selected) {
    if (!select) return;
    var html = '<option value="">' + esc(placeholder) + '</option>';
    (items || []).forEach(function (item) {
      var value = item.value;
      var label = item.label;
      var sel = selected && selected === value ? ' selected' : '';
      html += '<option value="' + esc(value) + '"' + sel + '>' + esc(label) + '</option>';
    });
    select.innerHTML = html;
  }

  function setStateMode(form, mode, preferred) {
    var stateSel = el(form, 'State');
    var stateCustom = form.querySelector('[id$="StateCustom"]');
    if (!stateSel || !stateCustom) return;
    if (mode === 'custom') {
      stateSel.hidden = true;
      stateSel.disabled = true;
      stateCustom.hidden = false;
      stateCustom.disabled = false;
      if (preferred) stateCustom.value = preferred;
    } else {
      stateCustom.hidden = true;
      stateCustom.disabled = true;
      if (!preferred) stateCustom.value = '';
      stateSel.hidden = false;
    }
  }

  function setCityMode(form, mode, preferred) {
    var citySel = el(form, 'City');
    var cityCustom = el(form, 'CityCustom');
    if (!citySel || !cityCustom) return;
    if (mode === 'custom') {
      citySel.hidden = true;
      citySel.disabled = true;
      cityCustom.hidden = false;
      cityCustom.disabled = false;
      if (preferred) cityCustom.value = preferred;
    } else if (mode === 'other') {
      citySel.hidden = false;
      citySel.disabled = false;
      cityCustom.hidden = false;
      cityCustom.disabled = false;
      if (preferred) cityCustom.value = preferred;
    } else {
      cityCustom.hidden = true;
      cityCustom.disabled = true;
      if (!preferred) cityCustom.value = '';
      citySel.hidden = false;
    }
  }

  function refreshCities(form, countryCode, stateCode, preferredCity) {
    var citySel = el(form, 'City');
    if (!citySel) return Promise.resolve();
    if (!countryCode || !stateCode) {
      setCityMode(form, 'select');
      setOptions(citySel, t('addr.city.ph', 'Select city'), [], '');
      citySel.disabled = true;
      return Promise.resolve();
    }
    citySel.disabled = true;
    return loadCities(countryCode).then(function (all) {
      var list = all
        .filter(function (row) { return String(row[0]) === String(stateCode); })
        .map(function (row) { return { value: row[1], label: row[1] }; });
      var seen = {};
      list = list.filter(function (item) {
        if (seen[item.value]) return false;
        seen[item.value] = true;
        return true;
      });

      if (!list.length) {
        setCityMode(form, 'custom', preferredCity || '');
        return;
      }

      var selected = preferredCity || '';
      var known = list.some(function (i) { return i.value === selected; });
      list.push({ value: '__other__', label: t('addr.city.other', 'Other / type city…') });
      setOptions(citySel, t('addr.city.ph', 'Select city'), list, known ? selected : (selected ? '__other__' : ''));
      citySel.disabled = false;
      if (selected && !known) setCityMode(form, 'other', selected);
      else setCityMode(form, 'select');
    });
  }

  function refreshStates(form, countryCode, preferredState, preferredCity) {
    var stateSel = el(form, 'State');
    if (!stateSel) return Promise.resolve();
    setStateMode(form, 'select');
    stateSel.disabled = true;
    setOptions(stateSel, t('addr.state.ph', 'Select state / province'), [], '');
    setCityMode(form, 'select');
    var citySel = el(form, 'City');
    if (citySel) {
      setOptions(citySel, t('addr.city.ph', 'Select city'), [], '');
      citySel.disabled = true;
    }
    if (!countryCode) return Promise.resolve();

    return loadStates(countryCode).then(function (states) {
      if (!states.length) {
        setStateMode(form, 'custom', preferredState || '');
        setCityMode(form, 'custom', preferredCity || '');
        return null;
      }

      var items = states.map(function (s) {
        return { value: s.c, label: localizedStateName(countryCode, s) };
      });
      var selected = preferredState || '';
      if (selected && !items.some(function (i) { return i.value === selected; })) {
        var hit = states.find(function (s) {
          return s.n === selected
            || localizedStateName(countryCode, s) === selected
            || CN_STATE_ZH[s.c] === selected;
        });
        if (hit) selected = hit.c;
        else {
          // 无法匹配到下拉项时允许手填
          setStateMode(form, 'custom', preferredState);
          setCityMode(form, 'custom', preferredCity || '');
          return null;
        }
      }
      setOptions(stateSel, t('addr.state.ph', 'Select state / province'), items, selected);
      stateSel.disabled = false;
      if (selected) return refreshCities(form, countryCode, selected, preferredCity);
      return null;
    });
  }

  function onCityChange(form) {
    var citySel = el(form, 'City');
    var custom = el(form, 'CityCustom');
    if (!citySel || !custom) return;
    if (citySel.value === '__other__') {
      setCityMode(form, 'other');
      custom.focus();
    } else {
      setCityMode(form, 'select');
    }
  }

  function bind(form) {
    if (!form) return;
    var countryEl = el(form, 'Country');

    countryOptionsHtml(countryEl && countryEl.value).then(function (opts) {
      if (!countryEl) return;
      var keep = countryEl.value;
      countryEl.innerHTML =
        '<option value="">' + esc(t('addr.country.ph', 'Select country or region')) + '</option>' + opts;
      if (keep) countryEl.value = keep;
    }).catch(function () { /* ignore */ });

    if (!form._addrBound) {
      form._addrBound = true;
      form.addEventListener('change', function (event) {
        var target = event.target;
        if (!target || !target.id) return;
        if (/Country$/.test(target.id)) {
          refreshStates(form, target.value, '', '');
        } else if (/State$/.test(target.id)) {
          refreshCities(form, countryEl && countryEl.value, target.value, '');
        } else if (/City$/.test(target.id)) {
          onCityChange(form);
        }
      });
    }
  }

  function currentCity(form) {
    var citySel = el(form, 'City');
    var custom = el(form, 'CityCustom');
    if (citySel && !citySel.hidden && citySel.value && citySel.value !== '__other__') return citySel.value;
    if (custom && !custom.hidden && custom.value.trim()) return custom.value.trim();
    if (custom && custom.value.trim()) return custom.value.trim();
    return '';
  }

  function currentState(form) {
    var stateEl = el(form, 'State');
    var stateCustom = form.querySelector('[id$="StateCustom"]');
    if (stateCustom && !stateCustom.hidden && stateCustom.value.trim()) {
      var typed = stateCustom.value.trim();
      return { code: '', name: typed };
    }
    if (!stateEl || stateEl.hidden) return { code: '', name: '' };
    var code = stateEl.value || '';
    var name = '';
    if (stateEl.selectedIndex >= 0) {
      name = (stateEl.options[stateEl.selectedIndex].textContent || '').trim();
    }
    return { code: code, name: name || code };
  }

  function extractCountryCode(raw) {
    var text = String(raw || '').trim();
    if (!text) return '';
    var m = text.match(/\(([A-Za-z]{2})\)\s*$/);
    if (m) return m[1].toUpperCase();
    if (/^[A-Za-z]{2}$/.test(text)) return text.toUpperCase();
    return '';
  }

  function parseStructuredAddress(raw) {
    var out = { countryCode: '', state: '', city: '', postal: '', detail: '' };
    var text = String(raw || '').trim();
    if (!text) return out;
    text.split(/\r?\n/).forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed) return;
      var kv = trimmed.match(/^([^:：]{1,24})\s*[:：]\s*(.+)$/);
      if (!kv) {
        if (!out.detail) out.detail = trimmed;
        return;
      }
      var key = kv[1].trim();
      var value = kv[2].trim();
      if (/^(国家|country|pays|land|país)$/i.test(key)) out.countryCode = extractCountryCode(value) || out.countryCode;
      else if (/^(省|州\/省|州|province|state\/province|state)$/i.test(key)) out.state = value;
      else if (/^(城市|市|city|ville|stadt|ciudad)$/i.test(key)) out.city = value;
      else if (/^(邮编|郵編|postal|code postal|plz)$/i.test(key)) out.postal = value;
      else if (/^(详细地址|詳細地址|地址|address|adresse)$/i.test(key)) out.detail = value;
      else if (/^(区\/县|區\/縣|区|縣|district)$/i.test(key)) {
        out.detail = out.detail ? (value + ' ' + out.detail) : value;
      }
    });
    return out;
  }

  function fillForm(form, data) {
    if (!form || !data) return;
    var countryCode = extractCountryCode(data.country) || data.countryCode || '';
    var parsed = parseStructuredAddress(data.address || data.shippingAddress || '');
    if (!countryCode) countryCode = parsed.countryCode;
    var statePref = data.state || data.province || parsed.state || '';
    var cityPref = data.city || parsed.city || '';
    var postal = data.postalCode || data.postal || parsed.postal || '';
    var detail = data.detail || parsed.detail || '';

    var countryEl = el(form, 'Country');
    var postalEl = el(form, 'Postal');
    var detailEl = el(form, 'AddressDetail');
    if (postalEl && postal) postalEl.value = postal;
    if (detailEl && detail) detailEl.value = detail;

    countryOptionsHtml(countryCode).then(function (opts) {
      if (!countryEl) return;
      countryEl.innerHTML =
        '<option value="">' + esc(t('addr.country.ph', 'Select country or region')) + '</option>' + opts;
      if (countryCode) countryEl.value = countryCode;
      return refreshStates(form, countryCode, statePref, cityPref);
    }).catch(function () { /* ignore */ });
  }

  function validateAndFormat(opts) {
    var ids = resolveIds(opts);
    var form = document.getElementById(ids.form);
    if (!form) return { ok: false, message: t('addr.err.missing', 'Please complete the shipping address') };

    var countryEl = el(form, 'Country');
    var country = countryEl ? (countryEl.value || '').trim() : '';
    if (!country) {
      return { ok: false, message: t('addr.err.country', 'Please select a country or region') };
    }

    var state = currentState(form);
    if (!state.code && !state.name) {
      return { ok: false, message: t('addr.err.region', 'Please select state/province and city') };
    }

    var city = currentCity(form);
    if (!city) {
      return { ok: false, message: t('addr.err.region', 'Please select state/province and city') };
    }

    var detailEl = el(form, 'AddressDetail');
    var detail = detailEl && detailEl.value ? String(detailEl.value).trim() : '';
    if (!detail) {
      return { ok: false, message: t('addr.err.detail', 'Please enter street address and details') };
    }

    var postalEl = el(form, 'Postal');
    var postal = postalEl && postalEl.value ? String(postalEl.value).trim() : '';
    if (!postal) {
      return { ok: false, message: t('addr.err.postal', 'Please enter postal / ZIP code') };
    }

    var countryName = localizedCountryName(country, country);

    var lines = [];
    lines.push(t('addr.line.country', 'Country') + ': ' + countryName + ' (' + country + ')');
    if (country === 'CN') {
      lines.push(t('addr.line.province', 'Province') + ': ' + (state.name || state.code));
    } else {
      lines.push(t('addr.line.state', 'State/Province') + ': ' + (state.name || state.code));
    }
    lines.push(t('addr.line.city', 'City') + ': ' + city);
    lines.push(t('addr.line.postal', 'Postal') + ': ' + postal);
    lines.push(t('addr.line.street', 'Address') + ': ' + detail);

    return {
      ok: true,
      shippingAddress: lines.join('\n'),
      countryCode: country,
      countryLabel: countryName + ' (' + country + ')',
      postalCode: postal,
      stateCode: state.code || '',
      stateName: state.name || '',
      city: city
    };
  }

  // 兼容旧调用名
  function syncCountryMode(form) {
    var countryEl = el(form, 'Country');
    if (countryEl) refreshStates(form, countryEl.value, '', '');
  }

  global.DUXURY_ADDRESS = {
    renderFormHtml: renderFormHtml,
    bind: bind,
    fillForm: fillForm,
    validateAndFormat: validateAndFormat,
    syncCountryMode: syncCountryMode,
    parseStructuredAddress: parseStructuredAddress,
    extractCountryCode: extractCountryCode
  };
})(typeof window !== 'undefined' ? window : this);
