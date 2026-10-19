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
    if (workspace && workspace.currentId) {
      var cid = workspace.currentId;
      window.DUXURY_API.getMessages(cid).then(renderMessages).catch(function () {});
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

  var SERVICE_PRICE = { custom: '$49', designer: '$99' };

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
      '<h3 class="profile-prompt__title">完善您的资料</h3>' +
      '<p class="profile-prompt__sub">为了更好的服务，请补充以下信息</p>' +
      '<label class="profile-prompt__label">称呼</label>' +
      '<input type="text" id="profileDisplayName" class="checkout__input" placeholder="如何称呼您" value="' + escapeAttr(data.displayName || '') + '">' +
      '<label class="profile-prompt__label">联系方式</label>' +
      '<input type="text" id="profileContact" class="checkout__input" placeholder="手机号 / 微信 / 邮箱" value="' + escapeAttr(data.contact || email || '') + '">' +
      '<div class="profile-prompt__actions">' +
        '<button class="prog-btn prog-btn--ok" id="profileSave">保存并继续</button>' +
        '<button class="prog-btn prog-btn--no" id="profileSkip">暂时跳过</button>' +
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
      if (!dn) { alert('请填写称呼'); return; }
      if (!ct) { alert('请填写联系方式'); return; }
      window.DUXURY_API.updateProfile(dn, ct)
        .then(function () {
          var user = { method: 'email', email: data.email || email, displayName: dn };
          localStorage.setItem('duxury-user', JSON.stringify(user));
          close();
          afterLogin();
        })
        .catch(function (err) {
          alert(err.message || '保存失败');
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

  function showCheckout() {
    if (!checkoutModal) return;
    var nameKey = selectedService === 'custom' ? 'svc.custom.title' : 'svc.designer.title';
    checkoutService.textContent = window.I18N.t(nameKey);
    checkoutPrice.textContent = SERVICE_PRICE[selectedService] || '$49';
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
        var depositAmount = selectedService === 'designer' ? 99 : 49;
        var refInput = document.getElementById('referralCodeInput');
        var referralCode = refInput && refInput.value.trim() ? refInput.value.trim().toUpperCase() : undefined;
        window.DUXURY_API.createOrder({
          serviceType: serviceType,
          customerName: customerName,
          depositAmount: depositAmount,
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
    members: {},
    allConversations: [],
    filter: 'all',
    searchQuery: ''
  };

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
      var statusPill = c.orderStatusLabel
        ? '<span class="conversation__status" style="background:' + statusColor + '">' + escapeHtml(c.orderStatusLabel) + '</span>'
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
      if (orderStatusLabel) {
        chatStage.textContent = orderStatusLabel;
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
        : (role === 'SUPER_SERVICE' ? 'member-avatar--super-service' : 'member-avatar--tracker'));
      var span = document.createElement('span');
      span.className = 'member-avatar ' + cls;
      span.title = m.displayName || role;
      span.textContent = (m.displayName || role).charAt(0).toUpperCase();
      chatMembers.appendChild(span);
    });
  }

  function renderMessages(messages) {
    if (!chatBody) return;
    chatBody.innerHTML = '<div class="chat__day"><span>' + window.I18N.t('ws.day.today') + '</span></div>';
    (messages || []).forEach(function (m) {
      if (m.msgType === 'event' && m.event) {
        appendEventCard(m);
        return;
      }
      var mine = m.senderType === 'C_PORTAL_CUSTOMER';
      appendChatMsg(m.content || '', mine ? 'out' : 'in', m.role || 'CUSTOMER', m.displayName || m.role || '', m.createdAt, m.translatedContent, m.id);
    });
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function appendEventCard(m) {
    if (!chatBody) return;
    if (m && m.id != null && messageAlreadyRendered(m.id)) return;
    var ev = m.event || {};
    var style = EVENT_STYLE[ev.eventType] || EVENT_STYLE._default;
    var role = ev.actorRole || m.role || 'SYSTEM';
    var senderName = ev.actorName || m.displayName || role;

    // 普通聊天气泡发送形式：昵称 + 时间，气泡部分替换为卡片（无头像圆球）
    // 自己发送的（客户操作类事件）靠右，他人发送的靠左
    var mine = ev.actorType === 'C_PORTAL_CUSTOMER';
    var msg = document.createElement('div');
    msg.className = 'msg msg--no-avatar ' + (mine ? 'msg--out' : 'msg--in');
    if (m && m.id != null) msg.setAttribute('data-mid', m.id);

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
    var isBalance = ev.eventType === 'BALANCE_PAYMENT' || ev.eventType === 'BALANCE_PAID';

    // 卡片（替代气泡）
    var card = document.createElement('div');
    card.className = 'msg-card msg-card--' + (ev.eventType || 'default') + (isBalance ? ' msg-card--balance' : '');
    card.style.borderTop = '3px solid ' + style.color;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.title = '点击查看详情';

    if (ev.title) {
      var title = document.createElement('div');
      title.className = 'msg-card__title';
      title.style.color = style.color;
      title.textContent = ev.title;
      card.appendChild(title);
    }
    var images = ev.images || [];
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
      contentEl.textContent = ev.content;
      card.appendChild(contentEl);
    }
    if (ev.reason) {
      var reason = document.createElement('div');
      reason.className = 'msg-card__reason';
      reason.textContent = ev.reason;
      card.appendChild(reason);
    }

    // 已决策锁定徽标
    if (ev.resolution && ev.resolutionLabel) {
      var lock = document.createElement('div');
      lock.className = 'msg-card__lock msg-card__lock--' + ev.resolution.toLowerCase();
      lock.textContent = ev.resolutionLabel + (ev.resolution === 'CONFIRM' ? ' ✓' : (ev.resolution === 'REJECT' ? ' ✗' : ''));
      card.appendChild(lock);
    }

    // 操作按钮（阻止冒泡，避免触发详情）
    if (ev.actionable && ev.eventType) {
      var confirmAct, rejectAct, confirmLabel, rejectLabel;
      if (ev.eventType === 'DESIGN_SUBMIT') {
        confirmAct = 'DESIGN_CONFIRM'; rejectAct = 'DESIGN_REJECT';
        confirmLabel = '确认设计稿'; rejectLabel = '驳回设计稿';
      } else if (ev.eventType === 'MODEL_SUBMIT') {
        confirmAct = 'MODEL_CONFIRM'; rejectAct = 'MODEL_REJECT';
        confirmLabel = '确认建模稿'; rejectLabel = '驳回建模稿';
      } else if (ev.eventType === 'BALANCE_PAYMENT') {
        confirmAct = 'BALANCE_PAY'; rejectAct = null;
        confirmLabel = '立即支付 $399'; rejectLabel = null;
      }
      if (confirmAct) {
        var actions = document.createElement('div');
        actions.className = 'msg-card__actions';
        if (confirmAct === 'BALANCE_PAY') {
          var payBtn = document.createElement('button');
          payBtn.className = 'prog-btn prog-btn--pay msg-card__btn';
          payBtn.textContent = confirmLabel;
          payBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            openBalancePayModal();
          });
          actions.appendChild(payBtn);
        } else {
          var okBtn = document.createElement('button');
          okBtn.className = 'prog-btn prog-btn--ok msg-card__btn';
          okBtn.textContent = confirmLabel;
          okBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            var orderId = workspace.orderId;
            if (!orderId) return;
            window.DUXURY_API.confirmOrder(orderId, confirmAct)
              .then(reloadChatAndProgress)
              .catch(function (err) { alert(err.message); });
          });
          actions.appendChild(okBtn);
          if (rejectAct) {
            var noBtn = document.createElement('button');
            noBtn.className = 'prog-btn prog-btn--no msg-card__btn';
            noBtn.textContent = rejectLabel;
            noBtn.addEventListener('click', function (e) {
              e.stopPropagation();
              var reason = prompt(window.I18N.t('ws.progress.reject.ph'));
              if (!reason) return;
              var orderId = workspace.orderId;
              if (!orderId) return;
              window.DUXURY_API.rejectOrder(orderId, rejectAct, reason)
                .then(reloadChatAndProgress)
                .catch(function (err) { alert(err.message); });
            });
            actions.appendChild(noBtn);
          }
        }
        card.appendChild(actions);
      }
    }

    // 点击卡片查看详情
    card.addEventListener('click', function () { openEventDetail(m); });
    content.appendChild(card);
    msg.appendChild(content);
    chatBody.appendChild(msg);
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
    var overlay = document.createElement('div');
    overlay.className = 'event-detail';
    var dialog = document.createElement('div');
    dialog.className = 'event-detail__dialog balance-pay';
    dialog.innerHTML =
      '<button class="event-detail__close" aria-label="Close">&times;</button>' +
      '<h3 class="balance-pay__title">支付尾款</h3>' +
      '<div class="balance-pay__amount">$399</div>' +
      '<div class="balance-pay__hint">模拟支付流程，点击确认即视为支付成功</div>' +
      '<div class="balance-pay__actions">' +
        '<button class="prog-btn prog-btn--pay" id="balancePayConfirm">确认支付</button>' +
        '<button class="prog-btn prog-btn--no" id="balancePayCancel">取消</button>' +
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
            '<h3 class="balance-pay__title">支付成功</h3>' +
            '<div class="balance-pay__hint">尾款 $399 已支付</div>' +
            '<div class="balance-pay__actions"><button class="prog-btn prog-btn--ok" id="balancePayDone">完成</button></div>';
          dialog.querySelector('#balancePayDone').addEventListener('click', function () {
            close();
            reloadChatAndProgress();
          });
        })
        .catch(function (err) { alert(err.message); });
    });
  }

  function openEventDetail(m) {
    var ev = m.event || {};
    var style = EVENT_STYLE[ev.eventType] || EVENT_STYLE._default;
    var role = ev.actorRole || m.role || 'SYSTEM';
    var senderName = ev.actorName || m.displayName || role;

    var overlay = document.createElement('div');
    overlay.className = 'event-detail';
    var dialog = document.createElement('div');
    dialog.className = 'event-detail__dialog';
    var html = '<button class="event-detail__close" aria-label="Close">&times;</button>';
    html += '<div class="event-detail__badge" style="background:' + style.color + '">' + escapeHtml(style.label) + '</div>';
    html += '<h3 class="event-detail__title" style="color:' + style.color + '">' + escapeHtml(ev.title || style.label) + '</h3>';
    html += '<div class="event-detail__meta">' + escapeHtml(senderName) + ' · ' + escapeHtml(formatTime(m.createdAt)) + '</div>';
    var images = ev.images || [];
    if (images.length) {
      html += '<div class="event-detail__imgs">';
      images.forEach(function (u) {
        html += '<img class="event-detail__img" src="' + escapeAttr(u) + '" alt="">';
      });
      html += '</div>';
    }
    if (ev.content) html += '<div class="event-detail__content">' + escapeHtml(ev.content) + '</div>';
    if (ev.reason) html += '<div class="event-detail__reason">驳回原因：' + escapeHtml(ev.reason) + '</div>';
    // 物流事件：展示物流轨迹
    if (ev.eventType === 'SHIPPED' || ev.eventType === 'DELIVERED') {
      html += '<div class="event-detail__shipment" id="eventShipment">加载物流信息…</div>';
    }
    dialog.innerHTML = html;
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    function close() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    dialog.querySelector('.event-detail__close').addEventListener('click', close);

    // 拉取物流并渲染
    if ((ev.eventType === 'SHIPPED' || ev.eventType === 'DELIVERED') && workspace.orderId) {
      var shipBox = dialog.querySelector('#eventShipment');
      window.DUXURY_API.getShipment(workspace.orderId).then(function (s) {
        if (!shipBox || !s) {
          if (shipBox) shipBox.textContent = '暂无物流信息';
          return;
        }
        var sh = '';
        sh += '<div class="event-detail__shipment-row">快递单号：' + escapeHtml(s.trackingNumber || '-') + '</div>';
        if (s.carrierName || s.carrierCode) {
          sh += '<div class="event-detail__shipment-row">承运商：' + escapeHtml(s.carrierName || s.carrierCode) + '</div>';
        }
        sh += '<div class="event-detail__shipment-row">状态：' + escapeHtml(s.statusLabel || '已发货（待物流更新）') + '</div>';
        if (s.events && s.events.length) {
          sh += '<div class="event-detail__timeline">';
          s.events.forEach(function (e) {
            sh += '<div class="event-detail__tl-item"><div class="event-detail__tl-desc">' + escapeHtml(e.description || '-') + '</div>';
            sh += '<div class="event-detail__tl-meta">' + escapeHtml(e.time || '') + (e.location ? ' · ' + escapeHtml(e.location) : '') + '</div></div>';
          });
          sh += '</div>';
        }
        if (s.queryUrl) {
          sh += '<a class="prog-file" href="' + escapeAttr(s.queryUrl) + '" target="_blank">在 17TRACK 查看完整轨迹</a>';
        }
        shipBox.innerHTML = sh;
      }).catch(function () {
        if (shipBox) shipBox.textContent = '物流信息加载失败';
      });
    }
  }

  function reloadChatAndProgress() {
    if (workspace.currentId) {
      window.DUXURY_API.getMessages(workspace.currentId).then(renderMessages).catch(function () {});
    }
    if (workspace.orderId) {
      var body = document.getElementById('chatProgressBody');
      if (body) renderOrderProgress(workspace.orderId, body);
    }
    loadConversations();
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
  document.addEventListener('pointerdown', unlockChatAudio, { once: true });
  document.addEventListener('keydown', unlockChatAudio, { once: true });

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
        : (role === 'SUPER_SERVICE' ? 'msg__avatar--super-service' : 'msg__avatar--tracker'));
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
      roleTag.textContent = roleName || role || '';
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
      ws.onopen = function () { workspaceChatWsRetry = 0; };
      ws.onmessage = function (ev) {
        var payload;
        try { payload = JSON.parse(ev.data); } catch (e) { return; }
        if (payload && payload.type === 'MESSAGE' && payload.data) {
          var m = payload.data;
          var mine = m.senderType === 'C_PORTAL_CUSTOMER';
          if (workspace.currentId === m.conversationId) {
            if (m.msgType === 'event' && m.event) {
              appendEventCard(m);
            } else {
              appendChatMsg(m.content, mine ? 'out' : 'in', m.role || 'CUSTOMER', m.displayName || m.role, m.createdAt, m.translatedContent, m.id);
            }
          }
          if (!mine) playChatNotify();
          loadConversations();
        }
        if (payload && payload.type === 'MESSAGE_TRANSLATED' && payload.data) {
          applyTranslation(payload.data.messageId, payload.data.translatedContent);
        }
      };
      ws.onclose = function () {
        workspaceChatWs = null;
        if (!localStorage.getItem('duxury-token')) return;
        workspaceChatWsRetry += 1;
        var delay = Math.min(15000, 1000 * Math.pow(2, Math.min(workspaceChatWsRetry, 4)));
        setTimeout(connectChatSocket, delay);
      };
    } catch (e) { /* ignore */ }
  }

  function startWorkspace() {
    connectChatSocket();
    loadConversations();
    loadOrderProgress();
  }

  if (localStorage.getItem('duxury-token') && chatApiReady()) {
    connectChatSocket();
  }
  if (chatBody && workspaceLoggedIn) {
    startWorkspace();
  }

  /* ============================================================
     Order progress panel (C 端进度：事件卡片 + 确认/驳回 + 报价 + 交付)
  ============================================================ */
  function loadOrderProgress() {
    var order = null;
    try { order = JSON.parse(localStorage.getItem('duxury-order') || 'null'); } catch (e) { order = null; }
    var orderId = order && order.orderId;
    var progress = document.getElementById('chatProgress');
    var body = document.getElementById('chatProgressBody');
    if (!progress || !body || !orderId || !(window.DUXURY_API && window.DUXURY_API.getOrderSummary)) return;
    progress.style.display = '';
    renderOrderProgress(orderId, body);

    var toggle = document.getElementById('chatProgressToggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        body.style.display = body.style.display === 'none' ? '' : 'none';
        toggle.textContent = body.style.display === 'none' ? '▼' : '▲';
      });
    }
  }

  function renderOrderProgress(orderId, body) {
    function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function build(summary, events) {
      var html = '';
      var st = summary.currentStatusLabel || summary.currentStatus || '';
      html += '<div class="prog-status"><strong>' + esc(summary.displayTitle || summary.orderNumber) + '</strong> <span class="prog-tag">' + esc(st) + '</span></div>';
      if (summary.firstDesignImageUrl) {
        html += '<img class="prog-img" src="' + esc(summary.firstDesignImageUrl) + '" alt="design">';
      }
      if (summary.quotation && summary.quotation.finalized) {
        html += '<div class="prog-quote"><div>工费 ¥' + (summary.quotation.laborCost || 0) + '</div><div>附加工费 ¥' + (summary.quotation.additionalLaborCost || 0) + '</div><div><strong>合计 ¥' + (summary.quotation.totalAmount || 0) + '</strong></div></div>';
      }
      if (summary.modelFiles && summary.modelFiles.length) {
        html += '<div class="prog-files">';
        summary.modelFiles.forEach(function (f) {
          html += '<a href="' + esc(f.fileUrl) + '" target="_blank" class="prog-file">下载 ' + esc(f.fileName || '文件') + '</a>';
        });
        html += '</div>';
      }
      // 物流信息（发货后展示）
      if (summary.shipment) {
        html += '<div class="prog-shipment">';
        html += '<div class="prog-shipment-title">物流信息</div>';
        html += '<div class="prog-shipment-row">快递单号：' + esc(summary.shipment.trackingNumber) + '</div>';
        if (summary.shipment.carrierName || summary.shipment.carrierCode) {
          html += '<div class="prog-shipment-row">承运商：' + esc(summary.shipment.carrierName || summary.shipment.carrierCode) + '</div>';
        }
        html += '<div class="prog-shipment-row">状态：' + esc(summary.shipment.statusLabel || '已发货（待物流更新）') + '</div>';
        if (summary.shipment.queryUrl) {
          html += '<a href="' + esc(summary.shipment.queryUrl) + '" target="_blank" class="prog-file">查询物流轨迹</a>';
        }
        if (summary.shipment.events && summary.shipment.events.length) {
          html += '<div class="prog-shipment-events">';
          summary.shipment.events.forEach(function (e) {
            html += '<div class="prog-event"><div class="prog-event-title">' + esc(e.description || e.time || '-') + '</div>';
            if (e.time) html += '<div class="prog-event-content">' + esc(e.time) + (e.location ? ' · ' + esc(e.location) : '') + '</div>';
            html += '</div>';
          });
          html += '</div>';
        }
        html += '</div>';
      }
      if (events && events.length) {
        html += '<div class="prog-events">';
        events.slice().reverse().forEach(function (ev) {
          html += '<div class="prog-event"><div class="prog-event-title">' + esc(ev.title || ev.eventType) + '</div>';
          if (ev.content) html += '<div class="prog-event-content">' + esc(ev.content) + '</div>';
          if (ev.reason) html += '<div class="prog-event-reason">驳回原因：' + esc(ev.reason) + '</div>';
          html += '</div>';
        });
        html += '</div>';
      }
      // 操作按钮
      var actions = '';
      var lastDesign = events.filter(function (e) { return ['DESIGN_SUBMIT','DESIGN_REJECT','DESIGN_CONFIRM'].indexOf(e.eventType) >= 0; }).slice(-1)[0];
      var lastModel = events.filter(function (e) { return ['MODEL_SUBMIT','MODEL_REJECT','MODEL_CONFIRM'].indexOf(e.eventType) >= 0; }).slice(-1)[0];
      if (!summary.designApproved && lastDesign && lastDesign.eventType === 'DESIGN_SUBMIT') {
        actions += '<button class="prog-btn prog-btn--ok" data-act="DESIGN_CONFIRM">确认设计稿</button><button class="prog-btn prog-btn--no" data-act="DESIGN_REJECT">驳回设计稿</button>';
      }
      if (!summary.modelApproved && lastModel && lastModel.eventType === 'MODEL_SUBMIT') {
        actions += '<button class="prog-btn prog-btn--ok" data-act="MODEL_CONFIRM">确认建模稿</button><button class="prog-btn prog-btn--no" data-act="MODEL_REJECT">驳回建模稿</button>';
      }
      if (summary.canPublishToStorefront) {
        actions += '<button class="prog-btn prog-btn--ok" data-act="PUBLISH">' + (window.I18N.t('pub.title')) + '</button>';
      }
      if (summary.currentStatus === 'PRODUCING') {
        if (summary.serviceType === 'STOREFRONT') {
          actions += '<button class="prog-btn prog-btn--ok" data-act="DELIVERY">确认收货</button>';
        } else {
          actions += '<button class="prog-btn prog-btn--ok" data-act="DELIVERY">确认收货 / 付尾款</button>';
        }
      }
      if (actions) html += '<div class="prog-actions">' + actions + '</div>';
      body.innerHTML = html;

      body.querySelectorAll('[data-act]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var act = btn.getAttribute('data-act');
          if (act === 'PUBLISH') {
            openPublishModal(orderId, summary);
            return;
          }
          if (act === 'DELIVERY') {
            if (!confirm(window.I18N.t('ws.progress.delivery.confirm'))) return;
            window.DUXURY_API.confirmDelivery(orderId).then(function () { refreshOrderProgress(orderId, body); }).catch(function (e) { alert(e.message); });
          } else if (act.indexOf('REJECT') >= 0) {
            var reason = prompt(window.I18N.t('ws.progress.reject.ph'));
            if (!reason) return;
            window.DUXURY_API.rejectOrder(orderId, act, reason).then(function () { refreshOrderProgress(orderId, body); }).catch(function (e) { alert(e.message); });
          } else {
            window.DUXURY_API.confirmOrder(orderId, act).then(function () { refreshOrderProgress(orderId, body); }).catch(function (e) { alert(e.message); });
          }
        });
      });
    }

    window.DUXURY_API.getOrderSummary(orderId).then(function (summary) {
      window.DUXURY_API.getOrderEvents(orderId).then(function (events) {
        build(summary, events || []);
      }).catch(function () { build(summary, []); });
    }).catch(function (e) { body.innerHTML = '<div class="prog-empty">' + esc(e.message || '加载进度失败') + '</div>'; });
  }

  function refreshOrderProgress(orderId, body) {
    renderOrderProgress(orderId, body);
    loadConversations();
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
