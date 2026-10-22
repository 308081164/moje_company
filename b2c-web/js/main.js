(function () {
  'use strict';

  /* ============================================================
     推广码落地：捕获 ?ref=CODE 并暂存，下单时随单提交
  ============================================================ */
  (function captureReferralRef() {
    try {
      var ref = new URLSearchParams(location.search).get('ref');
      if (ref && /^[A-Za-z0-9]{4,16}$/.test(ref.trim())) {
        localStorage.setItem('duxury-ref', ref.trim().toUpperCase());
      }
    } catch (e) { /* 忽略异常参数 */ }
  })();

  function getStoredReferralCode() {
    var v = localStorage.getItem('duxury-ref');
    return v && v.trim() ? v.trim().toUpperCase() : '';
  }

  /* ============================================================
     Workspace gate: orders page requires email sign-in
  ============================================================ */
  var isWorkspace = !!document.querySelector('.app-shell');
  var workspaceLoggedIn = !isWorkspace || !!localStorage.getItem('duxury-token');
  if (isWorkspace && !workspaceLoggedIn) {
    var gateEl = document.getElementById('orderGate');
    var shellEl = document.querySelector('.app-shell');
    if (gateEl) gateEl.style.display = '';
    if (shellEl) shellEl.style.display = 'none';
  }

  /* ============================================================
     Language switcher (shared)
  ============================================================ */
  var langSwitcher = document.getElementById('langSwitcher');
  var langBtn = document.getElementById('langBtn');
  var langMenu = document.getElementById('langMenu');

  function buildLangMenu() {
    if (!langMenu) return;
    langMenu.innerHTML = '';
    window.I18N.SUPPORTED.forEach(function (s) {
      var btn = document.createElement('button');
      btn.className = 'lang__option' + (s.code === window.I18N.current ? ' active' : '');
      btn.setAttribute('data-lang', s.code);
      btn.innerHTML = '<span>' + s.label + '</span>' +
        (s.code === window.I18N.current ? '<span class="lang__check">✓</span>' : '');
      btn.addEventListener('click', function () {
        window.I18N.setLang(s.code);
        rebuildLangMenu();
        langSwitcher.classList.remove('open');
        langBtn.setAttribute('aria-expanded', 'false');
      });
      langMenu.appendChild(btn);
    });
  }

  function rebuildLangMenu() {
    buildLangMenu();
    var btns = langMenu.querySelectorAll('.lang__option');
    btns.forEach(function (b) {
      if (b.getAttribute('data-lang') === window.I18N.current) {
        b.classList.add('active');
        b.innerHTML = '<span>' + b.querySelector('span').textContent + '</span><span class="lang__check">✓</span>';
      }
    });
  }

  if (langBtn) {
    langBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = langSwitcher.classList.toggle('open');
      langBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (!langSwitcher.contains(e.target)) {
        langSwitcher.classList.remove('open');
        langBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  document.addEventListener('duxury:langchange', function (e) {
    // 语言切换后：回写后端语言偏好，并重载当前会话消息以刷新翻译
    var lang = e && e.detail && e.detail.lang;
    if (lang && window.DUXURY_API && localStorage.getItem('duxury-token')) {
      window.DUXURY_API.updateLang(lang).catch(function () {});
    }
    if (typeof syncWorkspaceMessages === 'function') {
      syncWorkspaceMessages(false);
    }
  });

  /* ============================================================
     Auth area: signed-in user chip vs. guest CTA (shared)
  ============================================================ */
  var AUTH_STORAGE_KEYS = ['duxury-token', 'duxury-user', 'duxury-order', 'duxury-paid'];

  function getAuthUser() {
    if (!localStorage.getItem('duxury-token')) return null;
    try {
      var u = JSON.parse(localStorage.getItem('duxury-user') || 'null');
      if (u && (u.email || u.displayName)) return u;
    } catch (e) { /* 忽略损坏的缓存 */ }
    return null;
  }

  function authDisplayName(user) {
    var name = ((user && user.displayName) || '').trim();
    if (name) return name;
    return ((user && user.email) || '').trim();
  }

  function authAvatarLetter(user) {
    var name = authDisplayName(user);
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  function renderAuthArea() {
    var actions = document.querySelector('.header__actions');
    if (!actions) return;
    var user = getAuthUser();
    var cta = actions.querySelector('.header__cta');
    var chip = actions.querySelector('.auth-chip');

    // 未登录：移除用户 chip，恢复「开始定制」CTA（若该页有）
    if (!user) {
      if (chip) chip.parentNode.removeChild(chip);
      if (cta) cta.style.display = '';
      return;
    }

    // 已登录：隐藏 CTA，注入/更新用户 chip（头像 + 昵称 + 下拉菜单）
    if (cta) cta.style.display = 'none';
    if (!chip) {
      chip = document.createElement('div');
      chip.className = 'auth-chip';
      chip.innerHTML =
        '<button class="auth-chip__btn" type="button" aria-haspopup="true" aria-expanded="false">' +
          '<span class="auth-chip__avatar"></span>' +
          '<span class="auth-chip__name"></span>' +
          '<svg class="auth-chip__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</button>' +
        '<div class="auth-chip__menu">' +
          '<a class="auth-chip__item" href="order-workspace.html" data-i18n="auth.orders"></a>' +
          '<a class="auth-chip__item" href="seller.html" data-i18n="auth.studio"></a>' +
          '<a class="auth-chip__item" href="promo.html" data-i18n="auth.promo"></a>' +
          '<button class="auth-chip__item auth-chip__item--danger" type="button" data-auth-logout data-i18n="auth.logout"></button>' +
        '</div>';
      actions.appendChild(chip);

      var chipBtn = chip.querySelector('.auth-chip__btn');
      chipBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = chip.classList.toggle('open');
        chipBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', function (e) {
        if (!chip.contains(e.target)) {
          chip.classList.remove('open');
          chipBtn.setAttribute('aria-expanded', 'false');
        }
      });
      chip.querySelector('[data-auth-logout]').addEventListener('click', function () {
        AUTH_STORAGE_KEYS.forEach(function (k) { localStorage.removeItem(k); });
        // 刷新回到未登录态（订单工作台会重新显示登录 gate）
        location.reload();
      });
    }
    chip.querySelector('.auth-chip__avatar').textContent = authAvatarLetter(user);
    chip.querySelector('.auth-chip__name').textContent = authDisplayName(user);
    // 翻译新注入的菜单项（语言切换时 i18n.apply 也会命中这些 data-i18n）
    chip.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = window.I18N.t(el.getAttribute('data-i18n'));
    });
  }

  renderAuthArea();
  document.addEventListener('duxury:login', renderAuthArea);

  /* ============================================================
     Header / mobile menu (shared)
  ============================================================ */
  var header = document.getElementById('header');
  var menuToggle = document.getElementById('menuToggle');
  var nav = document.getElementById('nav');

  if (header) {
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      if (y > 60) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
    });
  }

  if (menuToggle) {
    menuToggle.addEventListener('click', function () {
      nav.classList.toggle('open');
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('open');
      });
    });
  }

  /* ============================================================
     Homepage: reveal, chat FAB, chat panel
  ============================================================ */
  var reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('visible'); });
  }

  var chatFab = document.getElementById('chatFab');
  var chatPanel = document.getElementById('chatPanel');
  var chatClose = document.getElementById('chatClose');

  if (chatFab) {
    chatFab.addEventListener('click', function () {
      chatPanel.classList.add('open');
      chatFab.style.opacity = '0';
      chatFab.style.pointerEvents = 'none';
    });
    chatClose.addEventListener('click', function () {
      chatPanel.classList.remove('open');
      chatFab.style.opacity = '';
      chatFab.style.pointerEvents = '';
    });
  }

  // Draggable chat panel (via header)
  var chatPanelHead = document.getElementById('chatPanelHead');
  if (chatPanelHead && chatPanel) {
    var dragging = false;
    var startX = 0, startY = 0, panelLeft = 0, panelTop = 0;

    function setPanelPosition(left, top) {
      chatPanel.style.left = left + 'px';
      chatPanel.style.top = top + 'px';
      chatPanel.style.right = 'auto';
      chatPanel.style.bottom = 'auto';
    }

    chatPanelHead.addEventListener('pointerdown', function (e) {
      // Ignore clicks on the close button
      if (e.target.closest('.chat-panel__close')) return;
      dragging = true;
      var rect = chatPanel.getBoundingClientRect();
      panelLeft = rect.left;
      panelTop = rect.top;
      startX = e.clientX;
      startY = e.clientY;
      // Disable transition while dragging for instant feedback
      chatPanel.style.transition = 'none';
      chatPanelHead.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    chatPanelHead.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      var rect = chatPanel.getBoundingClientRect();
      var nextLeft = panelLeft + dx;
      var nextTop = panelTop + dy;
      nextLeft = Math.min(Math.max(nextLeft, 8), Math.max(8, window.innerWidth - rect.width - 8));
      nextTop = Math.min(Math.max(nextTop, 8), Math.max(8, window.innerHeight - rect.height - 8));
      setPanelPosition(nextLeft, nextTop);
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      chatPanel.style.transition = '';
    }

    chatPanelHead.addEventListener('pointerup', endDrag);
    chatPanelHead.addEventListener('pointercancel', endDrag);
  }

  var panelInput = document.getElementById('panelChatInput');
  var panelSend = document.getElementById('panelChatSend');
  var panelBody = document.getElementById('panelChatBody');

  if (panelInput) {
    function sendPanelMsg() {
      var text = panelInput.value.trim();
      if (!text) return;
      appendPanelMsg(text, 'out');
      panelInput.value = '';
      // 不模拟 AI 对话；引导客户通过真实服务下单进入订单群聊
      appendPanelMsg(window.I18N.t('ai.redirect'), 'in');
    }
    function appendPanelMsg(text, dir) {
      var msg = document.createElement('div');
      msg.className = 'ws-msg ws-msg--' + dir;
      var bubble = document.createElement('p');
      bubble.className = 'ws-msg__bubble';
      bubble.textContent = text;
      msg.appendChild(bubble);
      var time = document.createElement('span');
      time.className = 'ws-msg__time';
      time.textContent = getTimeStr();
      msg.appendChild(time);
      panelBody.appendChild(msg);
      panelBody.scrollTop = panelBody.scrollHeight;
    }
    panelSend.addEventListener('click', sendPanelMsg);
    panelInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') sendPanelMsg();
    });
  }

  /* ============================================================
     Service selection → login → checkout
  ============================================================ */
  var loginModal = document.getElementById('loginModal');
  var checkoutModal = document.getElementById('checkoutModal');
  var selectedService = null; // 'custom' | 'designer'

  // 与后端 PortalDepositPricing 单价一致；实收金额由服务端按件数重算。
  var SERVICE_UNIT = { custom: 49, designer: 99 };

  function openModal(modal) {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeModal(modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Service card buttons (homepage)
  document.querySelectorAll('.service-card__btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      selectedService = btn.getAttribute('data-service');
      // Already signed in? skip login
      if (localStorage.getItem('duxury-user')) {
        showCheckout();
      } else {
        resetEmailLogin();
        openModal(loginModal);
      }
    });
  });

  // Login modal close handlers
  document.querySelectorAll('[data-modal-close]').forEach(function (el) {
    el.addEventListener('click', function () {
      var m = el.closest('.modal');
      if (m) closeModal(m);
    });
  });

  // Google login（暂未接入 OAuth，提示使用邮箱登录）
  var googleLogin = document.getElementById('googleLogin');
  if (googleLogin) {
    googleLogin.addEventListener('click', function () {
      alert(window.I18N.t('login.google.pending'));
    });
  }

  // Email login (verification code)
  var emailContinue = document.getElementById('emailContinue');
  var emailInput = document.getElementById('emailInput');
  var emailCodeStep = document.getElementById('emailCodeStep');
  var codeInput = document.getElementById('codeInput');
  var codeConfirm = document.getElementById('codeConfirm');
  var emailCodeHint = document.getElementById('emailCodeHint');

  function validEmail(v) {
    return v && v.indexOf('@') !== -1;
  }

  function resetEmailLogin() {
    if (!emailInput) return;
    if (emailInput.parentNode) emailInput.parentNode.style.display = '';
    if (emailCodeStep) emailCodeStep.style.display = 'none';
    if (emailCodeHint) { emailCodeHint.style.display = 'none'; emailCodeHint.textContent = ''; }
    if (codeInput) codeInput.value = '';
    emailInput.style.borderColor = '';
  }

  if (emailContinue) {
    function doEmailContinue() {
      var v = (emailInput.value || '').trim();
      if (!validEmail(v)) {
        emailInput.focus();
        emailInput.style.borderColor = '#e05d5d';
        return;
      }
      emailInput.style.borderColor = '';
      window.DUXURY_API.sendVerificationCode(v, 'LOGIN').then(function () {
        emailInput.parentNode.style.display = 'none';
        if (emailCodeStep) emailCodeStep.style.display = '';
        if (emailCodeHint) {
          emailCodeHint.style.display = 'block';
          emailCodeHint.textContent = window.I18N.t('login.code.sent');
        }
        if (codeInput) codeInput.focus();
      }).catch(function (err) {
        if (emailCodeHint) {
          emailCodeHint.style.display = 'block';
          emailCodeHint.textContent = err.message || window.I18N.t('login.code.error');
        }
      });
    }

    function doCodeConfirm() {
      var code = (codeInput.value || '').trim();
      var email = (emailInput.value || '').trim();
      if (!code) { codeInput.focus(); return; }
      window.DUXURY_API.loginByCode(email, code).then(function (data) {
        localStorage.setItem('duxury-token', data.accessToken || '');
        localStorage.setItem('duxury-user', JSON.stringify({
          method: 'email',
          email: data.email || email,
          displayName: data.displayName || email
        }));
        closeModal(loginModal);
        maybeShowProfilePrompt(data, email);
      }).catch(function (err) {
        if (emailCodeHint) {
          emailCodeHint.textContent = err.message || window.I18N.t('login.code.error');
        }
      });
    }

    emailContinue.addEventListener('click', doEmailContinue);
    emailInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doEmailContinue();
    });
    if (codeConfirm) {
      codeConfirm.addEventListener('click', doCodeConfirm);
      codeInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doCodeConfirm();
      });
    }
  }

  // 登录后检查预留基础信息（称呼、联系方式）是否齐全，缺失则引导填写
  function maybeShowProfilePrompt(data, email) {
    var missingDisplayName = !data.displayName || !data.displayName.trim();
    var missingContact = !data.contact || !data.contact.trim();
    if (!missingDisplayName && !missingContact) {
      afterLogin();
      return;
    }
    var overlay = document.createElement('div');
    overlay.className = 'event-detail';
    var dialog = document.createElement('div');
    dialog.className = 'event-detail__dialog profile-prompt';
    dialog.innerHTML =
      '<button class="event-detail__close" aria-label="Close">&times;</button>' +
      '<h3 class="profile-prompt__title">' + escapeHtml(window.I18N.t('profile.title')) + '</h3>' +
      '<p class="profile-prompt__sub">' + escapeHtml(window.I18N.t('profile.sub')) + '</p>' +
      '<label class="profile-prompt__label">' + escapeHtml(window.I18N.t('profile.name')) + '</label>' +
      '<input type="text" id="profileDisplayName" class="checkout__input" placeholder="' + escapeAttr(window.I18N.t('profile.name.ph')) + '" value="' + escapeAttr(data.displayName || '') + '">' +
      '<label class="profile-prompt__label">' + escapeHtml(window.I18N.t('profile.contact')) + '</label>' +
      '<input type="text" id="profileContact" class="checkout__input" placeholder="' + escapeAttr(window.I18N.t('profile.contact.ph')) + '" value="' + escapeAttr(data.contact || email || '') + '">' +
      '<div class="profile-prompt__actions">' +
        '<button class="prog-btn prog-btn--ok" id="profileSave">' + escapeHtml(window.I18N.t('profile.save')) + '</button>' +
        '<button class="prog-btn prog-btn--no" id="profileSkip">' + escapeHtml(window.I18N.t('profile.skip')) + '</button>' +
      '</div>';
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    dialog.querySelector('.event-detail__close').addEventListener('click', close);
    dialog.querySelector('#profileSkip').addEventListener('click', function () { close(); afterLogin(); });
    dialog.querySelector('#profileSave').addEventListener('click', function () {
      var dn = document.getElementById('profileDisplayName').value.trim();
      var ct = document.getElementById('profileContact').value.trim();
      if (!dn) { alert(window.I18N.t('profile.err.name')); return; }
      if (!ct) { alert(window.I18N.t('profile.err.contact')); return; }
      window.DUXURY_API.updateProfile(dn, ct)
        .then(function () {
          var user = { method: 'email', email: data.email || email, displayName: dn };
          localStorage.setItem('duxury-user', JSON.stringify(user));
          close();
          afterLogin();
        })
        .catch(function (err) {
          alert(err.message || window.I18N.t('profile.saveFail'));
        });
    });
  }

  // 登录成功后：首页进入结算；订单工作台进入工作台视图
  function afterLogin() {
    document.dispatchEvent(new CustomEvent('duxury:login'));
    if (isWorkspace) {
      var gate = document.getElementById('orderGate');
      var shell = document.querySelector('.app-shell');
      if (gate) gate.style.display = 'none';
      if (shell) shell.style.display = '';
      startWorkspace();
      return;
    }
    if (document.body.classList.contains('storefront-page')) {
      return;
    }
    showCheckout();
  }

  // 订单工作台登录引导按钮
  var orderGateLogin = document.getElementById('orderGateLogin');
  if (orderGateLogin) {
    orderGateLogin.addEventListener('click', function () {
      resetEmailLogin();
      openModal(loginModal);
    });
  }

  // Checkout
  var checkoutService = document.getElementById('checkoutService');
  var checkoutPrice = document.getElementById('checkoutPrice');
  var payDeposit = document.getElementById('payDeposit');
  var checkoutSuccess = document.getElementById('checkoutSuccess');
  var selectedImages = [];
  var MAX_IMAGES = 5;

  function readPieceCount() {
    var pieceCountEl = document.getElementById('pieceCountInput');
    var pieceCount = pieceCountEl ? parseInt(pieceCountEl.value, 10) : 1;
    if (!pieceCount || pieceCount < 1) pieceCount = 1;
    if (pieceCount > 5) pieceCount = 5;
    return pieceCount;
  }

  function formatDepositAmount(amount) {
    var lang = (window.I18N && window.I18N.current) || 'en';
    var n = String(amount);
    if (lang === 'zh-CN' || lang === 'zh-TW') return n + '美元';
    if (lang === 'fr' || lang === 'de' || lang === 'es') return n + ' $';
    return '$' + n;
  }

  function renderCheckoutDue() {
    if (!checkoutPrice) return;
    var unit = Object.prototype.hasOwnProperty.call(SERVICE_UNIT, selectedService)
      ? SERVICE_UNIT[selectedService]
      : SERVICE_UNIT.custom;
    var count = readPieceCount();
    var total = unit * count;
    if (count > 1) {
      checkoutPrice.textContent = formatDepositAmount(unit) + ' × ' + count + ' = ' + formatDepositAmount(total);
      checkoutPrice.classList.add('checkout__price--multi');
    } else {
      checkoutPrice.textContent = formatDepositAmount(unit);
      checkoutPrice.classList.remove('checkout__price--multi');
    }
  }

  function showCheckout() {
    if (!checkoutModal) return;
    var nameKey = selectedService === 'custom' ? 'svc.custom.title' : 'svc.designer.title';
    checkoutService.textContent = window.I18N.t(nameKey);
    renderCheckoutDue();
    checkoutSuccess.style.display = 'none';
    payDeposit.style.display = '';
    var reqBox = document.getElementById('checkoutRequirements');
    if (reqBox) reqBox.style.display = '';
    // 推广码（选填）：带来路 ref 参数访问时自动带出
    var refInput = document.getElementById('referralCodeInput');
    if (refInput && !refInput.value.trim()) {
      refInput.value = getStoredReferralCode();
    }
    selectedImages = [];
    renderImagePreview();
    openModal(checkoutModal);
  }

  var pieceCountInput = document.getElementById('pieceCountInput');
  if (pieceCountInput) {
    pieceCountInput.addEventListener('change', renderCheckoutDue);
  }

  document.addEventListener('duxury:langchange', function () {
    if (!checkoutModal || !checkoutModal.classList.contains('open')) return;
    if (checkoutService && selectedService) {
      var nameKey = selectedService === 'custom' ? 'svc.custom.title' : 'svc.designer.title';
      checkoutService.textContent = window.I18N.t(nameKey);
    }
    renderCheckoutDue();
  });

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderImagePreview() {
    var grid = document.getElementById('imagePreviewGrid');
    if (!grid) return;
    grid.innerHTML = '';
    selectedImages.forEach(function (dataUrl, idx) {
      var item = document.createElement('div');
      item.className = 'image-preview__item';
      var img = document.createElement('img');
      img.className = 'image-preview__img';
      img.src = dataUrl;
      img.alt = 'reference-' + (idx + 1);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'image-preview__remove';
      btn.setAttribute('aria-label', 'Remove');
      btn.textContent = '×';
      btn.addEventListener('click', function () {
        selectedImages.splice(idx, 1);
        renderImagePreview();
      });
      item.appendChild(img);
      item.appendChild(btn);
      grid.appendChild(item);
    });
  }

  // 上传区交互
  var uploadZone = document.getElementById('uploadZone');
  var referenceImageInput = document.getElementById('referenceImageInput');
  if (uploadZone && referenceImageInput) {
    uploadZone.addEventListener('click', function () {
      referenceImageInput.click();
    });
    uploadZone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        referenceImageInput.click();
      }
    });
    referenceImageInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(referenceImageInput.files || []);
      if (!files.length) return;
      var remaining = MAX_IMAGES - selectedImages.length;
      if (remaining <= 0) {
        alert(window.I18N.t('co.requirements.image.max'));
        referenceImageInput.value = '';
        return;
      }
      var toAdd = files.slice(0, remaining);
      if (files.length > remaining) {
        alert(window.I18N.t('co.requirements.image.max'));
      }
      Promise.all(toAdd.map(fileToDataUrl)).then(function (dataUrls) {
        selectedImages = selectedImages.concat(dataUrls);
        renderImagePreview();
        referenceImageInput.value = '';
      }).catch(function () {
        referenceImageInput.value = '';
      });
    });
    // 拖拽上传
    ['dragover', 'dragleave', 'drop'].forEach(function (evt) {
      uploadZone.addEventListener(evt, function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (evt === 'dragover') uploadZone.classList.add('upload-zone--dragover');
        else uploadZone.classList.remove('upload-zone--dragover');
      });
    });
    uploadZone.addEventListener('drop', function (e) {
      var files = Array.prototype.slice.call(e.dataTransfer.files || [])
        .filter(function (f) { return f.type.indexOf('image/') === 0; });
      if (!files.length) return;
      var remaining = MAX_IMAGES - selectedImages.length;
      if (remaining <= 0) {
        alert(window.I18N.t('co.requirements.image.max'));
        return;
      }
      var toAdd = files.slice(0, remaining);
      if (files.length > remaining) {
        alert(window.I18N.t('co.requirements.image.max'));
      }
      Promise.all(toAdd.map(fileToDataUrl)).then(function (dataUrls) {
        selectedImages = selectedImages.concat(dataUrls);
        renderImagePreview();
      });
    });
  }

  if (payDeposit) {
    payDeposit.addEventListener('click', function () {
      var serviceType = selectedService === 'custom' ? 'CUSTOM_IMAGE' : 'DESIGNER_DESIGN';
      var reqInput = document.getElementById('requirementInput');
      var matInput = document.getElementById('materialInput');
      var requirement = reqInput ? reqInput.value.trim() : '';
      var material = matInput ? matInput.value.trim() : '';
      var titleKey = serviceType === 'CUSTOM_IMAGE' ? 'svc.custom.title' : 'svc.designer.title';
      if (!requirement) {
        requirement = window.I18N.t(titleKey);
      }

      function finish(order) {
        localStorage.setItem('duxury-paid', serviceType);
        if (order) {
          localStorage.setItem('duxury-order', JSON.stringify(order));
        }
        payDeposit.style.display = 'none';
        checkoutSuccess.style.display = 'block';
      }

      function doCreate(referenceImages) {
        if (!localStorage.getItem('duxury-token')) {
          alert(window.I18N.t('co.login.required'));
          return;
        }
        var currentUser = null;
        try { currentUser = JSON.parse(localStorage.getItem('duxury-user') || 'null'); } catch (e) { currentUser = null; }
        var customerName = currentUser && currentUser.displayName && currentUser.displayName !== currentUser.email
          ? currentUser.displayName : undefined;
        var refInput = document.getElementById('referralCodeInput');
        var referralCode = refInput && refInput.value.trim() ? refInput.value.trim().toUpperCase() : undefined;
        var pieceCount = readPieceCount();
        var unit = Object.prototype.hasOwnProperty.call(SERVICE_UNIT, selectedService)
          ? SERVICE_UNIT[selectedService]
          : SERVICE_UNIT.custom;
        window.DUXURY_API.createOrder({
          serviceType: serviceType,
          customerName: customerName,
          depositAmount: unit * pieceCount,
          pieceCount: pieceCount,
          basicRequirements: requirement,
          materialInfo: material || undefined,
          referenceImages: referenceImages || undefined,
          referralCode: referralCode
        }).then(function (order) {
          if (referralCode) localStorage.removeItem('duxury-ref');
          finish(order);
        }).catch(function (err) {
          alert(err.message || 'order create failed');
        });
      }

      doCreate(selectedImages.length ? selectedImages : null);
    });
  }

  /* ============================================================
     Workspace app: conversation switching, filters, search, chat
  ============================================================ */
  var conversationList = document.getElementById('conversationList');
  var chatBody = document.getElementById('chatBody');
  var chatInput = document.getElementById('chatInput');
  var chatSend = document.getElementById('chatSend');
  var chatTyping = document.getElementById('chatTyping');
  var chatBack = document.getElementById('chatBack');
  var conversationSearch = document.getElementById('conversationSearch');
  var filterBar = document.getElementById('filterBar');

  // Per-conversation runtime state
  var workspace = {
    currentId: null,
    orderId: null,
    balanceAmount: null,
    members: {},
    allConversations: [],
    filter: 'all',
    searchQuery: ''
  };

  function parseBalanceLabel(ev) {
    var a = parseBalanceAmount(ev);
    if (a.amount === '—') return window.I18N.t('ws.event.BALANCE_PAYMENT');
    return a.symbol + a.amount;
  }

  function parseBalanceAmount(ev) {
    var content = ev && ev.content ? String(ev.content) : '';
    var m = content.match(/(?:尾款金额|Balance(?:\s+amount)?)[：:]\s*([¥$€]?)([\d.,]+)/i);
    if (m) return { symbol: m[1] || '¥', amount: m[2] };
    if (workspace.balanceAmount != null) {
      return { symbol: '¥', amount: String(workspace.balanceAmount) };
    }
    return { symbol: '¥', amount: '—' };
  }

  function fillBalancePaymentCard(card, ev) {
    var paid =
      ev.eventType === 'BALANCE_PAID' ||
      ev.resolution === 'PAID' ||
      (ev.resolution === 'CONFIRM' && ev.eventType === 'BALANCE_PAID');
    var amount = parseBalanceAmount(ev);
    var titleText = window.I18N.localizeEventTitle(ev.title, ev.eventType) || window.I18N.t('ws.balance.title');

    var head = document.createElement('div');
    head.className = 'pay-card__head';

    var icon = document.createElement('div');
    icon.className = 'pay-card__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M7 15h.01"/><path d="M11 15h2"/></svg>';

    var headText = document.createElement('div');
    headText.className = 'pay-card__head-text';
    var label = document.createElement('div');
    label.className = 'pay-card__label';
    label.textContent = titleText;
    var sub = document.createElement('div');
    sub.className = 'pay-card__sub';
    sub.textContent = paid
      ? (window.I18N && window.I18N.t('ws.pay.paidSub')) || '尾款已结清，订单将继续推进'
      : (window.I18N && window.I18N.t('ws.pay.pendingSub')) || '确认金额后完成支付';
    headText.appendChild(label);
    headText.appendChild(sub);

    var status = document.createElement('span');
    status.className = 'pay-card__status' + (paid ? ' pay-card__status--paid' : '');
    status.textContent = paid
      ? ((window.I18N && window.I18N.t('ws.pay.statusPaid')) || '已支付')
      : ((window.I18N && window.I18N.t('ws.pay.statusPending')) || '待支付');

    head.appendChild(icon);
    head.appendChild(headText);
    head.appendChild(status);

    var amountRow = document.createElement('div');
    amountRow.className = 'pay-card__amount';
    var sym = document.createElement('span');
    sym.className = 'pay-card__currency';
    sym.textContent = amount.symbol;
    var val = document.createElement('span');
    val.className = 'pay-card__value';
    val.textContent = amount.amount;
    amountRow.appendChild(sym);
    amountRow.appendChild(val);

    card.appendChild(head);
    card.appendChild(amountRow);

    var detail = (ev.content && String(ev.content).trim()) || '';
    detail = detail.replace(/(?:尾款金额|Balance(?:\s+amount)?)[：:][^\n]*/gi, '').trim();
    if (detail) {
      var note = document.createElement('p');
      note.className = 'pay-card__note';
      note.textContent = detail;
      card.appendChild(note);
    } else if (!paid) {
      var noteDefault = document.createElement('p');
      noteDefault.className = 'pay-card__note';
      noteDefault.textContent =
        (window.I18N && window.I18N.t('ws.pay.defaultNote')) || '含工费及您已确认的定制选项';
      card.appendChild(noteDefault);
    }

    if (ev.actionable && ev.eventType === 'BALANCE_PAYMENT' && !paid) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pay-card__cta';
      btn.textContent = (window.I18N && window.I18N.t('ws.pay.cta')) || '立即支付';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openBalancePayModal();
      });
      card.appendChild(btn);
    }
  }

  function chatApiReady() {
    return !!(window.DUXURY_API && window.DUXURY_API.listConversations && window.DUXURY_API.sendMessage);
  }

  function matchesFilter(c) {
    var f = workspace.filter || 'all';
    if (f === 'all') return true;
    if (f === 'design') {
      return c.orderStatus === 'PENDING_DESIGN' || c.orderStatus === 'DESIGNING';
    }
    if (f === 'producing') {
      return c.orderStatus === 'PENDING_PRODUCTION' || c.orderStatus === 'PRODUCING';
    }
    return true;
  }

  function localizedOrderStatus(orderStatus, fallbackLabel) {
    if (window.I18N && window.I18N.localizeOrderStatus) {
      return window.I18N.localizeOrderStatus(orderStatus, fallbackLabel);
    }
    return fallbackLabel || orderStatus || '';
  }

  function renderConversationList(items) {
    if (!conversationList) return;
    workspace.allConversations = items || [];
    var q = (workspace.searchQuery || '').trim().toLowerCase();
    var filtered = workspace.allConversations.filter(function (c) {
      if (!matchesFilter(c)) return false;
      if (!q) return true;
      var name = (c.orderNumber || c.title || '').toLowerCase();
      return name.indexOf(q) !== -1;
    });
    conversationList.innerHTML = '';
    if (!filtered.length) {
      conversationList.innerHTML = '<div class="conversation__empty">' + window.I18N.t('ws.empty') + '</div>';
    }
    filtered.forEach(function (c) {
      var el = document.createElement('div');
      el.className = 'conversation';
      el.setAttribute('data-id', c.id);
      el.setAttribute('data-order', c.orderNumber || '');
      var letter = (c.orderNumber || c.title || '?').charAt(0).toUpperCase();
      var statusColor = STATUS_COLORS[c.orderStatus] || '#6b7280';
      var statusText = localizedOrderStatus(c.orderStatus, c.orderStatusLabel);
      var statusPill = statusText
        ? '<span class="conversation__status" style="background:' + statusColor + '">' + escapeHtml(statusText) + '</span>'
        : '';
      var badge = c.unreadCount > 0
        ? '<span class="conversation__badge">' + c.unreadCount + '</span>'
        : '<span class="conversation__badge conversation__badge--muted">✓✓</span>';
      var typePill = c.serviceType
        ? '<span class="conversation__type conversation__type--' + c.serviceType.toLowerCase() + '">' + escapeHtml(c.serviceTypeLabel || c.serviceType) + '</span>'
        : '';
      var avatarHtml = c.avatarUrl
        ? '<div class="conversation__avatar conversation__avatar--ring conversation__avatar--img-wrap"><img class="conversation__avatar-img" src="' + escapeAttr(c.avatarUrl) + '" alt=""></div>'
        : '<div class="conversation__avatar conversation__avatar--ring" style="background:' + statusColor + '">' + letter + '</div>';
      el.innerHTML =
        avatarHtml +
        '<div class="conversation__main">' +
          '<div class="conversation__top"><span class="conversation__name">' + escapeHtml(c.orderNumber || c.title || '') + '</span>' + typePill + '</div>' +
          '<div class="conversation__bottom"><span class="conversation__preview">' + escapeHtml(c.lastMessage || '') + '</span>' + statusPill + badge + '</div>' +
        '</div>';
      el.addEventListener('click', function () { openConversation(c.id, c.title, c.orderNumber, c.orderId, c.orderStatus, c.orderStatusLabel); });
      conversationList.appendChild(el);
    });
    if (filtered.length && !workspace.currentId) {
      var first = filtered[0];
      openConversation(first.id, first.title, first.orderNumber, first.orderId, first.orderStatus, first.orderStatusLabel);
    }
  }

  function openConversation(id, title, orderNumber, orderId, orderStatus, orderStatusLabel) {
    workspace.currentId = id;
    workspace.orderId = orderId || null;
    var chatTitle = document.getElementById('chatTitle');
    var chatOrderId = document.getElementById('chatOrderId');
    var chatStage = document.getElementById('chatStage');
    if (chatTitle) chatTitle.textContent = title || '';
    if (chatOrderId) chatOrderId.textContent = orderNumber ? '#' + orderNumber : '';
    if (chatStage) {
      var stageLabel = localizedOrderStatus(orderStatus, orderStatusLabel);
      if (stageLabel) {
        chatStage.textContent = stageLabel;
        chatStage.style.display = '';
        chatStage.style.background = STATUS_COLORS[orderStatus] || '#6b7280';
        chatStage.style.color = '#fff';
      } else {
        chatStage.style.display = 'none';
      }
    }
    if (conversationList) {
      conversationList.querySelectorAll('.conversation').forEach(function (c) { c.classList.remove('active'); });
      var el = conversationList.querySelector('[data-id="' + id + '"]');
      if (el) el.classList.add('active');
    }
    document.body.classList.remove('sidebar-open');
    if (chatApiReady()) {
      window.DUXURY_API.getMembers(id).then(renderMembers).catch(function () {});
      window.DUXURY_API.getMessages(id).then(function (msgs) {
        (msgs || []).forEach(function (m) {
          if (chatNotified && m && m.id != null) chatNotified[String(m.id)] = true;
        });
        if (chatPrimed) chatPrimed[id] = true;
        renderMessages(msgs);
        window.DUXURY_API.markRead(id).then(loadConversations).catch(function () {});
      }).catch(function () {});
    }
  }

  function renderMembers(members) {
    workspace.members = {};
    (members || []).forEach(function (m) { workspace.members[m.accountType + ':' + m.accountId] = m; });
    var chatMembers = document.getElementById('chatMembers');
    if (!chatMembers) return;
    chatMembers.innerHTML = '';
    (members || []).forEach(function (m) {
      var role = m.role || 'CUSTOMER';
      var cls = role === 'DESIGNER' ? 'member-avatar--designer'
        : (role === 'CUSTOMER' ? 'member-avatar--client'
        : (role === 'SUPER_SERVICE' ? 'member-avatar--super-service'
        : (role === 'AI_ASSISTANT' ? 'member-avatar--ai' : 'member-avatar--tracker')));
      var span = document.createElement('span');
      span.className = 'member-avatar ' + cls;
      span.title = m.displayName || role;
      span.textContent = (m.displayName || role).charAt(0).toUpperCase();
      chatMembers.appendChild(span);
    });
  }

  /** 同一单件多次确认、重复尾款推送时只展示最新一条事件卡片。 */
  function prepareMessagesForDisplay(messages) {
    var list = (messages || []).slice();
    var lastIdxByKey = {};
    list.forEach(function (m, idx) {
      if (m.msgType !== 'event' || !m.event) return;
      var ev = m.event;
      var key = null;
      if (ev.eventType === 'DESIGN_CONFIRM' || ev.eventType === 'MODEL_CONFIRM') {
        key = ev.eventType + ':' + (ev.pieceId != null ? ev.pieceId : 'order');
      } else if (ev.eventType === 'BALANCE_PAYMENT') {
        key = 'BALANCE_PAYMENT';
      }
      if (key) lastIdxByKey[key] = idx;
    });
    if (!Object.keys(lastIdxByKey).length) return list;
    return list.filter(function (m, idx) {
      if (m.msgType !== 'event' || !m.event) return true;
      var ev = m.event;
      if (ev.eventType === 'DESIGN_CONFIRM' || ev.eventType === 'MODEL_CONFIRM') {
        var key = ev.eventType + ':' + (ev.pieceId != null ? ev.pieceId : 'order');
        return lastIdxByKey[key] === idx;
      }
      if (ev.eventType === 'BALANCE_PAYMENT') {
        return lastIdxByKey.BALANCE_PAYMENT === idx;
      }
      return true;
    });
  }

  function renderMessages(messages) {
    if (!chatBody) return;
    chatBody.innerHTML = '<div class="chat__day"><span>' + window.I18N.t('ws.day.today') + '</span></div>';
    var seenEventIds = {};
    prepareMessagesForDisplay(messages).forEach(function (m) {
      if (m.msgType === 'event' && m.event) {
        var eid = m.eventId != null ? m.eventId : (m.event && m.event.id);
        if (eid != null) {
          var key = String(eid);
          if (seenEventIds[key]) return;
          seenEventIds[key] = true;
        }
        appendEventCard(m);
        return;
      }
      var mine = m.senderType === 'C_PORTAL_CUSTOMER';
      appendChatMsg(m.content || '', mine ? 'out' : 'in', m.role || 'CUSTOMER', m.displayName || m.role || '', m.createdAt, m.translatedContent, m.id);
    });
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  /** 事件卡片在客户视角的左右：尾款/设计稿等由对方推送；客户确认/驳回靠右。 */
  function isBalanceEvent(ev) {
    return ev && (ev.eventType === 'BALANCE_PAYMENT' || ev.eventType === 'BALANCE_PAID');
  }

  function localizeAdjustNotice(text) {
    var raw = text || '';
    var designZh = '为满足生产工艺要求，我们对设计做了一定的调整，需要您确认新的设计是否符合您的预期。';
    var modelZh = '为满足生产工艺要求，我们对建模做了一定的调整，需要您确认新的建模是否符合您的预期。';
    if (raw.indexOf(designZh) >= 0) return raw.split(designZh).join(window.I18N.t('ws.adjust.design'));
    if (raw.indexOf(modelZh) >= 0) return raw.split(modelZh).join(window.I18N.t('ws.adjust.model'));
    return raw;
  }

  function isReviewEvent(ev) {
    return ev && (ev.eventType === 'REVIEW_REJECT' || ev.eventType === 'REVIEW_PASS');
  }

  function fillReviewCard(card, ev) {
    var failed = ev.eventType === 'REVIEW_REJECT';
    card.classList.add('msg-card--review');
    card.classList.add(failed ? 'msg-card--review-fail' : 'msg-card--review-pass');
    card.style.borderTop = '';
    var title = window.I18N.localizeEventType(ev.eventType);
    var reason = (ev.reason || '').trim();
    var notes = (ev.content || '').trim();
    card.innerHTML =
      '<div class="review-card__ribbon">' +
        '<span class="review-card__seal" aria-hidden="true">' + (failed ? '!' : '✓') + '</span>' +
        '<div>' +
          '<div class="review-card__kicker">' + escapeHtml(window.I18N.t('ws.review.kicker')) + '</div>' +
          '<div class="review-card__title">' + escapeHtml(title) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="review-card__body">' +
        '<p class="review-card__lead">' + escapeHtml(window.I18N.t(failed ? 'ws.review.failLead' : 'ws.review.passLead')) + '</p>' +
        (reason
          ? '<div class="review-card__reason"><span class="review-card__label">' + escapeHtml(window.I18N.t('ws.review.reason')) + '</span><p class="review-card__text">' + escapeHtml(reason) + '</p></div>'
          : '') +
        (notes
          ? '<div class="review-card__notes"><span class="review-card__label">' + escapeHtml(window.I18N.t('ws.review.notes')) + '</span><p class="review-card__text">' + escapeHtml(notes) + '</p></div>'
          : '') +
      '</div>';
  }

  function eventCardSenderMeta(ev, m) {
    if (isBalanceEvent(ev)) {
      return {
        role: 'SYSTEM',
        name: window.I18N.localizeActorName('SYSTEM', '')
      };
    }
    var role = ev.actorRole || m.role || 'SYSTEM';
    return {
      role: role,
      name: window.I18N.localizeActorName(role, ev.actorName || m.displayName || '')
    };
  }

  function eventCardIsMine(ev) {
    if (!ev) return false;
    if (ev.eventType === 'BALANCE_PAYMENT' || ev.eventType === 'BALANCE_PAID') return false;
    if (ev.eventType === 'DESIGN_SUBMIT' || ev.eventType === 'MODEL_SUBMIT') return false;
    return ev.actorType === 'C_PORTAL_CUSTOMER';
  }

  var SHIP_COUNTRY_PRIORITY = ['CN', 'US', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP', 'KR', 'SG', 'HK', 'TW', 'MO', 'IT', 'ES', 'NL', 'CH', 'MY', 'TH', 'VN', 'AE', 'NZ'];

  function shipCountryOptions(selected) {
    var codes = [];
    try {
      if (typeof Intl !== 'undefined' && Intl.supportedValuesOf) codes = Intl.supportedValuesOf('region');
    } catch (e) { /* ignore */ }
    if (!codes.length) codes = SHIP_COUNTRY_PRIORITY.concat(['IN', 'BR', 'MX']);
    var skip = { EU: 1, UN: 1, UK: 1 };
    codes = codes.filter(function (code) { return code && code.length === 2 && !skip[code]; });
    var loc = (window.I18N && window.I18N.current) ? window.I18N.current : 'en';
    var display = null;
    try { display = new Intl.DisplayNames([loc], { type: 'region' }); } catch (e2) { display = null; }
    var rows = codes.map(function (code) {
      var name = display ? (display.of(code) || code) : code;
      return { code: code, label: name + ' (' + code + ')' };
    });
    var head = [];
    var rest = [];
    rows.forEach(function (row) {
      if (SHIP_COUNTRY_PRIORITY.indexOf(row.code) >= 0) head.push(row);
      else rest.push(row);
    });
    head.sort(function (a, b) {
      return SHIP_COUNTRY_PRIORITY.indexOf(a.code) - SHIP_COUNTRY_PRIORITY.indexOf(b.code);
    });
    rest.sort(function (a, b) { return a.label.localeCompare(b.label, loc); });
    var all = head.concat(rest);
    if (selected && !all.some(function (row) { return row.label === selected; })) {
      all.unshift({ code: '', label: selected });
    }
    return all.map(function (row) {
      var sel = selected && selected === row.label ? ' selected' : '';
      return '<option value="' + escapeAttr(row.label) + '"' + sel + '>' + escapeHtml(row.label) + '</option>';
    }).join('');
  }

  function eventDisplayContent(ev) {
    if (!ev) return '';
    if (ev.eventType === 'SHIPPING_ADDRESS_REQUEST') return window.I18N.t('ws.shipaddr.body');
    return localizeAdjustNotice(ev.content || '');
  }

  function openShippingAddressForm(orderId) {
    if (!orderId) {
      alert(window.I18N.t('ws.action.missingOrder'));
      return;
    }
    var overlay = document.createElement('div');
    overlay.className = 'event-detail';
    var dialog = document.createElement('div');
    dialog.className = 'event-detail__dialog shipaddr-dialog';
    dialog.innerHTML =
      '<button type="button" class="event-detail__close" aria-label="Close">&times;</button>' +
      '<h3 class="balance-pay__title">' + escapeHtml(window.I18N.t('ws.shipaddr.title')) + '</h3>' +
      '<p class="shipaddr__hint">' + escapeHtml(window.I18N.t('ws.shipaddr.body')) + '</p>' +
      '<form class="shipaddr" id="shipaddrForm">' +
        '<label class="shipaddr__label" for="shipaddrRecipient">' + escapeHtml(window.I18N.t('ws.shipaddr.recipient')) + '</label>' +
        '<input class="checkout__input" id="shipaddrRecipient" autocomplete="name" maxlength="100">' +
        '<label class="shipaddr__label" for="shipaddrPhone">' + escapeHtml(window.I18N.t('ws.shipaddr.phone')) + '</label>' +
        '<input class="checkout__input" id="shipaddrPhone" type="tel" inputmode="tel" autocomplete="tel" maxlength="40">' +
        '<label class="shipaddr__label" for="shipaddrCountry">' + escapeHtml(window.I18N.t('ws.shipaddr.country')) + '</label>' +
        '<select class="checkout__input" id="shipaddrCountry">' +
          '<option value="">' + escapeHtml(window.I18N.t('ws.shipaddr.countryPh')) + '</option>' +
        '</select>' +
        '<label class="shipaddr__label" for="shipaddrDetail">' + escapeHtml(window.I18N.t('ws.shipaddr.detail')) + '</label>' +
        '<textarea class="checkout__input shipaddr__detail" id="shipaddrDetail" rows="3" maxlength="1000" autocomplete="street-address"></textarea>' +
        '<label class="shipaddr__label" for="shipaddrPostal">' + escapeHtml(window.I18N.t('ws.shipaddr.postal')) + '</label>' +
        '<input class="checkout__input" id="shipaddrPostal" autocomplete="postal-code" maxlength="20" placeholder="' + escapeAttr(window.I18N.t('ws.shipaddr.postalPh')) + '">' +
        '<div class="shipaddr__error" id="shipaddrError" role="alert"></div>' +
        '<div class="shipaddr__actions">' +
          '<button type="button" class="prog-btn prog-btn--no" id="shipaddrCancel">' + escapeHtml(window.I18N.t('ws.shipaddr.cancel')) + '</button>' +
          '<button type="submit" class="prog-btn prog-btn--ok" id="shipaddrSubmit">' + escapeHtml(window.I18N.t('ws.shipaddr.submit')) + '</button>' +
        '</div>' +
      '</form>';
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    dialog.querySelector('.event-detail__close').addEventListener('click', close);
    dialog.querySelector('#shipaddrCancel').addEventListener('click', close);
    dialog.addEventListener('click', function (e) { e.stopPropagation(); });

    var countryEl = dialog.querySelector('#shipaddrCountry');
    function fillCountries(selected) {
      countryEl.innerHTML =
        '<option value="">' + escapeHtml(window.I18N.t('ws.shipaddr.countryPh')) + '</option>' +
        shipCountryOptions(selected || '');
      if (selected) countryEl.value = selected;
    }
    fillCountries('');

    window.DUXURY_API.getShippingAddress(orderId).then(function (addr) {
      if (closed || !addr) return;
      if (addr.recipient) dialog.querySelector('#shipaddrRecipient').value = addr.recipient;
      if (addr.phone) dialog.querySelector('#shipaddrPhone').value = addr.phone;
      if (addr.address) dialog.querySelector('#shipaddrDetail').value = addr.address;
      if (addr.postalCode) dialog.querySelector('#shipaddrPostal').value = addr.postalCode;
      if (addr.country) fillCountries(addr.country);
    }).catch(function () {});

    dialog.querySelector('#shipaddrForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var errEl = dialog.querySelector('#shipaddrError');
      var submitBtn = dialog.querySelector('#shipaddrSubmit');
      var recipient = (dialog.querySelector('#shipaddrRecipient').value || '').trim();
      var phone = (dialog.querySelector('#shipaddrPhone').value || '').trim();
      var country = countryEl.value || '';
      var address = (dialog.querySelector('#shipaddrDetail').value || '').trim();
      var postalCode = (dialog.querySelector('#shipaddrPostal').value || '').trim();
      var err = '';
      if (!recipient) err = window.I18N.t('ws.shipaddr.err.recipient');
      else if (!phone || !/\d/.test(phone)) err = window.I18N.t('ws.shipaddr.err.phone');
      else if (!country) err = window.I18N.t('ws.shipaddr.err.country');
      else if (!address) err = window.I18N.t('ws.shipaddr.err.detail');
      if (err) {
        if (errEl) errEl.textContent = err;
        return;
      }
      if (errEl) errEl.textContent = '';
      if (submitBtn) submitBtn.disabled = true;
      window.DUXURY_API.submitShippingAddress(orderId, {
        recipient: recipient,
        phone: phone,
        country: country,
        address: address,
        postalCode: postalCode || null
      }).then(function () {
        close();
        return reloadChatAndProgress();
      }).catch(function (error) {
        if (errEl) errEl.textContent = (error && error.message) ? error.message : window.I18N.t('ws.action.failed');
      }).finally(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
    });
  }

  function appendEventCard(m) {
    if (!chatBody) return;
    if (m && m.id != null && messageAlreadyRendered(m.id)) return;
    var ev = m.event || {};
    var eventId = m.eventId != null ? m.eventId : ev.id;
    if (eventId != null && chatBody.querySelector('[data-event-id="' + String(eventId) + '"]')) return;
    var style = EVENT_STYLE[ev.eventType] || EVENT_STYLE._default;
    var senderMeta = eventCardSenderMeta(ev, m);
    var role = senderMeta.role;
    var senderName = senderMeta.name;

    // 普通聊天气泡发送形式：昵称 + 时间，气泡部分替换为卡片（无头像圆球）
    // 自己发送的（客户操作类事件）靠右，他人发送的靠左
    var mine = eventCardIsMine(ev);
    var msg = document.createElement('div');
    msg.className = 'msg msg--no-avatar ' + (mine ? 'msg--out' : 'msg--in');
    if (m && m.id != null) msg.setAttribute('data-mid', m.id);
    if (eventId != null) msg.setAttribute('data-event-id', String(eventId));

    var content = document.createElement('div');
    content.className = 'msg__content';

    var meta = document.createElement('div');
    meta.className = 'msg__meta' + (mine ? ' msg__meta--out' : '');
    var roleTag = document.createElement('span');
    roleTag.className = 'msg__role';
    roleTag.style.color = ROLE_COLORS[role] || '#999';
    roleTag.textContent = senderName;
    var time = document.createElement('span');
    time.className = 'msg__time';
    time.textContent = formatTime(m.createdAt);
    meta.appendChild(roleTag);
    meta.appendChild(time);
    content.appendChild(meta);

    // 尾款支付卡片：长条形，区别于其他卡片
    var isBalance = isBalanceEvent(ev);

    // 卡片（替代气泡）
    var card = document.createElement('div');
    card.className = 'msg-card msg-card--' + (ev.eventType || 'default') + (isBalance ? ' msg-card--pay-sheet' : '');
    if (!isBalance) {
      card.style.borderTop = '3px solid ' + style.color;
    }
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.title = window.I18N.t('ws.card.viewDetail');

    if (isBalance) {
      fillBalancePaymentCard(card, ev);
    } else if (isReviewEvent(ev)) {
      fillReviewCard(card, ev);
    } else if (ev.title) {
      var title = document.createElement('div');
      title.className = 'msg-card__title';
      title.style.color = style.color;
      title.textContent = window.I18N.localizeEventTitle(ev.title, ev.eventType);
      card.appendChild(title);
    }
    if (!isBalance && !isReviewEvent(ev)) {
    var images = (ev.images || []).filter(function (src) {
      return String(src || '').indexOf('data:image/svg') !== 0;
    });
    if (images.length) {
      var imgs = document.createElement('div');
      imgs.className = 'msg-card__imgs';
      var first = images[0];
      var img = document.createElement('img');
      img.className = 'msg-card__img';
      img.src = first;
      img.alt = ev.title || 'design';
      img.loading = 'lazy';
      imgs.appendChild(img);
      if (images.length > 1) {
        var more = document.createElement('span');
        more.className = 'msg-card__more';
        more.textContent = '+' + (images.length - 1);
        imgs.appendChild(more);
      }
      card.appendChild(imgs);
    }
    if (ev.content) {
      var contentEl = document.createElement('div');
      contentEl.className = 'msg-card__content';
      contentEl.textContent = eventDisplayContent(ev);
      card.appendChild(contentEl);
    }
    if (ev.reason) {
      var reason = document.createElement('div');
      reason.className = 'msg-card__reason';
      reason.textContent = ev.reason;
      card.appendChild(reason);
    }
    }

    // 已决策锁定徽标
    if (ev.resolution) {
      var lock = document.createElement('div');
      lock.className = 'msg-card__lock msg-card__lock--' + ev.resolution.toLowerCase();
      var resText = window.I18N.localizeResolution(ev.resolution);
      lock.textContent = resText + (ev.resolution === 'CONFIRM' ? ' ✓' : (ev.resolution === 'REJECT' ? ' ✗' : ''));
      card.appendChild(lock);
    }

    if (ev.actionable && ev.eventType === 'SHIPPING_ADDRESS_REQUEST') {
      var addrActions = document.createElement('div');
      addrActions.className = 'msg-card__actions';
      var addrBtn = document.createElement('button');
      addrBtn.type = 'button';
      addrBtn.className = 'prog-btn prog-btn--ok msg-card__btn msg-card__btn--addr';
      addrBtn.textContent = ev.resolution === 'FILLED'
        ? window.I18N.t('ws.shipaddr.edit')
        : window.I18N.t('ws.shipaddr.fill');
      addrBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!workspace.orderId) {
          alert(window.I18N.t('ws.action.missingOrder'));
          return;
        }
        openShippingAddressForm(workspace.orderId);
      });
      addrActions.appendChild(addrBtn);
      card.appendChild(addrActions);
    }

    // 操作按钮（阻止冒泡，避免触发详情）
    if (ev.actionable && ev.eventType && !isBalance && ev.eventType !== 'SHIPPING_ADDRESS_REQUEST') {
      var confirmAct, rejectAct, confirmLabel, rejectLabel;
      if (ev.eventType === 'DESIGN_SUBMIT') {
        confirmAct = 'DESIGN_CONFIRM'; rejectAct = 'DESIGN_REJECT';
        confirmLabel = window.I18N.t('ws.action.confirmDesign');
        rejectLabel = window.I18N.t('ws.action.rejectDesign');
      } else if (ev.eventType === 'MODEL_SUBMIT') {
        confirmAct = 'MODEL_CONFIRM'; rejectAct = 'MODEL_REJECT';
        confirmLabel = window.I18N.t('ws.action.confirmModel');
        rejectLabel = window.I18N.t('ws.action.rejectModel');
      }
      if (confirmAct) {
        var actions = document.createElement('div');
        actions.className = 'msg-card__actions';
        {
          var okBtn = document.createElement('button');
          okBtn.type = 'button';
          okBtn.className = 'prog-btn prog-btn--ok msg-card__btn';
          okBtn.textContent = confirmLabel;
          okBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            var orderId = workspace.orderId;
            if (!orderId || okBtn.disabled) {
              if (!orderId) alert(window.I18N.t('ws.action.missingOrder'));
              return;
            }
            okBtn.disabled = true;
            var pieceId = ev.pieceId;
            var req = pieceId
              ? window.DUXURY_API.confirmPiece(orderId, pieceId, confirmAct)
              : window.DUXURY_API.confirmOrder(orderId, confirmAct);
            req.then(reloadChatAndProgress)
              .catch(function (err) { alert((err && err.message) || window.I18N.t('ws.action.failed')); })
              .finally(function () { okBtn.disabled = false; });
          });
          actions.appendChild(okBtn);
          if (rejectAct) {
            var noBtn = document.createElement('button');
            noBtn.type = 'button';
            noBtn.className = 'prog-btn prog-btn--no msg-card__btn';
            noBtn.textContent = rejectLabel;
            noBtn.addEventListener('click', function (e) {
              e.stopPropagation();
              var orderId = workspace.orderId;
              if (!orderId) return;
              var pieceId = ev.pieceId;
              openRejectReasonModal({
                rejectAct: rejectAct,
                pieceId: pieceId,
                onSubmit: function (reason) {
                  if (pieceId) {
                    return window.DUXURY_API.rejectPiece(orderId, pieceId, rejectAct, reason);
                  }
                  return window.DUXURY_API.rejectOrder(orderId, rejectAct, reason);
                }
              });
            });
            actions.appendChild(noBtn);
          }
        }
        card.appendChild(actions);
      }
    }

    card.addEventListener('click', function () {
      if (ev.eventType === 'SHIPPING_ADDRESS_REQUEST' && ev.actionable) {
        if (!workspace.orderId) {
          alert(window.I18N.t('ws.action.missingOrder'));
          return;
        }
        openShippingAddressForm(workspace.orderId);
        return;
      }
      openEventDetail(m);
    });
    content.appendChild(card);
    msg.appendChild(content);
    chatBody.appendChild(msg);
  }

  /**
   * 设计稿 / 建模稿驳回：自定义弹窗（替代浏览器 prompt）
   * @param {{ rejectAct: string, pieceId?: number, onSubmit: (reason: string) => Promise<unknown> }} opts
   */
  function openRejectReasonModal(opts) {
    var rejectAct = opts.rejectAct;
    var titleKey = rejectAct === 'MODEL_REJECT' ? 'ws.reject.model.title' : 'ws.reject.design.title';
    var overlay = document.createElement('div');
    overlay.className = 'event-detail';
    var dialog = document.createElement('div');
    dialog.className = 'event-detail__dialog reject-modal';
    dialog.innerHTML =
      '<button type="button" class="event-detail__close" aria-label="Close">&times;</button>' +
      '<h3 class="balance-pay__title">' + escapeHtml(window.I18N.t(titleKey)) + '</h3>' +
      '<p class="reject-modal__hint">' + escapeHtml(window.I18N.t('ws.reject.hint')) + '</p>' +
      '<label class="reject-modal__label" for="rejectReasonInput">' + escapeHtml(window.I18N.t('ws.progress.reject.ph')) + '</label>' +
      '<textarea id="rejectReasonInput" class="checkout__input reject-modal__textarea" rows="4" maxlength="2000" placeholder="' + escapeAttr(window.I18N.t('ws.progress.reject.ph')) + '"></textarea>' +
      '<div class="reject-modal__error" id="rejectReasonError" role="alert"></div>' +
      '<div class="balance-pay__actions">' +
        '<button type="button" class="prog-btn prog-btn--no" id="rejectReasonCancel">' + escapeHtml(window.I18N.t('ws.reject.cancel')) + '</button>' +
        '<button type="button" class="prog-btn prog-btn--ok" id="rejectReasonSubmit">' + escapeHtml(window.I18N.t('ws.reject.submit')) + '</button>' +
      '</div>';
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    var input = dialog.querySelector('#rejectReasonInput');
    var errEl = dialog.querySelector('#rejectReasonError');
    var submitBtn = dialog.querySelector('#rejectReasonSubmit');
    var closed = false;

    function close() {
      if (closed) return;
      closed = true;
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    dialog.querySelector('.event-detail__close').addEventListener('click', close);
    dialog.querySelector('#rejectReasonCancel').addEventListener('click', close);
    dialog.addEventListener('click', function (e) { e.stopPropagation(); });

    setTimeout(function () {
      if (input) input.focus();
    }, 0);

    submitBtn.addEventListener('click', function () {
      if (submitBtn.disabled) return;
      var reason = (input && input.value || '').trim();
      if (!reason) {
        if (errEl) errEl.textContent = window.I18N.t('ws.reject.empty');
        if (input) input.focus();
        return;
      }
      if (errEl) errEl.textContent = '';
      submitBtn.disabled = true;
      opts.onSubmit(reason)
        .then(function () {
          close();
          return reloadChatAndProgress();
        })
        .catch(function (err) {
          if (errEl) errEl.textContent = err && err.message ? err.message : String(err);
        })
        .finally(function () {
          submitBtn.disabled = false;
        });
    });
  }

  function openPublishModal(orderId, summary) {
    var overlay = document.createElement('div');
    overlay.className = 'event-detail';
    var dialog = document.createElement('div');
    dialog.className = 'event-detail__dialog';
    dialog.innerHTML =
      '<button class="event-detail__close" aria-label="Close">&times;</button>' +
      '<h3 class="balance-pay__title">' + escapeHtml(window.I18N.t('pub.title')) + '</h3>' +
      '<p class="shop-fees__note" id="publishFeeNote"></p>' +
      '<label class="listing-label">' + escapeHtml(window.I18N.t('pub.title')) + '</label>' +
      '<input class="checkout__input" id="publishTitle" value="' + escapeAttr(summary.displayTitle || summary.orderNumber || '') + '">' +
      '<label class="listing-label">' + escapeHtml(window.I18N.t('pub.price')) + '</label>' +
      '<input class="checkout__input" id="publishPrice" type="number" min="1" step="0.01" placeholder="399">' +
      '<textarea class="checkout__input" id="publishDesc" rows="3" placeholder="..."></textarea>' +
      '<div class="balance-pay__actions"><button class="prog-btn prog-btn--ok" id="publishConfirm">' + escapeHtml(window.I18N.t('pub.submit')) + '</button></div>';
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    dialog.querySelector('.event-detail__close').addEventListener('click', close);
    window.DUXURY_API.getStorefrontFeeGuide().then(function (fees) {
      var note = document.getElementById('publishFeeNote');
      if (note && fees) {
        note.textContent = window.I18N.t('shop.fees') + ': ' +
          window.I18N.t('shop.prod') + ' $' + fees.productionFeeMin + '–$' + fees.productionFeeMax +
          ' · ' + window.I18N.t('shop.ship') + ' $' + fees.shippingFeeMin + '–$' + fees.shippingFeeMax;
      }
    }).catch(function () {});
    dialog.querySelector('#publishConfirm').addEventListener('click', function () {
      var price = Number(document.getElementById('publishPrice').value);
      if (!price || price <= 0) { alert(window.I18N.t('pub.price')); return; }
      window.DUXURY_API.publishStorefront({
        sourceOrderId: orderId,
        title: document.getElementById('publishTitle').value.trim(),
        description: document.getElementById('publishDesc').value.trim(),
        salePrice: price
      }).then(function () {
        close();
        location.href = 'seller.html';
      }).catch(function (err) { alert(err.message); });
    });
  }

  // 模拟支付尾款弹窗
  function openBalancePayModal() {
    var orderId = workspace.orderId;
    if (!orderId) return;
    function showModal(amountText) {
    var overlay = document.createElement('div');
    overlay.className = 'event-detail';
    var dialog = document.createElement('div');
    dialog.className = 'event-detail__dialog balance-pay';
    dialog.innerHTML =
      '<button class="event-detail__close" aria-label="Close">&times;</button>' +
      '<h3 class="balance-pay__title">' + escapeHtml(window.I18N.t('ws.balance.title')) + '</h3>' +
      '<div class="balance-pay__amount">' + escapeHtml(amountText || '—') + '</div>' +
      '<div class="balance-pay__hint">' + escapeHtml(window.I18N.t('ws.balance.hint')) + '</div>' +
      '<div class="balance-pay__actions">' +
        '<button class="prog-btn prog-btn--pay" id="balancePayConfirm">' + escapeHtml(window.I18N.t('ws.balance.confirm')) + '</button>' +
        '<button class="prog-btn prog-btn--no" id="balancePayCancel">' + escapeHtml(window.I18N.t('ws.balance.cancel')) + '</button>' +
      '</div>';
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    dialog.querySelector('.event-detail__close').addEventListener('click', close);
    dialog.querySelector('#balancePayCancel').addEventListener('click', close);
    dialog.querySelector('#balancePayConfirm').addEventListener('click', function () {
      window.DUXURY_API.payBalance(orderId)
        .then(function () {
          dialog.innerHTML =
            '<div class="balance-pay__success">✓</div>' +
            '<h3 class="balance-pay__title">' + escapeHtml(window.I18N.t('ws.balance.success')) + '</h3>' +
            '<div class="balance-pay__hint">' + escapeHtml(window.I18N.t('ws.balance.paidAmount').replace('{amount}', amountText || '')) + '</div>' +
            '<div class="balance-pay__actions"><button class="prog-btn prog-btn--ok" id="balancePayDone">' + escapeHtml(window.I18N.t('ws.balance.done')) + '</button></div>';
          dialog.querySelector('#balancePayDone').addEventListener('click', function () {
            close();
            reloadChatAndProgress();
          });
        })
        .catch(function (err) { alert(err.message); });
    });
    }
    if (workspace.balanceAmount != null) {
      showModal('¥' + workspace.balanceAmount);
      return;
    }
    window.DUXURY_API.getOrderSummary(orderId).then(function (s) {
      var amt = s && s.quotation && s.quotation.totalAmount;
      workspace.balanceAmount = amt != null ? amt : null;
      showModal(amt != null ? ('¥' + amt) : '—');
    }).catch(function () { showModal('—'); });
  }

  function openEventDetail(m) {
    var ev = m.event || {};
    var style = EVENT_STYLE[ev.eventType] || EVENT_STYLE._default;
    var senderMeta = eventCardSenderMeta(ev, m);
    var typeLabel = window.I18N.localizeEventType(ev.eventType);

    var overlay = document.createElement('div');
    overlay.className = 'event-detail';
    var dialog = document.createElement('div');
    dialog.className = 'event-detail__dialog';
    var html = '<button class="event-detail__close" aria-label="Close">&times;</button>';
    html += '<div class="event-detail__badge" style="background:' + style.color + '">' + escapeHtml(typeLabel) + '</div>';
    html += '<h3 class="event-detail__title" style="color:' + style.color + '">' + escapeHtml(window.I18N.localizeEventTitle(ev.title, ev.eventType) || typeLabel) + '</h3>';
    html += '<div class="event-detail__meta">' + escapeHtml(senderMeta.name) + ' · ' + escapeHtml(formatTime(m.createdAt)) + '</div>';
    var images = isReviewEvent(ev) ? [] : (ev.images || []).filter(function (src) {
      return String(src || '').indexOf('data:image/svg') !== 0;
    });
    if (images.length) {
      html += '<div class="event-gallery" data-count="' + images.length + '">';
      html += '<div class="event-gallery__stage">';
      html += '<img class="event-gallery__img" alt="">';
      html += '</div>';
      if (images.length > 1) {
        html += '<button type="button" class="event-gallery__nav event-gallery__nav--prev" aria-label="Previous">&#8249;</button>';
        html += '<button type="button" class="event-gallery__nav event-gallery__nav--next" aria-label="Next">&#8250;</button>';
        html += '<div class="event-gallery__count"></div>';
      }
      html += '</div>';
    }
    if (ev.content || ev.eventType === 'SHIPPING_ADDRESS_REQUEST') {
      html += '<div class="event-detail__content">' + escapeHtml(eventDisplayContent(ev)) + '</div>';
    }
    if (ev.eventType === 'SHIPPING_ADDRESS_REQUEST' && ev.actionable) {
      html += '<div class="shipaddr__actions"><button type="button" class="prog-btn prog-btn--ok" id="shipaddrOpen">' +
        escapeHtml(ev.resolution === 'FILLED' ? window.I18N.t('ws.shipaddr.edit') : window.I18N.t('ws.shipaddr.fill')) +
        '</button></div>';
    }
    if (ev.reason) html += '<div class="event-detail__reason">' + escapeHtml(window.I18N.t('ws.detail.rejectReason')) + ' ' + escapeHtml(ev.reason) + '</div>';
    // 物流事件：展示物流轨迹
    if (ev.eventType === 'SHIPPED' || ev.eventType === 'DELIVERED') {
      html += '<div class="event-detail__shipment" id="eventShipment">' + escapeHtml(window.I18N.t('ws.ship.loading')) + '</div>';
    }
    dialog.innerHTML = html;
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    var galleryIndex = 0;
    var onGalleryKey = null;
    function close() {
      if (onGalleryKey) document.removeEventListener('keydown', onGalleryKey);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    dialog.querySelector('.event-detail__close').addEventListener('click', close);
    var openAddr = dialog.querySelector('#shipaddrOpen');
    if (openAddr) {
      openAddr.addEventListener('click', function (e) {
        e.stopPropagation();
        close();
        openShippingAddressForm(workspace.orderId);
      });
    }

    if (images.length) {
      var galleryImg = dialog.querySelector('.event-gallery__img');
      var galleryCount = dialog.querySelector('.event-gallery__count');
      function showGallery(next) {
        var total = images.length;
        galleryIndex = (next + total) % total;
        if (galleryImg) galleryImg.src = images[galleryIndex];
        if (galleryCount) galleryCount.textContent = (galleryIndex + 1) + ' / ' + total;
      }
      showGallery(0);
      var prevBtn = dialog.querySelector('.event-gallery__nav--prev');
      var nextBtn = dialog.querySelector('.event-gallery__nav--next');
      if (prevBtn) prevBtn.addEventListener('click', function (e) { e.stopPropagation(); showGallery(galleryIndex - 1); });
      if (nextBtn) nextBtn.addEventListener('click', function (e) { e.stopPropagation(); showGallery(galleryIndex + 1); });
      var touchX = 0;
      var stage = dialog.querySelector('.event-gallery__stage');
      if (stage && images.length > 1) {
        stage.addEventListener('touchstart', function (e) {
          touchX = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0;
        }, { passive: true });
        stage.addEventListener('touchend', function (e) {
          var x = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : touchX;
          var delta = x - touchX;
          if (Math.abs(delta) < 40) return;
          showGallery(galleryIndex + (delta < 0 ? 1 : -1));
        }, { passive: true });
      }
      if (images.length > 1) {
        onGalleryKey = function (e) {
          if (e.key === 'ArrowLeft') showGallery(galleryIndex - 1);
          else if (e.key === 'ArrowRight') showGallery(galleryIndex + 1);
          else if (e.key === 'Escape') close();
        };
        document.addEventListener('keydown', onGalleryKey);
      }
    }

    // 拉取物流并渲染
    if ((ev.eventType === 'SHIPPED' || ev.eventType === 'DELIVERED') && workspace.orderId) {
      var shipBox = dialog.querySelector('#eventShipment');
      window.DUXURY_API.getShipment(workspace.orderId).then(function (s) {
        if (!shipBox || !s) {
          if (shipBox) shipBox.textContent = window.I18N.t('ws.ship.none');
          return;
        }
        var sh = '';
        sh += '<div class="event-detail__shipment-row">' + escapeHtml(window.I18N.t('ws.ship.tracking')) + ' ' + escapeHtml(s.trackingNumber || '-') + '</div>';
        if (s.carrierName || s.carrierCode) {
          sh += '<div class="event-detail__shipment-row">' + escapeHtml(window.I18N.t('ws.ship.carrier')) + ' ' + escapeHtml(s.carrierName || s.carrierCode) + '</div>';
        }
        sh += '<div class="event-detail__shipment-row">' + escapeHtml(window.I18N.t('ws.ship.status')) + ' ' + escapeHtml(s.statusLabel || window.I18N.t('ws.ship.pending')) + '</div>';
        if (s.events && s.events.length) {
          sh += '<div class="event-detail__timeline">';
          s.events.forEach(function (e) {
            sh += '<div class="event-detail__tl-item"><div class="event-detail__tl-desc">' + escapeHtml(e.description || '-') + '</div>';
            sh += '<div class="event-detail__tl-meta">' + escapeHtml(e.time || '') + (e.location ? ' · ' + escapeHtml(e.location) : '') + '</div></div>';
          });
          sh += '</div>';
        }
        if (s.queryUrl) {
          sh += '<a class="prog-file" href="' + escapeAttr(s.queryUrl) + '" target="_blank">' + escapeHtml(window.I18N.t('ws.ship.trackLink')) + '</a>';
        }
        shipBox.innerHTML = sh;
      }).catch(function () {
        if (shipBox) shipBox.textContent = window.I18N.t('ws.ship.loadFail');
      });
    }
  }

  function reloadChatAndProgress() {
    syncWorkspaceMessages(false);
  }

  function loadConversations() {
    if (!chatApiReady()) return;
    window.DUXURY_API.listConversations().then(renderConversationList).catch(function () {});
  }

  if (chatBack) {
    chatBack.addEventListener('click', function () {
      document.body.classList.add('sidebar-open');
    });
  }

  // Filters：按订单状态过滤会话列表
  if (filterBar) {
    filterBar.querySelectorAll('.ws-filter').forEach(function (f) {
      f.addEventListener('click', function () {
        filterBar.querySelectorAll('.ws-filter').forEach(function (x) { x.classList.remove('active'); });
        f.classList.add('active');
        workspace.filter = f.getAttribute('data-filter') || 'all';
        renderConversationList(workspace.allConversations);
      });
    });
  }

  // Search
  if (conversationSearch) {
    conversationSearch.addEventListener('input', function () {
      workspace.searchQuery = conversationSearch.value;
      renderConversationList(workspace.allConversations);
    });
  }

  // 不同角色的昵称颜色（统一三端）
  var ROLE_COLORS = {
    CUSTOMER: '#2ea043',
    DESIGNER: '#c9a96e',
    MODELER: '#4a6fff',
    SALES_MID: '#8b5cf6',
    SALES_PRE: '#f59e0b',
    FOLLOW_UP: '#22a5f7',
    SUPER_SERVICE: '#c026d3',
    AI_ASSISTANT: '#0d9488',
    ADMIN: '#c026d3',
    SYSTEM: '#999999'
  };

  // 订单流程状态颜色
  var STATUS_COLORS = {
    PENDING_DESIGN: '#f59e0b',
    DESIGNING: '#f59e0b',
    PENDING_MODEL: '#4a6fff',
    MODELING: '#4a6fff',
    PENDING_REVIEW: '#8b5cf6',
    PENDING_PRODUCTION: '#8b5cf6',
    PRODUCING: '#22a5f7',
    COMPLETED: '#2ea043',
    CANCELLED: '#999999'
  };

  // 订单服务类型颜色
  var SERVICE_TYPE_COLORS = {
    CUSTOM_IMAGE: '#f59e0b',
    DESIGNER_DESIGN: '#c9a96e',
    B2B_MODEL: '#8b5cf6'
  };

  // 事件卡片环节风格（颜色 + 标签）
  var EVENT_STYLE = {
    DESIGN_SUBMIT: { color: '#c9a96e', label: '设计稿' },
    DESIGN_REJECT: { color: '#e05d5d', label: '驳回设计' },
    DESIGN_CONFIRM: { color: '#2ea043', label: '确认设计' },
    MODEL_SUBMIT: { color: '#4a6fff', label: '建模稿' },
    MODEL_REJECT: { color: '#e05d5d', label: '驳回建模' },
    MODEL_CONFIRM: { color: '#2ea043', label: '确认建模' },
    REVIEW_PASS: { color: '#8b5cf6', label: '工艺验证' },
    REVIEW_REJECT: { color: '#e05d5d', label: '工艺驳回' },
    QUOTATION: { color: '#f59e0b', label: '报价' },
    PRODUCTION_LOG: { color: '#22a5f7', label: '生产跟单' },
    SHIPPED: { color: '#2ea043', label: '已发货' },
    SHIPPING_ADDRESS_REQUEST: { color: '#22a5f7', label: '收货信息' },
    SHIPPING_ADDRESS_FILLED: { color: '#2ea043', label: '已填收货信息' },
    DELIVERED: { color: '#2ea043', label: '已签收' },
    STATUS_CHANGE: { color: '#6b7280', label: '状态' },
    DELIVERY_CONFIRM: { color: '#2ea043', label: '交付' },
    BALANCE_PAYMENT: { color: '#d97706', label: '支付尾款' },
    BALANCE_PAID: { color: '#2ea043', label: '已支付' },
    _default: { color: '#6b7280', label: '事件' }
  };

  var chatNotifyCtx = null;
  function unlockChatAudio() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!chatNotifyCtx) chatNotifyCtx = new AC();
      if (chatNotifyCtx.state === 'suspended') chatNotifyCtx.resume();
    } catch (e) { /* ignore */ }
  }
  function playChatNotify() {
    try {
      unlockChatAudio();
      if (!chatNotifyCtx || chatNotifyCtx.state !== 'running') return;
      var ctx = chatNotifyCtx;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var t = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(1240, t + 0.07);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.1, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    } catch (e) { /* ignore */ }
  }
  document.addEventListener('pointerdown', unlockChatAudio);
  document.addEventListener('keydown', unlockChatAudio);
  document.addEventListener('touchstart', unlockChatAudio, { passive: true });

  function messageAlreadyRendered(messageId) {
    if (messageId == null || !chatBody) return false;
    return !!chatBody.querySelector('[data-mid="' + String(messageId) + '"]');
  }

  function appendChatMsg(text, dir, role, roleName, timeText, translated, messageId) {
    if (!chatBody) return;
    if (messageAlreadyRendered(messageId)) return;
    var msg = document.createElement('div');
    msg.className = 'msg msg--' + dir;
    if (messageId != null) {
      msg.setAttribute('data-mid', messageId);
    }
    if (dir === 'in' && role) {
      var avatar = document.createElement('span');
      var avatarCls = role === 'DESIGNER' ? 'msg__avatar--designer'
        : (role === 'CUSTOMER' ? 'msg__avatar--client'
        : (role === 'SUPER_SERVICE' ? 'msg__avatar--super-service'
        : (role === 'AI_ASSISTANT' ? 'msg__avatar--ai' : 'msg__avatar--tracker')));
      avatar.className = 'msg__avatar ' + avatarCls;
      avatar.textContent = (roleName || role || '?').charAt(0).toUpperCase();
      msg.appendChild(avatar);
    }
    var content = document.createElement('div');
    content.className = 'msg__content';
    if (dir === 'in' && role) {
      var meta = document.createElement('div');
      meta.className = 'msg__meta';
      var roleTag = document.createElement('span');
      roleTag.className = 'msg__role';
      roleTag.style.color = ROLE_COLORS[role] || '';
      roleTag.textContent = window.I18N.localizeActorName(role, roleName || '');
      var time = document.createElement('span');
      time.className = 'msg__time';
      time.textContent = formatTime(timeText);
      meta.appendChild(roleTag);
      meta.appendChild(time);
      content.appendChild(meta);
    }
    var bubble = document.createElement('p');
    bubble.className = 'msg__bubble';
    bubble.textContent = text;
    content.appendChild(bubble);
    if (translated && translated !== text) {
      var trans = document.createElement('div');
      trans.className = 'msg__translation';
      trans.textContent = translated;
      content.appendChild(trans);
    }
    if (dir === 'out') {
      var metaOut = document.createElement('div');
      metaOut.className = 'msg__meta msg__meta--out';
      var timeOut = document.createElement('span');
      timeOut.className = 'msg__time';
      timeOut.textContent = formatTime(timeText);
      var read = document.createElement('span');
      read.className = 'msg__read';
      read.textContent = '✓✓';
      metaOut.appendChild(timeOut);
      metaOut.appendChild(read);
      content.appendChild(metaOut);
    }
    // 他人文本消息：显示翻译按钮
    if (dir === 'in' && text && messageId != null) {
      attachTranslateButton(content, messageId, text);
    }
    msg.appendChild(content);
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function attachTranslateButton(content, messageId, text) {
    var btn = document.createElement('button');
    btn.className = 'msg__translate-btn';
    btn.type = 'button';
    var showing = !!content.querySelector('.msg__translation');
    btn.textContent = showing ? window.I18N.t('msg.showOriginal') : window.I18N.t('msg.translate');
    btn.addEventListener('click', function () {
      var existing = content.querySelector('.msg__translation');
      if (existing) {
        existing.remove();
        btn.textContent = window.I18N.t('msg.translate');
        return;
      }
      btn.textContent = '…';
      window.DUXURY_API.translateMessage(messageId, window.I18N.current)
        .then(function (dto) {
          var translated = dto && dto.translatedContent;
          if (!translated || translated.trim() === '' || translated.trim() === String(text).trim()) {
            btn.textContent = window.I18N.t('msg.translate');
            alert(window.I18N.t('msg.translate.failed'));
            return;
          }
          var trans = document.createElement('div');
          trans.className = 'msg__translation';
          trans.textContent = translated;
          var bubble = content.querySelector('.msg__bubble');
          if (bubble) bubble.insertAdjacentElement('afterend', trans);
          else content.appendChild(trans);
          btn.textContent = window.I18N.t('msg.showOriginal');
        })
        .catch(function () {
          btn.textContent = window.I18N.t('msg.translate');
          alert(window.I18N.t('msg.translate.failed'));
        });
    });
    content.appendChild(btn);
  }

  // 更新指定消息的翻译行（MESSAGE_TRANSLATED 事件）
  function applyTranslation(messageId, translatedContent) {
    if (!chatBody || !translatedContent) return;
    var msg = chatBody.querySelector('[data-mid="' + messageId + '"]');
    if (!msg) return;
    var content = msg.querySelector('.msg__content');
    if (!content) return;
    var existing = content.querySelector('.msg__translation');
    if (existing) {
      existing.textContent = translatedContent;
    } else {
      var bubble = content.querySelector('.msg__bubble');
      var trans = document.createElement('div');
      trans.className = 'msg__translation';
      trans.textContent = translatedContent;
      if (bubble) {
        bubble.insertAdjacentElement('afterend', trans);
      } else {
        content.appendChild(trans);
      }
    }
  }

  function sendChatMsg() {
    var text = chatInput.value.trim();
    if (!text || !workspace.currentId) return;
    chatInput.value = '';
    window.DUXURY_API.sendMessage(workspace.currentId, { content: text, msgType: 'text' })
      .then(function (m) { appendChatMsg(m.content, 'out', null, null, m.createdAt, m.translatedContent, m.id); })
      .catch(function (err) { appendChatMsg(err.message || 'send failed', 'in', 'SALES_MID', 'System', null); });
  }

  if (chatInput) {
    chatSend.addEventListener('click', sendChatMsg);
    chatInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') sendChatMsg();
    });
  }

  /* ============================================================
     Emoji picker (order workspace chat)
  ============================================================ */
  var EMOJI_LIST = ('😀 😁 😂 🤣 😊 😍 😘 😜 🤔 😅 😭 😡 🥰 😎 🤗 🤩 🥳 😴 😢 😤 ' +
    '👍 👎 🙏 👌 ✌️ 🤝 💪 🙌 👏 💍 💎 🌹 🌸 ⭐ ✨ 🔥 🎉 🎊 ❤️ 💖 💕 💯 ✅ ❓ ❗ 🎁').split(' ');
  var emojiBtn = document.getElementById('emojiBtn');
  var emojiPicker = document.getElementById('emojiPicker');

  function insertAtCursor(input, text) {
    var start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
    var end = typeof input.selectionEnd === 'number' ? input.selectionEnd : start;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    var pos = start + text.length;
    input.focus();
    try { input.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
  }

  function closeEmojiPicker() {
    if (emojiPicker) emojiPicker.hidden = true;
  }

  if (emojiBtn && emojiPicker && chatInput) {
    EMOJI_LIST.forEach(function (emo) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'emoji-picker__item';
      b.textContent = emo;
      b.addEventListener('click', function () {
        insertAtCursor(chatInput, emo);
        closeEmojiPicker();
      });
      emojiPicker.appendChild(b);
    });
    emojiBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      emojiPicker.hidden = !emojiPicker.hidden;
    });
    document.addEventListener('click', function (e) {
      if (!emojiPicker.hidden && !emojiPicker.contains(e.target) && e.target !== emojiBtn) {
        closeEmojiPicker();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeEmojiPicker();
    });
  }

  var workspaceChatWs = null;
  var workspaceChatWsRetry = 0;
  var chatPingTimer = null;
  var chatPongTimer = null;
  var chatReconnectTimer = null;
  var chatPollTimer = null;
  var chatAwaitingPong = false;
  var chatNotified = {};
  var chatPrimed = {};

  function clearChatHeartbeat() {
    if (chatPingTimer) clearInterval(chatPingTimer);
    if (chatPongTimer) clearTimeout(chatPongTimer);
    chatPingTimer = null;
    chatPongTimer = null;
    chatAwaitingPong = false;
  }

  function sendChatPing() {
    if (!workspaceChatWs || workspaceChatWs.readyState !== WebSocket.OPEN) return;
    try {
      workspaceChatWs.send(JSON.stringify({ type: 'ping' }));
    } catch (e) {
      try { workspaceChatWs.close(); } catch (err) { /* ignore */ }
      return;
    }
    chatAwaitingPong = true;
    if (chatPongTimer) clearTimeout(chatPongTimer);
    chatPongTimer = setTimeout(function () {
      if (!chatAwaitingPong) return;
      if (workspaceChatWs) {
        try { workspaceChatWs.close(); } catch (e) { /* ignore */ }
      }
    }, 10000);
  }

  function startChatHeartbeat() {
    clearChatHeartbeat();
    sendChatPing();
    chatPingTimer = setInterval(sendChatPing, 20000);
  }

  function syncWorkspaceMessages(notify) {
    if (!chatApiReady()) return;
    var cid = workspace.currentId;
    if (cid) {
      window.DUXURY_API.getMessages(cid).then(function (msgs) {
        if (workspace.currentId !== cid) return;
        var primed = !!chatPrimed[cid];
        var shouldSound = false;
        (msgs || []).forEach(function (m) {
          if (!m || m.id == null) return;
          var key = String(m.id);
          if (!chatNotified[key]) {
            chatNotified[key] = true;
            if (notify && primed && m.senderType !== 'C_PORTAL_CUSTOMER') shouldSound = true;
          }
        });
        chatPrimed[cid] = true;
        renderMessages(msgs);
        if (shouldSound) playChatNotify();
      }).catch(function () {});
    }
    loadConversations();
  }

  function stopChatPoll() {
    if (chatPollTimer) clearInterval(chatPollTimer);
    chatPollTimer = null;
  }

  function startChatPoll() {
    if (chatPollTimer || !chatApiReady()) return;
    if (!chatBody && !conversationList) return;
    syncWorkspaceMessages(true);
    chatPollTimer = setInterval(function () {
      if (workspaceChatWs && workspaceChatWs.readyState === WebSocket.OPEN) return;
      syncWorkspaceMessages(true);
    }, 10000);
  }

  function scheduleChatReconnect() {
    if (chatReconnectTimer || !localStorage.getItem('duxury-token')) return;
    workspaceChatWsRetry += 1;
    var delay = Math.min(15000, 1000 * Math.pow(2, Math.min(workspaceChatWsRetry - 1, 4)));
    chatReconnectTimer = setTimeout(function () {
      chatReconnectTimer = null;
      connectChatSocket();
    }, delay);
  }

  function connectChatSocket() {
    var token = localStorage.getItem('duxury-token');
    if (!token || !chatApiReady()) return;
    if (workspaceChatWs && (workspaceChatWs.readyState === WebSocket.OPEN || workspaceChatWs.readyState === WebSocket.CONNECTING)) {
      return;
    }
    var wsUrl;
    var base = window.DUXURY_API.base || '/api';
    if (/^https?:\/\//.test(base)) {
      wsUrl = base.replace(/^http/, 'ws') + '/ws/conversation?token=' + encodeURIComponent(token);
    } else {
      var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = proto + '//' + location.host + base + '/ws/conversation?token=' + encodeURIComponent(token);
    }
    try {
      var ws = new WebSocket(wsUrl);
      workspaceChatWs = ws;
      var connectTimer = setTimeout(function () {
        if (workspaceChatWs === ws && ws.readyState !== WebSocket.OPEN) {
          try { ws.close(); } catch (e) { /* ignore */ }
        }
      }, 8000);
      ws.onopen = function () {
        if (workspaceChatWs !== ws) return;
        clearTimeout(connectTimer);
        workspaceChatWsRetry = 0;
        stopChatPoll();
        startChatHeartbeat();
        syncWorkspaceMessages(true);
      };
      ws.onmessage = function (ev) {
        if (workspaceChatWs !== ws) return;
        var payload;
        try { payload = JSON.parse(ev.data); } catch (e) { return; }
        if (payload && payload.type === 'pong') {
          chatAwaitingPong = false;
          if (chatPongTimer) { clearTimeout(chatPongTimer); chatPongTimer = null; }
          return;
        }
        if (payload && payload.type === 'MESSAGE' && payload.data) {
          var m = payload.data;
          var key = m.id != null ? String(m.id) : '';
          var seen = !!(key && chatNotified[key]);
          if (key) chatNotified[key] = true;
          var mine = m.senderType === 'C_PORTAL_CUSTOMER';
          if (workspace.currentId === m.conversationId) {
            if (m.msgType === 'event' && m.event) {
              appendEventCard(m);
            } else {
              appendChatMsg(m.content, mine ? 'out' : 'in', m.role || 'CUSTOMER', m.displayName || m.role, m.createdAt, m.translatedContent, m.id);
            }
          }
          if (!mine && !seen) playChatNotify();
          loadConversations();
        }
        if (payload && payload.type === 'MESSAGE_TRANSLATED' && payload.data) {
          applyTranslation(payload.data.messageId, payload.data.translatedContent);
        }
      };
      ws.onclose = function () {
        clearTimeout(connectTimer);
        if (workspaceChatWs === ws) workspaceChatWs = null;
        if (workspaceChatWs && workspaceChatWs !== ws) return;
        clearChatHeartbeat();
        if (!localStorage.getItem('duxury-token')) return;
        startChatPoll();
        scheduleChatReconnect();
      };
    } catch (e) {
      startChatPoll();
      scheduleChatReconnect();
    }
  }

  function nudgeChatSocket() {
    if (!localStorage.getItem('duxury-token') || !chatApiReady()) return;
    if (workspaceChatWs && workspaceChatWs.readyState === WebSocket.OPEN) {
      sendChatPing();
      return;
    }
    workspaceChatWsRetry = 0;
    if (chatReconnectTimer) {
      clearTimeout(chatReconnectTimer);
      chatReconnectTimer = null;
    }
    connectChatSocket();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') nudgeChatSocket();
  });
  window.addEventListener('online', nudgeChatSocket);
  window.addEventListener('pageshow', nudgeChatSocket);

  function startWorkspace() {
    connectChatSocket();
    loadConversations();
  }

  if (localStorage.getItem('duxury-token') && chatApiReady()) {
    connectChatSocket();
  }
  if (chatBody && workspaceLoggedIn) {
    startWorkspace();
  }

  /* ============================================================
     Helpers
  ============================================================ */
  function getTimeStr() {
    var d = new Date();
    var h = String(d.getHours()).padStart(2, '0');
    var m = String(d.getMinutes()).padStart(2, '0');
    return h + ':' + m;
  }

  function formatTime(iso) {
    if (!iso) return getTimeStr();
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return getTimeStr();
      var h = String(d.getHours()).padStart(2, '0');
      var m = String(d.getMinutes()).padStart(2, '0');
      return h + ':' + m;
    } catch (e) {
      return getTimeStr();
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  // 从后端门户管理动态拉取 C 端首页数据（多语言文案区块 + 联系方式），失败时保留静态内容
  function loadDynamicHome() {
    if (!(window.DUXURY_API && window.DUXURY_API.getCHome)) return;
    window.DUXURY_API.getCHome().then(function (data) {
      if (!data) return;
      // 合并文案：blockKey -> {lang: text}，覆盖静态 i18n 文案
      var translations = {};
      (data.blocks || []).forEach(function (b) {
        if (b.blockKey && b.content && b.content.texts) {
          translations[b.blockKey] = b.content.texts;
        }
      });
      if (window.I18N && window.I18N.mergeTranslations) {
        window.I18N.mergeTranslations(translations);
      }
      applyContact(data);
    }).catch(function () {});
  }

  function applyContact(data) {
    var links = document.querySelectorAll('.footer__contact a');
    if (!links.length) return;
    var vals = [data.contactPhone, data.contactEmail, data.address].filter(Boolean);
    links.forEach(function (a, i) {
      if (vals[i]) a.textContent = vals[i];
    });
  }

  function applyWorks(data) {
    if (!data.categories || !data.categories.length) return;
    var grid = document.querySelector('.works__grid');
    if (!grid) return;
    grid.innerHTML = '';
    data.categories.slice(0, 4).forEach(function (c) {
      var card = document.createElement('article');
      card.className = 'work-card reveal visible';
      card.innerHTML =
        '<div class="work-card__img"><img src="' + escapeAttr(c.coverUrl || '') + '" alt="' + escapeAttr(c.nameEn || c.nameCn || '') + '" loading="lazy"></div>' +
        '<div class="work-card__info"><h3 class="work-card__name">' + escapeHtml(c.nameEn || c.nameCn || '') + '</h3>' +
        '<p class="work-card__desc">' + escapeHtml(c.description || '') + '</p></div>';
      grid.appendChild(card);
    });
  }

  if (!isWorkspace) {
    loadDynamicHome();
  }

  // Build language menu on load
  buildLangMenu();
})();
