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

  function renderBuyerSizeField(item) {
    var meta = window.DUXURY_JEWELRY
      ? window.DUXURY_JEWELRY.buyerSizeMeta(item.jewelryType)
      : { visible: false };
    if (!meta.visible && item.buyerSizeVisible === true) {
      meta = { visible: true, required: !!item.buyerSizeRequired, labelKey: 'shop.size.generic', placeholderKey: 'shop.size.generic.ph' };
    }
    if (!meta.visible) return '';
    var label = t(meta.labelKey || 'shop.size.generic', 'Size');
    var ph = t(meta.placeholderKey || 'shop.size.generic.ph', '');
    var req = meta.required || item.buyerSizeRequired;
    return (
      '<label class="listing-label" for="buySize">' + esc(label) + (req ? ' *' : '') + '</label>' +
      '<input class="checkout__input" id="buySize" ' + (req ? 'required' : '') + ' placeholder="' + esc(ph) + '">'
    );
  }

  function listingHref(id) {
    return 'listing.html?id=' + encodeURIComponent(id) + '&from=shop';
  }

  function listingCard(item) {
    var img = coverUrl(item);
    var typeTag = item.jewelryType
      ? '<span class="shop-card__type">' + esc(jewelryLabel(item.jewelryType)) + '</span>'
      : '';
    return '<a class="shop-card" href="' + listingHref(item.id) + '">' +
      '<div class="shop-card__img">' + (img ? '<img src="' + esc(img) + '" alt="">' : '<div class="shop-card__ph"></div>') + typeTag + '</div>' +
      '<div class="shop-card__body">' +
      '<h3 class="shop-card__title">' + esc(item.title) + '</h3>' +
      '<p class="shop-card__maker">' + esc(item.sellerDisplayName || '') + '</p>' +
      '<div class="shop-card__price">' + esc(money(item.salePrice)) + '</div>' +
      '<div class="shop-card__meta">' + esc(t('shop.sold')) + ' ' + esc(item.soldCount || 0) + '</div>' +
      '</div></a>';
  }

  var shopCache = { type: '', keyword: '', items: [] };

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

  function renderShopGrid(list) {
    var grid = document.getElementById('shopGrid');
    if (!grid) return;
    if (!list || !list.length) {
      grid.innerHTML = '<p class="shop-empty">' + esc(t('shop.empty')) + '</p>';
      return;
    }
    grid.innerHTML = list.map(listingCard).join('');
  }

  function loadShopGrid(typeFilter) {
    var grid = document.getElementById('shopGrid');
    if (!grid || !window.DUXURY_API) return;
    shopCache.type = typeFilter || '';
    window.DUXURY_API.listStorefront(typeFilter || undefined).then(function (list) {
      shopCache.items = Array.isArray(list) ? list : [];
      renderShopGrid(filterShopItems(shopCache.items, shopCache.keyword));
    }).catch(function (e) {
      shopCache.items = [];
      grid.innerHTML = '<p class="shop-empty">' + esc(e.message || t('shop.empty')) + '</p>';
    });
  }

  function initShopSearch() {
    var input = document.getElementById('shopSearch');
    if (!input) return;
    var timer = null;
    input.value = qs('q') || '';
    shopCache.keyword = input.value;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        shopCache.keyword = input.value || '';
        var url = new URL(location.href);
        if (shopCache.keyword.trim()) url.searchParams.set('q', shopCache.keyword.trim());
        else url.searchParams.delete('q');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
        renderShopGrid(filterShopItems(shopCache.items, shopCache.keyword));
      }, 180);
    });
  }

  function initShop() {
    var typeFilter = qs('type') || '';
    initShopSearch();
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
    var sizeEl = document.getElementById('buySize');
    if (sizeEl && sizeEl.required && !sizeEl.value.trim()) {
      alert(t('shop.size.ring.ph', 'Please enter finger size'));
      return;
    }
    var buyerSize = sizeEl ? sizeEl.value.trim() : '';
    window.DUXURY_API.purchaseStorefront(id, {
      customerName: nameEl ? nameEl.value.trim() : '',
      customerContact: contactEl ? contactEl.value.trim() : '',
      shippingAddress: addrResult.shippingAddress,
      buyerSize: buyerSize,
      note: noteEl ? noteEl.value.trim() : ''
    }).then(function (res) {
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
      var img = coverUrl(item);
      var backHref = 'shop.html';
      var typeQ = qs('type');
      var qQ = qs('q');
      if (typeQ || qQ) {
        var backUrl = new URL('shop.html', location.href);
        if (typeQ) backUrl.searchParams.set('type', typeQ);
        if (qQ) backUrl.searchParams.set('q', qQ);
        backHref = backUrl.pathname.split('/').pop() + backUrl.search;
      }
      root.innerHTML =
        '<div class="listing-media">' + (img ? '<img src="' + esc(img) + '" alt="">' : '<div class="shop-card__ph listing-ph"></div>') + '</div>' +
        '<div class="listing-info">' +
        '<a class="listing-back" href="' + esc(backHref) + '">&larr; ' + esc(t('shop.back', 'Back to shop')) + '</a>' +
        '<p class="section__eyebrow">' + esc(item.sellerDisplayName || '') + '</p>' +
        '<h1 class="listing-title">' + esc(item.title) + '</h1>' +
        '<div class="listing-price">' + esc(money(item.salePrice)) + '</div>' +
        '<p class="listing-desc">' + esc(item.description || '') + '</p>' +
        (item.jewelryType ? '<p class="listing-type"><span class="listing-type__label">' + esc(t('shop.type', 'Type')) + '</span> ' +
          esc(jewelryLabel(item.jewelryType)) + '</p>' : '') +
        '<p class="shop-fees__note">' + esc(t('shop.pay.mock')) + '</p>' +
        renderBuyerSizeField(item) +
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
        '</div>';
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
    sellerListingCache[String(l.id)] = l;
    var html = '<div class="sl-card">';
    html += '<div class="sl-card__img">' +
      (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : '<div class="sl-card__ph"></div>') +
      '<span class="sl-badge ' + (published ? 'sl-badge--live' : 'sl-badge--paused') + '">' +
      esc(t(published ? 'studio.status.published' : 'studio.status.paused')) + '</span></div>';
    html += '<div class="sl-card__body">';
    html += '<h3 class="sl-card__title">' + esc(l.title) + '</h3>';
    html += '<div class="sl-card__row"><span class="sl-card__price">' + esc(usd(l.salePrice)) + '</span>' +
      '<span class="sl-card__meta">' + esc(t('shop.sold')) + ' ' + esc(l.soldCount || 0) + '</span></div>';
    html += '<div class="sl-card__actions">';
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
        '<div class="assets-kpi"><span>' + esc(t('studio.available')) + '</span><strong>' + esc(usd(data.availableBalance)) + '</strong></div>' +
        '<div class="assets-kpi"><span>' + esc(t('studio.pending')) + '</span><strong>' + esc(usd(data.pendingBalance)) + '</strong></div>' +
        '<div class="assets-kpi"><span>' + esc(t('studio.earned')) + '</span><strong>' + esc(usd(data.totalEarned)) + '</strong></div>';
    }
    var bindings = document.getElementById('promoBindings');
    if (bindings) {
      var rows = data.bindings || [];
      if (!rows.length) {
        bindings.innerHTML = '<p class="shop-empty">—</p>';
      } else {
        var html = '<div class="seller-table">';
        rows.forEach(function (b) {
          html += '<div class="seller-row"><div><strong>' + esc(b.orderNumber || '—') + '</strong><div class="seller-muted">' + esc(b.orderStatusLabel || b.orderStatus || '') + '</div></div>';
          html += '<div>' + esc(usd(b.orderAmount)) + '</div>';
          html += '<div>' + esc(usd(b.commissionAmount)) + '</div></div>';
        });
        html += '</div>';
        bindings.innerHTML = html;
      }
    }
    var txns = document.getElementById('promoTxns');
    if (txns) {
      var list = data.txns || [];
      txns.innerHTML = list.length
        ? '<div class="seller-table">' + list.map(function (t) {
            return '<div class="seller-row"><div><strong>' + esc(t.type || '') + '</strong><div class="seller-muted">' + esc(t.remark || '') + '</div></div><div>' + esc(usd(t.amount)) + '</div></div>';
          }).join('') + '</div>'
        : '<p class="shop-empty">—</p>';
    }
    var withdrawals = document.getElementById('promoWithdrawals');
    if (withdrawals) {
      var list2 = data.withdrawals || [];
      withdrawals.innerHTML = list2.length
        ? '<div class="seller-table">' + list2.map(function (w) {
            return '<div class="seller-row"><div><strong>' + esc(w.status || '') + '</strong><div class="seller-muted">' + esc(w.remark || '') + '</div></div><div>' + esc(usd(w.amount)) + '</div></div>';
          }).join('') + '</div>'
        : '<p class="shop-empty">—</p>';
    }
    var copyBtn = document.getElementById('promoCopy');
    if (copyBtn && data.shareUrl) {
      copyBtn.onclick = function () {
        navigator.clipboard.writeText(data.shareUrl).then(function () {
          alert(window.I18N.t('studio.promo.copied'));
        });
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
    if (document.getElementById('listingRoot') && document.getElementById('listingRoot').children.length) {
      initListing();
    }
    if (document.getElementById('sellerBody') && document.getElementById('sellerRoot').style.display !== 'none') {
      loadSeller();
    }
    if (window.I18N) window.I18N.apply();
  });

  if (document.getElementById('homeShopWall')) initHomeShopFlip();
  if (document.getElementById('shopGrid')) initShop();
  if (document.getElementById('listingRoot')) initListing();
  if (document.getElementById('sellerBody')) initSeller();
})();
