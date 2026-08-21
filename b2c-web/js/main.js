(function () {
  'use strict';

  /* ============================================================
     Workspace gate: order chat requires paid deposit
  ============================================================ */
  var isWorkspace = !!document.querySelector('.app-shell');
  if (isWorkspace && !localStorage.getItem('duxury-paid')) {
    window.location.replace('index.html#services');
    return;
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
        showCheckout();
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

  // Checkout
  var checkoutService = document.getElementById('checkoutService');
  var checkoutPrice = document.getElementById('checkoutPrice');
  var payDeposit = document.getElementById('payDeposit');
  var checkoutSuccess = document.getElementById('checkoutSuccess');

  function showCheckout() {
    if (!checkoutModal) return;
    var nameKey = selectedService === 'custom' ? 'svc.custom.title' : 'svc.designer.title';
    checkoutService.textContent = window.I18N.t(nameKey);
    checkoutPrice.textContent = SERVICE_PRICE[selectedService] || '$49';
    checkoutSuccess.style.display = 'none';
    payDeposit.style.display = '';
    var reqBox = document.getElementById('checkoutRequirements');
    if (reqBox) reqBox.style.display = '';
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

  if (payDeposit) {
    payDeposit.addEventListener('click', function () {
      var serviceType = selectedService === 'custom' ? 'CUSTOM_IMAGE' : 'DESIGNER_DESIGN';
      var reqInput = document.getElementById('requirementInput');
      var matInput = document.getElementById('materialInput');
      var imgInput = document.getElementById('referenceImageInput');
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
        window.DUXURY_API.createOrder({
          serviceType: serviceType,
          basicRequirements: requirement,
          materialInfo: material || undefined,
          referenceImages: referenceImages || undefined
        }).then(finish).catch(function (err) {
          alert(err.message || 'order create failed');
        });
      }

      if (imgInput && imgInput.files && imgInput.files.length) {
        fileToDataUrl(imgInput.files[0]).then(function (dataUrl) {
          doCreate([dataUrl]);
        }).catch(function () {
          doCreate(null);
        });
      } else {
        doCreate(null);
      }
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
    members: {}
  };

  function chatApiReady() {
    return !!(window.DUXURY_API && window.DUXURY_API.listConversations && window.DUXURY_API.sendMessage);
  }

  function renderConversationList(items) {
    if (!conversationList) return;
    conversationList.innerHTML = '';
    (items || []).forEach(function (c) {
      var el = document.createElement('div');
      el.className = 'conversation';
      el.setAttribute('data-id', c.id);
      el.setAttribute('data-order', c.orderNumber || '');
      var letter = (c.title || c.orderNumber || '?').charAt(0).toUpperCase();
      var badge = c.unreadCount > 0
        ? '<span class="conversation__badge">' + c.unreadCount + '</span>'
        : '<span class="conversation__badge conversation__badge--muted">✓✓</span>';
      el.innerHTML =
        '<div class="conversation__avatar conversation__avatar--ring">' + letter + '</div>' +
        '<div class="conversation__main">' +
          '<div class="conversation__top"><span class="conversation__name">' + (c.title || c.orderNumber || '') + '</span><span class="conversation__time"></span></div>' +
          '<div class="conversation__bottom"><span class="conversation__preview">' + (c.lastMessage || '') + '</span>' + badge + '</div>' +
        '</div>';
      el.addEventListener('click', function () { openConversation(c.id, c.title, c.orderNumber); });
      conversationList.appendChild(el);
    });
    if (items && items.length && !workspace.currentId) {
      openConversation(items[0].id, items[0].title, items[0].orderNumber);
    }
  }

  function openConversation(id, title, orderNumber) {
    workspace.currentId = id;
    var chatTitle = document.getElementById('chatTitle');
    var chatOrderId = document.getElementById('chatOrderId');
    if (chatTitle) chatTitle.textContent = title || '';
    if (chatOrderId) chatOrderId.textContent = orderNumber ? '#' + orderNumber : '';
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
        : (role === 'CUSTOMER' ? 'member-avatar--client' : 'member-avatar--tracker');
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
      var mine = m.senderType === 'C_PORTAL_CUSTOMER';
      appendChatMsg(m.content || '', mine ? 'out' : 'in', m.role || 'CUSTOMER', m.displayName || m.role || '', m.createdAt, m.translatedContent, m.id);
    });
    chatBody.scrollTop = chatBody.scrollHeight;
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

  // Filters (visual only; conversations are order-bound, not status-bound)
  if (filterBar) {
    filterBar.querySelectorAll('.ws-filter').forEach(function (f) {
      f.addEventListener('click', function () {
        filterBar.querySelectorAll('.ws-filter').forEach(function (x) { x.classList.remove('active'); });
        f.classList.add('active');
      });
    });
  }

  // Search
  if (conversationSearch) {
    conversationSearch.addEventListener('input', function () {
      var q = conversationSearch.value.trim().toLowerCase();
      conversationList.querySelectorAll('.conversation').forEach(function (conv) {
        var name = conv.querySelector('.conversation__name').textContent.toLowerCase();
        var id = conv.getAttribute('data-order').toLowerCase();
        conv.style.display = (name.indexOf(q) !== -1 || id.indexOf(q) !== -1) ? '' : 'none';
      });
    });
  }

  function appendChatMsg(text, dir, role, roleName, timeText, translated, messageId) {
    if (!chatBody) return;
    var msg = document.createElement('div');
    msg.className = 'msg msg--' + dir;
    if (messageId != null) {
      msg.setAttribute('data-mid', messageId);
    }
    if (dir === 'in' && role) {
      var avatar = document.createElement('span');
      var avatarCls = role === 'DESIGNER' ? 'msg__avatar--designer'
        : (role === 'CUSTOMER' ? 'msg__avatar--client' : 'msg__avatar--tracker');
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
    msg.appendChild(content);
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
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
      .then(function (m) { appendChatMsg(m.content, 'out', null, null, m.createdAt); })
      .catch(function (err) { appendChatMsg(err.message || 'send failed', 'in', 'SALES_MID', 'System', null); });
  }

  if (chatInput) {
    chatSend.addEventListener('click', sendChatMsg);
    chatInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') sendChatMsg();
    });
  }

  function connectChatSocket() {
    var token = localStorage.getItem('duxury-token');
    if (!token || !chatApiReady()) return;
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
      ws.onmessage = function (ev) {
        var payload;
        try { payload = JSON.parse(ev.data); } catch (e) { return; }
        if (payload && payload.type === 'MESSAGE' && payload.data) {
          var m = payload.data;
          if (workspace.currentId === m.conversationId) {
            var mine = m.senderType === 'C_PORTAL_CUSTOMER';
            appendChatMsg(m.content, mine ? 'out' : 'in', m.role || 'CUSTOMER', m.displayName || m.role, m.createdAt, m.translatedContent, m.id);
          }
          loadConversations();
        }
        if (payload && payload.type === 'MESSAGE_TRANSLATED' && payload.data) {
          applyTranslation(payload.data.messageId, payload.data.translatedContent);
        }
      };
    } catch (e) { /* ignore */ }
  }

  if (chatBody) {
    connectChatSocket();
    loadConversations();
    loadOrderProgress();
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
      if (summary.currentStatus === 'PRODUCING') {
        actions += '<button class="prog-btn prog-btn--ok" data-act="DELIVERY">确认收货 / 付尾款</button>';
      }
      if (actions) html += '<div class="prog-actions">' + actions + '</div>';
      body.innerHTML = html;

      body.querySelectorAll('[data-act]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var act = btn.getAttribute('data-act');
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
