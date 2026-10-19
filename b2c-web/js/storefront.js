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

  function listingCard(item) {
    var img = coverUrl(item);
    return '<a class="shop-card" href="listing.html?id=' + encodeURIComponent(item.id) + '">' +
      '<div class="shop-card__img">' + (img ? '<img src="' + esc(img) + '" alt="">' : '<div class="shop-card__ph"></div>') + '</div>' +
      '<div class="shop-card__body">' +
      '<h3 class="shop-card__title">' + esc(item.title) + '</h3>' +
      '<p class="shop-card__maker">' + esc(item.sellerDisplayName || '') + '</p>' +
      '<div class="shop-card__price">' + esc(money(item.salePrice)) + '</div>' +
      '<div class="shop-card__meta">' + esc(t('shop.sold')) + ' ' + esc(item.soldCount || 0) + '</div>' +
      '</div></a>';
  }

  function initShop() {
    var grid = document.getElementById('shopGrid');
    if (!grid || !window.DUXURY_API) return;
    window.DUXURY_API.listStorefront().then(function (list) {
      if (!list || !list.length) {
        grid.innerHTML = '<p class="shop-empty">' + esc(t('shop.empty')) + '</p>';
        return;
      }
      grid.innerHTML = list.map(listingCard).join('');
    }).catch(function (e) {
      grid.innerHTML = '<p class="shop-empty">' + esc(e.message || t('shop.empty')) + '</p>';
    });
  }

  function doPurchase(id) {
    var nameEl = document.getElementById('buyName');
    var contactEl = document.getElementById('buyContact');
    var addrEl = document.getElementById('buyAddress');
    var noteEl = document.getElementById('buyNote');
    window.DUXURY_API.purchaseStorefront(id, {
      customerName: nameEl ? nameEl.value.trim() : '',
      customerContact: contactEl ? contactEl.value.trim() : '',
      shippingAddress: addrEl ? addrEl.value.trim() : '',
      note: noteEl ? noteEl.value.trim() : ''
    }).then(function (res) {
      localStorage.setItem('duxury-order', JSON.stringify(res));
      location.href = 'order-workspace.html';
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
      root.innerHTML =
        '<div class="listing-media">' + (img ? '<img src="' + esc(img) + '" alt="">' : '<div class="shop-card__ph listing-ph"></div>') + '</div>' +
        '<div class="listing-info">' +
        '<p class="section__eyebrow">' + esc(item.sellerDisplayName || '') + '</p>' +
        '<h1 class="listing-title">' + esc(item.title) + '</h1>' +
        '<div class="listing-price">' + esc(money(item.salePrice)) + '</div>' +
        '<p class="listing-desc">' + esc(item.description || '') + '</p>' +
        '<p class="shop-fees__note">' + esc(t('shop.pay.mock')) + '</p>' +
        '<label class="listing-label">' + esc(t('shop.name')) + '</label>' +
        '<input class="checkout__input" id="buyName">' +
        '<label class="listing-label">' + esc(t('shop.contact')) + '</label>' +
        '<input class="checkout__input" id="buyContact">' +
        '<label class="listing-label">' + esc(t('shop.addr')) + '</label>' +
        '<textarea class="checkout__input" id="buyAddress" rows="3"></textarea>' +
        '<label class="listing-label">' + esc(t('shop.note')) + '</label>' +
        '<textarea class="checkout__input" id="buyNote" rows="2"></textarea>' +
        '<button class="btn btn--gold btn--lg listing-buy" id="buyNow">' + esc(t('shop.buy')) + '</button>' +
        '</div>';
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
        if (!els.title.value.trim() || !price || price <= 0) {
          alert(t('studio.form.invalid'));
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
    var body = document.getElementById('sellerBody');
    if (!body) return;
    var listings = data.listings || [];
    var sales = data.recentSales || [];
    var html = '';
    html += '<div class="section__head"><p class="section__eyebrow">STUDIO</p><h1 class="section__title">' + esc(t('studio.title')) + '</h1><p class="section__sub">' + esc(t('studio.sub')) + '</p></div>';
    html += '<div class="seller-kpis">';
    html += '<div class="seller-kpi"><span>' + esc(t('studio.available')) + '</span><strong>' + esc(usd(data.availableBalance)) + '</strong></div>';
    html += '<div class="seller-kpi"><span>' + esc(t('studio.pending')) + '</span><strong>' + esc(usd(data.pendingBalance)) + '</strong></div>';
    html += '<div class="seller-kpi"><span>' + esc(t('studio.earned')) + '</span><strong>' + esc(usd(data.totalEarned)) + '</strong></div>';
    html += '</div>';
    html += '<div class="seller-withdraw"><input class="checkout__input" id="withdrawAmount" type="number" min="0" step="0.01" placeholder="' + esc(t('studio.available')) + '">';
    html += '<button class="btn btn--gold" id="withdrawBtn">' + esc(t('studio.withdraw')) + '</button></div>';
    if (data.feeGuide) {
      html += '<div class="shop-fees" style="margin-top:24px">';
      html += '<div class="shop-fees__title">' + esc(t('shop.fees')) + '</div>';
      html += '<div class="shop-fees__row">' + esc(t('shop.prod')) + ': ' + esc(range(data.feeGuide.productionFeeMin, data.feeGuide.productionFeeMax)) + '</div>';
      html += '<div class="shop-fees__row">' + esc(t('shop.ship')) + ': ' + esc(range(data.feeGuide.shippingFeeMin, data.feeGuide.shippingFeeMax)) + '</div>';
      html += '</div>';
    }
    html += '<h2 class="seller-h">' + esc(t('studio.listings')) + '</h2>';
    if (!listings.length) {
      html += '<p class="shop-empty">' + esc(t('shop.empty')) + '</p>';
    } else {
      html += '<div class="sl-cards">' + listings.map(sellerCard).join('') + '</div>';
    }
    html += '<h2 class="seller-h">' + esc(t('studio.sales')) + '</h2>';
    if (!sales.length) {
      html += '<p class="shop-empty">—</p>';
    } else {
      html += '<div class="seller-table">';
      sales.forEach(function (s) {
        html += '<div class="seller-row"><div><strong>' + esc(s.orderNumber) + '</strong><div class="seller-muted">' + esc(s.listingTitle || '') + '</div></div>';
        html += '<div>' + esc(s.statusLabel || s.status) + '</div>';
        html += '<div>' + esc(usd(s.sellerPayout)) + '</div></div>';
      });
      html += '</div>';
    }
    body.innerHTML = html;
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
    body.querySelectorAll('[data-pause]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.DUXURY_API.pauseStorefrontListing(btn.getAttribute('data-pause'))
          .then(loadSeller)
          .catch(function (e) { alert(e.message); });
      });
    });
    body.querySelectorAll('[data-republish]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.DUXURY_API.republishStorefrontListing(btn.getAttribute('data-republish'))
          .then(loadSeller)
          .catch(function (e) { alert(e.message); });
      });
    });
    body.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openListingEdit(sellerListingCache[btn.getAttribute('data-edit')]);
      });
    });
  }

  function loadSeller() {
    window.DUXURY_API.getSellerDashboard().then(function (data) {
      document.getElementById('sellerGate').style.display = 'none';
      document.getElementById('sellerRoot').style.display = '';
      renderSeller(data);
    }).catch(function (e) {
      if (e.status === 401) {
        document.getElementById('sellerGate').style.display = '';
        document.getElementById('sellerRoot').style.display = 'none';
        return;
      }
      document.getElementById('sellerRoot').style.display = '';
      document.getElementById('sellerBody').innerHTML = '<p class="shop-empty">' + esc(e.message) + '</p>';
    });
  }

  function initSeller() {
    if (!document.getElementById('sellerBody')) return;
    initListingEditModal();
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

  if (document.getElementById('shopGrid')) initShop();
  if (document.getElementById('listingRoot')) initListing();
  if (document.getElementById('sellerBody')) initSeller();
})();
