(function () {
  'use strict';

  function t(key) {
    return window.I18N && window.I18N.t ? window.I18N.t(key) : key;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function money(v) {
    if (v == null || v === '') return '—';
    var n = Number(v);
    if (isNaN(n)) return String(v);
    return '$' + n.toFixed(2);
  }
  function moneyHtml(v) {
    if (v == null || v === '') return '—';
    var n = Number(v);
    if (isNaN(n)) return esc(String(v));
    var parts = n.toFixed(2).split('.');
    return '<span class="shop-card__price-currency">$</span>' + esc(parts[0]) +
      (parts[1] ? '<small>.' + esc(parts[1]) + '</small>' : '');
  }
  function range(min, max) {
    return money(min) + ' – ' + money(max);
  }
  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }
  function coverUrl(listing) {
    return listing && listing.coverImageUrl ? listing.coverImageUrl : '';
  }

  function renderFeeGuide(el, fees) {
    if (!el || !fees) return;
    el.innerHTML =
      '<div class="shop-fees__title">' + esc(t('shop.fees')) + '</div>' +
      '<div class="shop-fees__row">' + esc(t('shop.prod')) + ': ' + esc(range(fees.productionFeeMin, fees.productionFeeMax)) + '</div>' +
      '<div class="shop-fees__row">' + esc(t('shop.ship')) + ': ' + esc(range(fees.shippingFeeMin, fees.shippingFeeMax)) + '</div>' +
      (fees.note ? '<p class="shop-fees__note">' + esc(fees.note) + '</p>' : '');
  }

  function jewelryLabel(code) {
    return window.DUXURY_JEWELRY ? window.DUXURY_JEWELRY.label(code) : code;
  }

  function selectOptionsHtml(list, selected) {
    return (list || []).map(function (row) {
      var lab = window.DUXURY_JEWELRY
        ? window.DUXURY_JEWELRY.optionLabel(list, row.code, row.code)
        : row.code;
      return '<option value="' + esc(row.code) + '"' +
        (selected === row.code ? ' selected' : '') + '>' + esc(lab) + '</option>';
    }).join('');
  }

  function renderBuyerOptions(item) {
    var meta = window.DUXURY_JEWELRY
      ? window.DUXURY_JEWELRY.buyerOptionsMeta(item.jewelryType)
      : { kind: 'NONE', fields: [] };
    if (meta.kind === 'NONE' && item.buyerSizeVisible === true) {
      return (
        '<div class="listing-options" id="buyOptions">' +
        '<div class="listing-label listing-label--section">' + esc(t('shop.options', 'Production options')) + '</div>' +
        '<label class="listing-label" for="buySize">' + esc(t('shop.size.generic', 'Size')) +
        (item.buyerSizeRequired ? ' *' : '') + '</label>' +
        '<input class="checkout__input" id="buySize" ' + (item.buyerSizeRequired ? 'required' : '') +
        ' placeholder="' + esc(t('shop.size.generic.ph', '')) + '">' +
        '</div>'
      );
    }
    if (meta.kind === 'NONE') return '';

    var html = '<div class="listing-options" id="buyOptions" data-kind="' + esc(meta.kind) + '">';
    html += '<div class="listing-label listing-label--section">' + esc(t('shop.options', 'Production options')) + '</div>';
    html += '<p class="listing-options__hint">' + esc(t('shop.options.hint')) + '</p>';

    if (meta.kind === 'RING') {
      html += '<label class="listing-label" for="buyRingUnit">' + esc(t('shop.ring.unit')) + ' *</label>';
      html += '<select class="checkout__input" id="buyRingUnit" required>' +
        '<option value="">' + esc(t('shop.pick', 'Please select')) + '</option>' +
        selectOptionsHtml(window.DUXURY_JEWELRY.RING_UNITS, 'HK') + '</select>';
      html += '<label class="listing-label" for="buySize">' + esc(t('shop.size.ring')) + ' *</label>';
      html += '<input class="checkout__input" id="buySize" required placeholder="' +
        esc(t('shop.size.ring.ph')) + '">';
    } else if (meta.kind === 'NECKLACE') {
      html += '<label class="listing-label" for="buyWithChain">' + esc(t('shop.chain.with')) + ' *</label>';
      html += '<select class="checkout__input" id="buyWithChain" required>' +
        '<option value="yes">' + esc(t('shop.chain.yes')) + '</option>' +
        '<option value="no">' + esc(t('shop.chain.no')) + '</option></select>';
      html += '<div id="buyChainStyleWrap">';
      html += '<label class="listing-label" for="buyChainStyle">' + esc(t('shop.chain.style')) + ' *</label>';
      html += '<select class="checkout__input" id="buyChainStyle">' +
        '<option value="">' + esc(t('shop.pick', 'Please select')) + '</option>' +
        selectOptionsHtml(window.DUXURY_JEWELRY.CHAIN_STYLES) + '</select></div>';
      html += '<label class="listing-label" for="buyChainLength">' + esc(t('shop.size.chain')) + '</label>';
      html += '<input class="checkout__input" id="buyChainLength" placeholder="' +
        esc(t('shop.size.chain.ph')) + '">';
    } else if (meta.kind === 'COLLARBONE') {
      html += '<label class="listing-label" for="buyChainStyle">' + esc(t('shop.chain.style')) + ' *</label>';
      html += '<select class="checkout__input" id="buyChainStyle" required>' +
        '<option value="">' + esc(t('shop.pick', 'Please select')) + '</option>' +
        selectOptionsHtml(window.DUXURY_JEWELRY.CHAIN_STYLES) + '</select>';
      html += '<label class="listing-label" for="buyChainLength">' + esc(t('shop.size.chain')) + '</label>';
      html += '<input class="checkout__input" id="buyChainLength" placeholder="' +
        esc(t('shop.size.chain.ph')) + '">';
    } else if (meta.kind === 'BRACELET') {
      html += '<label class="listing-label" for="buyBraceletMeasure">' + esc(t('shop.bracelet.measure')) + ' *</label>';
      html += '<select class="checkout__input" id="buyBraceletMeasure" required>' +
        '<option value="">' + esc(t('shop.pick', 'Please select')) + '</option>' +
        selectOptionsHtml(window.DUXURY_JEWELRY.BRACELET_MEASURES) + '</select>';
      html += '<label class="listing-label" for="buySize">' + esc(t('shop.bracelet.size')) + ' *</label>';
      html += '<input class="checkout__input" id="buySize" required placeholder="' +
        esc(t('shop.bracelet.size.ph')) + '">';
    }
    html += '</div>';
    return html;
  }

  function bindBuyerOptions() {
    var withChain = document.getElementById('buyWithChain');
    var wrap = document.getElementById('buyChainStyleWrap');
    var style = document.getElementById('buyChainStyle');
    if (!withChain || !wrap) return;
    function sync() {
      var on = withChain.value === 'yes';
      wrap.style.display = on ? '' : 'none';
      if (style) style.required = on;
      if (!on && style) style.value = '';
    }
    withChain.addEventListener('change', sync);
    sync();
  }

  function collectBuyerOptions() {
    var payload = {};
    var sizeEl = document.getElementById('buySize');
    var ringUnit = document.getElementById('buyRingUnit');
    var withChain = document.getElementById('buyWithChain');
    var chainStyle = document.getElementById('buyChainStyle');
    var chainLength = document.getElementById('buyChainLength');
    var braceletMeasure = document.getElementById('buyBraceletMeasure');
    if (sizeEl && sizeEl.value.trim()) payload.buyerSize = sizeEl.value.trim();
    if (ringUnit && ringUnit.value) payload.ringUnit = ringUnit.value;
    if (withChain && withChain.value) payload.withChain = withChain.value === 'yes';
    if (chainStyle && chainStyle.value) payload.chainStyle = chainStyle.value;
    if (chainLength && chainLength.value.trim()) payload.chainLength = chainLength.value.trim();
    if (braceletMeasure && braceletMeasure.value) payload.braceletMeasure = braceletMeasure.value;
    return payload;
  }

  function validateBuyerOptions() {
    var box = document.getElementById('buyOptions');
    if (!box) return { ok: true };
    var kind = box.getAttribute('data-kind') || '';
    if (kind === 'RING') {
      var unit = document.getElementById('buyRingUnit');
      var size = document.getElementById('buySize');
      if (!unit || !unit.value) return { ok: false, message: t('shop.err.ringUnit') };
      if (!size || !size.value.trim()) return { ok: false, message: t('shop.err.ringSize') };
    } else if (kind === 'NECKLACE') {
      var wc = document.getElementById('buyWithChain');
      var cs = document.getElementById('buyChainStyle');
      if (!wc || !wc.value) return { ok: false, message: t('shop.err.withChain') };
      if (wc.value === 'yes' && (!cs || !cs.value)) return { ok: false, message: t('shop.err.chainStyle') };
    } else if (kind === 'COLLARBONE') {
      var style = document.getElementById('buyChainStyle');
      if (!style || !style.value) return { ok: false, message: t('shop.err.chainStyle') };
    } else if (kind === 'BRACELET') {
      var measure = document.getElementById('buyBraceletMeasure');
      var bsize = document.getElementById('buySize');
      if (!measure || !measure.value) return { ok: false, message: t('shop.err.braceletMeasure') };
      if (!bsize || !bsize.value.trim()) return { ok: false, message: t('shop.err.braceletSize') };
    } else {
      var generic = document.getElementById('buySize');
      if (generic && generic.required && !generic.value.trim()) {
        return { ok: false, message: t('shop.size.generic.ph') };
      }
    }
    return { ok: true };
  }

  function buildGallery(item) {
    var design = Array.isArray(item.designImages) ? item.designImages.filter(Boolean) : [];
    var model = Array.isArray(item.modelEffectImages) ? item.modelEffectImages.filter(Boolean) : [];
    var photo = Array.isArray(item.photoImages) ? item.photoImages.filter(Boolean) : [];
    var cover = coverUrl(item);
    if (cover && design.indexOf(cover) < 0 && model.indexOf(cover) < 0 && photo.indexOf(cover) < 0) {
      design = [cover].concat(design);
    }
    var slides = [];
    design.forEach(function (u) { slides.push({ url: u, kind: 'design' }); });
    model.forEach(function (u) { slides.push({ url: u, kind: 'model' }); });
    photo.forEach(function (u) { slides.push({ url: u, kind: 'photo' }); });
    if (!slides.length && cover) slides.push({ url: cover, kind: 'design' });
    return {
      slides: slides,
      counts: { design: design.length, model: model.length, photo: photo.length, all: slides.length }
    };
  }

  function renderListingGallery(gallery) {
    var slides = gallery.slides || [];
    if (!slides.length) {
      return '<div class="listing-media"><div class="listing-media__stage">' +
        '<div class="shop-card__ph listing-ph"></div></div></div>';
    }
    var counts = gallery.counts || {};
    var tabs = [
      { id: 'all', label: t('shop.gallery.all'), n: counts.all },
      { id: 'design', label: t('shop.gallery.design'), n: counts.design },
      { id: 'model', label: t('shop.gallery.model'), n: counts.model },
      { id: 'photo', label: t('shop.gallery.photo'), n: counts.photo }
    ].filter(function (tab) { return tab.id === 'all' || tab.n > 0; });

    var html = '<div class="listing-media" id="listingGallery">';
    html += '<div class="listing-media__stage"><img id="listingHero" src="' + esc(slides[0].url) +
      '" alt="" data-kind="' + esc(slides[0].kind) + '"></div>';
    if (tabs.length > 1) {
      html += '<div class="listing-media__tabs" role="tablist">';
      tabs.forEach(function (tab, i) {
        html += '<button type="button" class="listing-media__tab' + (i === 0 ? ' is-on' : '') +
          '" data-kind="' + esc(tab.id) + '">' + esc(tab.label) +
          ' <em>' + esc(tab.n) + '</em></button>';
      });
      html += '</div>';
    }
    html += '<div class="listing-media__thumbs" id="listingThumbs">';
    slides.forEach(function (s, i) {
      html += '<button type="button" class="listing-media__thumb' + (i === 0 ? ' is-on' : '') +
        '" data-kind="' + esc(s.kind) + '" data-src="' + esc(s.url) +
        '" style="background-image:url(\'' + esc(s.url).replace(/'/g, '%27') + '\')" aria-label="' +
        (i + 1) + '"></button>';
    });
    html += '</div></div>';
    return html;
  }

  function bindListingGallery() {
    var root = document.getElementById('listingGallery');
    if (!root) return;
    var hero = document.getElementById('listingHero');
    var thumbs = root.querySelectorAll('.listing-media__thumb');
    var tabs = root.querySelectorAll('.listing-media__tab');

    function show(btn) {
      if (!hero || !btn) return;
      hero.src = btn.getAttribute('data-src') || '';
      hero.setAttribute('data-kind', btn.getAttribute('data-kind') || '');
      thumbs.forEach(function (el) { el.classList.toggle('is-on', el === btn); });
    }

    function filter(kind) {
      var first = null;
      thumbs.forEach(function (el) {
        var match = kind === 'all' || el.getAttribute('data-kind') === kind;
        el.style.display = match ? '' : 'none';
        if (match && !first) first = el;
      });
      tabs.forEach(function (tab) {
        tab.classList.toggle('is-on', tab.getAttribute('data-kind') === kind);
      });
      if (first) show(first);
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        filter(tab.getAttribute('data-kind') || 'all');
      });
    });
    thumbs.forEach(function (btn) {
      btn.addEventListener('click', function () { show(btn); });
    });
  }

  function renderListingHowto() {
    var steps = [
      t('shop.howto.s1'),
      t('shop.howto.s2'),
      t('shop.howto.s3'),
      t('shop.howto.s4'),
      t('shop.howto.s5')
    ];
    return '<section class="listing-howto">' +
      '<h2 class="listing-howto__title">' + esc(t('shop.howto.title')) + '</h2>' +
      '<p class="listing-howto__sub">' + esc(t('shop.howto.sub')) + '</p>' +
      '<ol class="listing-howto__steps">' + steps.map(function (s, i) {
        return '<li><span class="listing-howto__n">' + (i + 1) + '</span><span>' + esc(s) + '</span></li>';
      }).join('') + '</ol>' +
      '<p class="listing-howto__note">' + esc(t('shop.howto.note')) + '</p>' +
      '</section>';
  }

  function specRow(label, value) {
    if (value == null || String(value).trim() === '') return '';
    return '<span class="listing-specs__k">' + esc(label) + '</span>' +
      '<span class="listing-specs__v">' + esc(String(value).trim()) + '</span>';
  }

  function renderListingProductDetail(item) {
    if (!item) return '';
    var basics = '';
    basics += specRow(t('shop.type', 'Type'), item.jewelryType ? jewelryLabel(item.jewelryType) : '');
    basics += specRow(t('shop.spec.material', 'Metal'), item.materialLabel);
    basics += specRow(t('shop.spec.plating', 'Plating'), item.platingLabel);
    basics += specRow(t('shop.spec.weight', 'Weight'), item.weightLabel);
    basics += specRow(t('shop.spec.engraving', 'Engraving'), item.engravingText);
    basics += specRow(t('shop.seller', 'Seller'), item.sellerDisplayName);

    var stones = Array.isArray(item.stones) ? item.stones : [];
    var processes = Array.isArray(item.processes) ? item.processes : [];
    var html = '';

    if (basics) {
      html += '<section class="listing-detail-block">' +
        '<h2 class="listing-detail-block__title">' + esc(t('shop.spec.basicsTitle', 'Piece details')) + '</h2>' +
        '<p class="listing-detail-block__lead">' + esc(t('shop.spec.basicsLead')) + '</p>' +
        '<div class="listing-specs listing-specs--wide">' + basics + '</div></section>';
    }

    if (stones.length) {
      html += '<section class="listing-detail-block">' +
        '<h2 class="listing-detail-block__title">' + esc(t('shop.spec.stonesTitle', 'Stones')) + '</h2>' +
        '<p class="listing-detail-block__lead">' + esc(t('shop.spec.stonesLead')) + '</p>' +
        '<div class="listing-stone-table-wrap"><table class="listing-stone-table">' +
        '<thead><tr>' +
        '<th>' + esc(t('shop.spec.stoneType', 'Stone')) + '</th>' +
        '<th>' + esc(t('shop.spec.stoneShape', 'Cut')) + '</th>' +
        '<th>' + esc(t('shop.spec.stoneSize', 'Size')) + '</th>' +
        '<th>' + esc(t('shop.spec.stoneQty', 'Qty')) + '</th>' +
        '<th>' + esc(t('shop.spec.stoneWeight', 'Wt.')) + '</th>' +
        '<th>' + esc(t('shop.spec.stoneNotes', 'Notes')) + '</th>' +
        '</tr></thead><tbody>';
      stones.forEach(function (row) {
        html += '<tr>' +
          '<td>' + esc(row.stoneType || '—') + '</td>' +
          '<td>' + esc(row.shape || '—') + '</td>' +
          '<td>' + esc(row.size || '—') + '</td>' +
          '<td>' + esc(row.quantity || '—') + '</td>' +
          '<td>' + esc(row.weight || '—') + '</td>' +
          '<td>' + esc(row.notes || '—') + '</td></tr>';
      });
      html += '</tbody></table></div></section>';
    }

    if (processes.length) {
      html += '<section class="listing-detail-block">' +
        '<h2 class="listing-detail-block__title">' + esc(t('shop.spec.processTitle', 'Craft & finish')) + '</h2>' +
        '<p class="listing-detail-block__lead">' + esc(t('shop.spec.processLead')) + '</p>' +
        '<ul class="listing-process-list">';
      processes.forEach(function (row) {
        html += '<li class="listing-process-list__item">' +
          '<strong class="listing-process-list__name">' + esc(row.name || '—') + '</strong>';
        if (row.notes && String(row.notes).trim()) {
          html += '<p class="listing-process-list__note">' + esc(String(row.notes).trim()) + '</p>';
        }
        html += '</li>';
      });
      html += '</ul></section>';
    }

    if (!stones.length && !processes.length && !item.materialLabel && !item.platingLabel) {
      html += '<section class="listing-detail-block">' +
        '<p class="listing-detail-block__muted">' + esc(t('shop.spec.empty')) + '</p></section>';
    } else if (stones.length || processes.length || item.materialLabel) {
      html += '<p class="listing-detail-footnote">' + esc(t('shop.spec.footnote')) + '</p>';
    }

    return html ? '<div class="listing-product-detail">' + html + '</div>' : '';
  }

  function listingHref(id) {
    return 'listing.html?id=' + encodeURIComponent(id) + '&from=shop';
  }

  function listingCard(item) {
    var img = coverUrl(item);
    var typeInline = item.jewelryType
      ? '<span class="shop-card__type-inline">' + esc(jewelryLabel(item.jewelryType)) + '</span>'
      : '';
    var sold = Number(item.soldCount || 0);
    return '<a class="shop-card" href="' + listingHref(item.id) + '">' +
      '<div class="shop-card__img">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : '<div class="shop-card__ph"></div>') + '</div>' +
      '<div class="shop-card__body">' +
      '<div class="shop-card__price">' + moneyHtml(item.salePrice) + '</div>' +
      '<h3 class="shop-card__title">' + typeInline + esc(item.title) + '</h3>' +
      '<div class="shop-card__foot">' +
      '<span class="shop-card__meta">' + esc(t('shop.sold')) + ' ' + esc(sold) + '</span>' +
      '<span class="shop-card__maker">' + esc(item.sellerDisplayName || '') + '</span>' +
      '</div></div></a>';
  }

  var shopCache = { type: '', keyword: '', sort: 'default', items: [] };

  function initShopFilters(onChange) {
    var bar = document.getElementById('shopTypeFilter');
    if (!bar || !window.DUXURY_JEWELRY) return;
    var current = qs('type') || '';
    var chips = '<button type="button" class="shop-filter-chip' + (current ? '' : ' is-active') + '" data-type="">' +
      esc(t('shop.filter.all', 'All')) + '</button>';
    window.DUXURY_JEWELRY.TYPES.forEach(function (row) {
      var active = current === row.code ? ' is-active' : '';
      chips += '<button type="button" class="shop-filter-chip' + active + '" data-type="' + esc(row.code) + '">' +
        esc(jewelryLabel(row.code)) + '</button>';
    });
    bar.innerHTML = chips;
    bar.querySelectorAll('.shop-filter-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var type = btn.getAttribute('data-type') || '';
        var url = new URL(location.href);
        if (type) url.searchParams.set('type', type);
        else url.searchParams.delete('type');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
        bar.querySelectorAll('.shop-filter-chip').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        onChange(type);
      });
    });
  }

  function filterShopItems(list, keyword) {
    var q = String(keyword || '').trim().toLowerCase();
    if (!q) return list || [];
    return (list || []).filter(function (item) {
      var hay = [
        item.title,
        item.sellerDisplayName,
        item.description,
        item.jewelryType,
        jewelryLabel(item.jewelryType)
      ].join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function sortShopItems(list, sort) {
    var arr = (list || []).slice();
    if (sort === 'sales') {
      arr.sort(function (a, b) { return Number(b.soldCount || 0) - Number(a.soldCount || 0); });
    } else if (sort === 'price-asc') {
      arr.sort(function (a, b) { return Number(a.salePrice || 0) - Number(b.salePrice || 0); });
    } else if (sort === 'price-desc') {
      arr.sort(function (a, b) { return Number(b.salePrice || 0) - Number(a.salePrice || 0); });
    }
    return arr;
  }

  function updateShopCount(n) {
    var el = document.getElementById('shopCount');
    if (!el) return;
    var tpl = t('shop.count', '{n} items');
    el.innerHTML = tpl.replace('{n}', '<strong>' + esc(n) + '</strong>');
  }

  function renderShopGrid(list) {
    var grid = document.getElementById('shopGrid');
    if (!grid) return;
    var sorted = sortShopItems(list, shopCache.sort);
    updateShopCount(sorted.length);
    if (!sorted.length) {
      grid.innerHTML = '<p class="shop-empty">' + esc(t('shop.empty')) + '</p>';
      return;
    }
    grid.innerHTML = sorted.map(listingCard).join('');
  }

  function refreshShopView() {
    renderShopGrid(filterShopItems(shopCache.items, shopCache.keyword));
  }

  function loadShopGrid(typeFilter) {
    var grid = document.getElementById('shopGrid');
    if (!grid || !window.DUXURY_API) return;
    shopCache.type = typeFilter || '';
    grid.innerHTML = '<p class="shop-empty">' + esc(t('shop.loading', 'Loading…')) + '</p>';
    window.DUXURY_API.listStorefront(typeFilter || undefined).then(function (list) {
      shopCache.items = Array.isArray(list) ? list : [];
      refreshShopView();
    }).catch(function (e) {
      shopCache.items = [];
      updateShopCount(0);
      var msg = (e && e.message) ? String(e.message) : '';
      if (!msg || /未认证|令牌|401|unauthorized|session|expired/i.test(msg)) {
        msg = t('shop.empty');
      }
      grid.innerHTML = '<p class="shop-empty">' + esc(msg) + '</p>';
    });
  }

  function syncShopQuery() {
    var url = new URL(location.href);
    if (shopCache.keyword.trim()) url.searchParams.set('q', shopCache.keyword.trim());
    else url.searchParams.delete('q');
    if (shopCache.sort && shopCache.sort !== 'default') url.searchParams.set('sort', shopCache.sort);
    else url.searchParams.delete('sort');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  function focusShopSearchInput(input) {
    if (!input) return;
    var run = function () {
      try {
        input.focus({ preventScroll: false });
      } catch (e) {
        input.focus();
      }
      // 选中已有关键词，方便直接改搜；空值则光标落在输入位
      if (input.value) {
        try { input.select(); } catch (e2) { /* ignore */ }
      }
    };
    run();
    // 视图过渡 / 布局完成后再抢一次焦点，避免被 sticky 栏 remount 抢走
    requestAnimationFrame(function () {
      run();
      setTimeout(run, 80);
      setTimeout(run, 280);
    });
  }

  function initShopSearch() {
    var input = document.getElementById('shopSearch');
    if (!input) return;
    var timer = null;
    input.value = qs('q') || '';
    shopCache.keyword = input.value;
    function apply() {
      shopCache.keyword = input.value || '';
      syncShopQuery();
      refreshShopView();
    }
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(apply, 180);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(timer);
        apply();
      }
    });
    var btn = document.getElementById('shopSearchBtn');
    if (btn) btn.addEventListener('click', function () {
      clearTimeout(timer);
      apply();
    });

    var wantFocus = qs('autofocus') === '1' || qs('focus') === '1'
      || sessionStorage.getItem('duxury-shop-search-focus') === '1';
    if (wantFocus) {
      sessionStorage.removeItem('duxury-shop-search-focus');
      var heroMode = '';
      try {
        heroMode = sessionStorage.getItem('duxury-shop-search-hero') || '';
        sessionStorage.removeItem('duxury-shop-search-hero');
      } catch (eHero) { /* ignore */ }
      // VT 路径已做过入场 morph，不再叠加 pulse，避免“播两遍”
      if (heroMode === 'flip') {
        document.body.classList.add('mall-search--hero-in');
      }
      focusShopSearchInput(input);
      // 清理 URL 上的 autofocus，保留 q
      try {
        var url = new URL(location.href);
        url.searchParams.delete('autofocus');
        url.searchParams.delete('focus');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
      } catch (e3) { /* ignore */ }
    }
  }

  function supportsShopSearchViewTransition() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    try {
      return typeof CSS !== 'undefined' && CSS.supports && CSS.supports('view-transition-name', 'none');
    } catch (e) {
      return false;
    }
  }

  /**
   * 首页「发现创作者作品」搜索栏 → 独立站商城：Hero 形态过渡并锁定搜索焦点。
   * 注意：FLIP 幽灵层 与 跨文档 View Transition 互斥，避免同一 morph 播放两次。
   */
  function goShopSearchHero(seedQuery) {
    var q = String(seedQuery || '').trim();
    var url = 'shop.html?autofocus=1';
    if (q) url += '&q=' + encodeURIComponent(q);
    try { sessionStorage.setItem('duxury-shop-search-focus', '1'); } catch (e) { /* ignore */ }

    var box = document.getElementById('homeFeedSearchBox');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 优先：仅走跨文档 View Transition（一次 morph + 模糊）
    if (supportsShopSearchViewTransition()) {
      try { sessionStorage.setItem('duxury-shop-search-hero', 'vt'); } catch (eVt) { /* ignore */ }
      location.href = url;
      return;
    }

    // 回退：FLIP 幽灵层；并关闭本页 VT，避免导航时再播一遍
    if (box && !reduceMotion) {
      try { sessionStorage.setItem('duxury-shop-search-hero', 'flip'); } catch (eFlip) { /* ignore */ }
      document.documentElement.classList.add('skip-view-transition');
      try { box.style.viewTransitionName = 'none'; } catch (eName) { /* ignore */ }

      var ease = 'cubic-bezier(0.33, 0.1, 0.2, 1)';
      var dur = '0.92s';
      var rect = box.getBoundingClientRect();
      var ghost = box.cloneNode(true);
      ghost.removeAttribute('id');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.classList.add('feed-search__ghost');
      ghost.style.cssText = [
        'position:fixed',
        'left:' + rect.left + 'px',
        'top:' + rect.top + 'px',
        'width:' + rect.width + 'px',
        'height:' + rect.height + 'px',
        'margin:0',
        'z-index:10000',
        'pointer-events:none',
        'box-sizing:border-box',
        'transition:left ' + dur + ' ' + ease +
          ',top ' + dur + ' ' + ease +
          ',width ' + dur + ' ' + ease +
          ',height ' + dur + ' ' + ease +
          ',border-radius ' + dur + ' ' + ease +
          ',background ' + dur + ' ease,border-color ' + dur + ' ease,box-shadow ' + dur + ' ease'
      ].join(';');
      document.body.appendChild(ghost);
      box.style.opacity = '0';
      document.documentElement.classList.add('feed-search-morphing');
      ghost.classList.add('is-morphing');

      var headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
      var targetW = Math.min(820, Math.max(280, window.innerWidth - 48));
      var targetLeft = Math.max(24, (window.innerWidth - targetW) / 2);
      var targetTop = headerH + 56;
      var targetH = 52;

      requestAnimationFrame(function () {
        ghost.style.left = targetLeft + 'px';
        ghost.style.top = targetTop + 'px';
        ghost.style.width = targetW + 'px';
        ghost.style.height = targetH + 'px';
        ghost.style.borderRadius = '6px';
        ghost.style.background = '#fff';
        ghost.style.borderColor = 'var(--mall-accent, #b8860b)';
        ghost.style.boxShadow = '0 6px 20px rgba(40, 28, 12, 0.06)';
      });

      var navigated = false;
      function navigate() {
        if (navigated) return;
        navigated = true;
        location.href = url;
      }
      ghost.addEventListener('transitionend', function (ev) {
        if (ev.propertyName === 'left' || ev.propertyName === 'top' || ev.propertyName === 'width') {
          navigate();
        }
      });
      setTimeout(navigate, 980);
      return;
    }
    location.href = url;
  }

  function initHomeFeedSearch() {
    var root = document.getElementById('homeFeedSearch');
    var input = document.getElementById('homeFeedSearchInput');
    var box = document.getElementById('homeFeedSearchBox');
    if (!root || !input || !box) return;
    var going = false;
    function openShop() {
      if (going) return;
      going = true;
      goShopSearchHero(input.value);
    }
    box.addEventListener('pointerdown', function (e) {
      // 避免只点到滚动条等；整块搜索栏都可触发
      e.preventDefault();
      openShop();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openShop();
      }
    });
  }

  function initShopSort() {
    var bar = document.getElementById('shopSort');
    if (!bar) return;
    var current = qs('sort') || 'default';
    if (['default', 'sales', 'price-asc', 'price-desc'].indexOf(current) < 0) current = 'default';
    shopCache.sort = current;
    var opts = [
      { id: 'default', key: 'shop.sort.default' },
      { id: 'sales', key: 'shop.sort.sales' },
      { id: 'price-asc', key: 'shop.sort.priceAsc' },
      { id: 'price-desc', key: 'shop.sort.priceDesc' }
    ];
    bar.innerHTML = opts.map(function (o) {
      return '<button type="button" class="mall-sort__btn' + (current === o.id ? ' is-active' : '') +
        '" data-sort="' + o.id + '">' + esc(t(o.key)) + '</button>';
    }).join('');
    bar.querySelectorAll('.mall-sort__btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        shopCache.sort = btn.getAttribute('data-sort') || 'default';
        bar.querySelectorAll('.mall-sort__btn').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        syncShopQuery();
        refreshShopView();
      });
    });
  }

  function initShop() {
    var typeFilter = qs('type') || '';
    initShopSearch();
    initShopSort();
    initShopFilters(function (type) {
      loadShopGrid(type);
    });
    loadShopGrid(typeFilter);
  }

  var FALLBACK_SHOP_IMGS = [
    'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Custom%20sapphire%20engagement%20ring%20with%20diamond%20halo%2C%20white%20gold%2C%20product%20photography%2C%20clean%20background&image_size=portrait_4_3',
    'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Custom%20emerald%20pendant%20necklace%20on%20gold%20chain%2C%20luxury%20jewelry%2C%20dark%20elegant%20background&image_size=portrait_4_3',
    'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Custom%20diamond%20tennis%20bracelet%2C%20white%20gold%2C%20luxury%20jewelry%20product%20photography&image_size=portrait_4_3',
    'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Custom%20pearl%20and%20gold%20drop%20earrings%2C%20luxury%20jewelry%2C%20minimal%20background&image_size=portrait_4_3',
    'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Oval%20ruby%20ring%20rose%20gold%20hand%20engraved%20band%2C%20luxury%20jewelry%20product%20photography%2C%20elegant%20background&image_size=portrait_4_3',
    'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Classic%20diamond%20stud%20earrings%20white%20gold%2C%20luxury%20jewelry%20macro%20photography%2C%20soft%20light&image_size=portrait_4_3'
  ];

  function wallFaceHtml(url) {
    if (url) return '<img src="' + esc(url) + '" alt="" loading="lazy">';
    return '<div class="shop-wall-flip__ph"></div>';
  }

  function wallFlipHtml(front, back) {
    var href = front.id ? listingHref(front.id) : 'shop.html';
    var frontUrl = front.coverImageUrl || front.url || '';
    var backUrl = (back && (back.coverImageUrl || back.url)) || frontUrl;
    return '<a class="shop-wall-flip" href="' + href + '" title="' + esc(front.title || '') + '">' +
      '<div class="shop-wall-flip__inner">' +
      '<div class="shop-wall-flip__face shop-wall-flip__face--front">' + wallFaceHtml(frontUrl) + '</div>' +
      '<div class="shop-wall-flip__face shop-wall-flip__face--back">' + wallFaceHtml(backUrl) + '</div>' +
      '</div></a>';
  }

  function normalizeShopItems(list) {
    var items = (list || []).filter(function (x) { return x && (x.coverImageUrl || x.url); });
    if (items.length) return items;
    return FALLBACK_SHOP_IMGS.map(function (url, i) {
      return { url: url, title: t('shopsp.preview', 'Featured piece') + ' ' + (i + 1) };
    });
  }

  function buildWallRowHtml(items, offset, count) {
    var tiles = [];
    var half = Math.max(1, Math.ceil(items.length / 2));
    for (var i = 0; i < count; i++) {
      var front = items[(offset + i) % items.length];
      var back = items[(offset + i + half) % items.length];
      tiles.push(wallFlipHtml(front, back));
    }
    // 复制一份以实现无缝横向滚动
    return tiles.join('') + tiles.join('');
  }

  function startWallFlipCycle(wall) {
    if (wall._flipTimers) wall._flipTimers.forEach(clearInterval);
    wall._flipTimers = [];
    wall.querySelectorAll('.shop-wall-flip').forEach(function (card, index) {
      var timer = setInterval(function () {
        if (card.matches(':hover')) return;
        card.classList.toggle('is-flipped');
      }, 7800 + (index % 6) * 900);
      wall._flipTimers.push(timer);
    });
  }

  function initHomeShopFlip() {
    var wall = document.getElementById('homeShopWall');
    if (!wall) return;
    var rowA = wall.querySelector('[data-shop-row="a"]');
    var rowB = wall.querySelector('[data-shop-row="b"]');
    var rowC = wall.querySelector('[data-shop-row="c"]');
    if (!rowA || !rowB || !rowC) return;

    function paint(list) {
      var items = normalizeShopItems(list);
      rowA.innerHTML = buildWallRowHtml(items, 0, 6);
      rowB.innerHTML = buildWallRowHtml(items, 2, 6);
      rowC.innerHTML = buildWallRowHtml(items, 4, 6);
      startWallFlipCycle(wall);
    }

    paint([]);
    if (!window.DUXURY_API || !window.DUXURY_API.listStorefront) return;
    window.DUXURY_API.listStorefront().then(function (list) {
      if (Array.isArray(list) && list.length) paint(list);
    }).catch(function () {});
  }

  function doPurchase(id) {
    var nameEl = document.getElementById('buyName');
    var contactEl = document.getElementById('buyContact');
    var noteEl = document.getElementById('buyNote');
    var addrResult = window.DUXURY_ADDRESS
      ? window.DUXURY_ADDRESS.validateAndFormat()
      : { ok: false, message: 'Address form unavailable' };
    if (!addrResult.ok) {
      alert(addrResult.message || 'Please complete shipping address');
      return;
    }
    var optCheck = validateBuyerOptions();
    if (!optCheck.ok) {
      alert(optCheck.message || t('shop.options.hint'));
      return;
    }
    var body = collectBuyerOptions();
    body.customerName = nameEl ? nameEl.value.trim() : '';
    body.customerContact = contactEl ? contactEl.value.trim() : '';
    body.shippingAddress = addrResult.shippingAddress;
    body.note = noteEl ? noteEl.value.trim() : '';
    window.DUXURY_API.purchaseStorefront(id, body).then(function (res) {
      localStorage.setItem('duxury-order', JSON.stringify(res));
      var query = '';
      if (res && res.conversationId) query = '?conversationId=' + encodeURIComponent(res.conversationId);
      else if (res && res.orderId) query = '?orderId=' + encodeURIComponent(res.orderId);
      location.href = 'order-workspace.html' + query;
    }).catch(function (e) {
      alert(e.message || 'purchase failed');
    });
  }

  function initListing() {
    var root = document.getElementById('listingRoot');
    if (!root || !window.DUXURY_API) return;
    var id = qs('id');
    if (!id) {
      root.innerHTML = '<p class="shop-empty">Missing listing</p>';
      return;
    }
    window.DUXURY_API.getStorefrontListing(id).then(function (item) {
      var backHref = 'shop.html';
      var typeQ = qs('type');
      var qQ = qs('q');
      var sortQ = qs('sort');
      if (typeQ || qQ || sortQ) {
        var backUrl = new URL('shop.html', location.href);
        if (typeQ) backUrl.searchParams.set('type', typeQ);
        if (qQ) backUrl.searchParams.set('q', qQ);
        if (sortQ) backUrl.searchParams.set('sort', sortQ);
        backHref = backUrl.pathname.split('/').pop() + backUrl.search;
      }
      var priceParts = (function () {
        var n = Number(item.salePrice);
        if (isNaN(n)) return { cur: '', main: esc(String(item.salePrice || '—')) };
        var p = n.toFixed(2).split('.');
        return { cur: '$', main: esc(p[0]) + (p[1] ? '<small>.' + esc(p[1]) + '</small>' : '') };
      })();
      var sold = Number(item.soldCount || 0);
      var gallery = buildGallery(item);
      root.innerHTML =
        '<nav class="listing-crumb" aria-label="Breadcrumb">' +
        '<a href="index.html">' + esc(t('nav.home', 'Home')) + '</a><span>/</span>' +
        '<a href="' + esc(backHref) + '">' + esc(t('nav.shop', 'Shop')) + '</a><span>/</span>' +
        '<span>' + esc(item.title) + '</span></nav>' +
        '<div class="listing-layout">' +
        renderListingGallery(gallery) +
        '<div class="listing-info">' +
        '<div class="listing-seller-line">' +
        '<span class="listing-seller-line__shop">' + esc(item.sellerDisplayName || t('shop.seller', 'Seller')) + '</span>' +
        '<span>' + esc(t('shop.studio.fulfill', 'Studio produces & ships')) + '</span>' +
        '</div>' +
        '<h1 class="listing-title">' + esc(item.title) + '</h1>' +
        '<div class="listing-pricebox">' +
        '<div class="listing-pricebox__label">' + esc(t('shop.price', 'Price')) + '</div>' +
        '<div class="listing-price"><span class="listing-price__cur">' + priceParts.cur + '</span>' + priceParts.main + '</div>' +
        '<div class="listing-pricebox__meta">' +
        '<span>' + esc(t('shop.sold')) + ' ' + esc(sold) + '</span>' +
        '</div></div>' +
        '<div class="listing-promises">' +
        '<span>' + esc(t('shop.promise.auth')) + '</span>' +
        '<span>' + esc(t('shop.promise.make')) + '</span>' +
        '<span>' + esc(t('shop.promise.ship')) + '</span>' +
        '</div>' +
        (item.description ? '<p class="listing-desc">' + esc(item.description) + '</p>' : '') +
        '<div class="listing-order">' +
        '<p class="listing-order__hint">' + esc(t('shop.pay.mock')) + '</p>' +
        renderBuyerOptions(item) +
        '<label class="listing-label">' + esc(t('shop.name')) + '</label>' +
        '<input class="checkout__input" id="buyName">' +
        '<label class="listing-label">' + esc(t('shop.contact')) + '</label>' +
        '<input class="checkout__input" id="buyContact">' +
        '<div class="listing-address-block">' +
        '<div class="listing-label listing-label--section">' + esc(t('shop.addr')) + '</div>' +
        (window.DUXURY_ADDRESS ? window.DUXURY_ADDRESS.renderFormHtml() : '') +
        '</div>' +
        '<label class="listing-label">' + esc(t('shop.note')) + '</label>' +
        '<textarea class="checkout__input" id="buyNote" rows="2"></textarea>' +
        '<button class="btn btn--gold btn--lg listing-buy" id="buyNow">' + esc(t('shop.buy')) + '</button>' +
        '</div></div></div>' +
        renderListingProductDetail(item) +
        renderListingHowto();
      bindListingGallery();
      bindBuyerOptions();
      if (window.DUXURY_ADDRESS) {
        window.DUXURY_ADDRESS.bind(document.getElementById('buyAddressForm'));
      }
      document.getElementById('buyNow').addEventListener('click', function () {
        if (!localStorage.getItem('duxury-token')) {
          sessionStorage.setItem('duxury-pending-buy', id);
          var loginModal = document.getElementById('loginModal');
          if (loginModal && window.I18N) {
            loginModal.classList.add('open');
            loginModal.setAttribute('aria-hidden', 'false');
          }
          return;
        }
        doPurchase(id);
      });
    }).catch(function (e) {
      root.innerHTML = '<p class="shop-empty">' + esc(e.message || 'Not found') + '</p>';
    });
  }

  function usd(v) { return money(v); }

  var MIN_SALE_PRICE = 299;

  function priceBelowQuote(price) {
    return !price || price < MIN_SALE_PRICE;
  }

  var sellerListingCache = {};
  var editingListingId = null;

  function listingEditEls() {
    return {
      modal: document.getElementById('listingEditModal'),
      title: document.getElementById('slEditTitle'),
      desc: document.getElementById('slEditDesc'),
      price: document.getElementById('slEditPrice'),
      cover: document.getElementById('slEditCover'),
      preview: document.getElementById('slEditPreview'),
      save: document.getElementById('slEditSave')
    };
  }

  function updateCoverPreview(els) {
    if (!els.preview) return;
    var url = els.cover ? els.cover.value.trim() : '';
    if (url) {
      els.preview.src = url;
      els.preview.style.display = '';
    } else {
      els.preview.removeAttribute('src');
      els.preview.style.display = 'none';
    }
  }

  function openListingEdit(listing) {
    var els = listingEditEls();
    if (!els.modal || !listing) return;
    editingListingId = listing.id;
    els.title.value = listing.title || '';
    els.desc.value = listing.description || '';
    els.price.value = listing.salePrice != null ? listing.salePrice : '';
    els.cover.value = listing.coverImageUrl || '';
    updateCoverPreview(els);
    els.modal.classList.add('open');
    els.modal.setAttribute('aria-hidden', 'false');
  }

  function closeListingEdit() {
    var els = listingEditEls();
    editingListingId = null;
    if (els.modal) {
      els.modal.classList.remove('open');
      els.modal.setAttribute('aria-hidden', 'true');
    }
  }

  function initListingEditModal() {
    var els = listingEditEls();
    if (!els.modal || els.modal.__slBound) return;
    els.modal.__slBound = true;
    els.modal.querySelectorAll('[data-sl-close]').forEach(function (el) {
      el.addEventListener('click', closeListingEdit);
    });
    if (els.cover) {
      els.cover.addEventListener('input', function () { updateCoverPreview(els); });
    }
    if (els.preview) {
      els.preview.addEventListener('error', function () { els.preview.style.display = 'none'; });
    }
    if (els.save) {
      els.save.addEventListener('click', function () {
        if (!editingListingId) return;
        var price = Number(els.price.value);
        if (!els.title.value.trim()) {
          alert(t('studio.form.invalid'));
          return;
        }
        if (priceBelowQuote(price)) {
          alert(t('pub.min'));
          return;
        }
        els.save.disabled = true;
        window.DUXURY_API.updateSellerListing(editingListingId, {
          title: els.title.value.trim(),
          description: els.desc.value,
          salePrice: price,
          coverImageUrl: els.cover.value.trim()
        }).then(function () {
          closeListingEdit();
          loadSeller();
        }).catch(function (e) {
          alert(e.message);
        }).finally(function () {
          els.save.disabled = false;
        });
      });
    }
  }

  function sellerCard(l) {
    var img = coverUrl(l);
    var published = l.status === 'PUBLISHED';
    var detailHref = listingHref(l.id);
    sellerListingCache[String(l.id)] = l;
    var html = '<div class="sl-card">';
    html += '<a class="sl-card__img" href="' + esc(detailHref) + '" title="' + esc(t('studio.view', 'View listing')) + '">' +
      (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : '<div class="sl-card__ph"></div>') +
      '<span class="sl-badge ' + (published ? 'sl-badge--live' : 'sl-badge--paused') + '">' +
      esc(t(published ? 'studio.status.published' : 'studio.status.paused')) + '</span></a>';
    html += '<div class="sl-card__body">';
    html += '<h3 class="sl-card__title"><a class="sl-card__link" href="' + esc(detailHref) + '">' +
      esc(l.title) + '</a></h3>';
    html += '<div class="sl-card__row"><span class="sl-card__price">' + esc(usd(l.salePrice)) + '</span>' +
      '<span class="sl-card__meta">' + esc(t('shop.sold')) + ' ' + esc(l.soldCount || 0) + '</span></div>';
    html += '<div class="sl-card__actions">';
    html += '<a class="sl-btn" href="' + esc(detailHref) + '">' + esc(t('studio.view', 'View')) + '</a>';
    html += '<button class="sl-btn" data-edit="' + esc(l.id) + '">' + esc(t('studio.edit')) + '</button>';
    html += published
      ? '<button class="sl-btn sl-btn--warn" data-pause="' + esc(l.id) + '">' + esc(t('studio.pause')) + '</button>'
      : '<button class="sl-btn sl-btn--gold" data-republish="' + esc(l.id) + '">' + esc(t('studio.republish')) + '</button>';
    html += '</div></div></div>';
    return html;
  }

  function renderSeller(data) {
    var kpis = document.getElementById('sellerKpis');
    if (kpis) {
      kpis.innerHTML =
        '<div class="assets-kpi"><span>' + esc(t('studio.available')) + '</span><strong>' + esc(usd(data.availableBalance)) + '</strong></div>' +
        '<div class="assets-kpi"><span>' + esc(t('studio.pending')) + '</span><strong>' + esc(usd(data.pendingBalance)) + '</strong></div>' +
        '<div class="assets-kpi"><span>' + esc(t('studio.earned')) + '</span><strong>' + esc(usd(data.totalEarned)) + '</strong></div>';
    }
    var listingsBox = document.getElementById('sellerListings');
    if (listingsBox) {
      var listings = data.listings || [];
      listingsBox.innerHTML = listings.length
        ? '<div class="sl-cards">' + listings.map(sellerCard).join('') + '</div>'
        : '<p class="shop-empty">' + esc(t('shop.empty')) + '</p>';
    }
    var salesBox = document.getElementById('sellerSales');
    if (salesBox) {
      var sales = data.recentSales || [];
      if (!sales.length) {
        salesBox.innerHTML = '<p class="shop-empty">—</p>';
      } else {
        var html = '<div class="seller-table">';
        sales.forEach(function (s) {
          html += '<div class="seller-row"><div><strong>' + esc(s.orderNumber) + '</strong><div class="seller-muted">' + esc(s.listingTitle || '') + '</div></div>';
          html += '<div>' + esc(s.statusLabel || s.status) + '</div>';
          html += '<div>' + esc(usd(s.sellerPayout)) + '</div></div>';
        });
        html += '</div>';
        salesBox.innerHTML = html;
      }
    }
    var wbtn = document.getElementById('withdrawBtn');
    if (wbtn) {
      wbtn.addEventListener('click', function () {
        var amt = Number(document.getElementById('withdrawAmount').value);
        if (!amt || amt <= 0) { alert(t('pub.price')); return; }
        window.DUXURY_API.withdrawSeller(amt).then(function () {
          loadSeller();
        }).catch(function (e) { alert(e.message); });
      });
    }
    document.querySelectorAll('[data-pause]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.DUXURY_API.pauseStorefrontListing(btn.getAttribute('data-pause'))
          .then(loadSeller)
          .catch(function (e) { alert(e.message); });
      });
    });
    document.querySelectorAll('[data-republish]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.DUXURY_API.republishStorefrontListing(btn.getAttribute('data-republish'))
          .then(loadSeller)
          .catch(function (e) { alert(e.message); });
      });
    });
    document.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openListingEdit(sellerListingCache[btn.getAttribute('data-edit')]);
      });
    });
  }

  function cssUrl(u) {
    return String(u || '').replace(/\\/g, '\\\\').replace(/'/g, '%27').replace(/"/g, '%22').replace(/\)/g, '%29');
  }

  function openAssetViewer(urls, start) {
    if (!urls || !urls.length) return;
    var index = start || 0;
    var overlay = document.createElement('div');
    overlay.className = 'asset-view';
    overlay.innerHTML =
      '<button class="asset-view__close" type="button" aria-label="Close">&times;</button>' +
      '<button class="asset-view__nav asset-view__nav--prev" type="button" aria-label="Previous">&#8249;</button>' +
      '<img class="asset-view__img" alt="">' +
      '<button class="asset-view__nav asset-view__nav--next" type="button" aria-label="Next">&#8250;</button>' +
      '<div class="asset-view__count"></div>';
    document.body.appendChild(overlay);
    var img = overlay.querySelector('.asset-view__img');
    var count = overlay.querySelector('.asset-view__count');
    function show(i) {
      index = (i + urls.length) % urls.length;
      img.src = urls[index];
      count.textContent = (index + 1) + ' / ' + urls.length;
    }
    function close() {
      document.removeEventListener('keydown', onKey);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    }
    show(index);
    overlay.querySelector('.asset-view__close').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelector('.asset-view__nav--prev').addEventListener('click', function (e) {
      e.stopPropagation();
      show(index - 1);
    });
    overlay.querySelector('.asset-view__nav--next').addEventListener('click', function (e) {
      e.stopPropagation();
      show(index + 1);
    });
    document.addEventListener('keydown', onKey);
  }

  function galleryCard(order) {
    var imgs = [];
    if (order && order.designImages) imgs = imgs.concat(order.designImages);
    if (order && order.modelEffectImages) imgs = imgs.concat(order.modelEffectImages);
    if (order && order.referenceImages) imgs = imgs.concat(order.referenceImages);
    imgs = imgs.filter(Boolean).slice(0, 8);
    var cover = imgs[0] || '';
    var title = order.displayTitle || order.orderNumber || '—';
    var number = order.orderNumber && order.orderNumber !== title ? order.orderNumber : '';
    var price = order.salePrice != null && Number(order.salePrice) > 0 ? usd(order.salePrice) : '';
    var html = '<article class="asset-card">';
    html += '<div class="asset-card__stage">';
    html += '<span class="asset-card__status" data-status="' + esc(order.currentStatus || '') + '">' +
      esc(order.currentStatusLabel || order.currentStatus || '') + '</span>';
    html += cover
      ? '<img class="asset-card__hero" src="' + esc(cover) + '" alt="" loading="lazy">'
      : '<div class="asset-card__ph"><span>duxury</span></div>';
    if (imgs.length > 1) {
      html += '<div class="asset-card__thumbs">' + imgs.map(function (u, i) {
        return '<button type="button" class="asset-card__thumb' + (i === 0 ? ' is-on' : '') +
          '" data-thumb="' + i + '" data-src="' + esc(u) + '" style="background-image:url(\'' + cssUrl(u) + '\')" aria-label="' + (i + 1) + '"></button>';
      }).join('') + '</div>';
    }
    html += '</div>';
    html += '<div class="asset-card__body">';
    if (number) html += '<div class="asset-card__no">' + esc(number) + '</div>';
    html += '<h3 class="asset-card__title" title="' + esc(title).replace(/"/g, '&quot;') + '">' + esc(title) + '</h3>';
    if (price) html += '<div class="asset-card__price">' + esc(price) + '</div>';
    if (order.canPublishToStorefront) {
      html += '<button class="asset-card__cta" type="button" data-publish="' + esc(order.orderId) + '">' + esc(t('studio.publish')) + '</button>';
    }
    html += '</div></article>';
    return html;
  }

  function renderGallery(orders) {
    var box = document.getElementById('sellerGallery');
    if (!box) return;
    if (!orders || !orders.length) {
      box.innerHTML = '<p class="shop-empty">' + esc(t('studio.gallery.empty')) + '</p>';
      return;
    }
    var total = (orders || []).reduce(function (sum, o) {
      return sum + (o && o.salePrice != null ? Number(o.salePrice) : 0);
    }, 0);
    box.innerHTML =
      '<div class="asset-value"><div><span>' + esc(t('studio.total')) + '</span><strong>' + esc(usd(total)) + '</strong></div>' +
      '<em>' + orders.length + ' ' + esc(t('studio.count')) + '</em></div>' +
      '<div class="asset-grid">' + orders.map(galleryCard).join('') + '</div>';
    box.querySelectorAll('.asset-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        var thumb = e.target && e.target.closest ? e.target.closest('[data-thumb]') : null;
        var hero = card.querySelector('.asset-card__hero');
        if (thumb) {
          if (hero) hero.src = thumb.getAttribute('data-src') || '';
          card.querySelectorAll('[data-thumb]').forEach(function (el) { el.classList.remove('is-on'); });
          thumb.classList.add('is-on');
          return;
        }
        if (hero && e.target === hero) {
          var urls = [];
          card.querySelectorAll('[data-thumb]').forEach(function (el) {
            var src = el.getAttribute('data-src');
            if (src) urls.push(src);
          });
          if (!urls.length && hero.src) urls.push(hero.getAttribute('src') || hero.src);
          var on = card.querySelector('[data-thumb].is-on');
          var current = on ? Number(on.getAttribute('data-thumb')) || 0 : 0;
          openAssetViewer(urls, current);
        }
      });
    });
    box.querySelectorAll('[data-publish]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var orderId = Number(btn.getAttribute('data-publish'));
        if (!orderId) return;
        var order = (orders || []).find(function (o) { return Number(o.orderId) === orderId; });
        openPublishModal(orderId, order || { orderNumber: String(orderId) });
      });
    });
  }

  function orderImages(order) {
    var imgs = [];
    if (order && order.designImages) imgs = imgs.concat(order.designImages);
    if (order && order.modelEffectImages) imgs = imgs.concat(order.modelEffectImages);
    if (order && order.referenceImages) imgs = imgs.concat(order.referenceImages);
    var seen = {};
    return imgs.filter(function (u) {
      if (!u || seen[u]) return false;
      seen[u] = true;
      return true;
    });
  }

  function openPublishModal(orderId, summary) {
    if (!orderId) return;
    summary = summary || {};
    var imgs = orderImages(summary);
    var selected = imgs[0] || '';
    var overlay = document.createElement('div');
    overlay.className = 'sl-modal sl-modal--publish open';
    overlay.setAttribute('aria-hidden', 'false');
    var picks = imgs.map(function (u, i) {
      return '<button type="button" class="pub-pick' + (i === 0 ? ' is-on' : '') + '" data-cover="' + esc(u) + '" style="background-image:url(\'' + cssUrl(u) + '\')" aria-label="' + (i + 1) + '"></button>';
    }).join('');
    overlay.innerHTML =
      '<div class="sl-modal__backdrop" data-pub-close></div>' +
      '<div class="sl-modal__dialog" role="dialog" aria-modal="true">' +
        '<button class="sl-modal__close" type="button" data-pub-close aria-label="Close">&times;</button>' +
        '<h3 class="sl-modal__title">' + esc(t('studio.publish')) + '</h3>' +
        '<div class="pub-edit">' +
          '<div>' +
            '<div class="pub-stage">' + (selected
              ? '<img id="publishPreview" alt="" src="' + esc(selected) + '">'
              : '<img id="publishPreview" alt="" style="display:none">') + '</div>' +
            (picks ? '<div class="pub-picks">' + picks + '</div>' : '') +
          '</div>' +
          '<div>' +
            '<p class="pub-hint">' + esc(t('pub.cover.hint')) + '</p>' +
            '<label class="sl-label" for="publishTitle">' + esc(t('studio.field.title')) + '</label>' +
            '<input class="sl-input" id="publishTitle" maxlength="200" value="' + esc(summary.displayTitle || summary.orderNumber || '').replace(/"/g, '&quot;') + '">' +
            '<label class="sl-label" for="publishPrice">' + esc(t('studio.field.price')) + '</label>' +
            '<input class="sl-input" id="publishPrice" type="number" min="' + MIN_SALE_PRICE + '" step="0.01" placeholder="' + MIN_SALE_PRICE + '">' +
            '<p class="pub-hint">' + esc(t('pub.min')) + '</p>' +
            '<label class="sl-label" for="publishDesc">' + esc(t('studio.field.desc')) + '</label>' +
            '<textarea class="sl-input" id="publishDesc" rows="4"></textarea>' +
          '</div>' +
        '</div>' +
        '<div class="sl-modal__actions">' +
          '<button class="sl-btn" type="button" data-pub-close>' + esc(t('studio.cancel')) + '</button>' +
          '<button class="sl-btn sl-btn--gold" type="button" id="publishConfirm">' + esc(t('pub.submit')) + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    overlay.querySelectorAll('[data-pub-close]').forEach(function (el) {
      el.addEventListener('click', close);
    });
    overlay.querySelectorAll('[data-cover]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selected = btn.getAttribute('data-cover') || '';
        overlay.querySelectorAll('[data-cover]').forEach(function (el) { el.classList.remove('is-on'); });
        btn.classList.add('is-on');
        var preview = overlay.querySelector('#publishPreview');
        if (preview) {
          preview.src = selected;
          preview.style.display = selected ? '' : 'none';
        }
      });
    });
    overlay.querySelector('#publishConfirm').addEventListener('click', function () {
      var title = overlay.querySelector('#publishTitle').value.trim();
      var price = Number(overlay.querySelector('#publishPrice').value);
      if (!title) { alert(t('studio.form.invalid')); return; }
      if (priceBelowQuote(price)) { alert(t('pub.min')); return; }
      if (imgs.length && !selected) { alert(t('pub.cover.required')); return; }
      var confirmBtn = overlay.querySelector('#publishConfirm');
      confirmBtn.disabled = true;
      window.DUXURY_API.publishStorefront({
        sourceOrderId: orderId,
        title: title,
        description: overlay.querySelector('#publishDesc').value.trim(),
        salePrice: price,
        coverImageUrl: selected || null
      }).then(function () {
        close();
        loadSeller();
        var shopTab = document.querySelector('[data-tab="shop"]');
        if (shopTab) shopTab.click();
      }).catch(function (err) {
        alert(err.message);
      }).finally(function () {
        confirmBtn.disabled = false;
      });
    });
  }

  function loadGallery() {
    window.DUXURY_API.listMyOrders().then(function (rows) {
      var finished = (rows || []).filter(function (o) {
        return o && (o.currentStatus === 'COMPLETED' || o.modelApproved === true || o.designApproved === true);
      });
      renderGallery(finished);
    }).catch(function () {
      renderGallery([]);
    });
  }

  function renderPromo(data) {
    var codeEl = document.getElementById('promoCode');
    var rateEl = document.getElementById('promoRate');
    var linkEl = document.getElementById('promoLink');
    var qrEl = document.getElementById('promoQr');
    if (codeEl) codeEl.textContent = data.code || '—';
    if (rateEl) rateEl.textContent = window.I18N.t('studio.promo.rate').replace('{rate}', (data.commissionRate != null ? (Number(data.commissionRate) * 100).toFixed(0) : '5') + '%');
    if (linkEl) linkEl.textContent = data.shareUrl || '—';
    if (qrEl) {
      var qrValue = data.qrCodeBase64 || '';
      if (qrValue && qrValue.indexOf('data:') !== 0) {
        qrValue = 'data:image/png;base64,' + qrValue;
      }
      if (qrValue) {
        qrEl.src = qrValue;
        qrEl.style.display = '';
      } else {
        qrEl.style.display = 'none';
      }
    }
    var stats = document.getElementById('promoStats');
    if (stats) {
      stats.innerHTML =
        '<div class="pm-stat pm-stat--accent"><span>' + esc(t('studio.available')) + '</span><strong>' + esc(usd(data.availableBalance)) + '</strong></div>' +
        '<div class="pm-stat"><span>' + esc(t('studio.pending')) + '</span><strong>' + esc(usd(data.pendingBalance)) + '</strong></div>' +
        '<div class="pm-stat"><span>' + esc(t('studio.earned')) + '</span><strong>' + esc(usd(data.totalEarned)) + '</strong></div>';
    }
    var bindings = document.getElementById('promoBindings');
    if (bindings) {
      var rows = data.bindings || [];
      if (!rows.length) {
        bindings.innerHTML = '<p class="shop-empty">' + esc(t('studio.promo.empty')) + '</p>';
      } else {
        var html = '<div class="seller-table">';
        rows.forEach(function (b) {
          var statusText = b.orderStatusLabel || b.orderStatus || '';
          html += '<div class="seller-row">';
          html += '<div><strong>' + esc(b.orderNumber || '—') + '</strong>';
          if (statusText) html += '<span class="pm-status">' + esc(statusText) + '</span>';
          html += '</div>';
          html += '<div class="pm-row-meta"><span>' + esc(t('studio.promo.orderAmt')) + '</span><b>' + esc(usd(b.orderAmount)) + '</b></div>';
          html += '<div class="pm-row-meta pm-row-meta--earn"><span>' + esc(t('studio.promo.commissionAmt')) + '</span><b>' + esc(usd(b.commissionAmount)) + '</b></div>';
          html += '</div>';
        });
        html += '</div>';
        bindings.innerHTML = html;
      }
    }
    var txns = document.getElementById('promoTxns');
    if (txns) {
      var list = data.txns || [];
      txns.innerHTML = list.length
        ? '<div class="seller-table">' + list.map(function (txn) {
            return '<div class="seller-row"><div><strong>' + esc(txn.type || '') + '</strong><div class="seller-muted">' + esc(txn.remark || '') + '</div></div>' +
              '<div class="pm-row-meta pm-row-meta--earn"><span>' + esc(t('studio.promo.commissionAmt')) + '</span><b>' + esc(usd(txn.amount)) + '</b></div></div>';
          }).join('') + '</div>'
        : '<p class="shop-empty">' + esc(t('studio.promo.emptyTxns')) + '</p>';
    }
    var withdrawals = document.getElementById('promoWithdrawals');
    if (withdrawals) {
      var list2 = data.withdrawals || [];
      withdrawals.innerHTML = list2.length
        ? '<div class="seller-table">' + list2.map(function (w) {
            return '<div class="seller-row"><div><strong>' + esc(w.status || '') + '</strong><div class="seller-muted">' + esc(w.remark || '') + '</div></div>' +
              '<div class="pm-row-meta"><span>' + esc(t('studio.withdraw')) + '</span><b>' + esc(usd(w.amount)) + '</b></div></div>';
          }).join('') + '</div>'
        : '<p class="shop-empty">' + esc(t('studio.promo.emptyWithdrawals')) + '</p>';
    }
    var copyBtn = document.getElementById('promoCopy');
    if (copyBtn && data.shareUrl) {
      copyBtn.onclick = function () {
        var url = data.shareUrl;
        var label = copyBtn.textContent;
        function copied() {
          copyBtn.textContent = t('studio.promo.copied');
          setTimeout(function () { copyBtn.textContent = label; }, 1600);
        }
        function fallbackCopy() {
          var ta = document.createElement('textarea');
          ta.value = url;
          ta.setAttribute('readonly', '');
          ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          var ok = false;
          try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
          document.body.removeChild(ta);
          if (ok) copied();
          else window.prompt(t('studio.promo.copied'), url);
        }
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(url).then(copied).catch(fallbackCopy);
        } else {
          fallbackCopy();
        }
      };
    }
    var posterBtn = document.getElementById('promoPosterBtn');
    if (posterBtn) {
      posterBtn.onclick = function () {
        alert(window.I18N.t('studio.promo.posterSoon'));
      };
    }
    var wbtn = document.getElementById('promoWithdrawBtn');
    if (wbtn) {
      wbtn.onclick = function () {
        var amt = Number(document.getElementById('promoWithdrawAmount').value);
        if (!amt || amt <= 0) { alert(window.I18N.t('pub.price')); return; }
        window.DUXURY_API.withdrawReferral(amt).then(function () {
          loadSeller();
        }).catch(function (e) { alert(e.message); });
      };
    }
  }

  function loadSeller() {
    window.DUXURY_API.getSellerDashboard().then(function (data) {
      document.getElementById('sellerGate').style.display = 'none';
      document.getElementById('sellerRoot').style.display = '';
      document.getElementById('sellerContent').style.display = '';
      renderSeller(data);
      loadGallery();
    }).catch(function (e) {
      if (e.status === 401) {
        document.getElementById('sellerGate').style.display = '';
        document.getElementById('sellerRoot').style.display = 'none';
        document.getElementById('sellerContent').style.display = 'none';
        return;
      }
      document.getElementById('sellerRoot').style.display = '';
      document.getElementById('sellerContent').style.display = '';
    });
    window.DUXURY_API.getReferralDashboard().then(function (data) {
      renderPromo(data);
    }).catch(function () {
      renderPromo({});
    });
  }

  function initSellerTabs() {
    document.querySelectorAll('.assets-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.assets-tab').forEach(function (el) { el.classList.remove('is-on'); });
        btn.classList.add('is-on');
        var tab = btn.getAttribute('data-tab');
        document.getElementById('galleryPanel').style.display = tab === 'gallery' ? '' : 'none';
        document.getElementById('listingsPanel').style.display = tab === 'shop' ? '' : 'none';
        document.getElementById('promoPanel').style.display = tab === 'promo' ? '' : 'none';
      });
    });
  }

  function initSeller() {
    if (!document.getElementById('sellerBody')) return;
    initListingEditModal();
    initSellerTabs();
    var loginBtn = document.getElementById('sellerGateLogin');
    if (loginBtn) {
      loginBtn.addEventListener('click', function () {
        var loginModal = document.getElementById('loginModal');
        if (loginModal) {
          loginModal.classList.add('open');
          loginModal.setAttribute('aria-hidden', 'false');
        }
      });
    }
    if (!localStorage.getItem('duxury-token')) {
      document.getElementById('sellerGate').style.display = '';
      document.getElementById('sellerRoot').style.display = 'none';
      return;
    }
    loadSeller();
  }

  document.addEventListener('duxury:login', function () {
    var pending = sessionStorage.getItem('duxury-pending-buy');
    if (pending && document.getElementById('listingRoot')) {
      sessionStorage.removeItem('duxury-pending-buy');
      doPurchase(pending);
      return;
    }
    if (document.getElementById('sellerBody')) loadSeller();
  });

  document.addEventListener('duxury:langchange', function () {
    if (document.getElementById('shopGrid')) {
      loadShopGrid(qs('type') || '');
      initShopFilters(function (type) { loadShopGrid(type); });
    }
    if (document.getElementById('homeShopWall')) initHomeShopFlip();
    if (document.getElementById('homeFeed')) initHomeFeed();
    if (document.getElementById('listingRoot') && document.getElementById('listingRoot').children.length) {
      initListing();
    }
    if (document.getElementById('sellerBody') && document.getElementById('sellerRoot').style.display !== 'none') {
      loadSeller();
    }
    if (window.I18N) window.I18N.apply();
  });

  var HOME_FEED_PAGE_SIZE = 60;
  var homeFeedAll = [];
  var homeFeedVisible = HOME_FEED_PAGE_SIZE;

  function feedAspectClass(i) {
    var mods = ['xhs-card__media--tall', 'xhs-card__media--square', 'xhs-card__media--wide', 'xhs-card__media--tall'];
    return mods[i % mods.length];
  }

  function feedCard(item, index) {
    var img = coverUrl(item);
    var type = item.jewelryType
      ? '<span class="xhs-card__type">' + esc(jewelryLabel(item.jewelryType)) + '</span>'
      : '';
    return '<a class="xhs-card" href="' + listingHref(item.id) + '">' +
      '<div class="xhs-card__media ' + feedAspectClass(index) + '">' +
      (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : '<div class="xhs-card__ph">duxury</div>') +
      type + '</div>' +
      '<div class="xhs-card__body">' +
      '<h3 class="xhs-card__title">' + esc(item.title || '') + '</h3>' +
      '<div class="xhs-card__meta">' +
      '<span class="xhs-card__price">' + esc(money(item.salePrice)) + '</span>' +
      '<span class="xhs-card__maker">' + esc(item.sellerDisplayName || '') + '</span>' +
      '</div></div></a>';
  }

  function updateHomeFeedMore() {
    var wrap = document.getElementById('homeFeedMore');
    var loadBtn = document.getElementById('homeFeedLoadMore');
    if (!wrap) return;
    var total = homeFeedAll.length;
    if (!total) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    var hasMore = homeFeedVisible < total;
    if (loadBtn) loadBtn.hidden = !hasMore;
  }

  function paintHomeFeed() {
    var box = document.getElementById('homeFeed');
    if (!box) return;
    var items = homeFeedAll.slice(0, homeFeedVisible);
    if (!items.length) {
      box.innerHTML = '<p class="feed__empty">' + esc(t('feed.empty', t('shop.empty'))) + '</p>';
      updateHomeFeedMore();
      return;
    }
    box.innerHTML = items.map(feedCard).join('');
    updateHomeFeedMore();
  }

  function initHomeFeedMoreActions() {
    var loadBtn = document.getElementById('homeFeedLoadMore');
    if (!loadBtn || loadBtn.getAttribute('data-bound') === '1') return;
    loadBtn.setAttribute('data-bound', '1');
    loadBtn.addEventListener('click', function () {
      homeFeedVisible = Math.min(homeFeedVisible + HOME_FEED_PAGE_SIZE, homeFeedAll.length);
      paintHomeFeed();
      var wrap = document.getElementById('homeFeedMore');
      if (wrap && wrap.scrollIntoView) {
        wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  function initHomeFeed() {
    var box = document.getElementById('homeFeed');
    if (!box || !window.DUXURY_API) return;
    initHomeFeedMoreActions();
    homeFeedVisible = HOME_FEED_PAGE_SIZE;
    box.innerHTML = '<p class="feed__empty">' + esc(t('shop.loading', 'Loading…')) + '</p>';
    var moreWrap = document.getElementById('homeFeedMore');
    if (moreWrap) moreWrap.hidden = true;
    window.DUXURY_API.listStorefront().then(function (list) {
      homeFeedAll = Array.isArray(list) ? list : [];
      paintHomeFeed();
    }).catch(function () {
      homeFeedAll = [];
      paintHomeFeed();
    });
  }

  if (document.getElementById('homeShopWall')) initHomeShopFlip();
  if (document.getElementById('homeFeed')) initHomeFeed();
  if (document.getElementById('homeFeedSearch')) initHomeFeedSearch();
  if (document.getElementById('shopGrid')) initShop();
  if (document.getElementById('listingRoot')) initListing();
  if (document.getElementById('sellerBody')) initSeller();
})();
