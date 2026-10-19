/**
 * duxury — 个人推广页（promo.html）
 * 页面级 i18n 字典（8 语言），不占用全局 i18n.js，减少并行改动冲突。
 */
(function () {
  'use strict';

  var T = {
    'title': { en: 'Refer & Earn', fr: 'Parrainage', de: 'Empfehlen & Verdienen', es: 'Invita y gana', ja: '紹介で稼ぐ', ko: '추천하고 수익', 'zh-TW': '推廣賺佣', 'zh-CN': '推广赚佣' },
    'sub': {
      en: 'Share your code. Friends order, you earn 5% commission when their order completes.',
      fr: 'Partagez votre code. Vos amis commandent, vous gagnez 5 % à la commande terminée.',
      de: 'Teile deinen Code. Freunde bestellen, du erhältst 5 % Provision nach Abschluss.',
      es: 'Comparte tu código. Tus amigos piden y ganas 5 % al completarse el pedido.',
      ja: 'コードをシェア。友達が注文すると、完了時に5%のコミッション。',
      ko: '코드를 공유하세요. 친구가 주문하면 완료 시 5% 커미션.',
      'zh-TW': '分享你的推廣碼，好友下單並完成後，你即可獲得訂單金額 5% 佣金。',
      'zh-CN': '分享你的推广码，好友下单并完成后，你即可获得订单金额 5% 佣金。'
    },
    'gate': { en: 'Sign in to view your referral program', fr: 'Connectez-vous pour voir votre parrainage', de: 'Anmelden, um dein Empfehlungsprogramm zu sehen', es: 'Inicia sesión para ver tu programa de referidos', ja: 'ログインして紹介プログラムを表示', ko: '로그인하여 추천 프로그램 보기', 'zh-TW': '登入後查看你的推廣計畫', 'zh-CN': '登录后查看你的推广计划' },
    'gate.cta': { en: 'Sign in', fr: 'Se connecter', de: 'Anmelden', es: 'Iniciar sesión', ja: 'ログイン', ko: '로그인', 'zh-TW': '登入', 'zh-CN': '登录' },
    'code.label': { en: 'Your referral code', fr: 'Votre code', de: 'Dein Code', es: 'Tu código', ja: 'あなたの紹介コード', ko: '내 추천 코드', 'zh-TW': '你的專屬推廣碼', 'zh-CN': '你的专属推广码' },
    'code.rate': { en: '5% commission on every completed order', fr: '5 % sur chaque commande terminée', de: '5 % auf jede abgeschlossene Bestellung', es: '5 % en cada pedido completado', ja: '完了した注文ごとに5%', ko: '완료된 주문마다 5%', 'zh-TW': '每筆完成訂單 5% 佣金', 'zh-CN': '每笔完成订单 5% 佣金' },
    'copy.code': { en: 'Copy code', fr: 'Copier le code', de: 'Code kopieren', es: 'Copiar código', ja: 'コードをコピー', ko: '코드 복사', 'zh-TW': '複製推廣碼', 'zh-CN': '复制推广码' },
    'copy.link': { en: 'Copy link', fr: 'Copier le lien', de: 'Link kopieren', es: 'Copiar enlace', ja: 'リンクをコピー', ko: '링크 복사', 'zh-TW': '複製連結', 'zh-CN': '复制链接' },
    'copied': { en: 'Copied!', fr: 'Copié !', de: 'Kopiert!', es: '¡Copiado!', ja: 'コピーしました', ko: '복사됨', 'zh-TW': '已複製！', 'zh-CN': '已复制！' },
    'qr.tip': { en: 'Scan to open your referral link', fr: 'Scannez pour ouvrir votre lien', de: 'Scannen, um deinen Link zu öffnen', es: 'Escanea para abrir tu enlace', ja: 'スキャンして紹介リンクを開く', ko: '스캔하여 추천 링크 열기', 'zh-TW': '掃碼打開你的推廣連結', 'zh-CN': '扫码打开你的推广链接' },
    'poster.h': { en: 'Poster', fr: 'Affiche', de: 'Poster', es: 'Póster', ja: 'ポスター', ko: '포스터', 'zh-TW': '推廣海報', 'zh-CN': '推广海报' },
    'poster.save': { en: 'Save poster (PNG)', fr: 'Enregistrer (PNG)', de: 'Poster speichern (PNG)', es: 'Guardar póster (PNG)', ja: 'ポスターを保存 (PNG)', ko: '포스터 저장 (PNG)', 'zh-TW': '保存海報（PNG）', 'zh-CN': '保存海报（PNG）' },
    'wallet.available': { en: 'Withdrawable', fr: 'Retirable', de: 'Auszahlbar', es: 'Retirable', ja: '出金可能', ko: '출금 가능', 'zh-TW': '可提現餘額', 'zh-CN': '可提现余额' },
    'wallet.pending': { en: 'Pending settlement', fr: 'En attente', de: 'Ausstehend', es: 'Pendiente', ja: '精算待ち', ko: '정산 대기', 'zh-TW': '待結算', 'zh-CN': '待结算' },
    'wallet.earned': { en: 'Total earned', fr: 'Total gagné', de: 'Gesamt verdient', es: 'Total ganado', ja: '累計収益', ko: '누적 수익', 'zh-TW': '累計收益', 'zh-CN': '累计收益' },
    'wallet.withdrawn': { en: 'Withdrawn', fr: 'Retiré', de: 'Ausgezahlt', es: 'Retirado', ja: '出金済み', ko: '출금 완료', 'zh-TW': '已提現', 'zh-CN': '已提现' },
    'withdraw.ph': { en: 'Amount (USD)', fr: 'Montant (USD)', de: 'Betrag (USD)', es: 'Monto (USD)', ja: '金額（USD）', ko: '금액 (USD)', 'zh-TW': '提現金額（USD）', 'zh-CN': '提现金额（USD）' },
    'withdraw.cta': { en: 'Withdraw', fr: 'Retirer', de: 'Auszahlen', es: 'Retirar', ja: '出金する', ko: '출금하기', 'zh-TW': '申請提現', 'zh-CN': '申请提现' },
    'withdraw.all': { en: 'All', fr: 'Tout', de: 'Alles', es: 'Todo', ja: '全額', ko: '전액', 'zh-TW': '全部提現', 'zh-CN': '全部提现' },
    'withdraw.done': { en: 'Withdrawal received (mock instant payout)', fr: 'Retrait reçu (paiement simulé)', de: 'Auszahlung erhalten (simuliert)', es: 'Retiro recibido (pago simulado)', ja: '出金を受け付けました（模擬即時入金）', ko: '출금 접수됨 (모의 즉시 입금)', 'zh-TW': '提現已到賬（模擬即時到賬）', 'zh-CN': '提现已到账（模拟即时到账）' },
    'stats.buyers': { en: 'Referred buyers', fr: 'Acheteurs parrainés', de: 'Geworbene Käufer', es: 'Compradores referidos', ja: '紹介した購入者', ko: '추천한 구매자', 'zh-TW': '綁定人數', 'zh-CN': '绑定人数' },
    'stats.orders': { en: 'Bound orders', fr: 'Commandes liées', de: 'Gebundene Bestellungen', es: 'Pedidos vinculados', ja: '紐付け注文', ko: '연동 주문', 'zh-TW': '綁定訂單', 'zh-CN': '绑定订单' },
    'stats.settled': { en: 'Settled orders', fr: 'Commandes réglées', de: 'Abgerechnete Bestellungen', es: 'Pedidos liquidados', ja: '精算済み注文', ko: '정산 완료 주문', 'zh-TW': '成交訂單', 'zh-CN': '成交订单' },
    'txns.h': { en: 'Commission details', fr: 'Détails des commissions', de: 'Provisionsdetails', es: 'Detalles de comisión', ja: 'コミッション明細', ko: '커미션 내역', 'zh-TW': '佣金明細', 'zh-CN': '佣金明细' },
    'bindings.h': { en: 'Bound orders', fr: 'Commandes liées', de: 'Gebundene Bestellungen', es: 'Pedidos vinculados', ja: '紐付け注文一覧', ko: '연동 주문 목록', 'zh-TW': '綁定訂單列表', 'zh-CN': '绑定订单列表' },
    'withdrawals.h': { en: 'Withdrawal history', fr: 'Historique des retraits', de: 'Auszahlungsverlauf', es: 'Historial de retiros', ja: '出金履歴', ko: '출금 내역', 'zh-TW': '提現記錄', 'zh-CN': '提现记录' },
    'empty': { en: 'Nothing here yet', fr: 'Rien pour le moment', de: 'Noch nichts hier', es: 'Aún no hay nada', ja: 'まだありません', ko: '아직 없음', 'zh-TW': '暫無記錄', 'zh-CN': '暂无记录' },
    'txn.HOLD': { en: 'Pending', fr: 'En attente', de: 'Ausstehend', es: 'Pendiente', ja: '保留', ko: '보류', 'zh-TW': '待結算', 'zh-CN': '待结算' },
    'txn.SETTLE': { en: 'Settled', fr: 'Réglé', de: 'Abgerechnet', es: 'Liquidado', ja: '精算完了', ko: '정산', 'zh-TW': '已結算', 'zh-CN': '已结算' },
    'txn.WITHDRAW': { en: 'Withdraw', fr: 'Retrait', de: 'Auszahlung', es: 'Retiro', ja: '出金', ko: '출금', 'zh-TW': '提現', 'zh-CN': '提现' },
    'bind.PENDING': { en: 'Pending', fr: 'En attente', de: 'Ausstehend', es: 'Pendiente', ja: '精算待ち', ko: '정산 대기', 'zh-TW': '待結算', 'zh-CN': '待结算' },
    'bind.SETTLED': { en: 'Settled', fr: 'Réglé', de: 'Abgerechnet', es: 'Liquidado', ja: '精算済み', ko: '정산 완료', 'zh-TW': '已結算', 'zh-CN': '已结算' },
    'bind.CANCELLED': { en: 'Cancelled', fr: 'Annulé', de: 'Storniert', es: 'Cancelado', ja: 'キャンセル', ko: '취소됨', 'zh-TW': '已取消', 'zh-CN': '已取消' },
    'col.order': { en: 'Order', fr: 'Commande', de: 'Bestellung', es: 'Pedido', ja: '注文', ko: '주문', 'zh-TW': '訂單號', 'zh-CN': '订单号' },
    'col.base': { en: 'Order amount', fr: 'Montant', de: 'Betrag', es: 'Monto', ja: '注文金額', ko: '주문 금액', 'zh-TW': '計佣基數', 'zh-CN': '计佣基数' },
    'col.commission': { en: 'Commission', fr: 'Commission', de: 'Provision', es: 'Comisión', ja: 'コミッション', ko: '커미션', 'zh-TW': '佣金', 'zh-CN': '佣金' },
    'col.time': { en: 'Time', fr: 'Date', de: 'Zeit', es: 'Fecha', ja: '時間', ko: '시간', 'zh-TW': '時間', 'zh-CN': '时间' },
    'col.type': { en: 'Type', fr: 'Type', de: 'Typ', es: 'Tipo', ja: '種別', ko: '유형', 'zh-TW': '類型', 'zh-CN': '类型' },
    'col.status': { en: 'Status', fr: 'Statut', de: 'Status', es: 'Estado', ja: '状態', ko: '상태', 'zh-TW': '狀態', 'zh-CN': '状态' },
    'col.remark': { en: 'Remark', fr: 'Remarque', de: 'Notiz', es: 'Nota', ja: '備考', ko: '비고', 'zh-TW': '備註', 'zh-CN': '备注' },
    'poster.tagline': { en: 'BESPOKE JEWELRY', fr: 'JOAILLERIE SUR MESURE', de: 'MASSSCHMUCK', es: 'JOYERÍA A MEDIDA', ja: 'オーダーメイドジュエリー', ko: '맞춤 주얼리', 'zh-TW': '單件定制珠寶', 'zh-CN': '单件定制珠宝' },
    'poster.invite': { en: 'Scan & shop with my code', fr: 'Scannez & achetez avec mon code', de: 'Scannen & mit meinem Code shoppen', es: 'Escanea y compra con mi código', ja: 'スキャンしてコードで購入', ko: '스캔하고 내 코드로 구매', 'zh-TW': '掃碼使用我的推廣碼下單', 'zh-CN': '扫码使用我的推广码下单' },
    'poster.reward': { en: 'You get bespoke jewelry, I earn 5%', fr: 'Vous recevez votre bijou, je gagne 5 %', de: 'Du erhältst Schmuck, ich verdiene 5 %', es: 'Tú recibes joyería, yo gano 5 %', ja: 'あなたはジュエリーを、私は5%を', ko: '당신은 주얼리를, 저는 5%를', 'zh-TW': '你收穫定制珠寶，我獲得 5% 佣金', 'zh-CN': '你收获定制珠宝，我获得 5% 佣金' }
  };

  function lang() {
    return (window.I18N && window.I18N.current) || 'en';
  }
  function t(key) {
    var entry = T[key];
    if (!entry) return key;
    return entry[lang()] || entry.en;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function money(v) {
    if (v == null || v === '') return '$0.00';
    var n = Number(v);
    if (isNaN(n)) return String(v);
    return '$' + n.toFixed(2);
  }
  function fmtTime(iso) {
    if (!iso) return '—';
    return String(iso).replace('T', ' ').slice(0, 16);
  }

  function translateStatic() {
    document.querySelectorAll('[data-promo]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-promo'));
    });
  }

  function copyText(text, btn) {
    function done() {
      if (!btn) return;
      var old = btn.textContent;
      btn.textContent = t('copied');
      setTimeout(function () { btn.textContent = old; }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallback(); });
    } else {
      fallback();
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
      document.body.removeChild(ta);
      done();
    }
  }

  /* ---------- 海报（canvas 生成 PNG） ---------- */
  var posterData = null; // { code, shareUrl, qr }

  function drawPoster() {
    var canvas = document.getElementById('promoPosterCanvas');
    if (!canvas || !posterData) return;
    var W = 720, H = 1080;
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');

    // 背景：深色渐变 + 金色细框
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#16120c');
    g.addColorStop(0.55, '#2a2114');
    g.addColorStop(1, '#14110b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#c9a85c';
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 26, W - 52, H - 52);
    ctx.strokeStyle = 'rgba(201,168,92,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(38, 38, W - 76, H - 76);

    ctx.textAlign = 'center';

    // 品牌与标语
    ctx.fillStyle = '#c9a85c';
    ctx.font = '600 44px "Cormorant Garamond", "Noto Serif SC", serif';
    ctx.fillText('d u x u r y', W / 2, 130);
    ctx.fillStyle = 'rgba(243,233,210,0.75)';
    ctx.font = '300 22px "Cormorant Garamond", "Noto Serif SC", serif';
    ctx.fillText(t('poster.tagline'), W / 2, 172);
    ctx.fillStyle = 'rgba(201,168,92,0.85)';
    ctx.fillRect(W / 2 - 60, 198, 120, 2);

    // 二维码白卡
    var qrSize = 330;
    var qrX = (W - qrSize) / 2;
    var qrY = 250;
    ctx.fillStyle = '#ffffff';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(qrX - 18, qrY - 18, qrSize + 36, qrSize + 36, 18);
      ctx.fill();
    } else {
      ctx.fillRect(qrX - 18, qrY - 18, qrSize + 36, qrSize + 36);
    }

    function drawRest() {
      // 邀请文案
      ctx.fillStyle = '#f3e9d2';
      ctx.font = '500 30px "Cormorant Garamond", "Noto Serif SC", serif';
      ctx.fillText(t('poster.invite'), W / 2, qrY + qrSize + 92);

      // 推广码
      ctx.fillStyle = 'rgba(243,233,210,0.72)';
      ctx.font = '300 20px "Cormorant Garamond", "Noto Serif SC", serif';
      ctx.fillText(t('code.label'), W / 2, qrY + qrSize + 150);
      ctx.fillStyle = '#e9cf8f';
      ctx.font = '700 58px "Cormorant Garamond", "Noto Serif SC", serif';
      var spaced = String(posterData.code || '').split('').join(' ');
      ctx.fillText(spaced, W / 2, qrY + qrSize + 215);

      // 返佣说明 + 链接
      ctx.fillStyle = 'rgba(243,233,210,0.85)';
      ctx.font = '400 22px "Cormorant Garamond", "Noto Serif SC", serif';
      ctx.fillText(t('poster.reward'), W / 2, qrY + qrSize + 272);
      ctx.fillStyle = 'rgba(243,233,210,0.5)';
      ctx.font = '300 18px Inter, sans-serif';
      ctx.fillText(String(posterData.shareUrl || ''), W / 2, H - 72);
    }

    if (posterData.qr) {
      var img = new Image();
      img.onload = function () {
        ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
        drawRest();
      };
      img.onerror = drawRest;
      img.src = posterData.qr;
    } else {
      drawRest();
    }
  }

  function savePoster() {
    var canvas = document.getElementById('promoPosterCanvas');
    if (!canvas) return;
    canvas.toBlob(function (blob) {
      if (!blob) return;
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'duxury-referral-' + (posterData && posterData.code ? posterData.code : 'poster') + '.png';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 400);
    }, 'image/png');
  }

  /* ---------- 渲染 ---------- */
  var dashboard = null;

  function bindingBadge(status) {
    var cls = status === 'SETTLED' ? 'pm-badge--settled' : (status === 'CANCELLED' ? 'pm-badge--cancelled' : 'pm-badge--pending');
    return '<span class="pm-badge ' + cls + '">' + esc(t('bind.' + status) || status) + '</span>';
  }

  function render(data) {
    var body = document.getElementById('promoBody');
    if (!body) return;
    var bindings = data.bindings || [];
    var txns = data.txns || [];
    var withdrawals = data.withdrawals || [];

    var html = '';
    html += '<div class="section__head"><p class="section__eyebrow">REFERRAL</p><h1 class="section__title">' + esc(t('title')) + '</h1><p class="section__sub">' + esc(t('sub')) + '</p></div>';

    // 推广卡片 + 二维码
    html += '<div class="pm-share">';
    html += '<div class="pm-qr">' + (data.qrCodeBase64 ? '<img src="' + esc(data.qrCodeBase64) + '" alt="QR">' : '') + '<div class="pm-qr__tip">' + esc(t('qr.tip')) + '</div></div>';
    html += '<div class="pm-card">';
    html += '<div class="pm-card__brand">duxury</div>';
    html += '<div><div class="pm-card__label">' + esc(t('code.label')) + '</div>' +
      '<div class="pm-card__code">' + esc(data.code || '—') + '</div></div>';
    html += '<div class="pm-card__rate">' + esc(t('code.rate')) + '</div>';
    html += '<div class="pm-link">' + esc(data.shareUrl || '') + '</div>';
    html += '<div class="pm-card__row">' +
      '<button class="pm-btn pm-btn--gold" id="pmCopyCode">' + esc(t('copy.code')) + '</button>' +
      '<button class="pm-btn" id="pmCopyLink">' + esc(t('copy.link')) + '</button>' +
      '</div>';
    html += '</div></div>';

    // 海报
    html += '<h2 class="seller-h">' + esc(t('poster.h')) + '</h2>';
    html += '<div class="pm-poster"><div class="pm-poster__frame"><canvas id="promoPosterCanvas"></canvas></div>' +
      '<div style="margin-top:14px"><button class="btn btn--gold" id="pmSavePoster">' + esc(t('poster.save')) + '</button></div></div>';

    // 钱包三卡片 + 提现
    html += '<div class="seller-kpis">';
    html += '<div class="seller-kpi"><span>' + esc(t('wallet.available')) + '</span><strong>' + esc(money(data.availableBalance)) + '</strong></div>';
    html += '<div class="seller-kpi"><span>' + esc(t('wallet.pending')) + '</span><strong>' + esc(money(data.pendingBalance)) + '</strong></div>';
    html += '<div class="seller-kpi"><span>' + esc(t('wallet.earned')) + '</span><strong>' + esc(money(data.totalEarned)) + '</strong></div>';
    html += '</div>';
    html += '<div class="seller-withdraw">' +
      '<input class="checkout__input" id="pmWithdrawAmount" type="number" min="0" step="0.01" placeholder="' + esc(t('withdraw.ph')) + '">' +
      '<button class="sl-btn" id="pmWithdrawAll">' + esc(t('withdraw.all')) + '</button>' +
      '<button class="btn btn--gold" id="pmWithdrawBtn">' + esc(t('withdraw.cta')) + '</button></div>';
    html += '<p class="seller-muted" style="margin-top:8px">' + esc(t('wallet.withdrawn')) + ': ' + esc(money(data.totalWithdrawn)) + '</p>';

    // 统计
    html += '<div class="pm-stats">';
    html += '<div class="seller-kpi"><span>' + esc(t('stats.buyers')) + '</span><strong>' + esc(data.boundBuyerCount || 0) + '</strong></div>';
    html += '<div class="seller-kpi"><span>' + esc(t('stats.orders')) + '</span><strong>' + esc(data.boundOrderCount || 0) + '</strong></div>';
    html += '<div class="seller-kpi"><span>' + esc(t('stats.settled')) + '</span><strong>' + esc(data.settledOrderCount || 0) + '</strong></div>';
    html += '</div>';

    // 佣金明细
    html += '<h2 class="seller-h">' + esc(t('txns.h')) + '</h2>';
    if (!txns.length) {
      html += '<p class="shop-empty">' + esc(t('empty')) + '</p>';
    } else {
      html += '<div class="seller-table">';
      txns.forEach(function (x) {
        var positive = Number(x.amount) >= 0;
        html += '<div class="seller-row"><div><strong>' + esc(t('txn.' + x.type) || x.type) + '</strong>' +
          '<div class="seller-muted">' + esc(x.remark || '') + '</div></div>' +
          '<div class="seller-muted">' + esc(fmtTime(x.createdAt)) + '</div>' +
          '<div class="' + (positive ? 'pm-amount--in' : 'pm-amount--out') + '">' + (positive ? '+' : '') + esc(money(x.amount)) + '</div></div>';
      });
      html += '</div>';
    }

    // 绑定订单
    html += '<h2 class="seller-h">' + esc(t('bindings.h')) + '</h2>';
    if (!bindings.length) {
      html += '<p class="shop-empty">' + esc(t('empty')) + '</p>';
    } else {
      html += '<div class="seller-table">';
      bindings.forEach(function (b) {
        html += '<div class="seller-row"><div><strong>' + esc(b.orderNumber || ('#' + b.orderId)) + '</strong>' +
          '<div class="seller-muted">' + esc(b.orderStatusLabel || b.orderStatus || '') + ' · ' + esc(fmtTime(b.createdAt)) + '</div></div>' +
          '<div>' + esc(t('col.base')) + ' ' + esc(money(b.orderAmount)) + ' · ' + esc(t('col.commission')) + ' <span class="pm-amount--in">' + esc(money(b.commissionAmount)) + '</span></div>' +
          '<div>' + bindingBadge(b.status) + '</div></div>';
      });
      html += '</div>';
    }

    // 提现记录
    html += '<h2 class="seller-h">' + esc(t('withdrawals.h')) + '</h2>';
    if (!withdrawals.length) {
      html += '<p class="shop-empty">' + esc(t('empty')) + '</p>';
    } else {
      html += '<div class="seller-table">';
      withdrawals.forEach(function (w) {
        html += '<div class="seller-row"><div><strong>' + esc(money(w.amount)) + '</strong>' +
          '<div class="seller-muted">' + esc(w.remark || '') + '</div></div>' +
          '<div class="seller-muted">' + esc(fmtTime(w.createdAt)) + '</div>' +
          '<div><span class="pm-badge pm-badge--settled">' + esc(w.status || '') + '</span></div></div>';
      });
      html += '</div>';
    }

    body.innerHTML = html;

    // 事件：复制
    var copyCodeBtn = document.getElementById('pmCopyCode');
    if (copyCodeBtn) copyCodeBtn.addEventListener('click', function () { copyText(data.code || '', copyCodeBtn); });
    var copyLinkBtn = document.getElementById('pmCopyLink');
    if (copyLinkBtn) copyLinkBtn.addEventListener('click', function () { copyText(data.shareUrl || '', copyLinkBtn); });

    // 事件：海报
    posterData = { code: data.code, shareUrl: data.shareUrl, qr: data.qrCodeBase64 };
    drawPoster();
    var saveBtn = document.getElementById('pmSavePoster');
    if (saveBtn) saveBtn.addEventListener('click', savePoster);

    // 事件：提现
    var allBtn = document.getElementById('pmWithdrawAll');
    if (allBtn) allBtn.addEventListener('click', function () {
      var input = document.getElementById('pmWithdrawAmount');
      if (input && data.availableBalance != null) input.value = Number(data.availableBalance).toFixed(2);
    });
    var wBtn = document.getElementById('pmWithdrawBtn');
    if (wBtn) wBtn.addEventListener('click', function () {
      var amt = Number(document.getElementById('pmWithdrawAmount').value);
      if (!amt || amt <= 0) { alert(t('withdraw.ph')); return; }
      wBtn.disabled = true;
      window.DUXURY_API.withdrawReferral(amt).then(function () {
        alert(t('withdraw.done'));
        load();
      }).catch(function (e) {
        alert(e.message);
      }).finally(function () {
        wBtn.disabled = false;
      });
    });
  }

  function load() {
    window.DUXURY_API.getReferralDashboard().then(function (data) {
      dashboard = data;
      document.getElementById('promoGate').style.display = 'none';
      document.getElementById('promoRoot').style.display = '';
      render(data);
    }).catch(function (e) {
      if (e.status === 401) {
        document.getElementById('promoGate').style.display = '';
        document.getElementById('promoRoot').style.display = 'none';
        return;
      }
      document.getElementById('promoRoot').style.display = '';
      document.getElementById('promoBody').innerHTML = '<p class="shop-empty">' + esc(e.message) + '</p>';
    });
  }

  function init() {
    translateStatic();
    var loginBtn = document.getElementById('promoGateLogin');
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
      document.getElementById('promoGate').style.display = '';
      document.getElementById('promoRoot').style.display = 'none';
      return;
    }
    load();
  }

  document.addEventListener('duxury:login', function () {
    if (document.getElementById('promoBody')) init();
  });
  document.addEventListener('duxury:langchange', function () {
    translateStatic();
    if (dashboard) render(dashboard);
  });

  if (document.getElementById('promoBody')) init();
})();
