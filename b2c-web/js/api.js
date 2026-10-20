/**
 * duxury — backend API client
 * 默认走同源 /api（nginx 反代到后端 8851），可通过 window.DUXURY_API_BASE 覆盖。
 */
(function () {
  'use strict';

  var BASE = (window.DUXURY_API_BASE || '/api').replace(/\/+$/, '');

  function request(method, path, body) {
    var opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    var token = localStorage.getItem('duxury-token');
    if (token) {
      opts.headers['Authorization'] = 'Bearer ' + token;
    }
    if (body !== undefined && body !== null) {
      opts.body = JSON.stringify(body);
    }
    return fetch(BASE + path, opts).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        if (text) {
          try { data = JSON.parse(text); } catch (e) { data = { message: text }; }
        }
        if (!res.ok) {
          var err = new Error(data && data.message ? data.message : 'Request failed');
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function post(path, body) { return request('POST', path, body); }
  function get(path) { return request('GET', path); }
  function put(path, body) { return request('PUT', path, body); }
  function patch(path, body) { return request('PATCH', path, body); }

  window.DUXURY_API = {
    base: BASE,
    // 认证
    sendVerificationCode: function (email, purpose) {
      return post('/portal/c/account/send-verification-code', { email: email, purpose: purpose || 'LOGIN' });
    },
    loginByCode: function (email, code) {
      return post('/portal/c/account/login-by-code', { email: email, code: code });
    },
    // 语言偏好回写
    updateLang: function (lang) {
      return put('/portal/c/account/lang', { lang: lang });
    },
    // 更新客户预留基础资料（称呼、联系方式）
    updateProfile: function (displayName, contact) {
      return put('/portal/c/account/profile', { displayName: displayName, contact: contact });
    },
    // 门户首页
    getHome: function () {
      return get('/public/portal/home');
    },
    // C 端独立站首页（多语言区块 + 联系方式）
    getCHome: function () {
      return get('/public/portal/c/home');
    },
    // C端自助下单
    createOrder: function (body) {
      return post('/portal/c/orders/create', body);
    },
    // C端订单进度（须已绑定）
    getOrderSummary: function (orderId) {
      return get('/portal/c/orders/' + orderId + '/summary');
    },
    getOrderEvents: function (orderId) {
      return get('/portal/c/orders/' + orderId + '/events');
    },
    confirmOrder: function (orderId, eventType) {
      return post('/portal/c/orders/' + orderId + '/confirm', { eventType: eventType });
    },
    rejectOrder: function (orderId, eventType, reason) {
      return post('/portal/c/orders/' + orderId + '/reject', { eventType: eventType, reason: reason });
    },
    confirmPiece: function (orderId, pieceId, eventType) {
      return post('/portal/c/orders/' + orderId + '/pieces/' + pieceId + '/confirm', { eventType: eventType });
    },
    rejectPiece: function (orderId, pieceId, eventType, reason) {
      return post('/portal/c/orders/' + orderId + '/pieces/' + pieceId + '/reject', { eventType: eventType, reason: reason });
    },
    confirmDelivery: function (orderId) {
      return post('/portal/c/orders/' + orderId + '/confirm-delivery', {});
    },
    payBalance: function (orderId) {
      return post('/portal/c/orders/' + orderId + '/pay-balance', {});
    },
    // 查询订单物流（须已绑定）
    getShipment: function (orderId) {
      return get('/portal/c/orders/' + orderId + '/shipment');
    },
    // 站内聊天
    listConversations: function () {
      return get('/conversations');
    },
    ensureConversation: function (orderId) {
      return post('/conversations/by-order/' + orderId);
    },
    getMessages: function (conversationId) {
      return get('/conversations/' + conversationId + '/messages');
    },
    getMembers: function (conversationId) {
      return get('/conversations/' + conversationId + '/members');
    },
    sendMessage: function (conversationId, body) {
      return post('/conversations/' + conversationId + '/messages', body);
    },
    markRead: function (conversationId) {
      return post('/conversations/' + conversationId + '/read', {});
    },
    translateMessage: function (messageId, targetLang) {
      return post('/conversations/messages/' + messageId + '/translate', { targetLang: targetLang });
    },
    listStorefront: function () {
      return get('/public/storefront/listings');
    },
    getStorefrontListing: function (id) {
      return get('/public/storefront/listings/' + id);
    },
    getStorefrontFeeGuide: function () {
      return get('/public/storefront/fee-guide');
    },
    publishStorefront: function (body) {
      return post('/portal/c/storefront/publish', body);
    },
    pauseStorefrontListing: function (id) {
      return post('/portal/c/storefront/listings/' + id + '/pause', {});
    },
    republishStorefrontListing: function (id) {
      return post('/portal/c/storefront/listings/' + id + '/republish', {});
    },
    listSellerListings: function () {
      return get('/portal/c/storefront/seller/listings');
    },
    updateSellerListing: function (id, body) {
      return patch('/portal/c/storefront/seller/listings/' + id, body);
    },
    purchaseStorefront: function (id, body) {
      return post('/portal/c/storefront/listings/' + id + '/purchase', body || {});
    },
    getSellerDashboard: function () {
      return get('/portal/c/storefront/seller');
    },
    withdrawSeller: function (amount) {
      return post('/portal/c/storefront/seller/withdraw', { amount: amount });
    },
    // 个人推广码
    getReferralCode: function () {
      return get('/portal/c/referral/code');
    },
    getReferralDashboard: function () {
      return get('/portal/c/referral/dashboard');
    },
    withdrawReferral: function (amount) {
      return post('/portal/c/referral/withdraw', { amount: amount });
    }
  };
})();
