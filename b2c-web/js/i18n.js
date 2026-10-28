/**
 * duxury — i18n
 * Supported: English (default), Français, Deutsch, Español, 日本語, 한국어, 繁體中文, 简体中文
 */
(function () {
  'use strict';

  var SUPPORTED = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'fr', label: 'Français', short: 'FR' },
    { code: 'de', label: 'Deutsch', short: 'DE' },
    { code: 'es', label: 'Español', short: 'ES' },
    { code: 'ja', label: '日本語', short: '日' },
    { code: 'ko', label: '한국어', short: '한' },
    { code: 'zh-TW', label: '繁體中文', short: '繁' },
    { code: 'zh-CN', label: '简体中文', short: '简' }
  ];

  var T = {
    /* ---------- Nav ---------- */
    'nav.home': {
      en: 'Home', fr: 'Accueil', de: 'Start', es: 'Inicio',
      ja: 'ホーム', ko: '홈', 'zh-TW': '首頁', 'zh-CN': '首页'
    },
    'nav.partner': {
      en: 'Partners', fr: 'Partenaires', de: 'Partner', es: 'Socios',
      ja: 'パートナー', ko: '파트너', 'zh-TW': '合作模式', 'zh-CN': '合作模式'
    },
    'nav.portfolio': {
      en: 'Portfolio', fr: 'Collection', de: 'Kollektion', es: 'Colección',
      ja: 'コレクション', ko: '컬렉션', 'zh-TW': '作品集', 'zh-CN': '作品集'
    },
    'nav.process': {
      en: 'Process', fr: 'Processus', de: 'Prozess', es: 'Proceso',
      ja: 'プロセス', ko: '프로세스', 'zh-TW': '定制流程', 'zh-CN': '定制流程'
    },
    'nav.craft': {
      en: 'Craft', fr: 'Savoir-faire', de: 'Handwerk', es: 'Artesanía',
      ja: '職人技', ko: '장인정신', 'zh-TW': '匠心工藝', 'zh-CN': '匠心工艺'
    },
    'nav.orders': {
      en: 'Orders', fr: 'Commandes', de: 'Bestellungen', es: 'Pedidos',
      ja: 'ご注文', ko: '주문', 'zh-TW': '訂單中心', 'zh-CN': '订单中心'
    },
    'nav.cta': {
      en: 'Start Custom', fr: 'Commencer', de: 'Jetzt starten', es: 'Empezar',
      ja: '注文を始める', ko: '주문 시작', 'zh-TW': '開始定制', 'zh-CN': '开始定制'
    },
    'nav.services': { en: 'Services', fr: 'Services', de: 'Leistungen', es: 'Servicios', ja: 'サービス', ko: '서비스', 'zh-TW': '服務', 'zh-CN': '服务' },
    'nav.shop': { en: 'Shop', fr: 'Boutique', de: 'Shop', es: 'Tienda', ja: 'ショップ', ko: '스토어', 'zh-TW': '獨立站商城', 'zh-CN': '独立站商城' },
    'nav.studio': { en: 'My Assets', fr: 'Mes actifs', de: 'Meine Assets', es: 'Mis activos', ja: 'マイアセット', ko: '내 자산', 'zh-TW': '我的資產', 'zh-CN': '我的资产' },
    'auth.orders': {
      en: 'Order Center', fr: 'Centre de commandes', de: 'Bestellcenter', es: 'Centro de pedidos',
      ja: '注文センター', ko: '주문 센터', 'zh-TW': '訂單中心', 'zh-CN': '订单中心'
    },
    'auth.studio': {
      en: 'Seller Studio', fr: 'Espace vendeur', de: 'Verkäuferstudio', es: 'Estudio del vendedor',
      ja: '出品者スタジオ', ko: '판매자 스튜디오', 'zh-TW': '商家後台', 'zh-CN': '商家后台'
    },
    'auth.logout': {
      en: 'Sign Out', fr: 'Se déconnecter', de: 'Abmelden', es: 'Cerrar sesión',
      ja: 'ログアウト', ko: '로그아웃', 'zh-TW': '登出', 'zh-CN': '退出登录'
    },
    'auth.promo': {
      en: 'Refer & Earn', fr: 'Parrainage', de: 'Empfehlen & Verdienen', es: 'Invita y gana',
      ja: '紹介で稼ぐ', ko: '추천하고 수익', 'zh-TW': '推廣賺佣', 'zh-CN': '推广赚佣'
    },

    /* ---------- Hero ---------- */
    'hero.eyebrow': {
      en: 'BESPOKE JEWELRY', fr: 'JOAILLERIE SUR MESURE', de: 'MASSGEFERTIGTER SCHMUCK',
      es: 'JOYERÍA A MEDIDA', ja: 'オーダーメイドジュエリー', ko: '맞춤 주얼리',
      'zh-TW': '單件定制珠寶', 'zh-CN': '单件定制珠宝'
    },
    'hero.title1': {
      en: 'Every piece', fr: 'Chaque pièce', de: 'Jedes Stück', es: 'Cada pieza',
      ja: 'すべての作品は', ko: '모든 작품은', 'zh-TW': '每一件', 'zh-CN': '每一件'
    },
    'hero.title2': {
      en: 'born for you', fr: 'née pour vous', de: 'für dich geboren', es: 'nace para ti',
      ja: 'あなたのために', ko: '당신을 위해 태어납니다', 'zh-TW': '都為你而生', 'zh-CN': '都为你而生'
    },
    'hero.desc': {
      en: 'From inspiration to delivery, transparent online communication throughout. Pay a deposit to begin your bespoke journey.',
      fr: 'De l’inspiration à la livraison, une communication en ligne transparente. Versez un acompte pour commencer votre voyage sur mesure.',
      de: 'Von der Inspiration bis zur Lieferung — transparente Online-Kommunikation. Zahlen Sie eine Anzahlung und starten Sie Ihre Reise.',
      es: 'De la inspiración a la entrega, comunicación en línea transparente. Pague un depósito para comenzar su viaje a medida.',
      ja: '着想から納品まで、オンラインで透明なコミュニケーション。内金をお支払いいただくと、オーダーメイドの旅が始まります。',
      ko: '영감부터 배송까지, 투명한 온라인 소통. 예약금을 내고 맞춤 여정을 시작하세요.',
      'zh-TW': '從靈感到交付，全程在線透明溝通。支付定金，即刻開啟您的專屬定制之旅。',
      'zh-CN': '从灵感到交付，全程在线透明沟通。支付定金，即刻开启您的专属定制之旅。'
    },
    'hero.cta1': {
      en: 'Consult a Designer', fr: 'Consulter un designer', de: 'Designer kontaktieren',
      es: 'Consultar a un diseñador', ja: 'デザイナーに相談', ko: '디자이너 상담',
      'zh-TW': '立即諮詢設計師', 'zh-CN': '立即咨询设计师'
    },
    'hero.cta2': {
      en: 'View Portfolio', fr: 'Voir la collection', de: 'Kollektion ansehen',
      es: 'Ver colección', ja: 'コレクションを見る', ko: '컬렉션 보기',
      'zh-TW': '瀏覽作品集', 'zh-CN': '浏览作品集'
    },
    'hero.scroll': {
      en: 'Scroll', fr: 'Défiler', de: 'Scrollen', es: 'Desplazar',
      ja: 'スクロール', ko: '스크롤', 'zh-TW': '向下探索', 'zh-CN': '向下探索'
    },

    /* ---------- Works ---------- */
    'works.eyebrow': { en: 'PORTFOLIO', fr: 'PORTFOLIO', de: 'PORTFOLIO', es: 'PORTAFOLIO', ja: 'ポートフォリオ', ko: '포트폴리오', 'zh-TW': '作品集', 'zh-CN': '作品集' },
    'works.title': {
      en: 'Selected Works', fr: 'Œuvres choisies', de: 'Ausgewählte Werke', es: 'Obras seleccionadas',
      ja: 'セレクション', ko: '대표 작품', 'zh-TW': '精選作品', 'zh-CN': '精选作品'
    },
    'works.sub': {
      en: 'Every piece is a one-of-a-kind story', fr: 'Chaque pièce est une histoire unique',
      de: 'Jedes Stück ist eine einzigartige Geschichte', es: 'Cada pieza es una historia única',
      ja: '一点一点が唯一無二の物語', ko: '하나하나가 유일무이한 이야기',
      'zh-TW': '每一件都是獨一無二的故事', 'zh-CN': '每一件都是独一无二的故事'
    },
    'work1.name': { en: 'Galaxy', fr: 'Galaxie', de: 'Galaxie', es: 'Galaxia', ja: '星河', ko: '은하', 'zh-TW': '星河', 'zh-CN': '星河' },
    'work1.desc': {
      en: 'Sapphire · 18K White Gold · Diamond set', fr: 'Saphir · Or blanc 18K · Serti diamant',
      de: 'Saphir · 18K Weißgold · Diamantfassung', es: 'Zafiro · Oro blanco 18K · Engaste de diamantes',
      ja: 'サファイア · 18Kホワイトゴールド · ダイヤ', ko: '사파이어 · 18K 화이트골드 · 다이아몬드',
      'zh-TW': '藍寶石 · 18K白金 · 鑽石鑲嵌', 'zh-CN': '蓝宝石 · 18K白金 · 钻石镶嵌'
    },
    'work2.name': { en: 'Emerald Plume', fr: 'Plume d’émeraude', de: 'Smaragdfeder', es: 'Pluma esmeralda', ja: '翠羽', ko: '취우', 'zh-TW': '翠羽', 'zh-CN': '翠羽' },
    'work2.desc': {
      en: 'Emerald · 18K Gold · Custom', fr: 'Émeraude · Or 18K · Sur mesure',
      de: 'Smaragd · 18K Gold · Maßanfertigung', es: 'Esmeralda · Oro 18K · A medida',
      ja: 'エメラルド · 18Kゴールド · オーダー', ko: '에메랄드 · 18K 골드 · 맞춤',
      'zh-TW': '祖母綠 · 18K黃金 · 個性定制', 'zh-CN': '祖母绿 · 18K黄金 · 个性定制'
    },
    'work3.name': { en: 'Lustre', fr: 'Lustre', de: 'Glanz', es: 'Brillo', ja: '流光', ko: '유광', 'zh-TW': '流光', 'zh-CN': '流光' },
    'work3.desc': {
      en: 'Diamond · 18K White Gold · Precision cut', fr: 'Diamant · Or blanc 18K · Taille précise',
      de: 'Diamant · 18K Weißgold · Präzisionsschliff', es: 'Diamante · Oro blanco 18K · Corte preciso',
      ja: 'ダイヤモンド · 18Kホワイトゴールド', ko: '다이아몬드 · 18K 화이트골드 · 정밀 커팅',
      'zh-TW': '鑽石 · 18K白金 · 精密切割', 'zh-CN': '钻石 · 18K白金 · 精密切割'
    },
    'work4.name': { en: 'Morning Dew', fr: 'Rosée du matin', de: 'Morgentau', es: 'Rocío', ja: '晨露', ko: '새벽이슬', 'zh-TW': '晨露', 'zh-CN': '晨露' },
    'work4.desc': {
      en: 'Akoya Pearl · 18K Gold · Hand forged', fr: 'Perle Akoya · Or 18K · Forgé main',
      de: 'Akoya-Perle · 18K Gold · Handgeschmiedet', es: 'Perla Akoya · Oro 18K · Forjado a mano',
      ja: 'アコヤ真珠 · 18Kゴールド · 手打ち', ko: '아코야 진주 · 18K 골드 · 수공예',
      'zh-TW': 'Akoya珍珠 · 18K黃金 · 手工鍛造', 'zh-CN': 'Akoya珍珠 · 18K黄金 · 手工锻造'
    },

    /* ---------- Shop spotlight ---------- */
    'shopsp.eyebrow': {
      en: 'MAKER SHOP', fr: 'BOUTIQUE DES CRÉATEURS', de: 'MAKER-SHOP', es: 'TIENDA MAKER',
      ja: 'メイカーショップ', ko: '메이커 스토어', 'zh-TW': '獨立站商城', 'zh-CN': '独立站商城'
    },
    'shopsp.title': {
      en: 'Enter the independent marketplace', fr: 'Entrez dans la boutique indépendante',
      de: 'Entdecke den unabhängigen Shop', es: 'Entra en la tienda independiente',
      ja: '独立商城へ', ko: '독립 스토어로 이동', 'zh-TW': '進入獨立站商城', 'zh-CN': '进入独立站商城'
    },
    'shopsp.desc': {
      en: 'Browse pieces published by our clients. We produce and ship every order.',
      fr: 'Parcourez les pièces publiées par nos clients. Nous produisons et expédions chaque commande.',
      de: 'Stöbere in Stücken, die unsere Kunden veröffentlicht haben. Wir produzieren und versenden jede Bestellung.',
      es: 'Explora piezas publicadas por nuestros clientes. Producimos y enviamos cada pedido.',
      ja: 'クライアントが公開した作品をご覧ください。すべて当店が制作・発送します。',
      ko: '고객이 직접 올린 작품을 만나보세요. 모든 주문은 저희가 제작·배송합니다.',
      'zh-TW': '瀏覽客戶發布的作品，每一件都由我們製作並代為寄出。',
      'zh-CN': '浏览客户发布的作品，每一件都由我们制作并代为寄出。'
    },
    'shopsp.cta': {
      en: 'Shop now', fr: 'Acheter', de: 'Jetzt shoppen', es: 'Comprar',
      ja: 'ショップへ', ko: '스토어 이동', 'zh-TW': '進入商城', 'zh-CN': '进入商城'
    },
    'shopsp.aria': {
      en: 'Open the duxury marketplace', fr: 'Ouvrir la boutique duxury', de: 'duxury Shop öffnen',
      es: 'Abrir la tienda duxury', ja: 'duxury ショップを開く', ko: 'duxury 스토어 열기',
      'zh-TW': '打開 duxury 獨立站商城', 'zh-CN': '打开 duxury 独立站商城'
    },
    'shopsp.hint': {
      en: 'Tiles keep flipping through more pieces — click one to open details, then return to the shop.',
      fr: 'Les tuiles tournent pour d’autres pièces — cliquez pour les détails, puis revenez à la boutique.',
      de: 'Kacheln drehen sich weiter — tippen für Details, zurück zum Shop.',
      es: 'Las fichas rotan más piezas: haz clic para ver detalles y vuelve a la tienda.',
      ja: 'タイルがめくれて別作品を表示。クリックで詳細、ショップに戻れます。',
      ko: '타일이 뒤집히며 더 많은 작품을 보여줍니다. 클릭 후 스토어로 돌아올 수 있습니다.',
      'zh-TW': '三排牆面保留滾動，單格會翻轉展示更多作品；點擊進入詳情，返回即可回到商城。',
      'zh-CN': '三排墙面保留滚动，单格会翻转展示更多作品；点击进入详情，返回即可回到商城。'
    },
    'shopsp.preview': {
      en: 'Featured piece', fr: 'Pièce en vedette', de: 'Highlight', es: 'Pieza destacada',
      ja: '注目作品', ko: '추천 작품', 'zh-TW': '精選作品', 'zh-CN': '精选作品'
    },

    /* ---------- Partner ---------- */
    'partner.eyebrow': {
      en: 'PARTNER WITH US', fr: 'DEVENEZ PARTENAIRE', de: 'WERDEN SIE PARTNER', es: 'ASOCIADO',
      ja: 'パートナー募集', ko: '파트너십', 'zh-TW': '合作模式', 'zh-CN': '合作模式'
    },
    'partner.title': {
      en: 'We craft it. You can also monetize it.',
      fr: 'Nous créons. Vous pouvez aussi en tirer profit.',
      de: 'Wir fertigen. Sie können es auch verkaufen.',
      es: 'Lo creamos. También puedes monetizarlo.',
      ja: '制作は私たち。収益化はあなたにも。',
      ko: '제작은 저희가, 수익화는 당신도.',
      'zh-TW': '我們為你定制，也能讓你的設計變現。',
      'zh-CN': '我们为你定制，也能让你的设计变现。'
    },
    'partner.sub': {
      en: 'duxury is more than a bespoke atelier. Once your design and sample are confirmed, publish it on our independent shop at your own price — we produce and ship, you earn the margin.',
      fr: 'duxury est plus qu’un atelier sur mesure. Une fois votre design et l’échantillon validés, publiez-le sur notre boutique à votre prix — nous produisons et expédions, vous gardez la marge.',
      de: 'duxury ist mehr als ein Atelier. Sobald Design und Muster bestätigt sind, veröffentlichst du das Stück zu deinem Preis — wir produzieren und versenden, du verdienst den Aufschlag.',
      es: 'duxury es más que un taller a medida. Cuando el diseño y la muestra están confirmados, publícalo en nuestra tienda con tu precio — nosotros producimos y enviamos, tú ganas el margen.',
      ja: 'duxury はオーダーメイドだけではありません。デザインとサンプル確定後、あなたの価格で独立商城に出品できます。制作と発送は当店、利益はあなたに。',
      ko: 'duxury는 맞춤 공방 그 이상입니다. 디자인과 샘플이 확정되면 직접 정한 가격으로 독립 스토어에 올리세요. 제작·배송은 저희가, 마진은 당신에게.',
      'zh-TW': 'duxury 不只是定制工坊。設計與打樣確認後，一鍵發布到獨立站商城，售價由你決定；我們負責生產與代發貨，差價歸你。',
      'zh-CN': 'duxury 不只是定制工坊。设计与打样确认后，一键发布到独立站商城，售价由你决定；我们负责生产与代发货，差价归你。'
    },
    'partner.cta': {
      en: 'Open seller studio', fr: 'Ouvrir le studio vendeur', de: 'Seller-Studio öffnen',
      es: 'Abrir estudio de vendedor', ja: '販売スタジオへ', ko: '셀러 스튜디오 열기',
      'zh-TW': '進入商家後台', 'zh-CN': '进入商家后台'
    },
    'partner.s1.title': { en: 'Create', fr: 'Créer', de: 'Entwerfen', es: 'Crear', ja: '創る', ko: '제작', 'zh-TW': '創作', 'zh-CN': '创作' },
    'partner.s1.desc': {
      en: 'Start a custom order or bring your own drawing. Confirm design and sample with our team.',
      fr: 'Lancez une commande sur mesure ou apportez votre dessin. Validez design et échantillon avec notre équipe.',
      de: 'Starte eine Custom-Order oder bring deine Zeichnung mit. Bestätige Design und Muster mit unserem Team.',
      es: 'Inicia un pedido a medida o trae tu dibujo. Confirma diseño y muestra con nuestro equipo.',
      ja: 'オーダーメイドを申し込むか、図面をご持参ください。デザインとサンプルを当店と確定します。',
      ko: '맞춤 주문을 하거나 도면을 가져오세요. 디자인과 샘플을 저희와 함께 확정합니다.',
      'zh-TW': '發起定制或上傳你的手稿，與我們確認設計與打樣。', 'zh-CN': '发起定制或上传你的手稿，与我们确认设计与打样。'
    },
    'partner.s2.title': { en: 'Publish', fr: 'Publier', de: 'Veröffentlichen', es: 'Publicar', ja: '公開', ko: '게시', 'zh-TW': '發布', 'zh-CN': '发布' },
    'partner.s2.desc': {
      en: 'One click lists your piece on the duxury shop at the price you set, with production and shipping ranges shown up front.',
      fr: 'En un clic, votre pièce est listée sur la boutique duxury au prix de votre choix, avec les fourchettes de production et d’envoi affichées.',
      de: 'Ein Klick listet dein Stück im duxury Shop zu deinem Preis, Produktions- und Versandspannen vorab sichtbar.',
      es: 'Con un clic, tu pieza aparece en la tienda duxury al precio que elijas, con rangos de producción y envío visibles.',
      ja: 'ワンクリックであなたの価格で duxury ショップに出品。制作費と送料の目安も事前に表示されます。',
      ko: '한 번의 클릭으로 원하는 가격에 duxury 스토어에 올리세요. 제작·배송 구간이 미리 표시됩니다.',
      'zh-TW': '一鍵發布到 duxury 獨立站商城，售價自定；生產與代寄費用區間會明確展示。',
      'zh-CN': '一键发布到 duxury 独立站商城，售价自定；生产与代寄费用区间会明确展示。'
    },
    'partner.s3.title': { en: 'Earn', fr: 'Gagner', de: 'Verdienen', es: 'Ganar', ja: '稼ぐ', ko: '수익', 'zh-TW': '收益', 'zh-CN': '收益' },
    'partner.s3.desc': {
      en: 'Buyers order from the marketplace; we produce and ship. Track sales and withdrawable balance in your seller studio.',
      fr: 'Les acheteurs commandent sur la boutique ; nous produisons et expédions. Suivez ventes et solde retirable dans votre studio.',
      de: 'Käufer bestellen im Shop; wir produzieren und versenden. Verkäufe und auszahlbares Guthaben siehst du im Seller-Studio.',
      es: 'Los compradores piden en la tienda; nosotros producimos y enviamos. Sigue ventas y saldo retirable en tu estudio.',
      ja: '購入者がショップで注文、制作と発送は当店。売上と出金可能残高は販売スタジオで確認できます。',
      ko: '구매자는 스토어에서 주문하고, 제작·배송은 저희가 합니다. 판매와 출금 가능 잔액은 셀러 스튜디오에서 확인하세요.',
      'zh-TW': '買家在商城下單，我們負責生產與代寄；商家後台可查看銷量與可提現餘額。',
      'zh-CN': '买家在商城下单，我们负责生产与代寄；商家后台可查看销量与可提现余额。'
    },

    /* ---------- Process ---------- */
    'process.eyebrow': { en: 'PROCESS', fr: 'PROCESSUS', de: 'PROZESS', es: 'PROCESO', ja: 'プロセス', ko: '프로세스', 'zh-TW': '定制流程', 'zh-CN': '定制流程' },
    'process.title': {
      en: 'The Journey', fr: 'Le parcours', de: 'Die Reise', es: 'El viaje',
      ja: '制作の旅', ko: '제작 여정', 'zh-TW': '定制之旅', 'zh-CN': '定制之旅'
    },
    'process.sub': {
      en: 'From idea to finished piece, every step is clear', fr: 'De l’idée à la pièce finie, chaque étape est claire',
      de: 'Von der Idee bis zum fertigen Stück, jeder Schritt ist klar', es: 'De la idea a la pieza terminada, cada paso es claro',
      ja: 'アイデアから完成まで、すべての工程が明確', ko: '아이디어부터 완성까지, 모든 단계가 투명합니다',
      'zh-TW': '從靈感到成品，每一步都清晰可見', 'zh-CN': '从灵感到成品，每一步都清晰可见'
    },
    'step1.title': { en: 'Consultation', fr: 'Consultation', de: 'Beratung', es: 'Consulta', ja: '相談', ko: '상담', 'zh-TW': '諮詢溝通', 'zh-CN': '咨询沟通' },
    'step1.desc': {
      en: 'One-on-one with a designer to discuss needs, style and budget.',
      fr: 'Échangez en tête-à-tête avec un designer sur vos besoins, votre style et votre budget.',
      de: 'Im Einzelgespräch mit einem Designer über Wünsche, Stil und Budget.',
      es: 'Cara a cara con un diseñador sobre necesidades, estilo y presupuesto.',
      ja: 'デザイナーと一対一で、ご要望・スタイル・ご予算を相談します。',
      ko: '디자이너와 1:1로 니즈, 스타일, 예산을 상담합니다.',
      'zh-TW': '與設計師一對一交流需求、風格偏好與預算。',
      'zh-CN': '与设计师一对一交流需求、风格偏好与预算。'
    },
    'step2.title': { en: 'Proposal', fr: 'Proposition', de: 'Entwurf', es: 'Propuesta', ja: '提案', ko: '제안', 'zh-TW': '方案確認', 'zh-CN': '方案确认' },
    'step2.desc': {
      en: 'Sketches, 3D previews, material details and transparent pricing.',
      fr: 'Croquis, aperçus 3D, détails des matériaux et tarifs transparents.',
      de: 'Skizzen, 3D-Vorschauen, Materialdetails und transparente Preise.',
      es: 'Bocetos, vistas 3D, detalles de materiales y precios transparentes.',
      ja: 'デザイン画・3Dプレビュー・素材詳細・透明な見積もり。',
      ko: '스케치, 3D 미리보기, 재료 상세와 투명한 견적.',
      'zh-TW': '設計手稿、3D建模預覽、材料明細與透明報價。',
      'zh-CN': '设计手稿、3D建模预览、材料明细与透明报价。'
    },
    'step3.title': { en: 'Deposit', fr: 'Acompte', de: 'Anzahlung', es: 'Depósito', ja: '内金', ko: '예약금', 'zh-TW': '支付定金', 'zh-CN': '支付定金' },
    'step3.desc': {
      en: 'Pay a deposit to lock in service — your dedicated order chat opens instantly.',
      fr: 'Versez un acompte pour réserver — votre chat de commande dédié s’ouvre immédiatement.',
      de: 'Zahlen Sie eine Anzahlung — Ihr eigener Bestell-Chat öffnet sich sofort.',
      es: 'Pague un depósito para reservar: su chat de pedido dedicado se abre al instante.',
      ja: '内金でサービス確定 — 専用の注文チャットが即座に開設されます。',
      ko: '예약금을 내면 서비스가 확정되고 전용 주문 채팅이 즉시 열립니다.',
      'zh-TW': '支付定金鎖定服務，專屬訂單群聊即時開啟。',
      'zh-CN': '支付定金锁定服务，专属订单群聊即时开启。'
    },
    'step3.badge': { en: 'Key step', fr: 'Étape clé', de: 'Schlüsselschritt', es: 'Paso clave', ja: '重要ステップ', ko: '핵심 단계', 'zh-TW': '關鍵節點', 'zh-CN': '关键节点' },
    'step4.title': { en: 'Delivery', fr: 'Livraison', de: 'Lieferung', es: 'Entrega', ja: '納品', ko: '배송', 'zh-TW': '交付驗收', 'zh-CN': '交付验收' },
    'step4.desc': {
      en: 'Delivery and final settlement. Lifetime care keeps your jewelry timeless.',
      fr: 'Livraison et règlement final. Un entretien à vie pour un bijou intemporel.',
      de: 'Lieferung und Restzahlung. Lebenslange Pflege für zeitlosen Schmuck.',
      es: 'Entrega y liquidación final. Cuidado de por vida para su joya.',
      ja: '納品・残金決済。生涯アフターケアでジュエリーを永く。',
      ko: '배송과 잔금 결제. 평생 케어로 주얼리를 오래도록.',
      'zh-TW': '成品交付、尾款結清。終身保養，讓珠寶歷久彌新。',
      'zh-CN': '成品交付，尾款结清。终身保养，让珠宝历久弥新。'
    },

    /* ---------- Craft ---------- */
    'craft.eyebrow': { en: 'CRAFTSMANSHIP', fr: 'SAVOIR-FAIRE', de: 'HANDWERKSKUNST', es: 'ARTESANÍA', ja: '職人技', ko: '장인정신', 'zh-TW': '匠心工藝', 'zh-CN': '匠心工艺' },
    'craft.title': {
      en: 'Heritage of Craft', fr: 'Héritage artisanal', de: 'Handwerkstradition',
      es: 'Herencia artesanal', ja: '匠の伝統', ko: '장인의 유산',
      'zh-TW': '匠心傳承', 'zh-CN': '匠心传承'
    },
    'craft.text': {
      en: 'Every piece is forged by hand by master artisans — from stone selection to setting, through dozens of steps. True luxury lies not in a label, but in the perfection of every detail.',
      fr: 'Chaque pièce est forgée à la main par des maîtres artisans — de la sélection des pierres au serti, en des dizaines d’étapes. Le vrai luxe n’est pas une étiquette, mais la perfection de chaque détail.',
      de: 'Jedes Stück wird von Meisterhand geschmiedet — von der Steinauswahl bis zur Fassung, in Dutzenden Schritten. Wahrer Luxus liegt nicht im Etikett, sondern in der Perfektion jedes Details.',
      es: 'Cada pieza es forjada a mano por maestros artesanos — de la selección de piedras al engaste, en decenas de pasos. El verdadero lujo no está en una etiqueta, sino en la perfección de cada detalle.',
      ja: '一点一点が熟練の職人の手で鍛えられます — 石選びから留めまで、数十の工程を経て。真の贅沢はラベルではなく、細部の完成度に宿ります。',
      ko: '모든 작품은 장인의 손으로 제작됩니다 — 원석 선정부터 세팅까지 수십 단계를 거칩니다. 진정한 럭셔리는 라벨이 아닌 디테일의 완성도에 있습니다.',
      'zh-TW': '每一件珠寶都由資深工匠手工鍛造，從選石到鑲嵌，歷經數十道工序。真正的奢華不在於品牌標籤，而在於每一處細節的極致打磨。',
      'zh-CN': '每一件珠宝都由资深工匠手工锻造，从选石到镶嵌，历经数十道工序。真正的奢华不在于品牌标签，而在于每一处细节的极致打磨。'
    },

    /* ---------- CTA ---------- */
    'cta.title': {
      en: 'Begin Your Bespoke Journey', fr: 'Commencez votre voyage sur mesure',
      de: 'Starten Sie Ihre Reise', es: 'Comience su viaje a medida',
      ja: 'オーダーメイドの旅を始めましょう', ko: '맞춤 여정을 시작하세요',
      'zh-TW': '開啟你的定制之旅', 'zh-CN': '开启你的定制之旅'
    },
    'cta.desc': {
      en: 'Book a consultation and let our designers tell your story.',
      fr: 'Réservez une consultation et laissez nos designers raconter votre histoire.',
      de: 'Buchen Sie eine Beratung und lassen Sie unsere Designer Ihre Geschichte erzählen.',
      es: 'Reserve una consulta y deje que nuestros diseñadores cuenten su historia.',
      ja: '相談を予約して、デザイナーにあなたの物語を語らせてください。',
      ko: '상담을 예약하고 디자이너가 당신의 이야기를 담아내도록 하세요.',
      'zh-TW': '預約諮詢，讓設計師為您講述屬於您的珠寶故事。',
      'zh-CN': '预约咨询，让设计师为你讲述属于你的珠宝故事。'
    },

    /* ---------- Footer ---------- */
    'footer.tagline': {
      en: 'Bespoke jewelry · every piece born for you', fr: 'Joaillerie sur mesure · chaque pièce née pour vous',
      de: 'Maßgefertigter Schmuck · jedes Stück für dich geboren', es: 'Joyería a medida · cada pieza nace para ti',
      ja: 'オーダーメイドジュエリー · すべてあなたのために', ko: '맞춤 주얼리 · 모든 작품은 당신을 위해',
      'zh-TW': '單件定制珠寶 · 每一件都為你而生', 'zh-CN': '单件定制珠宝 · 每一件都为你而生'
    },
    'footer.explore': { en: 'Explore', fr: 'Explorer', de: 'Entdecken', es: 'Explorar', ja: '探索', ko: '탐색', 'zh-TW': '探索', 'zh-CN': '探索' },
    'footer.service': { en: 'Service', fr: 'Service', de: 'Service', es: 'Servicio', ja: 'サービス', ko: '서비스', 'zh-TW': '服務', 'zh-CN': '服务' },
    'footer.contact': { en: 'Contact', fr: 'Contact', de: 'Kontakt', es: 'Contacto', ja: 'お問い合わせ', ko: '문의', 'zh-TW': '聯繫', 'zh-CN': '联系' },
    'footer.orders': { en: 'Orders', fr: 'Commandes', de: 'Bestellungen', es: 'Pedidos', ja: 'ご注文', ko: '주문', 'zh-TW': '訂單中心', 'zh-CN': '订单中心' },
    'footer.consult': { en: 'Online Consult', fr: 'Consultation en ligne', de: 'Online-Beratung', es: 'Consulta en línea', ja: 'オンライン相談', ko: '온라인 상담', 'zh-TW': '在線諮詢', 'zh-CN': '在线咨询' },
    'footer.care': { en: 'Aftercare', fr: 'Entretien', de: 'Pflege', es: 'Mantenimiento', ja: 'アフターケア', ko: '애프터케어', 'zh-TW': '售後保養', 'zh-CN': '售后保养' },

    /* ---------- Workspace ---------- */
    'ws.title': {
      en: 'Order Workspace', fr: 'Espace commandes', de: 'Bestell-Workspace',
      es: 'Espacio de pedidos', ja: '注文ワークスペース', ko: '주문 워크스페이스',
      'zh-TW': '訂單協作工作台', 'zh-CN': '订单协作工作台'
    },
    'ws.sub': {
      en: 'One order, one dedicated group chat', fr: 'Une commande, un chat de groupe dédié',
      de: 'Eine Bestellung, ein eigener Gruppenchat', es: 'Un pedido, un chat de grupo dedicado',
      ja: '1注文に1つの専用グループチャット', ko: '주문 하나에 전용 그룹 채팅 하나',
      'zh-TW': '一個訂單一個專屬群聊', 'zh-CN': '一个订单一个专属群聊'
    },
    'ws.orders': { en: 'My Orders', fr: 'Mes commandes', de: 'Meine Bestellungen', es: 'Mis pedidos', ja: 'マイ注文', ko: '내 주문', 'zh-TW': '我的訂單', 'zh-CN': '我的订单' },
    'ws.search': { en: 'Search orders…', fr: 'Rechercher…', de: 'Suchen…', es: 'Buscar…', ja: '注文を検索…', ko: '주문 검색…', 'zh-TW': '搜尋訂單…', 'zh-CN': '搜索订单…' },
    'ws.empty': { en: 'No orders found', fr: 'Aucune commande trouvée', de: 'Keine Bestellungen gefunden', es: 'No se encontraron pedidos', ja: '注文が見つかりません', ko: '주문을 찾을 수 없습니다', 'zh-TW': '未找到訂單', 'zh-CN': '暂无符合条件的订单' },
    'ws.filter.all': { en: 'All', fr: 'Tous', de: 'Alle', es: 'Todos', ja: 'すべて', ko: '전체', 'zh-TW': '全部', 'zh-CN': '全部' },
    'ws.filter.design': { en: 'Designing', fr: 'Conception', de: 'Entwurf', es: 'Diseñando', ja: 'デザイン中', ko: '디자인 중', 'zh-TW': '設計中', 'zh-CN': '设计中' },
    'ws.filter.producing': { en: 'Producing', fr: 'Production', de: 'Produktion', es: 'Produciendo', ja: '制作中', ko: '제작 중', 'zh-TW': '製作中', 'zh-CN': '制作中' },
    'ws.role.designer': { en: 'Designer', fr: 'Designer', de: 'Designer', es: 'Diseñador', ja: 'デザイナー', ko: '디자이너', 'zh-TW': '設計師', 'zh-CN': '设计师' },
    'ws.role.modeler': { en: 'Modeler', fr: 'Modeleur', de: 'Modellierer', es: 'Modelador', ja: 'モデラー', ko: '모델러', 'zh-TW': '建模師', 'zh-CN': '建模师' },
    'ws.role.tracker': { en: 'Order Tracker', fr: 'Suivi de commande', de: 'Auftragsverfolger', es: 'Gestor de pedido', ja: 'オーダー管理', ko: '주문 담당자', 'zh-TW': '跟單員', 'zh-CN': '跟单员' },
    'ws.role.oms': { en: 'OMS auto-join', fr: 'OMS auto', de: 'OMS automatisch', es: 'OMS automático', ja: 'OMS自動参加', ko: 'OMS 자동 참여', 'zh-TW': 'OMS 自動加入', 'zh-CN': 'OMS 自动加入' },
    'ws.status.modeling': { en: '3D modeling', fr: 'Modélisation 3D', de: '3D-Modellierung', es: 'Modelado 3D', ja: '3Dモデリング中', ko: '3D 모델링 중', 'zh-TW': '3D建模中', 'zh-CN': '3D建模中' },
    'ws.status.done': { en: 'Delivered', fr: 'Livré', de: 'Geliefert', es: 'Entregado', ja: '納品済み', ko: '배송 완료', 'zh-TW': '已交付', 'zh-CN': '已交付' },
    'ws.status.design': { en: 'Designing', fr: 'Conception', de: 'Im Entwurf', es: 'Diseñando', ja: 'デザイン中', ko: '디자인 중', 'zh-TW': '方案設計中', 'zh-CN': '方案设计中' },
    'ws.day.today': { en: 'Today', fr: 'Aujourd’hui', de: 'Heute', es: 'Hoy', ja: '今日', ko: '오늘', 'zh-TW': '今天', 'zh-CN': '今天' },
    'ws.progress.delivery.confirm': { en: 'Confirm receipt and pay the balance?', fr: 'Confirmer la réception et payer le solde ?', de: 'Empfang bestätigen und Restbetrag zahlen?', es: '¿Confirmar recepción y pagar el saldo?', ja: '受領を確認して残金を支払いますか？', ko: '수령 확인 및 잔금을 결제하시겠습니까?', 'zh-TW': '確認收貨並支付尾款？', 'zh-CN': '确认收货并支付尾款？' },
    'ws.progress.reject.ph': { en: 'Please enter rejection reason', fr: 'Veuillez saisir le motif du rejet', de: 'Bitte Ablehnungsgrund eingeben', es: 'Introduzca el motivo del rechazo', ja: '却下理由を入力してください', ko: '거부 사유를 입력하세요', 'zh-TW': '請輸入駁回原因', 'zh-CN': '请输入驳回原因' },
    'ws.pay.pendingSub': { en: 'Review the amount and pay to continue production', fr: 'Vérifiez le montant et payez pour poursuivre', de: 'Betrag prüfen und zahlen, um fortzufahren', es: 'Revise el importe y pague para continuar', ja: '金額を確認のうえお支払いください', ko: '금액 확인 후 결제해 주세요', 'zh-TW': '確認金額後完成支付', 'zh-CN': '确认金额后完成支付' },
    'ws.pay.paidSub': { en: 'Balance paid — your order will move forward', fr: 'Solde réglé — la commande avance', de: 'Restbetrag bezahlt — Auftrag läuft weiter', es: 'Saldo pagado — el pedido continúa', ja: '尾款お支払い済み', ko: '잔금 결제 완료', 'zh-TW': '尾款已結清，訂單將繼續推進', 'zh-CN': '尾款已结清，订单将继续推进' },
    'ws.pay.statusPending': { en: 'Unpaid', fr: 'À payer', de: 'Offen', es: 'Pendiente', ja: '未払い', ko: '미결제', 'zh-TW': '待支付', 'zh-CN': '待支付' },
    'ws.pay.statusPaid': { en: 'Paid', fr: 'Payé', de: 'Bezahlt', es: 'Pagado', ja: '支払済', ko: '결제완료', 'zh-TW': '已支付', 'zh-CN': '已支付' },
    'ws.pay.defaultNote': { en: 'Includes labor and confirmed customization options', fr: 'Inclut la main-d’œuvre et les options choisies', de: 'Inkl. Arbeit und gewählte Optionen', es: 'Incluye mano de obra y opciones confirmadas', ja: '工賃と選択オプションを含みます', ko: '공임 및 선택 옵션 포함', 'zh-TW': '含工費及您已確認的定制選項', 'zh-CN': '含工费及您已确认的定制选项' },
    'ws.pay.cta': { en: 'Pay now', fr: 'Payer', de: 'Jetzt zahlen', es: 'Pagar ahora', ja: '今すぐ支払う', ko: '지금 결제', 'zh-TW': '立即支付', 'zh-CN': '立即支付' },
    'ws.reject.design.title': { en: 'Reject design draft', fr: 'Rejeter le design', de: 'Design ablehnen', es: 'Rechazar diseño', ja: 'デザインを却下', ko: '디자인안 거부', 'zh-TW': '駁回設計稿', 'zh-CN': '驳回设计稿' },
    'ws.reject.model.title': { en: 'Reject 3D model', fr: 'Rejeter le modèle 3D', de: '3D-Modell ablehnen', es: 'Rechazar modelo 3D', ja: 'モデルを却下', ko: '모델링안 거부', 'zh-TW': '駁回建模稿', 'zh-CN': '驳回建模稿' },
    'ws.reject.hint': { en: 'Please describe what should be revised so our team can update the draft.', fr: 'Décrivez les modifications souhaitées pour que l’équipe puisse ajuster le design.', de: 'Beschreiben Sie die gewünschten Änderungen für unser Team.', es: 'Indique qué debe corregirse para que el equipo actualice el borrador.', ja: '修正してほしい点を具体的にご記入ください。', ko: '수정이 필요한 내용을 구체적으로 적어 주세요.', 'zh-TW': '請說明需要修改的內容，方便團隊調整方案。', 'zh-CN': '请说明需要修改的内容，方便团队调整方案。' },
    'ws.reject.empty': { en: 'Please enter a rejection reason', fr: 'Veuillez saisir un motif', de: 'Bitte Ablehnungsgrund eingeben', es: 'Introduzca el motivo', ja: '却下理由を入力してください', ko: '거부 사유를 입력하세요', 'zh-TW': '請填寫駁回原因', 'zh-CN': '请填写驳回原因' },
    'ws.reject.submit': { en: 'Submit rejection', fr: 'Envoyer le rejet', de: 'Ablehnung senden', es: 'Enviar rechazo', ja: '却下を送信', ko: '거부 제출', 'zh-TW': '提交駁回', 'zh-CN': '提交驳回' },
    'ws.reject.cancel': { en: 'Cancel', fr: 'Annuler', de: 'Abbrechen', es: 'Cancelar', ja: 'キャンセル', ko: '취소', 'zh-TW': '取消', 'zh-CN': '取消' },
    'ws.designopt.title': { en: 'Production options', fr: 'Options de production', de: 'Produktionsoptionen', es: 'Opciones de producción', ja: '製作オプション', ko: '제작 옵션', 'zh-TW': '生產選項', 'zh-CN': '生产选项' },
    'ws.designopt.body': { en: 'Your design is approved. Please choose the options below.', fr: 'Le design est validé. Choisissez les options ci-dessous.', de: 'Das Design ist freigegeben. Bitte wählen Sie die Optionen.', es: 'El diseño está aprobado. Elija las opciones.', ja: 'デザインが承認されました。次の項目を選んでください。', ko: '디자인이 승인되었습니다. 아래 항목을 선택해 주세요.', 'zh-TW': '設計已通過。請選擇下面三項。', 'zh-CN': '设计已通过。请选择下面三项。' },
    'ws.designopt.buyout': { en: 'Buy out the design', fr: 'Rachat du design', de: 'Design aufkaufen', es: 'Comprar el diseño', ja: 'デザインを買い取る', ko: '디자인 매입', 'zh-TW': '買斷設計', 'zh-CN': '买断设计' },
    'ws.designopt.copyright': { en: 'Copyright certificate', fr: 'Certificat de droit d’auteur', de: 'Urheberzertifikat', es: 'Certificado de copyright', ja: '著作権証明書', ko: '저작권 증명서', 'zh-TW': '版權證書', 'zh-CN': '版权证书' },
    'ws.designopt.confidential': { en: 'Keep private, do not promote', fr: 'Confidentiel, sans promotion', de: 'Vertraulich, keine Werbung', es: 'Confidencial, sin promoción', ja: '非公開・宣伝しない', ko: '비공개, 홍보하지 않음', 'zh-TW': '保密、不對外宣傳', 'zh-CN': '保密，不对外宣传' },
    'ws.designopt.fill': { en: 'Choose options', fr: 'Choisir', de: 'Auswählen', es: 'Elegir', ja: '選択する', ko: '선택', 'zh-TW': '填寫選項', 'zh-CN': '填写选项' },
    'ws.designopt.submit': { en: 'Submit', fr: 'Envoyer', de: 'Senden', es: 'Enviar', ja: '送信', ko: '제출', 'zh-TW': '提交', 'zh-CN': '提交' },
    'ws.designopt.done': { en: 'Options saved', fr: 'Options enregistrées', de: 'Optionen gespeichert', es: 'Opciones guardadas', ja: '保存しました', ko: '저장되었습니다', 'zh-TW': '已保存', 'zh-CN': '已保存' },
    'ws.action.confirmDesign': { en: 'Approve design', fr: 'Valider le design', de: 'Design freigeben', es: 'Aprobar diseño', ja: 'デザインを承認', ko: '디자인 승인', 'zh-TW': '確認設計稿', 'zh-CN': '确认设计稿' },
    'ws.action.rejectDesign': { en: 'Reject design', fr: 'Rejeter le design', de: 'Design ablehnen', es: 'Rechazar diseño', ja: 'デザインを却下', ko: '디자인 거부', 'zh-TW': '駁回設計稿', 'zh-CN': '驳回设计稿' },
    'ws.action.confirmModel': { en: 'Approve 3D model', fr: 'Valider le modèle 3D', de: '3D-Modell freigeben', es: 'Aprobar modelo 3D', ja: 'モデルを承認', ko: '모델링 승인', 'zh-TW': '確認建模稿', 'zh-CN': '确认建模稿' },
    'ws.action.rejectModel': { en: 'Reject 3D model', fr: 'Rejeter le modèle 3D', de: '3D-Modell ablehnen', es: 'Rechazar modelo 3D', ja: 'モデルを却下', ko: '모델링 거부', 'zh-TW': '駁回建模稿', 'zh-CN': '驳回建模稿' },
    'ws.resolution.CONFIRM': { en: 'Confirmed', fr: 'Confirmé', de: 'Bestätigt', es: 'Confirmado', ja: '確認済み', ko: '확인됨', 'zh-TW': '已確認', 'zh-CN': '已确认' },
    'ws.resolution.REJECT': { en: 'Rejected', fr: 'Rejeté', de: 'Abgelehnt', es: 'Rechazado', ja: '却下', ko: '거부됨', 'zh-TW': '已駁回', 'zh-CN': '已驳回' },
    'ws.resolution.PAID': { en: 'Paid', fr: 'Payé', de: 'Bezahlt', es: 'Pagado', ja: '支払済', ko: '결제완료', 'zh-TW': '已支付', 'zh-CN': '已支付' },
    'ws.resolution.FILLED': { en: 'Address saved', fr: 'Adresse enregistrée', de: 'Adresse gespeichert', es: 'Dirección guardada', ja: '住所を保存', ko: '주소 저장됨', 'zh-TW': '已填寫', 'zh-CN': '已填写' },
    'ws.event.title.design': { en: 'Design draft', fr: 'Avant-projet', de: 'Designentwurf', es: 'Borrador de diseño', ja: 'デザイン稿', ko: '디자인안', 'zh-TW': '設計稿', 'zh-CN': '设计稿' },
    'ws.event.title.model': { en: '3D model', fr: 'Modèle 3D', de: '3D-Modell', es: 'Modelo 3D', ja: 'モデリング稿', ko: '모델링안', 'zh-TW': '建模稿', 'zh-CN': '建模稿' },
    'ws.event.DESIGN_SUBMIT': { en: 'Design draft', fr: 'Design', de: 'Design', es: 'Diseño', ja: 'デザイン稿', ko: '디자인안', 'zh-TW': '設計稿', 'zh-CN': '设计稿' },
    'ws.event.DESIGN_REJECT': { en: 'Design rejected', fr: 'Design rejeté', de: 'Design abgelehnt', es: 'Diseño rechazado', ja: 'デザイン却下', ko: '디자인 거부', 'zh-TW': '駁回設計', 'zh-CN': '驳回设计' },
    'ws.event.DESIGN_CONFIRM': { en: 'Design approved', fr: 'Design validé', de: 'Design bestätigt', es: 'Diseño aprobado', ja: 'デザイン承認', ko: '디자인 승인', 'zh-TW': '確認設計', 'zh-CN': '确认设计' },
    'ws.event.MODEL_SUBMIT': { en: '3D model', fr: 'Modèle 3D', de: '3D-Modell', es: 'Modelo 3D', ja: 'モデリング稿', ko: '모델링안', 'zh-TW': '建模稿', 'zh-CN': '建模稿' },
    'ws.event.MODEL_REJECT': { en: 'Model rejected', fr: 'Modèle rejeté', de: 'Modell abgelehnt', es: 'Modelo rechazado', ja: 'モデル却下', ko: '모델 거부', 'zh-TW': '駁回建模', 'zh-CN': '驳回建模' },
    'ws.event.MODEL_CONFIRM': { en: 'Model approved', fr: 'Modèle validé', de: 'Modell bestätigt', es: 'Modelo aprobado', ja: 'モデル承認', ko: '모델 승인', 'zh-TW': '確認建模', 'zh-CN': '确认建模' },
    'ws.event.REVIEW_PASS': { en: 'Craft review passed', fr: 'Validation technique', de: 'Technik geprüft', es: 'Revisión técnica', ja: '工芸検証', ko: '공정 검증', 'zh-TW': '工藝驗證通過', 'zh-CN': '工艺验证通过' },
    'ws.event.REVIEW_REJECT': { en: 'Craft review rejected', fr: 'Rejet technique', de: 'Technik abgelehnt', es: 'Revisión rechazada', ja: '工芸却下', ko: '공정 거부', 'zh-TW': '工藝驗證駁回', 'zh-CN': '工艺验证驳回' },
    'ws.review.kicker': { en: 'Craft review', fr: 'Validation', de: 'Prüfung', es: 'Revisión', ja: '工芸検証', ko: '공정 검증', 'zh-TW': '工藝驗證', 'zh-CN': '工艺验证' },
    'ws.review.failLead': { en: 'This piece needs a revision before we continue.', fr: 'Cette pièce doit être ajustée avant de continuer.', de: 'Dieses Teil muss angepasst werden, bevor es weitergeht.', es: 'Esta pieza debe corregirse antes de continuar.', ja: '続行する前に修正が必要です。', ko: '계속하기 전에 수정이 필요합니다.', 'zh-TW': '此件需要按說明修改後才能繼續。', 'zh-CN': '此件需要按说明修改后才能继续。' },
    'ws.review.passLead': { en: 'Craft review passed. Production can move forward.', fr: 'Validation technique réussie.', de: 'Technikprüfung bestanden.', es: 'La revisión técnica ha sido aprobada.', ja: '工芸検証を通過しました。', ko: '공정 검증을 통과했습니다.', 'zh-TW': '工藝驗證已通過，可進入後續製作。', 'zh-CN': '工艺验证已通过，可进入后续制作。' },
    'ws.review.reason': { en: 'What to change', fr: 'À modifier', de: 'Änderung', es: 'Qué cambiar', ja: '修正内容', ko: '수정 내용', 'zh-TW': '需修改內容', 'zh-CN': '需修改内容' },
    'ws.review.notes': { en: 'Notes', fr: 'Notes', de: 'Hinweis', es: 'Notas', ja: '補足', ko: '보충', 'zh-TW': '補充說明', 'zh-CN': '补充说明' },
    'ws.adjust.design': { en: 'To meet production requirements, we adjusted the design. Please confirm the new design still matches what you expect.', fr: 'Pour respecter la fabrication, le design a été ajusté. Merci de confirmer qu’il correspond toujours à vos attentes.', de: 'Für die Fertigung haben wir das Design angepasst. Bitte bestätigen Sie, dass es weiterhin Ihren Vorstellungen entspricht.', es: 'Para cumplir el proceso de producción ajustamos el diseño. Confirme si sigue siendo lo que espera.', ja: '製造工程に合わせデザインを調整しました。新しいデザインがご希望どおりかご確認ください。', ko: '제작 공정에 맞춰 디자인을 조정했습니다. 새 디자인이 기대와 맞는지 확인해 주세요.', 'zh-TW': '為滿足生產工藝要求，我們對設計做了一定的調整，需要您確認新的設計是否符合您的預期。', 'zh-CN': '为满足生产工艺要求，我们对设计做了一定的调整，需要您确认新的设计是否符合您的预期。' },
    'ws.adjust.model': { en: 'To meet production requirements, we adjusted the 3D model. Please confirm the new model still matches what you expect.', fr: 'Pour respecter la fabrication, le modèle 3D a été ajusté. Merci de confirmer qu’il correspond toujours à vos attentes.', de: 'Für die Fertigung haben wir das 3D-Modell angepasst. Bitte bestätigen Sie, dass es weiterhin Ihren Vorstellungen entspricht.', es: 'Para cumplir el proceso de producción ajustamos el modelo 3D. Confirme si sigue siendo lo que espera.', ja: '製造工程に合わせ3Dモデルを調整しました。新しいモデルがご希望どおりかご確認ください。', ko: '제작 공정에 맞춰 3D 모델을 조정했습니다. 새 모델이 기대와 맞는지 확인해 주세요.', 'zh-TW': '為滿足生產工藝要求，我們對建模做了一定的調整，需要您確認新的建模是否符合您的預期。', 'zh-CN': '为满足生产工艺要求，我们对建模做了一定的调整，需要您确认新的建模是否符合您的预期。' },
    'ws.action.missingOrder': { en: 'Order is not ready. Please refresh and try again.', fr: 'Commande indisponible. Actualisez et réessayez.', de: 'Auftrag nicht bereit. Bitte aktualisieren.', es: 'El pedido no está listo. Actualice e inténtelo de nuevo.', ja: '注文の準備ができていません。更新して再試行してください。', ko: '주문이 준비되지 않았습니다. 새로고침 후 다시 시도하세요.', 'zh-TW': '訂單尚未就緒，請刷新後重試。', 'zh-CN': '订单尚未就绪，请刷新后重试。' },
    'ws.action.failed': { en: 'Could not update. Please try again.', fr: 'Échec de la mise à jour.', de: 'Aktualisierung fehlgeschlagen.', es: 'No se pudo actualizar.', ja: '更新できませんでした。', ko: '업데이트하지 못했습니다.', 'zh-TW': '操作失敗，請重試。', 'zh-CN': '操作失败，请重试。' },
    'ws.event.QUOTATION': { en: 'Quotation', fr: 'Devis', de: 'Angebot', es: 'Cotización', ja: '見積', ko: '견적', 'zh-TW': '報價', 'zh-CN': '报价' },
    'ws.event.PRODUCTION_LOG': { en: 'Production update', fr: 'Suivi production', de: 'Produktionsupdate', es: 'Avance de producción', ja: '生産フォロー', ko: '생산 진행', 'zh-TW': '生產跟單', 'zh-CN': '生产跟单' },
    'ws.event.SHIPPED': { en: 'Shipped', fr: 'Expédié', de: 'Versendet', es: 'Enviado', ja: '発送済', ko: '발송됨', 'zh-TW': '已發貨', 'zh-CN': '已发货' },
    'ws.event.DELIVERED': { en: 'Delivered', fr: 'Livré', de: 'Zugestellt', es: 'Entregado', ja: '配達完了', ko: '배송 완료', 'zh-TW': '已簽收', 'zh-CN': '已签收' },
    'ws.event.STATUS_CHANGE': { en: 'Status update', fr: 'Mise à jour', de: 'Status', es: 'Estado', ja: 'ステータス', ko: '상태', 'zh-TW': '狀態', 'zh-CN': '状态' },
    'ws.event.DELIVERY_CONFIRM': { en: 'Delivery', fr: 'Livraison', de: 'Lieferung', es: 'Entrega', ja: '納品', ko: '인도', 'zh-TW': '交付', 'zh-CN': '交付' },
    'ws.event.BALANCE_PAYMENT': { en: 'Balance due', fr: 'Solde à payer', de: 'Restzahlung', es: 'Saldo pendiente', ja: '尾金支払い', ko: '잔금 결제', 'zh-TW': '支付尾款', 'zh-CN': '支付尾款' },
    'ws.event.BALANCE_PAID': { en: 'Balance paid', fr: 'Solde payé', de: 'Rest bezahlt', es: 'Saldo pagado', ja: '尾金支払済', ko: '잔금 결제 완료', 'zh-TW': '已支付', 'zh-CN': '已支付' },
    'ws.event.SHIPPING_ADDRESS_REQUEST': { en: 'Shipping details', fr: 'Adresse de livraison', de: 'Lieferadresse', es: 'Datos de envío', ja: '配送先', ko: '배송지', 'zh-TW': '收貨信息', 'zh-CN': '收货信息' },
    'ws.event.SHIPPING_ADDRESS_FILLED': { en: 'Shipping details saved', fr: 'Adresse enregistrée', de: 'Lieferadresse gespeichert', es: 'Datos de envío guardados', ja: '配送先を保存', ko: '배송지 저장', 'zh-TW': '已提交收貨信息', 'zh-CN': '已提交收货信息' },
    'ws.shipaddr.title': { en: 'Please add your shipping details', fr: 'Veuillez indiquer votre adresse de livraison', de: 'Bitte Lieferadresse angeben', es: 'Indique los datos de envío', ja: '配送先をご記入ください', ko: '배송지를 입력해 주세요', 'zh-TW': '請完善收貨信息', 'zh-CN': '请完善收货信息' },
    'ws.shipaddr.body': { en: 'Production is complete. Please add the recipient, phone number, country or region, street address, and postal code if you have one, so we can ship your order.', fr: 'La production est terminée. Indiquez le destinataire, le téléphone, le pays ou la région, l’adresse et le code postal (si vous en avez un) pour que nous puissions expédier.', de: 'Die Fertigung ist abgeschlossen. Bitte Empfänger, Telefon, Land oder Region, Adresse und ggf. Postleitzahl angeben, damit wir versenden können.', es: 'La producción ha terminado. Indique destinatario, teléfono, país o región, dirección y código postal (si lo tiene) para poder enviarlo.', ja: '制作が完了しました。発送のため、受取人・電話番号・国/地域・住所・郵便番号（あれば）をご記入ください。', ko: '제작이 완료되었습니다. 발송을 위해 수령인, 전화번호, 국가/지역, 상세 주소, 우편번호(있으면)를 입력해 주세요.', 'zh-TW': '生產已經完成。請填寫收貨人、聯繫電話、國家或地區、詳細地址和郵編（如有），方便我們安排發貨。', 'zh-CN': '生产已经完成。请填写收货人、联系电话、国家或地区、详细地址和邮编（如有），方便我们安排发货。' },
    'ws.shipaddr.filledTitle': { en: 'Shipping details saved', fr: 'Adresse de livraison enregistrée', de: 'Lieferadresse gespeichert', es: 'Datos de envío guardados', ja: '配送先を保存しました', ko: '배송지를 저장했습니다', 'zh-TW': '已提交收貨信息', 'zh-CN': '已提交收货信息' },
    'ws.shipaddr.fill': { en: 'Add shipping details', fr: 'Renseigner l’adresse', de: 'Adresse angeben', es: 'Añadir datos de envío', ja: '配送先を記入', ko: '배송지 입력', 'zh-TW': '填寫收貨信息', 'zh-CN': '填写收货信息' },
    'ws.shipaddr.edit': { en: 'Update shipping details', fr: 'Modifier l’adresse', de: 'Adresse ändern', es: 'Modificar datos de envío', ja: '配送先を変更', ko: '배송지 수정', 'zh-TW': '修改收貨信息', 'zh-CN': '修改收货信息' },
    'ws.shipaddr.recipient': { en: 'Recipient', fr: 'Destinataire', de: 'Empfänger', es: 'Destinatario', ja: '受取人', ko: '수령인', 'zh-TW': '收貨人', 'zh-CN': '收货人' },
    'ws.shipaddr.phone': { en: 'Phone', fr: 'Téléphone', de: 'Telefon', es: 'Teléfono', ja: '電話番号', ko: '전화번호', 'zh-TW': '聯繫電話', 'zh-CN': '联系电话' },
    'ws.shipaddr.country': { en: 'Country / region', fr: 'Pays / région', de: 'Land / Region', es: 'País / región', ja: '国 / 地域', ko: '국가 / 지역', 'zh-TW': '國家 / 地區', 'zh-CN': '国家 / 地区' },
    'ws.shipaddr.countryPh': { en: 'Select country or region', fr: 'Choisir un pays ou une région', de: 'Land oder Region wählen', es: 'Seleccione país o región', ja: '国または地域を選択', ko: '국가 또는 지역 선택', 'zh-TW': '請選擇國家或地區', 'zh-CN': '请选择国家或地区' },
    'ws.shipaddr.detail': { en: 'Street address', fr: 'Adresse', de: 'Adresse', es: 'Dirección', ja: '詳細住所', ko: '상세 주소', 'zh-TW': '詳細地址', 'zh-CN': '详细地址' },
    'ws.shipaddr.postal': { en: 'Postal code', fr: 'Code postal', de: 'Postleitzahl', es: 'Código postal', ja: '郵便番号', ko: '우편번호', 'zh-TW': '郵編', 'zh-CN': '邮编' },
    'ws.shipaddr.postalPh': { en: 'Optional', fr: 'Facultatif', de: 'Optional', es: 'Opcional', ja: '任意', ko: '선택', 'zh-TW': '有就填', 'zh-CN': '有就填' },
    'ws.shipaddr.submit': { en: 'Save', fr: 'Enregistrer', de: 'Speichern', es: 'Guardar', ja: '保存', ko: '저장', 'zh-TW': '提交', 'zh-CN': '提交' },
    'ws.shipaddr.cancel': { en: 'Cancel', fr: 'Annuler', de: 'Abbrechen', es: 'Cancelar', ja: 'キャンセル', ko: '취소', 'zh-TW': '取消', 'zh-CN': '取消' },
    'ws.shipaddr.err.recipient': { en: 'Please enter the recipient', fr: 'Indiquez le destinataire', de: 'Bitte Empfänger angeben', es: 'Indique el destinatario', ja: '受取人を入力してください', ko: '수령인을 입력해 주세요', 'zh-TW': '請填寫收貨人', 'zh-CN': '请填写收货人' },
    'ws.shipaddr.err.phone': { en: 'Please enter a phone number', fr: 'Indiquez un téléphone', de: 'Bitte Telefonnummer angeben', es: 'Indique un teléfono', ja: '電話番号を入力してください', ko: '전화번호를 입력해 주세요', 'zh-TW': '請填寫聯繫電話', 'zh-CN': '请填写联系电话' },
    'ws.shipaddr.err.country': { en: 'Please select a country or region', fr: 'Choisissez un pays ou une région', de: 'Bitte Land oder Region wählen', es: 'Seleccione un país o región', ja: '国または地域を選択してください', ko: '국가 또는 지역을 선택해 주세요', 'zh-TW': '請選擇國家或地區', 'zh-CN': '请选择国家或地区' },
    'ws.shipaddr.err.detail': { en: 'Please enter the street address', fr: 'Indiquez l’adresse', de: 'Bitte Adresse angeben', es: 'Indique la dirección', ja: '詳細住所を入力してください', ko: '상세 주소를 입력해 주세요', 'zh-TW': '請填寫詳細地址', 'zh-CN': '请填写详细地址' },
    'ws.shipaddr.success': { en: 'Shipping details saved', fr: 'Adresse enregistrée', de: 'Adresse gespeichert', es: 'Datos guardados', ja: '配送先を保存しました', ko: '배송지를 저장했습니다', 'zh-TW': '收貨信息已保存', 'zh-CN': '收货信息已保存' },
    'ws.event._default': { en: 'Update', fr: 'Événement', de: 'Ereignis', es: 'Evento', ja: 'イベント', ko: '이벤트', 'zh-TW': '事件', 'zh-CN': '事件' },
    'ws.order.PENDING_DESIGN': { en: 'Pending design', fr: 'En attente de design', de: 'Design ausstehend', es: 'Diseño pendiente', ja: 'デザイン待ち', ko: '디자인 대기', 'zh-TW': '設計中', 'zh-CN': '设计中' },
    'ws.order.DESIGNING': { en: 'Design review', fr: 'Relecture design', de: 'Design-Review', es: 'Revisión de diseño', ja: 'デザイン確認中', ko: '디자인 검토', 'zh-TW': '設計複審中', 'zh-CN': '设计复审中' },
    'ws.order.PENDING_MODEL': { en: 'Pending 3D model', fr: 'Modèle en attente', de: 'Modell ausstehend', es: 'Modelado pendiente', ja: 'モデリング待ち', ko: '모델링 대기', 'zh-TW': '建模中', 'zh-CN': '建模中' },
    'ws.order.MODELING': { en: 'Model revisions', fr: 'Modèle en révision', de: 'Modell-Anpassung', es: 'Revisión de modelo', ja: 'モデル修正中', ko: '모델 수정', 'zh-TW': '建模修改中', 'zh-CN': '建模修改中' },
    'ws.order.PENDING_REVIEW': { en: 'Craft review', fr: 'Validation technique', de: 'Technikprüfung', es: 'Revisión técnica', ja: '工芸検証待ち', ko: '공정 검증 대기', 'zh-TW': '待工藝驗證', 'zh-CN': '待工艺验证' },
    'ws.order.PENDING_PRODUCTION': { en: 'Ready to produce', fr: 'Prêt à produire', de: 'Produktionsbereit', es: 'Listo para producir', ja: '生産待ち', ko: '생산 대기', 'zh-TW': '待生產', 'zh-CN': '待生产' },
    'ws.order.PRODUCING': { en: 'In production', fr: 'En production', de: 'In Produktion', es: 'En producción', ja: '生産中', ko: '생산 중', 'zh-TW': '生產中', 'zh-CN': '生产中' },
    'ws.order.COMPLETED': { en: 'Completed', fr: 'Terminé', de: 'Abgeschlossen', es: 'Completado', ja: '完了', ko: '완료', 'zh-TW': '已完成', 'zh-CN': '已完成' },
    'ws.order.CANCELLED': { en: 'Cancelled', fr: 'Annulé', de: 'Storniert', es: 'Cancelado', ja: 'キャンセル', ko: '취소됨', 'zh-TW': '已取消', 'zh-CN': '已取消' },
    'ws.role.customer': { en: 'Customer', fr: 'Client', de: 'Kunde', es: 'Cliente', ja: 'お客様', ko: '고객', 'zh-TW': '客戶', 'zh-CN': '客户' },
    'ws.role.ai': { en: 'AI assistant', fr: 'Assistant IA', de: 'KI-Assistent', es: 'Asistente IA', ja: 'AIアシスタント', ko: 'AI 어시스턴트', 'zh-TW': 'AI 助理', 'zh-CN': 'AI 助理' },
    'ws.role.admin': { en: 'Admin', fr: 'Admin', de: 'Admin', es: 'Admin', ja: '管理者', ko: '관리자', 'zh-TW': '管理員', 'zh-CN': '管理员' },
    'ws.role.system': { en: 'System', fr: 'Système', de: 'System', es: 'Sistema', ja: 'システム', ko: '시스템', 'zh-TW': '系統', 'zh-CN': '系统' },
    'ws.card.viewDetail': { en: 'Tap to view details', fr: 'Voir les détails', de: 'Details anzeigen', es: 'Ver detalles', ja: 'タップして詳細', ko: '탭하여 상세 보기', 'zh-TW': '點擊查看詳情', 'zh-CN': '点击查看详情' },
    'ws.detail.rejectReason': { en: 'Rejection reason:', fr: 'Motif du rejet :', de: 'Ablehnungsgrund:', es: 'Motivo del rechazo:', ja: '却下理由：', ko: '거부 사유:', 'zh-TW': '駁回原因：', 'zh-CN': '驳回原因：' },
    'ws.ship.loading': { en: 'Loading shipment…', fr: 'Chargement de l’expédition…', de: 'Sendung wird geladen…', es: 'Cargando envío…', ja: '配送情報を読み込み中…', ko: '배송 정보 불러오는 중…', 'zh-TW': '載入物流資訊…', 'zh-CN': '加载物流信息…' },
    'ws.ship.none': { en: 'No shipment info yet', fr: 'Pas encore d’expédition', de: 'Noch keine Sendung', es: 'Sin envío aún', ja: '物流情報はまだありません', ko: '배송 정보 없음', 'zh-TW': '暫無物流資訊', 'zh-CN': '暂无物流信息' },
    'ws.ship.tracking': { en: 'Tracking number:', fr: 'N° de suivi :', de: 'Sendungsnummer:', es: 'Nº de seguimiento:', ja: '追跡番号：', ko: '운송장 번호:', 'zh-TW': '快遞單號：', 'zh-CN': '快递单号：' },
    'ws.ship.carrier': { en: 'Carrier:', fr: 'Transporteur :', de: 'Versanddienst:', es: 'Transportista:', ja: '配送業者：', ko: '택배사:', 'zh-TW': '承運商：', 'zh-CN': '承运商：' },
    'ws.ship.status': { en: 'Status:', fr: 'Statut :', de: 'Status:', es: 'Estado:', ja: '状態：', ko: '상태:', 'zh-TW': '狀態：', 'zh-CN': '状态：' },
    'ws.ship.pending': { en: 'Shipped (tracking pending)', fr: 'Expédié (suivi en attente)', de: 'Versendet (Tracking ausstehend)', es: 'Enviado (seguimiento pendiente)', ja: '発送済み（追跡更新待ち）', ko: '발송됨(추적 대기)', 'zh-TW': '已發貨（待物流更新）', 'zh-CN': '已发货（待物流更新）' },
    'ws.ship.sandbox': { en: 'This is the YunExpress sandbox. The events below were returned by the sandbox.', fr: 'Environnement de test YunExpress. Les étapes ci-dessous viennent du bac à sable.', de: 'YunExpress-Sandbox. Die folgenden Ereignisse kommen aus der Sandbox.', es: 'Entorno de prueba de YunExpress. Los eventos siguientes vienen del sandbox.', ja: '雲途のサンドボックスです。下の履歴はサンドボックスの返答です。', ko: '윈익스프레스 샌드박스입니다. 아래 내역은 샌드박스 응답입니다.', 'zh-TW': '目前是雲途沙盒環境，以下為沙盒返回的軌跡。', 'zh-CN': '当前是云途沙盒环境，以下为沙盒返回的轨迹。' },
    'ws.ship.sandboxEmpty': { en: 'This is the YunExpress sandbox, and there are no tracking events yet.', fr: 'Environnement de test YunExpress : aucun événement de suivi pour le moment.', de: 'YunExpress-Sandbox: noch keine Sendungsverfolgung.', es: 'Entorno de prueba de YunExpress: aún no hay eventos.', ja: '雲途のサンドボックスです。追跡履歴はまだありません。', ko: '윈익스프레스 샌드박스이며, 아직 배송 이력이 없습니다.', 'zh-TW': '目前是雲途沙盒環境，暫無軌跡節點。', 'zh-CN': '当前是云途沙盒环境，暂无轨迹节点。' },
    'ws.ship.noEvents': { en: 'No tracking events yet.', fr: 'Aucun événement de suivi pour le moment.', de: 'Noch keine Sendungsereignisse.', es: 'Aún no hay eventos de seguimiento.', ja: '追跡履歴はまだありません。', ko: '아직 배송 이력이 없습니다.', 'zh-TW': '暫無軌跡節點。', 'zh-CN': '暂无轨迹节点。' },
    'ws.ship.trackLink': { en: 'Track on 17TRACK', fr: 'Suivre sur 17TRACK', de: 'Auf 17TRACK verfolgen', es: 'Seguir en 17TRACK', ja: '17TRACKで追跡', ko: '17TRACK에서 조회', 'zh-TW': '在 17TRACK 查看完整軌跡', 'zh-CN': '在 17TRACK 查看完整轨迹' },
    'ws.ship.lastMile': { en: 'Local carrier:', fr: 'Transporteur local :', de: 'Zusteller:', es: 'Transportista local:', ja: '現地配送：', ko: '현지 배송:', 'zh-TW': '末端派送：', 'zh-CN': '末端派送：' },
    'ws.ship.lastMileLink': { en: 'Open the local carrier site', fr: 'Ouvrir le site du transporteur local', de: 'Zusteller-Website öffnen', es: 'Abrir el sitio del transportista local', ja: '現地配送会社のサイトを開く', ko: '현지 배송사 사이트 열기', 'zh-TW': '打開末端派送查詢', 'zh-CN': '打开末端派送查询' },
    'ws.ship.cancelledTitle': { en: 'Waybill cancelled', fr: 'Lettre de transport annulée', de: 'Frachtbrief storniert', es: 'Guía cancelada', ja: '送り状を取り消しました', ko: '운송장이 취소되었습니다', 'zh-TW': '運單已撤銷', 'zh-CN': '运单已撤销' },
    'ws.ship.heldTitle': { en: 'Shipment held', fr: 'Envoi intercepté', de: 'Sendung angehalten', es: 'Envío interceptado', ja: '配送を一時保留しました', ko: '배송이 일시 보류되었습니다', 'zh-TW': '運單已攔截', 'zh-CN': '运单已拦截' },
    'ws.ship.cancelledBody': { en: 'This waybill has been cancelled and will not continue. If we ship again, you will receive a new tracking number.', fr: 'Cette lettre de transport est annulée. Si nous réexpédions, vous recevrez un nouveau numéro.', de: 'Dieser Frachtbrief wurde storniert. Bei erneutem Versand erhalten Sie eine neue Nummer.', es: 'Esta guía se canceló. Si volvemos a enviarlo, recibirá un número nuevo.', ja: 'この送り状は取り消され、配送は続きません。再発送する場合は新しい番号をお知らせします。', ko: '이 운송장은 취소되어 더 이상 배송되지 않습니다. 다시 보내면 새 번호를 안내합니다.', 'zh-TW': '這張運單已撤銷，暫不繼續派送。如需重新寄出，我們會再通知您新的單號。', 'zh-CN': '这张运单已撤销，暂不继续派送。如需重新寄出，我们会再通知您新的单号。' },
    'ws.ship.heldBody': { en: 'The parcel is temporarily held. We are handling it and will update tracking.', fr: 'Le colis est temporairement retenu. Nous le traitons et mettrons le suivi à jour.', de: 'Das Paket ist vorübergehend angehalten. Wir bearbeiten es und aktualisieren die Sendung.', es: 'El paquete está retenido temporalmente. Lo estamos gestionando y actualizaremos el seguimiento.', ja: '荷物は一時保留中です。対応後に配送状況を更新します。', ko: '택배가 일시 보류되었습니다. 처리 후 배송 현황을 업데이트합니다.', 'zh-TW': '包裹已暫時攔截，我們正在處理，隨後會更新物流。', 'zh-CN': '包裹已暂时拦截，我们正在处理，随后会更新物流。' },
    'ws.ship.loadFail': { en: 'Failed to load shipment', fr: 'Échec du chargement', de: 'Laden fehlgeschlagen', es: 'Error al cargar envío', ja: '物流情報の読み込みに失敗', ko: '배송 정보 로드 실패', 'zh-TW': '物流資訊載入失敗', 'zh-CN': '物流信息加载失败' },
    'ws.ship.current': { en: 'Use this current tracking number', fr: 'Utilisez ce numéro actuel', de: 'Diese aktuelle Sendungsnummer verwenden', es: 'Use este número actual', ja: 'この最新の追跡番号で照会してください', ko: '이 현재 운송장 번호로 조회하세요', 'zh-TW': '請按當前單號查詢', 'zh-CN': '请按当前单号查询' },
    'ws.ship.correctedTitle': { en: 'Tracking number corrected', fr: 'Numéro de suivi corrigé', de: 'Sendungsnummer korrigiert', es: 'Número de seguimiento corregido', ja: '追跡番号を訂正しました', ko: '운송장 번호를 정정했습니다', 'zh-TW': '物流單號已更正', 'zh-CN': '物流单号已更正' },
    'ws.ship.reshippedTitle': { en: 'Shipped again', fr: 'Réexpédié', de: 'Erneut versendet', es: 'Enviado de nuevo', ja: '再発送しました', ko: '다시 발송했습니다', 'zh-TW': '已重新發貨', 'zh-CN': '已重新发货' },
    'ws.ship.correctedBody': { en: 'The tracking number has been corrected. Please track: {tracking}', fr: 'Le numéro de suivi a été corrigé. Suivez : {tracking}', de: 'Die Sendungsnummer wurde korrigiert. Bitte verfolgen: {tracking}', es: 'El número de seguimiento se ha corregido. Consulte: {tracking}', ja: '追跡番号を訂正しました。次の番号で照会してください：{tracking}', ko: '운송장 번호를 정정했습니다. 다음 번호로 조회해 주세요: {tracking}', 'zh-TW': '物流單號已更正。請按新單號查詢：{tracking}', 'zh-CN': '物流单号已更正。请按新单号查询：{tracking}' },
    'ws.ship.reshippedBody': { en: 'Your order has been shipped again. Please track: {tracking}', fr: 'Votre commande a été réexpédiée. Suivez : {tracking}', de: 'Ihre Bestellung wurde erneut versendet. Bitte verfolgen: {tracking}', es: 'Su pedido se ha enviado de nuevo. Consulte: {tracking}', ja: '再発送しました。次の番号で照会してください：{tracking}', ko: '다시 발송했습니다. 다음 번호로 조회해 주세요: {tracking}', 'zh-TW': '已重新發貨。請按新單號查詢：{tracking}', 'zh-CN': '已重新发货。请按新单号查询：{tracking}' },
    'ws.ship.carrierSuffix': { en: ' (Carrier: {carrier})', fr: ' (Transporteur : {carrier})', de: ' (Versanddienst: {carrier})', es: ' (Transportista: {carrier})', ja: '（配送業者：{carrier}）', ko: ' (택배사: {carrier})', 'zh-TW': '（承運商：{carrier}）', 'zh-CN': '（承运商：{carrier}）' },
    'ws.balance.title': { en: 'Pay balance', fr: 'Payer le solde', de: 'Restzahlung', es: 'Pagar saldo', ja: '尾金を支払う', ko: '잔금 결제', 'zh-TW': '支付尾款', 'zh-CN': '支付尾款' },
    'ws.balance.hint': { en: 'Demo checkout — confirm to mark as paid.', fr: 'Paiement démo — confirmer pour valider.', de: 'Demo-Zahlung — bestätigen gilt als bezahlt.', es: 'Pago de prueba — confirmar marca como pagado.', ja: 'デモ決済 — 確認で支払い完了扱い', ko: '데모 결제 — 확인 시 결제 완료 처리', 'zh-TW': '模擬支付流程，點擊確認即視為支付成功', 'zh-CN': '模拟支付流程，点击确认即视为支付成功' },
    'ws.balance.confirm': { en: 'Confirm payment', fr: 'Confirmer le paiement', de: 'Zahlung bestätigen', es: 'Confirmar pago', ja: '支払いを確認', ko: '결제 확인', 'zh-TW': '確認支付', 'zh-CN': '确认支付' },
    'ws.balance.cancel': { en: 'Cancel', fr: 'Annuler', de: 'Abbrechen', es: 'Cancelar', ja: 'キャンセル', ko: '취소', 'zh-TW': '取消', 'zh-CN': '取消' },
    'ws.balance.success': { en: 'Payment successful', fr: 'Paiement réussi', de: 'Zahlung erfolgreich', es: 'Pago exitoso', ja: '支払い完了', ko: '결제 완료', 'zh-TW': '支付成功', 'zh-CN': '支付成功' },
    'ws.balance.paidAmount': { en: 'Balance {amount} paid', fr: 'Solde {amount} payé', de: 'Rest {amount} bezahlt', es: 'Saldo {amount} pagado', ja: '尾金 {amount} 支払済', ko: '잔금 {amount} 결제됨', 'zh-TW': '尾款 {amount} 已支付', 'zh-CN': '尾款 {amount} 已支付' },
    'ws.balance.done': { en: 'Done', fr: 'Terminé', de: 'Fertig', es: 'Listo', ja: '完了', ko: '완료', 'zh-TW': '完成', 'zh-CN': '完成' },
    'ws.assist.title': { en: 'Add a designer', 'zh-TW': '加請設計師協助', 'zh-CN': '加请设计师协助' },
    'ws.assist.body': {
      en: 'This order was created from your reference images. Pay an extra fee to have a designer review your information and continue the design. The more complete your answers, the lower the fee: $100 before the form, $80 after it, $60 after the model is confirmed.',
      'zh-TW': '這單是來圖定制。額外支付費用即可請設計師核對您已填寫的信息並繼續設計。信息越完整，費用越低：未填問卷 $100，已填問卷 $80，建模已確認 $60。',
      'zh-CN': '这单是来图定制。额外支付费用即可请设计师核对您已填写的信息并继续设计。信息越完整，费用越低：未填问卷 $100，已填问卷 $80，建模已确认 $60。'
    },
    'ws.assist.pay': { en: 'Pay now', 'zh-TW': '立即支付', 'zh-CN': '立即支付' },
    'ws.assist.later': { en: 'Not now', 'zh-TW': '暫時不需要', 'zh-CN': '暂时不需要' },
    'ws.assist.done': { en: 'Your order is now designer design. The designer will review the information you already filled in.', 'zh-TW': '已轉為設計師設計。設計師會核對您已填寫的信息。', 'zh-CN': '已转为设计师设计。设计师会核对您已填写的信息。' },
    'ws.assist.error': { en: 'Could not complete the upgrade', 'zh-TW': '升級未完成', 'zh-CN': '升级未完成' },
    'ws.assist.price': { en: 'Your fee: $', 'zh-TW': '本次費用：$', 'zh-CN': '本次费用：$' },
    'profile.title': { en: 'Complete your profile', fr: 'Complétez votre profil', de: 'Profil vervollständigen', es: 'Complete su perfil', ja: 'プロフィールを入力', ko: '프로필을 완성해 주세요', 'zh-TW': '完善您的資料', 'zh-CN': '完善您的资料' },
    'profile.sub': { en: 'Help us serve you better with a few details.', fr: 'Quelques informations pour mieux vous servir.', de: 'Ein paar Angaben für besseren Service.', es: 'Algunos datos para atenderle mejor.', ja: 'より良いサービスのため、情報をご入力ください。', ko: '더 나은 서비스를 위해 정보를 입력해 주세요.', 'zh-TW': '為了更好的服務，請補充以下資訊', 'zh-CN': '为了更好的服务，请补充以下信息' },
    'profile.name': { en: 'Display name', fr: 'Nom affiché', de: 'Anzeigename', es: 'Nombre', ja: 'お名前', ko: '이름', 'zh-TW': '稱呼', 'zh-CN': '称呼' },
    'profile.name.ph': { en: 'How should we address you?', fr: 'Comment vous appeler ?', de: 'Wie sollen wir Sie nennen?', es: '¿Cómo llamarle?', ja: 'お呼びする名前', ko: '어떻게 불러드릴까요?', 'zh-TW': '如何稱呼您', 'zh-CN': '如何称呼您' },
    'profile.contact': { en: 'Contact', fr: 'Contact', de: 'Kontakt', es: 'Contacto', ja: '連絡先', ko: '연락처', 'zh-TW': '聯繫方式', 'zh-CN': '联系方式' },
    'profile.contact.ph': { en: 'Phone / WeChat / email', fr: 'Tél. / WeChat / e-mail', de: 'Telefon / WeChat / E-Mail', es: 'Tel. / WeChat / correo', ja: '電話 / WeChat / メール', ko: '전화 / WeChat / 이메일', 'zh-TW': '手機號 / 微信 / 郵箱', 'zh-CN': '手机号 / 微信 / 邮箱' },
    'profile.save': { en: 'Save and continue', fr: 'Enregistrer', de: 'Speichern', es: 'Guardar', ja: '保存して続行', ko: '저장 후 계속', 'zh-TW': '保存並繼續', 'zh-CN': '保存并继续' },
    'profile.skip': { en: 'Skip for now', fr: 'Plus tard', de: 'Überspringen', es: 'Omitir', ja: 'あとで', ko: '나중에', 'zh-TW': '暫時跳過', 'zh-CN': '暂时跳过' },
    'profile.err.name': { en: 'Please enter your name', fr: 'Veuillez saisir votre nom', de: 'Bitte Namen eingeben', es: 'Introduzca su nombre', ja: 'お名前を入力してください', ko: '이름을 입력하세요', 'zh-TW': '請填寫稱呼', 'zh-CN': '请填写称呼' },
    'profile.err.contact': { en: 'Please enter contact info', fr: 'Veuillez saisir un contact', de: 'Bitte Kontakt eingeben', es: 'Introduzca contacto', ja: '連絡先を入力してください', ko: '연락처를 입력하세요', 'zh-TW': '請填寫聯繫方式', 'zh-CN': '请填写联系方式' },
    'profile.saveFail': { en: 'Could not save profile', fr: 'Échec de l’enregistrement', de: 'Speichern fehlgeschlagen', es: 'No se pudo guardar', ja: '保存に失敗しました', ko: '저장 실패', 'zh-TW': '保存失敗', 'zh-CN': '保存失败' },
    'ws.stage.modeling': { en: '3D modeling stage', fr: 'Étape de modélisation 3D', de: '3D-Modellierungsphase', es: 'Etapa de modelado 3D', ja: '3Dモデリング段階', ko: '3D 모델링 단계', 'zh-TW': '3D建模階段', 'zh-CN': '3D建模阶段' },
    'ws.online': { en: 'Online', fr: 'En ligne', de: 'Online', es: 'En línea', ja: 'オンライン', ko: '온라인', 'zh-TW': '在線', 'zh-CN': '在线' },
    'ws.input': { en: 'Type a message…', fr: 'Écrire un message…', de: 'Nachricht schreiben…', es: 'Escribir un mensaje…', ja: 'メッセージを入力…', ko: '메시지를 입력하세요…', 'zh-TW': '輸入訊息…', 'zh-CN': '输入消息…' },
    'ws.send': { en: 'Send', fr: 'Envoyer', de: 'Senden', es: 'Enviar', ja: '送信', ko: '보내기', 'zh-TW': '發送', 'zh-CN': '发送' },
    'ws.reply': {
      en: 'Received — I’ll sync the team and get back to you shortly.',
      fr: 'Bien reçu — je synchronise l’équipe et reviens vers vous.',
      de: 'Erhalten — ich informiere das Team und melde mich.',
      es: 'Recibido — sincronizo al equipo y le respondo.',
      ja: '承知しました — チームに共有し、追ってご返信します。',
      ko: '확인했습니다 — 팀과 공유하고 곧 답변드리겠습니다.',
      'zh-TW': '收到 — 我會同步團隊，稍後回覆您。',
      'zh-CN': '收到 — 我会同步团队，稍后回复您。'
    },
    'ws.welcome': {
      en: 'Hello! I’m the duxury design consultant. Tell me about your inspiration, budget and timeline.',
      fr: 'Bonjour ! Je suis le conseiller duxury. Parlez-moi de votre inspiration, budget et délais.',
      de: 'Hallo! Ich bin der duxury-Designberater. Erzählen Sie mir von Inspiration, Budget und Zeitplan.',
      es: '¡Hola! Soy el asesor de duxury. Cuénteme su inspiración, presupuesto y plazos.',
      ja: 'こんにちは！duxury デザインコンサルタントです。インスピレーションやご予算、スケジュールをお聞かせください。',
      ko: '안녕하세요! duxury 디자인 컨설턴트입니다. 영감, 예산, 일정을 알려주세요.',
      'zh-TW': '您好！我是 duxury 的設計顧問。請告訴我您的靈感、預算與期望時間。',
      'zh-CN': '您好！我是 duxury 的设计顾问。请告诉我您的灵感、预算与期望时间。'
    },
    'ws.msg.designer': {
      en: 'Proposal confirmed — moving to 3D modeling. The modeler will now craft the digital model.',
      fr: 'Proposition confirmée — passage au modelage 3D. Le modeleur va réaliser le modèle numérique.',
      de: 'Entwurf bestätigt — weiter zur 3D-Modellierung. Der Modellierer erstellt nun das Modell.',
      es: 'Propuesta confirmada — pasamos al modelado 3D. El modelador creará el modelo digital.',
      ja: '提案が確定しました — 3Dモデリングへ進みます。モデラーがデジタルモデルを制作します。',
      ko: '제안이 확정되었습니다 — 3D 모델링으로 진행합니다. 모델러가 디지털 모델을 제작합니다.',
      'zh-TW': '方案已確認，進入3D建模階段。建模師將接手製作數字模型。',
      'zh-CN': '方案已确认，进入3D建模阶段。建模师将接手制作数字模型。'
    },
    'ws.msg.client': {
      en: 'Great, looking forward to seeing the render!', fr: 'Super, j’ai hâte de voir le rendu !',
      de: 'Großartig, ich freue mich auf das Rendering!', es: '¡Genial, con ganas de ver el renderizado!',
      ja: 'ありがとうございます。レンダリングを楽しみにしています！', ko: '좋아요, 렌더링이 기대됩니다!',
      'zh-TW': '好的，期待看到建模效果！', 'zh-CN': '好的，期待看到建模效果！'
    },
    'ws.msg.joined': {
      en: 'Modeler joined the chat', fr: 'Le modeleur a rejoint le chat',
      de: 'Modellierer ist dem Chat beigetreten', es: 'El modelador se unió al chat',
      ja: 'モデラーがチャットに参加しました', ko: '모델러가 채팅에 참여했습니다',
      'zh-TW': '建模師已加入群聊', 'zh-CN': '建模师已加入群聊'
    },
    'ws.msg.modeler': {
      en: 'Hi everyone, I’m your modeler. Building the 3D model from the sketch — first preview expected tomorrow.',
      fr: 'Bonjour à tous, je suis votre modeleur. Je construis le modèle 3D — premier aperçu demain.',
      de: 'Hallo zusammen, ich bin Ihr Modellierer. Ich baue das 3D-Modell — erste Vorschau morgen.',
      es: 'Hola a todos, soy su modelador. Construyo el modelo 3D — primera vista mañana.',
      ja: 'みなさん、こんにちは。モデラーです。設計図をもとに3Dモデルを制作中、初版は明日の予定です。',
      ko: '안녕하세요, 모델러입니다. 스케치 기반 3D 모델 제작 중이며, 첫 미리보기는 내일 예정입니다.',
      'zh-TW': '大家好，我是本次建模師。正在根據設計稿製作3D模型，預計明天可出初版預覽。',
      'zh-CN': '大家好，我是本次建模师。正在根据设计稿制作3D模型，预计明天可出初版预览。'
    },
    'ws.msg.tracker': {
      en: 'Noted — I’ll track progress and sync the order status. Reach out anytime.',
      fr: 'Noté — je suis la progression et synchronise le statut. Contactez-moi à tout moment.',
      de: 'Notiert — ich verfolge den Fortschritt und synchronisiere den Status.',
      es: 'Anotado — seguiré el progreso y sincronizaré el estado.',
      ja: '承知しました。進捗を追跡し、注文ステータスを同期します。',
      ko: '확인했습니다 — 진행 상황을 추적하고 주문 상태를 동기화하겠습니다.',
      'zh-TW': '收到，我會持續跟進進度並同步至訂單狀態。有任何問題隨時溝通。',
      'zh-CN': '收到，我会持续跟进进度并同步至订单状态。有任何问题随时沟通。'
    },
    'ws.online.hint': {
      en: 'Designer online · replies ~1 min', fr: 'Designer en ligne · réponse ~1 min',
      de: 'Designer online · Antwort ~1 min', es: 'Diseñador en línea · responde ~1 min',
      ja: 'デザイナーオンライン · 約1分で返信', ko: '디자이너 온라인 · 약 1분 내 답변',
      'zh-TW': '設計師在線 · 平均1分鐘回覆', 'zh-CN': '设计师在线 · 平均1分钟回复'
    },
    'ws.typing': {
      en: 'typing…', fr: 'écrit…', de: 'schreibt…', es: 'escribiendo…',
      ja: '入力中…', ko: '입력 중…', 'zh-TW': '輸入中…', 'zh-CN': '输入中…'
    },

    /* ---------- Message translate ---------- */
    'msg.translate': {
      en: 'Translate', fr: 'Traduire', de: 'Übersetzen', es: 'Traducir',
      ja: '翻訳', ko: '번역', 'zh-TW': '翻譯', 'zh-CN': '翻译'
    },
    'msg.showOriginal': {
      en: 'Show original', fr: 'Voir l’original', de: 'Original anzeigen', es: 'Ver original',
      ja: '原文を表示', ko: '원문 보기', 'zh-TW': '顯示原文', 'zh-CN': '显示原文'
    },
    'msg.translate.failed': {
      en: 'Translation failed. Please try again later.',
      fr: 'Traduction échouée. Veuillez réessayer.',
      de: 'Übersetzung fehlgeschlagen. Bitte erneut versuchen.',
      es: 'Error de traducción. Inténtelo de nuevo.',
      ja: '翻訳に失敗しました。後でもう一度お試しください。',
      ko: '번역에 실패했습니다. 나중에 다시 시도해주세요.',
      'zh-TW': '翻譯失敗，請稍後再試。',
      'zh-CN': '翻译失败，请稍后再试。'
    },

    /* ---------- Services ---------- */
    'svc.eyebrow': { en: 'OUR SERVICES', fr: 'NOS SERVICES', de: 'UNSERE LEISTUNGEN', es: 'NUESTROS SERVICIOS', ja: 'サービス', ko: '서비스', 'zh-TW': '我們的服務', 'zh-CN': '我们的服务' },
    'svc.title': {
      en: 'Choose Your Way', fr: 'Choisissez votre formule', de: 'Wählen Sie Ihren Weg',
      es: 'Elija su modalidad', ja: 'お選びください', ko: '방식을 선택하세요',
      'zh-TW': '選擇你的定制方式', 'zh-CN': '选择你的定制方式'
    },
    'svc.sub': {
      en: 'Two clear paths — modeling from your drawings, or full design with our atelier',
      fr: 'Deux parcours clairs — modelage depuis vos dessins, ou design complet avec notre atelier',
      de: 'Zwei klare Wege — Modellierung nach Ihren Zeichnungen oder volles Design mit unserem Atelier',
      es: 'Dos caminos claros: modelado desde sus dibujos, o diseño completo con nuestro atelier',
      ja: '二つの道 — お持ちの図面からモデリング、またはアトリエでのフルデザイン',
      ko: '두 가지 길 — 도면 기반 모델링, 또는 아틀리에 풀 디자인',
      'zh-TW': '兩條清晰路徑 — 來圖建模，或與工作室一起完整設計',
      'zh-CN': '两条清晰路径 — 来图建模，或与工作室一起完整设计'
    },
    'svc.custom.title': {
      en: 'Bring Your Design', fr: 'Apportez votre design', de: 'Eigenes Design',
      es: 'Traiga su diseño', ja: 'お手持ちのデザイン', ko: '도면 직접 제출',
      'zh-TW': '來圖定制', 'zh-CN': '来图定制'
    },
    'svc.custom.desc': {
      en: 'You already have drawings. We model and produce — no designer consultation included.',
      fr: 'Vous avez déjà des dessins. Nous modélisons et produisons — sans consultation designer.',
      de: 'Sie haben bereits Zeichnungen. Wir modellieren und fertigen — ohne Designer-Beratung.',
      es: 'Ya tiene dibujos. Modelamos y producimos — sin consulta de diseñador.',
      ja: '設計図をお持ちの方向け。モデリングと制作のみ — デザイナー相談は含みません。',
      ko: '도면이 있는 경우. 모델링과 제작만 진행 — 디자이너 상담은 포함되지 않습니다.',
      'zh-TW': '您已有設計圖。我們負責建模與制作 — 不含設計師一對一服務。',
      'zh-CN': '您已有设计图。我们负责建模与制作 — 不含设计师一对一服务。'
    },
    'path.flow': {
      en: 'Your journey', fr: 'Votre parcours', de: 'Ihr Ablauf', es: 'Su recorrido',
      ja: 'ご案内の流れ', ko: '진행 과정', 'zh-TW': '流程說明', 'zh-CN': '流程说明'
    },
    'path.custom.tag': {
      en: 'Modeling path', fr: 'Parcours modelage', de: 'Modellierungspfad', es: 'Ruta de modelado',
      ja: 'モデリングコース', ko: '모델링 코스', 'zh-TW': '建模路徑', 'zh-CN': '建模路径'
    },
    'path.custom.in1': {
      en: 'Upload your drawings & brief', fr: 'Envoyez dessins et brief', de: 'Zeichnungen & Brief hochladen',
      es: 'Suba dibujos y brief', ja: '図面と要望をアップロード', ko: '도면과 요구사항 업로드',
      'zh-TW': '上傳設計圖與需求說明', 'zh-CN': '上传设计图与需求说明'
    },
    'path.custom.in2': {
      en: 'Dedicated order chat with our team', fr: 'Chat de commande dédié', de: 'Eigener Bestell-Chat',
      es: 'Chat de pedido dedicado', ja: '専用の注文チャット', ko: '전용 주문 채팅',
      'zh-TW': '專屬訂單群聊對接團隊', 'zh-CN': '专属订单群聊对接团队'
    },
    'path.custom.in3': {
      en: '3D modeling, production & shipping', fr: 'Modélisation 3D, production et envoi',
      de: '3D-Modellierung, Produktion & Versand', es: 'Modelado 3D, producción y envío',
      ja: '3Dモデリング・制作・配送', ko: '3D 모델링·제작·배송',
      'zh-TW': '3D 建模、制作與配送', 'zh-CN': '3D 建模、制作与配送'
    },
    'path.custom.out1': {
      en: 'No one-on-one designer service', fr: 'Sans consultation designer individuelle',
      de: 'Ohne 1:1-Designer-Service', es: 'Sin servicio de diseñador 1:1',
      ja: 'デザイナー一対一サービスなし', ko: '디자이너 1:1 상담 없음',
      'zh-TW': '不含設計師一對一服務', 'zh-CN': '不含设计师一对一服务'
    },
    'path.custom.s1.title': {
      en: 'Share drawings', fr: 'Partager les dessins', de: 'Zeichnungen teilen', es: 'Compartir dibujos',
      ja: '図面を共有', ko: '도면 공유', 'zh-TW': '提交來圖', 'zh-CN': '提交来图'
    },
    'path.custom.s1.desc': {
      en: 'Upload references and describe materials, size and budget.',
      fr: 'Uploadez vos références et précisez matériaux, taille et budget.',
      de: 'Referenzen hochladen und Material, Größe und Budget angeben.',
      es: 'Suba referencias y describa materiales, talla y presupuesto.',
      ja: '参考画像を上げ、素材・サイズ・予算を伝えます。',
      ko: '참고 이미지를 올리고 소재·사이즈·예산을 알려 주세요.',
      'zh-TW': '上傳參考圖，並說明材質、尺寸與預算。',
      'zh-CN': '上传参考图，并说明材质、尺寸与预算。'
    },
    'path.custom.s2.title': {
      en: 'Pay deposit', fr: 'Verser l’acompte', de: 'Anzahlung zahlen', es: 'Pagar depósito',
      ja: '内金を支払う', ko: '예약금 결제', 'zh-TW': '支付定金', 'zh-CN': '支付定金'
    },
    'path.custom.s2.desc': {
      en: '$99 unlocks your order workspace — sales support, no designer seat.',
      fr: '99 $ ouvre votre espace — support commercial, sans designer.',
      de: '99 $ öffnet Ihren Arbeitsraum — Vertrieb, ohne Designer.',
      es: '99 $ abre su espacio — soporte comercial, sin diseñador.',
      ja: '99ドルで注文ワークスペースを開放 — 営業サポート、デザイナー席なし。',
      ko: '99달러로 주문 워크스페이스 오픈 — 영업 지원, 디자이너 좌석 없음.',
      'zh-TW': '99 美元解鎖訂單工作台 — 售中對接，不含設計師席位。',
      'zh-CN': '99 美元解锁订单工作台 — 售中对接，不含设计师席位。'
    },
    'path.custom.s3.title': {
      en: 'Modeling confirm', fr: 'Valider le modelage', de: 'Modellierung bestätigen', es: 'Confirmar modelado',
      ja: 'モデリング確認', ko: '모델링 확인', 'zh-TW': '建模確認', 'zh-CN': '建模确认'
    },
    'path.custom.s3.desc': {
      en: 'Review the 3D model against your drawings before production.',
      fr: 'Vérifiez le modèle 3D par rapport à vos dessins avant production.',
      de: 'Prüfen Sie das 3D-Modell anhand Ihrer Zeichnungen vor der Produktion.',
      es: 'Revise el modelo 3D frente a sus dibujos antes de producir.',
      ja: '制作前に3Dモデルを図面と照合して確認します。',
      ko: '제작 전 3D 모델을 도면과 대조해 확인합니다.',
      'zh-TW': '生產前對照來圖審核 3D 模型。',
      'zh-CN': '生产前对照来图审核 3D 模型。'
    },
    'path.custom.s4.title': {
      en: 'Produce & deliver', fr: 'Produire & livrer', de: 'Fertigen & liefern', es: 'Producir y entregar',
      ja: '制作・納品', ko: '제작·배송', 'zh-TW': '制作交付', 'zh-CN': '制作交付'
    },
    'path.custom.s4.desc': {
      en: 'Craft, settle the balance, and receive with lifetime care.',
      fr: 'Fabrication, solde final, puis livraison avec entretien à vie.',
      de: 'Fertigung, Restzahlung und Lieferung mit lebenslanger Pflege.',
      es: 'Fabricación, saldo final y entrega con cuidado de por vida.',
      ja: '制作・残金決済・納品。生涯アフターケア付き。',
      ko: '제작·잔금 결제·배송. 평생 케어 포함.',
      'zh-TW': '制作、結清尾款並交付，含終身保養。',
      'zh-CN': '制作、结清尾款并交付，含终身保养。'
    },
    'path.designer.tag': {
      en: 'Design path', fr: 'Parcours design', de: 'Designpfad', es: 'Ruta de diseño',
      ja: 'デザインコース', ko: '디자인 코스', 'zh-TW': '設計路徑', 'zh-CN': '设计路径'
    },
    'path.designer.in1': {
      en: 'One-on-one designer consultation', fr: 'Consultation designer en tête-à-tête',
      de: '1:1-Designer-Beratung', es: 'Consulta 1:1 con diseñador',
      ja: 'デザイナー一対一相談', ko: '디자이너 1:1 상담',
      'zh-TW': '設計師一對一諮詢', 'zh-CN': '设计师一对一咨询'
    },
    'path.designer.in2': {
      en: 'Sketches & 3D design preview', fr: 'Croquis et aperçu 3D', de: 'Skizzen & 3D-Vorschau',
      es: 'Bocetos y vista 3D', ja: 'デザイン画と3Dプレビュー', ko: '스케치와 3D 미리보기',
      'zh-TW': '設計手稿與 3D 預覽', 'zh-CN': '设计手稿与 3D 预览'
    },
    'path.designer.in3': {
      en: 'Modeling, production & shipping', fr: 'Modelage, production et envoi',
      de: 'Modellierung, Produktion & Versand', es: 'Modelado, producción y envío',
      ja: 'モデリング・制作・配送', ko: '모델링·제작·배송',
      'zh-TW': '建模、制作與配送', 'zh-CN': '建模、制作与配送'
    },
    'path.designer.in4': {
      en: 'Dedicated order chat with your team', fr: 'Chat de commande dédié',
      de: 'Eigener Bestell-Chat mit Ihrem Team', es: 'Chat de pedido con su equipo',
      ja: '専用チームとの注文チャット', ko: '전담 팀과의 주문 채팅',
      'zh-TW': '專屬訂單群聊對接團隊', 'zh-CN': '专属订单群聊对接团队'
    },
    'path.designer.s1.title': {
      en: 'Pay deposit', fr: 'Verser l’acompte', de: 'Anzahlung zahlen', es: 'Pagar depósito',
      ja: '内金を支払う', ko: '예약금 결제', 'zh-TW': '支付定金', 'zh-CN': '支付定金'
    },
    'path.designer.s1.desc': {
      en: '$199 opens your workspace with a designer already on the team.',
      fr: '199 $ ouvre votre espace avec un designer déjà dans l’équipe.',
      de: '199 $ öffnet Ihren Raum — Designer ist bereits im Team.',
      es: '199 $ abre su espacio con un diseñador ya en el equipo.',
      ja: '199ドルでワークスペースを開放 — デザイナーが最初から参加。',
      ko: '199달러로 워크스페이스 오픈 — 디자이너가 처음부터 합류.',
      'zh-TW': '199 美元開啟工作台，設計師從一開始就在群內。',
      'zh-CN': '199 美元开启工作台，设计师从一开始就在群内。'
    },
    'path.designer.s2.title': {
      en: 'Consult', fr: 'Consultation', de: 'Beratung', es: 'Consulta',
      ja: '相談', ko: '상담', 'zh-TW': '一對一溝通', 'zh-CN': '一对一沟通'
    },
    'path.designer.s2.desc': {
      en: 'One-on-one on style, stones, metal and budget.',
      fr: 'Échange individuel sur style, pierres, métal et budget.',
      de: '1:1 zu Stil, Steinen, Metall und Budget.',
      es: 'Cara a cara sobre estilo, piedras, metal y presupuesto.',
      ja: 'スタイル・宝石・金属・予算を一対一で相談。',
      ko: '스타일·원석·메탈·예산을 1:1로 상담.',
      'zh-TW': '就風格、寶石、金屬與預算一對一溝通。',
      'zh-CN': '就风格、宝石、金属与预算一对一沟通。'
    },
    'path.designer.s3.title': {
      en: 'Design confirm', fr: 'Valider le design', de: 'Design bestätigen', es: 'Confirmar diseño',
      ja: 'デザイン確認', ko: '디자인 확인', 'zh-TW': '設計確認', 'zh-CN': '设计确认'
    },
    'path.designer.s3.desc': {
      en: 'Review sketches and 3D proposals until you approve the look.',
      fr: 'Relisez croquis et propositions 3D jusqu’à validation.',
      de: 'Skizzen und 3D-Vorschläge prüfen, bis Sie zustimmen.',
      es: 'Revise bocetos y propuestas 3D hasta aprobar el look.',
      ja: 'デザイン画と3D提案を確認し、承認するまで調整します。',
      ko: '스케치와 3D 제안을 확인하며 승인할 때까지 조정합니다.',
      'zh-TW': '審閱手稿與 3D 方案，確認造型後再進入下一步。',
      'zh-CN': '审阅手稿与 3D 方案，确认造型后再进入下一步。'
    },
    'path.designer.s4.title': {
      en: 'Model & produce', fr: 'Modeler & produire', de: 'Modellieren & fertigen', es: 'Modelar y producir',
      ja: 'モデリング・制作', ko: '모델링·제작', 'zh-TW': '建模制作', 'zh-CN': '建模制作'
    },
    'path.designer.s4.desc': {
      en: 'Modeling lock-in, then atelier production.',
      fr: 'Verrouillage du modelage, puis production en atelier.',
      de: 'Modellierung fixieren, dann Atelierfertigung.',
      es: 'Cierre de modelado y luego producción en atelier.',
      ja: 'モデリング確定後、工房で制作します。',
      ko: '모델링 확정 후 공방에서 제작합니다.',
      'zh-TW': '鎖定建模後進入工藝制作。',
      'zh-CN': '锁定建模后进入工艺制作。'
    },
    'path.designer.s5.title': {
      en: 'Deliver', fr: 'Livrer', de: 'Liefern', es: 'Entregar',
      ja: '納品', ko: '배송', 'zh-TW': '交付', 'zh-CN': '交付'
    },
    'path.designer.s5.desc': {
      en: 'Final settlement, shipping, and lifetime care.',
      fr: 'Solde final, envoi et entretien à vie.',
      de: 'Restzahlung, Versand und lebenslange Pflege.',
      es: 'Liquidación final, envío y cuidado de por vida.',
      ja: '残金決済・配送・生涯アフターケア。',
      ko: '잔금 결제·배송·평생 케어.',
      'zh-TW': '結清尾款、發貨與終身保養。',
      'zh-CN': '结清尾款、发货与终身保养。'
    },
    'svc.custom.note': {
      en: 'Note: your drawing may not meet production standards, and the finished piece may deviate slightly from the design.',
      fr: 'Note : votre dessin peut ne pas respecter les normes de production et la pièce peut légèrement différer.',
      de: 'Hinweis: Ihr Entwurf entspricht möglicherweise nicht den Produktionsstandards, das Stück kann leicht abweichen.',
      es: 'Nota: su dibujo puede no cumplir los estándares de producción y la pieza puede desviarse ligeramente.',
      ja: '注意：設計図が生産基準を満たさない場合があり、完成品に若干の差異が生じることがあります。',
      ko: '참고: 도면이 생산 기준에 부합하지 않을 수 있으며, 완성품에 약간의 차이가 있을 수 있습니다.',
      'zh-TW': '注意：設計圖可能不符合生產標準，成品可能存在一定偏差。',
      'zh-CN': '注意：设计图可能不符合生产标准，成品可能存在一定偏差。'
    },
    'svc.custom.price': { en: '$99', fr: '99 $', de: '99 $', es: '99 $', ja: '$99', ko: '$99', 'zh-TW': '99美元', 'zh-CN': '99美元' },
    'svc.designer.title': {
      en: 'Designer Design', fr: 'Design par designer', de: 'Designer-Entwurf',
      es: 'Diseño por diseñador', ja: 'デザイナー設計', ko: '디자이너 디자인',
      'zh-TW': '設計師設計', 'zh-CN': '设计师设计'
    },
    'svc.designer.desc': {
      en: 'Start from inspiration. A designer shapes the piece with you before modeling.',
      fr: 'Parte de l’inspiration. Un designer façonne la pièce avec vous avant le modelage.',
      de: 'Starten Sie mit Inspiration. Ein Designer formt das Stück mit Ihnen vor der Modellierung.',
      es: 'Parta de la inspiración. Un diseñador da forma a la pieza con usted antes del modelado.',
      ja: '着想から始め、モデリング前にデザイナーと一緒に形を決めます。',
      ko: '영감에서 시작해 모델링 전에 디자이너와 함께 형태를 잡습니다.',
      'zh-TW': '從靈感出發，建模前由設計師與您一起打磨造型。',
      'zh-CN': '从灵感出发，建模前由设计师与您一起打磨造型。'
    },
    'svc.designer.note': {
      en: 'Includes one-on-one consultation, sketches and 3D preview before production.',
      fr: 'Comprend consultation individuelle, croquis et aperçu 3D avant production.',
      de: 'Inklusive Einzelberatung, Skizzen und 3D-Vorschau vor der Produktion.',
      es: 'Incluye consulta individual, bocetos y vista 3D antes de producir.',
      ja: '制作前に一対一相談・デザイン画・3Dプレビューを含みます。',
      ko: '제작 전 1:1 상담, 스케치, 3D 미리보기가 포함됩니다.',
      'zh-TW': '包含一對一諮詢、設計手稿與製作前3D預覽。',
      'zh-CN': '包含一对一咨询、设计手稿与制作前3D预览。'
    },
    'svc.designer.price': { en: '$199', fr: '199 $', de: '199 $', es: '199 $', ja: '$199', ko: '$199', 'zh-TW': '199美元', 'zh-CN': '199美元' },
    'svc.deposit': { en: 'deposit', fr: 'acompte', de: 'Anzahlung', es: 'depósito', ja: '内金', ko: '예약금', 'zh-TW': '定金', 'zh-CN': '定金' },
    'svc.select': { en: 'Select & Pay', fr: 'Choisir & payer', de: 'Auswählen & zahlen', es: 'Seleccionar y pagar', ja: '選択して支払う', ko: '선택 및 결제', 'zh-TW': '選擇並支付', 'zh-CN': '选择并支付' },
    'svc.popular': { en: 'Most popular', fr: 'Le plus choisi', de: 'Am beliebtesten', es: 'Más popular', ja: '人気No.1', ko: '가장 인기', 'zh-TW': '最受歡迎', 'zh-CN': '最受欢迎' },
    'svc.guarantee': {
      en: 'Fully refundable before production starts', fr: 'Remboursable avant le début de la production',
      de: 'Vor Produktionsbeginn voll erstattbar', es: 'Reembolsable antes de producir',
      ja: '制作開始前は全額返金', ko: '제작 시작 전 전액 환불',
      'zh-TW': '製作開始前可全額退款', 'zh-CN': '制作开始前可全额退款'
    },

    /* ---------- Login ---------- */
    'login.expired': {
      en: 'Your session has expired. Please sign in again.',
      fr: 'Votre session a expiré. Veuillez vous reconnecter.',
      de: 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
      es: 'Su sesión ha caducado. Vuelva a iniciar sesión.',
      ja: 'ログインの有効期限が切れました。再度ログインしてください。',
      ko: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
      'zh-TW': '登入已過期，請重新登入。',
      'zh-CN': '登录已过期，请重新登录。'
    },
    'login.title': {
      en: 'Sign in to continue', fr: 'Connectez-vous pour continuer', de: 'Anmelden zum Fortfahren',
      es: 'Inicie sesión para continuar', ja: '続行するにはログイン', ko: '계속하려면 로그인하세요',
      'zh-TW': '登入以繼續', 'zh-CN': '登录以继续'
    },
    'login.sub': {
      en: 'Sign in is required before placing your deposit', fr: 'La connexion est requise avant de verser un acompte',
      de: 'Vor der Anzahlung ist eine Anmeldung erforderlich', es: 'Debe iniciar sesión antes del depósito',
      ja: '内金の前にログインが必要です', ko: '예약금 결제 전 로그인이 필요합니다',
      'zh-TW': '支付定金前需先登入', 'zh-CN': '支付定金前需先登录'
    },
    'login.google': {
      en: 'Continue with Google', fr: 'Continuer avec Google', de: 'Mit Google fortfahren',
      es: 'Continuar con Google', ja: 'Googleで続ける', ko: 'Google로 계속',
      'zh-TW': '使用 Google 帳號登入', 'zh-CN': '使用 Google 账号登录'
    },
    'login.google.pending': {
      en: 'Google sign-in is coming soon. Please use email to continue.',
      fr: 'La connexion Google arrive bientôt. Veuillez utiliser l’e-mail.',
      de: 'Google-Anmeldung folgt in Kürze. Bitte E-Mail verwenden.',
      es: 'El inicio con Google estará disponible pronto. Use el correo.',
      ja: 'Googleログインは近日対応予定です。メールをご利用ください。',
      ko: 'Google 로그인은 곧 지원됩니다. 이메일을 이용해주세요.',
      'zh-TW': 'Google 登入即將上線，請使用郵箱繼續。',
      'zh-CN': 'Google 登录即将上线，请使用邮箱继续。'
    },
    'login.email': {
      en: 'Continue with Email', fr: 'Continuer avec e-mail', de: 'Mit E-Mail fortfahren',
      es: 'Continuar con correo', ja: 'メールで続ける', ko: '이메일로 계속',
      'zh-TW': '使用郵箱登入', 'zh-CN': '使用邮箱登录'
    },
    'login.email.ph': { en: 'you@example.com', fr: 'vous@exemple.com', de: 'sie@beispiel.de', es: 'tu@ejemplo.com', ja: 'you@example.com', ko: 'you@example.com', 'zh-TW': 'you@example.com', 'zh-CN': 'you@example.com' },
    'login.continue': { en: 'Continue', fr: 'Continuer', de: 'Weiter', es: 'Continuar', ja: '続ける', ko: '계속', 'zh-TW': '繼續', 'zh-CN': '继续' },
    'login.send': { en: 'Send code', fr: 'Envoyer', de: 'Code senden', es: 'Enviar código', ja: 'コード送信', ko: '코드 받기', 'zh-TW': '獲取驗證碼', 'zh-CN': '获取验证码' },
    'login.resend': { en: 'Resend', fr: 'Renvoyer', de: 'Erneut senden', es: 'Reenviar', ja: '再送信', ko: '다시 받기', 'zh-TW': '重新發送', 'zh-CN': '重新发送' },
    'login.submit': { en: 'Sign in', fr: 'Connexion', de: 'Anmelden', es: 'Entrar', ja: 'ログイン', ko: '로그인', 'zh-TW': '登入', 'zh-CN': '登录' },
    'login.or': { en: 'or', fr: 'ou', de: 'oder', es: 'o', ja: 'または', ko: '또는', 'zh-TW': '或', 'zh-CN': '或' },
    'login.code.ph': { en: 'Verification code', fr: 'Code de vérification', de: 'Bestätigungscode', es: 'Código de verificación', ja: '認証コード', ko: '인증 코드', 'zh-TW': '驗證碼', 'zh-CN': '验证码' },
    'login.code.label': { en: 'Enter the code from your email', 'zh-TW': '請輸入郵箱中的驗證碼', 'zh-CN': '请输入邮箱中的验证码' },
    'login.code.change': { en: 'Use a different email', 'zh-TW': '修改郵箱', 'zh-CN': '修改邮箱' },
    'login.verify': { en: 'Verify', fr: 'Vérifier', de: 'Bestätigen', es: 'Verificar', ja: '確認', ko: '확인', 'zh-TW': '驗證', 'zh-CN': '验证' },
    'login.code.sent': {
      en: 'Verification code sent to your email.',
      fr: 'Code de vérification envoyé à votre e-mail.',
      de: 'Bestätigungscode an Ihre E-Mail gesendet.',
      es: 'Código de verificación enviado a su correo.',
      ja: '認証コードをメールで送信しました。',
      ko: '인증 코드를 이메일로 보냈습니다.',
      'zh-TW': '驗證碼已發送至您的郵箱。',
      'zh-CN': '验证码已发送至您的邮箱。'
    },
    'login.code.error': {
      en: 'Failed to send or verify code. Please try again.',
      fr: 'Échec de l’envoi ou de la vérification. Veuillez réessayer.',
      de: 'Senden oder Prüfen fehlgeschlagen. Bitte erneut versuchen.',
      es: 'Error al enviar o verificar. Inténtelo de nuevo.',
      ja: '送信または検証に失敗しました。もう一度お試しください。',
      ko: '전송 또는 인증에 실패했습니다. 다시 시도해주세요.',
      'zh-TW': '發送或驗證失敗，請重試。',
      'zh-CN': '发送或验证失败，请重试。'
    },
    'login.close': { en: 'Close', fr: 'Fermer', de: 'Schließen', es: 'Cerrar', ja: '閉じる', ko: '닫기', 'zh-TW': '關閉', 'zh-CN': '关闭' },

    /* ---------- Checkout ---------- */
    'co.title': {
      en: 'Secure Your Order', fr: 'Réservez votre commande', de: 'Bestellung sichern',
      es: 'Asegure su pedido', ja: 'ご注文を確定', ko: '주문 확정',
      'zh-TW': '確認您的訂單', 'zh-CN': '确认您的订单'
    },
    'co.sub': {
      en: 'Pay your deposit to unlock the dedicated group chat', fr: 'Payez l’acompte pour débloquer le chat dédié',
      de: 'Zahlen Sie die Anzahlung für den Gruppenchat', es: 'Pague el depósito para desbloquear el chat',
      ja: '内金をお支払いいただくと専用チャットが利用可能に', ko: '예약금을 결제하면 전용 채팅이 열립니다',
      'zh-TW': '支付定金即可解鎖專屬群聊', 'zh-CN': '支付定金即可解锁专属群聊'
    },
    'co.summary': { en: 'Order summary', fr: 'Récapitulatif', de: 'Zusammenfassung', es: 'Resumen del pedido', ja: '注文内容', ko: '주문 요약', 'zh-TW': '訂單摘要', 'zh-CN': '订单摘要' },
    'co.service': { en: 'Service', fr: 'Service', de: 'Leistung', es: 'Servicio', ja: 'サービス', ko: '서비스', 'zh-TW': '服務', 'zh-CN': '服务' },
    'co.total': { en: 'Total due', fr: 'Total à payer', de: 'Fälliger Betrag', es: 'Total a pagar', ja: 'お支払い額', ko: '결제 금액', 'zh-TW': '應付金額', 'zh-CN': '应付金额' },
    'co.referral': { en: 'Referral code (optional)', fr: 'Code de parrainage (optionnel)', de: 'Empfehlungscode (optional)', es: 'Código de referido (opcional)', ja: '紹介コード（任意）', ko: '추천 코드 (선택)', 'zh-TW': '推廣碼（選填）', 'zh-CN': '推广码（选填）' },
    'co.referral.ph': { en: 'Friend’s code — they earn 5%', fr: 'Code d’un ami — il gagne 5 %', de: 'Code eines Freundes — er erhält 5 %', es: 'Código de un amigo — gana 5 %', ja: '友達のコード — 5%還元', ko: '친구 코드 — 5% 적립', 'zh-TW': '好友推廣碼，TA 可獲 5% 佣金', 'zh-CN': '好友推广码，TA 可获 5% 佣金' },
    'co.pieceCount': { en: 'How many jewelry pieces in this order?', fr: 'Nombre de pièces pour cette commande', de: 'Anzahl Schmuckstücke in dieser Bestellung', es: '¿Cuántas piezas en este pedido?', ja: '本注文のジュエリー点数', ko: '이 주문의 주얼리 개수', 'zh-TW': '本單珠寶件數', 'zh-CN': '本单珠宝件数' },
    'co.pieceCount.hint': {
      en: 'Each piece is designed and confirmed separately (e.g. two rings in a wedding set). Staff can rename pieces later.',
      fr: 'Chaque pièce est conçue et validée séparément. L’équipe pourra renommer les pièces ensuite.',
      de: 'Jedes Stück wird einzeln entworfen und bestätigt. Das Team kann die Stücke später umbenennen.',
      es: 'Cada pieza se diseña y confirma por separado. El equipo puede renombrarlas después.',
      ja: '各点数は別々にデザイン・確認します（結婚指輪セットなど）。後から名称変更できます。',
      ko: '각 개수는 따로 디자인·확인합니다. 이후 이름을 변경할 수 있습니다.',
      'zh-TW': '每件將分別設計與確認（如婚戒對戒）；後續可在訂單中重命名。',
      'zh-CN': '每件将分别设计与确认（如婚戒对戒）；后续可在订单中重命名。'
    },
    'co.pieceCount.opt1': { en: '1 piece', 'zh-CN': '1 件', 'zh-TW': '1 件' },
    'co.pieceCount.opt2': { en: '2 pieces', 'zh-CN': '2 件', 'zh-TW': '2 件' },
    'co.pieceCount.opt3': { en: '3 pieces', 'zh-CN': '3 件', 'zh-TW': '3 件' },
    'co.pieceCount.opt4': { en: '4 pieces', 'zh-CN': '4 件', 'zh-TW': '4 件' },
    'co.pieceCount.opt5': { en: '5 pieces', 'zh-CN': '5 件', 'zh-TW': '5 件' },
    'co.pay': { en: 'Pay deposit', fr: 'Payer l’acompte', de: 'Anzahlung zahlen', es: 'Pagar depósito', ja: '内金を支払う', ko: '예약금 결제', 'zh-TW': '支付定金', 'zh-CN': '支付定金' },
    'co.pay.busy': { en: 'Submitting…', 'zh-TW': '正在提交…', 'zh-CN': '正在提交…' },
    'co.referral.skipped': {
      en: 'This referral code cannot be used on your own order. The order will continue without it.',
      'zh-TW': '這個推廣碼不能用在您自己的訂單上，已忽略並繼續提交。',
      'zh-CN': '这个推广码不能用在您自己的订单上，已忽略并继续提交。'
    },
    'co.secure': { en: '256-bit encrypted · secure payment', fr: 'Chiffrement 256 bits · paiement sécurisé', de: '256-Bit-Verschlüsselung · sichere Zahlung', es: 'Cifrado de 256 bits · pago seguro', ja: '256bit暗号化 · 安全な決済', ko: '256비트 암호화 · 안전 결제', 'zh-TW': '256位元加密 · 安全支付', 'zh-CN': '256位加密 · 安全支付' },
    'co.back': { en: 'Back', fr: 'Retour', de: 'Zurück', es: 'Volver', ja: '戻る', ko: '뒤로', 'zh-TW': '返回', 'zh-CN': '返回' },
    'co.success': {
      en: 'Deposit received — your group chat is ready!', fr: 'Acompte reçu — votre chat est prêt !',
      de: 'Anzahlung erhalten — Ihr Chat ist bereit!', es: 'Depósito recibido — ¡su chat está listo!',
      ja: '内金を受領しました — チャットの準備ができました！', ko: '예약금 수령 완료 — 채팅이 준비되었습니다!',
      'zh-TW': '定金已收到 — 您的群聊已就緒！', 'zh-CN': '定金已收到 — 您的群聊已就绪！'
    },
    'co.enter': { en: 'Open this order chat', fr: 'Ouvrir le chat de cette commande', de: 'Zum Chat dieser Bestellung', es: 'Abrir el chat de este pedido', ja: 'この注文のチャットを開く', ko: '이 주문 채팅 열기', 'zh-TW': '進入這單群聊', 'zh-CN': '进入这单群聊' },
    'co.requirements.label': { en: 'Describe your requirements', fr: 'Décrivez vos besoins', de: 'Beschreiben Sie Ihre Anforderungen', es: 'Describa sus requisitos', ja: 'ご要望を記入', ko: '요구사항을 설명하세요', 'zh-TW': '描述您的需求', 'zh-CN': '描述您的需求' },
    'co.requirements.ph': { en: 'e.g. 18K gold diamond ring, size 12, princess cut…', fr: 'ex. bague diamant or 18K, taille 12…', de: 'z.B. 18K Gold-Diamantring, Größe 12…', es: 'ej. anillo de diamante oro 18K, talla 12…', ja: '例：18Kゴールド ダイヤリング 12号…', ko: '예: 18K 골드 다이아 반지 12호…', 'zh-TW': '例：18K金鑽石戒指 12號…', 'zh-CN': '例：18K金钻石戒指 12号…' },
    'co.requirements.material': { en: 'Material / style (optional)', fr: 'Matériau / style (optionnel)', de: 'Material / Stil (optional)', es: 'Material / estilo (opcional)', ja: '素材 / スタイル（任意）', ko: '소재 / 스타일 (선택)', 'zh-TW': '材質 / 款式（可選）', 'zh-CN': '材质 / 款式（可选）' },
    'co.requirements.material.ph': { en: 'e.g. 18K white gold, halo setting', fr: 'ex. or blanc 18K, halo', de: 'z.B. 18K Weißgold, Halo-Fassung', es: 'ej. oro blanco 18K, halo', ja: '例：18Kホワイトゴールド ハロー', ko: '예: 18K 화이트골드, 헤일로', 'zh-TW': '例：18K白金 光環鑲嵌', 'zh-CN': '例：18K白金 光环镶嵌' },
    'co.requirements.image': { en: 'Reference images (up to 5)', fr: 'Images de référence (jusqu’à 5)', de: 'Referenzbilder (bis zu 5)', es: 'Imágenes de referencia (hasta 5)', ja: '参考画像（最大5枚）', ko: '참고 이미지 (최대 5장)', 'zh-TW': '參考圖（最多5張）', 'zh-CN': '参考图（最多5张）' },
    'co.requirements.image.upload': { en: 'Click or drag images here · up to 5', fr: 'Cliquez ou déposez des images · jusqu’à 5', de: 'Klicken oder ziehen · bis zu 5 Bilder', es: 'Haz clic o arrastra imágenes · hasta 5', ja: 'クリックまたはドラッグで画像 · 最大5枚', ko: '클릭 또는 드래그로 이미지 · 최대 5장', 'zh-TW': '點擊或拖曳圖片 · 最多5張', 'zh-CN': '点击或拖拽图片 · 最多5张' },
    'co.requirements.image.max': { en: 'You can upload up to 5 images', fr: 'Vous pouvez téléverser jusqu’à 5 images', de: 'Sie können bis zu 5 Bilder hochladen', es: 'Puede subir hasta 5 imágenes', ja: '最大5枚までアップロードできます', ko: '최대 5장까지 업로드할 수 있습니다', 'zh-TW': '最多可上傳5張圖片', 'zh-CN': '最多可上传5张图片' },
    'co.requirements.image.remove': { en: 'Remove', fr: 'Supprimer', de: 'Entfernen', es: 'Eliminar', ja: '削除', ko: '삭제', 'zh-TW': '刪除', 'zh-CN': '删除' },
    'co.login.required': {
      en: 'Please sign in before paying your deposit.',
      fr: 'Veuillez vous connecter avant de payer l’acompte.',
      de: 'Bitte melden Sie sich vor der Anzahlung an.',
      es: 'Inicie sesión antes de pagar el depósito.',
      ja: '内金の前にお支払いください。',
      ko: '예약금 결제 전 로그인해주세요.',
      'zh-TW': '支付定金前請先登入。',
      'zh-CN': '支付定金前请先登录。'
    },

    /* ---------- AI Assistant ---------- */
    'ai.title': { en: 'AI Assistant', fr: 'Assistant IA', de: 'KI-Assistent', es: 'Asistente IA', ja: 'AIアシスタント', ko: 'AI 어시스턴트', 'zh-TW': 'AI智能客服', 'zh-CN': 'AI智能客服' },
    'ai.status': { en: 'AI online · instant reply', fr: 'IA en ligne · réponse instantanée', de: 'KI online · Sofortantwort', es: 'IA en línea · respuesta instantánea', ja: 'AIオンライン · 即時返信', ko: 'AI 온라인 · 즉시 답변', 'zh-TW': 'AI在線 · 即時回覆', 'zh-CN': 'AI在线 · 即时回复' },
    'ai.welcome': {
      en: 'Hi! I’m the duxury AI assistant. I can answer questions about services, deposits and the process before you order.',
      fr: 'Bonjour ! Je suis l’assistant IA de duxury. Je réponds à vos questions avant commande.',
      de: 'Hallo! Ich bin der duxury-KI-Assistent. Ich beantworte Ihre Fragen vor der Bestellung.',
      es: '¡Hola! Soy el asistente IA de duxury. Respondo sus dudas antes de pedir.',
      ja: 'こんにちは！duxury のAIアシスタントです。ご注文前にサービス・内金・工程についてお答えします。',
      ko: '안녕하세요! duxury AI 어시스턴트입니다. 주문 전 서비스·예약금·프로세스를 안내해 드립니다.',
      'zh-TW': '您好！我是 duxury 的AI智能客服，付款前可為您解答服務、定金與流程相關問題。',
      'zh-CN': '您好！我是 duxury 的AI智能客服，付款前可为您解答服务、定金与流程相关问题。'
    },
    'ai.reply': {
      en: 'Thanks for reaching out! You can choose a service and pay a deposit to unlock your dedicated design team.',
      fr: 'Merci ! Choisissez un service et versez un acompte pour débloquer votre équipe.',
      de: 'Danke! Wählen Sie einen Service und zahlen Sie eine Anzahlung.',
      es: '¡Gracias! Elija un servicio y pague un depósito para desbloquear su equipo.',
      ja: 'ありがとうございます！サービスを選択して内金をお支払いいただくと、専用チームをご利用いただけます。',
      ko: '감사합니다! 서비스를 선택하고 예약금을 결제하면 전담 팀을 이용하실 수 있습니다.',
      'zh-TW': '感謝您的諮詢！選擇服務並支付定金，即可解鎖專屬設計團隊。',
      'zh-CN': '感谢您的咨询！选择服务并支付定金，即可解锁专属设计团队。'
    },
    'ai.redirect': {
      en: 'Please choose a service below and pay a deposit to open your dedicated order chat with our team.',
      fr: 'Veuillez choisir un service ci-dessous et verser un acompte pour ouvrir votre chat dédié.',
      de: 'Wählen Sie unten einen Service und zahlen Sie eine Anzahlung, um Ihren Bestell-Chat zu öffnen.',
      es: 'Elija un servicio y pague un depósito para abrir su chat de pedido dedicado.',
      ja: '下のサービスを選択して内金をお支払いいただくと、専用の注文チャットが開設されます。',
      ko: '아래 서비스를 선택하고 예약금을 결제하면 전용 주문 채팅이 열립니다.',
      'zh-TW': '請選擇下方服務並支付定金，即可開啟您的專屬訂單群聊。',
      'zh-CN': '请选择下方服务并支付定金，即可开启您的专属订单群聊。'
    },

    /* ---------- Gate ---------- */
    'gate.title': {
      en: 'Sign in to view your orders', fr: 'Connectez-vous pour voir vos commandes',
      de: 'Anmelden, um Bestellungen zu sehen', es: 'Inicie sesión para ver sus pedidos',
      ja: 'ログインして注文を見る', ko: '로그인하여 주문 보기',
      'zh-TW': '登入查看您的訂單', 'zh-CN': '登录查看您的订单'
    },
    'gate.desc': {
      en: 'Sign in with your email to view your orders and chat with our team.', fr: 'Connectez-vous avec votre e-mail pour voir vos commandes et discuter avec notre équipe.',
      de: 'Melden Sie sich mit Ihrer E-Mail an, um Bestellungen zu sehen und mit unserem Team zu chatten.', es: 'Inicie sesión con su correo para ver sus pedidos y chatear con nuestro equipo.',
      ja: 'メールでログインして、注文の確認とチームとのチャットができます。', ko: '이메일로 로그인하여 주문을 확인하고 팀과 채팅하세요.',
      'zh-TW': '使用郵箱登入，即可查看您的訂單並與團隊溝通。', 'zh-CN': '使用邮箱登录，即可查看您的订单并与团队沟通。'
    },
    'gate.cta': {
      en: 'Sign in to view my orders', fr: 'Se connecter pour voir mes commandes',
      de: 'Anmelden, um meine Bestellungen zu sehen', es: 'Iniciar sesión para ver mis pedidos',
      ja: 'ログインして注文を見る', ko: '로그인하여 내 주문 보기',
      'zh-TW': '登入查看我的訂單', 'zh-CN': '登录并查看我的订单'
    },

    /* ---------- Storefront ---------- */
    'shop.eyebrow': { en: 'MAKER SHOP', fr: 'BOUTIQUE', de: 'SHOP', es: 'TIENDA', ja: 'ショップ', ko: '스토어', 'zh-TW': '創作者商城', 'zh-CN': '创作者商城' },
    'shop.title': { en: 'Pieces from our community', fr: 'Créations de la communauté', de: 'Werke aus der Community', es: 'Piezas de la comunidad', ja: 'コミュニティの作品', ko: '커뮤니티 작품', 'zh-TW': '來自社區創作者的作品', 'zh-CN': '来自社区创作者的作品' },
    'shop.sub': { en: 'Buy a published design. The studio produces and ships it for you.', fr: 'Achetez un design publié. L’atelier produit et expédie.', de: 'Kaufe ein veröffentlichtes Design. Das Atelier produziert und versendet.', es: 'Compra un diseño publicado. El taller produce y envía.', ja: '公開されたデザインを購入。工房が製作・発送します。', ko: '게시된 디자인을 구매하세요. 공방이 제작하고 배송합니다.', 'zh-TW': '購買已上架的設計，由工坊代工生產並郵寄。', 'zh-CN': '购买已上架的设计，由工坊代工生产并邮寄。' },
    'shop.empty': { en: 'No pieces listed yet.', fr: 'Aucun article pour le moment.', de: 'Noch keine Stücke.', es: 'Aún no hay piezas.', ja: 'まだ出品がありません。', ko: '아직 상품이 없습니다.', 'zh-TW': '暫無上架作品。', 'zh-CN': '暂无上架作品。' },
    'shop.sold': { en: 'sold', fr: 'vendu', de: 'verkauft', es: 'vendido', ja: '販売', ko: '판매', 'zh-TW': '已售', 'zh-CN': '已售' },
    'shopcta.eyebrow': { en: 'BESPOKE SERVICE', fr: 'SERVICE SUR MESURE', de: 'MASSANFERTIGUNG', es: 'SERVICIO A MEDIDA', ja: 'オーダーメイド', ko: '맞춤 서비스', 'zh-TW': '專屬定制服務', 'zh-CN': '专属定制服务' },
    'shopcta.title': { en: 'Want a one-of-a-kind design made just for you?', fr: 'Envie d’un design unique, rien que pour vous ?', de: 'Wünschen Sie ein Unikat, nur für Sie gefertigt?', es: '¿Quiere un diseño único, hecho solo para usted?', ja: '世界にひとつだけのデザインをお探しですか？', ko: '세상에 하나뿐인 나만의 디자인을 원하시나요?', 'zh-TW': '想要獨一無二的專屬設計？', 'zh-CN': '想要独一无二的专属设计？' },
    'shopcta.desc': { en: 'Our designers craft it for you — one-on-one, from inspiration to finished piece.', fr: 'Nos designers le créent pour vous, en tête-à-tête, de l’inspiration à la pièce finale.', de: 'Unsere Designer fertigen es für Sie — persönlich, von der Inspiration bis zum fertigen Stück.', es: 'Nuestros diseñadores lo crean para usted, uno a uno, de la inspiración a la pieza final.', ja: 'デザイナーが一対一で、着想から完成までお仕立てします。', ko: '디자이너가 1:1로 영감부터 완성까지 맞춤 제작해 드립니다.', 'zh-TW': '我們的設計師為您量身定制，從靈感到成品一對一服務。', 'zh-CN': '我们的设计师为你量身定制，从灵感到成品一对一服务。' },
    'shopcta.btn': { en: 'Start Custom', fr: 'Commencer', de: 'Jetzt starten', es: 'Empezar', ja: '定制を始める', ko: '맞춤 시작하기', 'zh-TW': '開始定制', 'zh-CN': '开始定制' },
    'shop.fees': { en: 'Studio production & shipping (reference)', fr: 'Production et envoi (indicatif)', de: 'Produktion & Versand (Richtwert)', es: 'Producción y envío (referencia)', ja: '製作・発送費（目安）', ko: '제작·배송비(참고)', 'zh-TW': '工坊代工與代郵參考價', 'zh-CN': '工坊代工与代邮参考价' },
    'shop.prod': { en: 'Production', fr: 'Production', de: 'Produktion', es: 'Producción', ja: '製作', ko: '제작', 'zh-TW': '代工', 'zh-CN': '代工' },
    'shop.ship': { en: 'Shipping', fr: 'Livraison', de: 'Versand', es: 'Envío', ja: '発送', ko: '배송', 'zh-TW': '代郵', 'zh-CN': '代邮' },
    'shop.buy': { en: 'Buy now', fr: 'Acheter', de: 'Jetzt kaufen', es: 'Comprar', ja: '購入する', ko: '구매하기', 'zh-TW': '立即購買', 'zh-CN': '立即购买' },
    'shop.pay.mock': { en: 'Mock payment — you will be charged the sale price in full.', fr: 'Paiement simulé — le prix de vente est débité en totalité.', de: 'Simulierte Zahlung — der Verkaufspreis wird vollständig belastet.', es: 'Pago simulado: se cobra el precio de venta completo.', ja: '模擬決済 — 販売価格を全額お支払いいただきます。', ko: '모의 결제 — 판매가가 전액 결제됩니다.', 'zh-TW': '模擬支付 — 將按售價全額扣款。', 'zh-CN': '模拟支付 — 将按售价全额扣款。' },
    'shop.addr': { en: 'Shipping address', fr: 'Adresse de livraison', de: 'Lieferadresse', es: 'Dirección de envío', ja: '配送先', ko: '배송지', 'zh-TW': '收貨地址', 'zh-CN': '收货地址' },
    'shop.type': { en: 'Type', fr: 'Type', de: 'Typ', es: 'Tipo', ja: 'タイプ', ko: '유형', 'zh-TW': '類型', 'zh-CN': '类型' },
    'shop.filter.all': { en: 'All types', fr: 'Tous', de: 'Alle', es: 'Todos', ja: 'すべて', ko: '전체', 'zh-TW': '全部類型', 'zh-CN': '全部类型' },
    'shop.search.ph': {
      en: 'Search title, maker or type…', fr: 'Rechercher titre, créateur ou type…',
      de: 'Titel, Maker oder Typ suchen…', es: 'Buscar título, creador o tipo…',
      ja: 'タイトル・作者・タイプで検索…', ko: '제목·메이커·유형 검색…',
      'zh-TW': '搜尋標題、作者或類型…', 'zh-CN': '搜索标题、作者或类型…'
    },
    'shop.back': {
      en: 'Back to shop', fr: 'Retour à la boutique', de: 'Zurück zum Shop', es: 'Volver a la tienda',
      ja: 'ショップに戻る', ko: '스토어로 돌아가기', 'zh-TW': '返回商城', 'zh-CN': '返回商城'
    },
    'shop.size.ring': { en: 'Finger size', fr: 'Taille de doigt', de: 'Ringgröße', es: 'Talla de anillo', ja: '指輪のサイズ', ko: '반지 사이즈', 'zh-TW': '手寸', 'zh-CN': '手寸' },
    'shop.size.ring.ph': { en: 'Required for rings, e.g. US 7 or HK 14', fr: 'Obligatoire pour les bagues', de: 'Pflichtangabe für Ringe', es: 'Obligatorio en anillos', ja: '指輪は必須', ko: '반지는 필수', 'zh-TW': '戒指必填，如港碼 14', 'zh-CN': '戒指必填，如港码 14' },
    'shop.size.chain': { en: 'Chain length', fr: 'Longueur de chaîne', de: 'Kettenlänge', es: 'Longitud de cadena', ja: 'チェーンの長さ', ko: '체인 길이', 'zh-TW': '鏈長', 'zh-CN': '链长' },
    'shop.size.chain.ph': { en: 'Optional, e.g. 40 cm', fr: 'Optionnel', de: 'Optional', es: 'Opcional', ja: '任意', ko: '선택', 'zh-TW': '選填，如 45cm', 'zh-CN': '选填，如 45cm' },
    'shop.size.generic': { en: 'Size', fr: 'Taille', de: 'Größe', es: 'Talla', ja: 'サイズ', ko: '사이즈', 'zh-TW': '規格', 'zh-CN': '规格' },
    'shop.size.generic.ph': { en: 'Enter size if needed', fr: 'Si nécessaire', de: 'Falls erforderlich', es: 'Si aplica', ja: '必要な場合', ko: '필요 시 입력', 'zh-TW': '按需填寫', 'zh-CN': '按需填写' },
    'jewelry.ring': { en: 'Ring', fr: 'Bague', de: 'Ring', es: 'Anillo', ja: 'リング', ko: '반지', 'zh-TW': '戒指', 'zh-CN': '戒指' },
    'jewelry.necklace': { en: 'Necklace', fr: 'Collier', de: 'Halskette', es: 'Collar', ja: 'ネックレス', ko: '목걸이', 'zh-TW': '項鏈', 'zh-CN': '项链' },
    'jewelry.earring': { en: 'Earrings', fr: 'Boucles', de: 'Ohrringe', es: 'Pendientes', ja: 'ピアス', ko: '귀걸이', 'zh-TW': '耳釘/耳環', 'zh-CN': '耳钉/耳环' },
    'jewelry.brooch': { en: 'Brooch', fr: 'Broche', de: 'Brosche', es: 'Broche', ja: 'ブローチ', ko: '브로치', 'zh-TW': '胸針', 'zh-CN': '胸针' },
    'jewelry.bracelet': { en: 'Bracelet', fr: 'Bracelet', de: 'Armband', es: 'Pulsera', ja: 'ブレスレット', ko: '팔찌', 'zh-TW': '手鏈', 'zh-CN': '手链' },
    'jewelry.other': { en: 'Other', fr: 'Autre', de: 'Sonstige', es: 'Otro', ja: 'その他', ko: '기타', 'zh-TW': '其他', 'zh-CN': '其他' },
    'addr.country': { en: 'Country / region', fr: 'Pays / région', de: 'Land / Region', es: 'País / región', ja: '国・地域', ko: '국가/지역', 'zh-TW': '國家/地區', 'zh-CN': '国家/地区' },
    'addr.country.ph': { en: 'Select country or region', fr: 'Choisir un pays ou une région', de: 'Land oder Region wählen', es: 'Seleccione país o región', ja: '国・地域を選択', ko: '국가/지역 선택', 'zh-TW': '請選擇國家或地區', 'zh-CN': '请选择国家或地区' },
    'addr.province': { en: 'Province', fr: 'Province', de: 'Provinz', es: 'Provincia', ja: '省', ko: '성/도', 'zh-TW': '省/直轄市', 'zh-CN': '省/直辖市' },
    'addr.province.ph': { en: 'Select province', fr: 'Choisir la province', de: 'Provinz wählen', es: 'Seleccione provincia', ja: '省を選択', ko: '성/도 선택', 'zh-TW': '請選擇省/直轄市', 'zh-CN': '请选择省/直辖市' },
    'addr.city': { en: 'City', fr: 'Ville', de: 'Stadt', es: 'Ciudad', ja: '市区町村', ko: '시/군/구', 'zh-TW': '城市', 'zh-CN': '城市' },
    'addr.district': { en: 'District', fr: 'District', de: 'Bezirk', es: 'Distrito', ja: '区', ko: '구/읍/면', 'zh-TW': '區/縣', 'zh-CN': '区/县' },
    'addr.state': { en: 'State / province', fr: 'État / province', de: 'Bundesland / Provinz', es: 'Estado / provincia', ja: '州/県', ko: '주/도', 'zh-TW': '州/省', 'zh-CN': '州/省' },
    'addr.postal': { en: 'Postal / ZIP code', fr: 'Code postal', de: 'Postleitzahl', es: 'Código postal', ja: '郵便番号', ko: '우편번호', 'zh-TW': '郵政編碼', 'zh-CN': '邮政编码' },
    'addr.detail': { en: 'Street address & details', fr: 'Adresse détaillée', de: 'Straße und Details', es: 'Dirección detallada', ja: '番地・建物名など', ko: '상세 주소', 'zh-TW': '詳細地址', 'zh-CN': '详细地址' },
    'addr.err.missing': { en: 'Please complete the shipping address', fr: 'Veuillez compléter l’adresse', de: 'Bitte Lieferadresse ausfüllen', es: 'Complete la dirección de envío', ja: '配送先を入力してください', ko: '배송지를 입력해 주세요', 'zh-TW': '請完善收貨地址', 'zh-CN': '请完善收货地址' },
    'addr.err.country': { en: 'Please select a country or region', fr: 'Veuillez choisir un pays ou une région', de: 'Bitte Land oder Region wählen', es: 'Seleccione país o región', ja: '国・地域を選択してください', ko: '국가/지역을 선택해 주세요', 'zh-TW': '請選擇國家或地區', 'zh-CN': '请选择国家或地区' },
    'addr.err.detail': { en: 'Please enter street address and details', fr: 'Veuillez saisir l’adresse détaillée', de: 'Bitte Straße und Details eingeben', es: 'Introduzca la dirección detallada', ja: '詳細住所を入力してください', ko: '상세 주소를 입력해 주세요', 'zh-TW': '請填寫詳細地址', 'zh-CN': '请填写详细地址' },
    'addr.err.region': { en: 'Please complete province/state and city', fr: 'Veuillez indiquer la province/état et la ville', de: 'Bitte Provinz/Bundesland und Stadt angeben', es: 'Indique provincia/estado y ciudad', ja: '都道府県・市区町村を入力してください', ko: '주/도와 시를 입력해 주세요', 'zh-TW': '請填寫省/州與城市', 'zh-CN': '请填写省/州与城市' },
    'addr.line.country': { en: 'Country', fr: 'Pays', de: 'Land', es: 'País', ja: '国', ko: '국가', 'zh-TW': '國家', 'zh-CN': '国家' },
    'addr.line.province': { en: 'Province', fr: 'Province', de: 'Provinz', es: 'Provincia', ja: '省', ko: '성/도', 'zh-TW': '省', 'zh-CN': '省' },
    'addr.line.state': { en: 'State/Province', fr: 'État/Province', de: 'Bundesland/Provinz', es: 'Estado/Provincia', ja: '州/県', ko: '주/도', 'zh-TW': '州/省', 'zh-CN': '州/省' },
    'addr.line.city': { en: 'City', fr: 'Ville', de: 'Stadt', es: 'Ciudad', ja: '市', ko: '시', 'zh-TW': '城市', 'zh-CN': '城市' },
    'addr.line.district': { en: 'District', fr: 'District', de: 'Bezirk', es: 'Distrito', ja: '区', ko: '구', 'zh-TW': '區/縣', 'zh-CN': '区/县' },
    'addr.line.postal': { en: 'Postal', fr: 'Code postal', de: 'PLZ', es: 'Código postal', ja: '郵便番号', ko: '우편번호', 'zh-TW': '郵編', 'zh-CN': '邮编' },
    'addr.line.street': { en: 'Address', fr: 'Adresse', de: 'Adresse', es: 'Dirección', ja: '住所', ko: '주소', 'zh-TW': '詳細地址', 'zh-CN': '详细地址' },
    'shop.note': { en: 'Note (optional)', fr: 'Remarque (optionnel)', de: 'Hinweis (optional)', es: 'Nota (opcional)', ja: '備考（任意）', ko: '메모(선택)', 'zh-TW': '備註（選填）', 'zh-CN': '备注（选填）' },
    'shop.name': { en: 'Your name', fr: 'Votre nom', de: 'Ihr Name', es: 'Su nombre', ja: 'お名前', ko: '이름', 'zh-TW': '稱呼', 'zh-CN': '称呼' },
    'shop.contact': { en: 'Contact', fr: 'Contact', de: 'Kontakt', es: 'Contacto', ja: '連絡先', ko: '연락처', 'zh-TW': '聯繫方式', 'zh-CN': '联系方式' },
    'studio.title': { en: 'My Assets', fr: 'Mes actifs', de: 'Meine Assets', es: 'Mis activos', ja: 'マイアセット', ko: '내 자산', 'zh-TW': '我的資產', 'zh-CN': '我的资产' },
    'studio.sub': { en: 'Finished jewelry, listings, earnings and withdrawals. When nothing is listed yet, this page is your personal jewelry gallery.', fr: 'Bijoux terminés, annonces, revenus et retraits. Sans annonce, cette page est votre galerie personnelle.', de: 'Fertiger Schmuck, Angebote, Einnahmen und Auszahlungen. Ohne Angebot ist dies Ihre persönliche Galerie.', es: 'Joyería terminada, anuncios, ingresos y retiros. Sin anuncios, es tu galería personal.', ja: '完成したジュエリー、出品、収益、出金。出品がなくても個人ギャラリーとして使えます。', ko: '완성된 주얼리, 등록, 수익 및 출금. 등록이 없어도 개인 갤러리가 됩니다.', 'zh-TW': '已完成的珠寶資產、上架、收益與提現。未上架時，這裡就是您的個人珠寶展覽館。', 'zh-CN': '已完成的珠宝资产、上架、收益与提现。未上架时，这里就是您的个人珠宝展览馆。' },
    'studio.available': { en: 'Withdrawable', fr: 'Retirable', de: 'Auszahlbar', es: 'Retirable', ja: '出金可能', ko: '출금 가능', 'zh-TW': '可提現', 'zh-CN': '可提现' },
    'studio.pending': { en: 'Pending', fr: 'En attente', de: 'Ausstehend', es: 'Pendiente', ja: '保留中', ko: '대기 중', 'zh-TW': '待結算', 'zh-CN': '待结算' },
    'studio.earned': { en: 'Total earned', fr: 'Total gagné', de: 'Gesamtverdienst', es: 'Total ganado', ja: '累計収益', ko: '총수익', 'zh-TW': '累計收益', 'zh-CN': '累计收益' },
    'studio.withdraw': { en: 'Withdraw', fr: 'Retirer', de: 'Auszahlen', es: 'Retirar', ja: '出金', ko: '출금', 'zh-TW': '提現', 'zh-CN': '提现' },
    'studio.listings': { en: 'My shop', fr: 'Ma boutique', de: 'Mein Shop', es: 'Mi tienda', ja: 'マイショップ', ko: '내 가게', 'zh-TW': '我的小店', 'zh-CN': '我的小店' },
    'studio.gallery': { en: 'My jewelry assets', fr: 'Mes bijoux', de: 'Meine Schmuckstücke', es: 'Mis joyas', ja: 'マイジュエリー', ko: '내 주얼리', 'zh-TW': '我的珠寶資產', 'zh-CN': '我的珠宝资产' },
    'studio.gallery.sub': { en: 'Pieces you have completed or confirmed. This is your personal jewelry showroom.', fr: 'Pièces terminées ou confirmées. C’est votre vitrine personnelle.', de: 'Fertige oder bestätigte Stücke. Ihre persönliche Galerie.', es: 'Piezas terminadas o confirmadas. Tu vitrina personal.', ja: '完成または確認済みの作品。あなただけのギャラリーです。', ko: '완성했거나 확인한 작품입니다. 개인 갤러리입니다.', 'zh-TW': '已完成或已確認的作品，這裡是您的個人珠寶展廳。', 'zh-CN': '已完成或已确认的作品，这里是您的个人珠宝展厅。' },
    'studio.gallery.empty': { en: 'Your finished pieces will appear here once they are ready.', fr: 'Vos pièces terminées apparaîtront ici.', de: 'Fertige Stücke erscheinen hier, sobald sie bereit sind.', es: 'Tus piezas terminadas aparecerán aquí cuando estén listas.', ja: '完成した作品はここに表示されます。', ko: '완성된 작품이 준비되면 여기에 표시됩니다.', 'zh-TW': '完成的作品會在這裡展示。', 'zh-CN': '完成的作品会在这里展示。' },
    'studio.listings.sub': { en: 'Publish finished pieces to the shop, pause or relist them, and track sales.', fr: 'Publiez vos pièces terminées, mettez-les en pause ou republiez-les, et suivez les ventes.', de: 'Veröffentlichen Sie fertige Stücke, pausieren oder listen Sie sie erneut und verfolgen Sie Verkäufe.', es: 'Publica piezas terminadas, ponlas en pausa o vuelve a publicarlas y sigue las ventas.', ja: '完成した作品を出品・停止・再出品し、売上を追跡します。', ko: '완성된 작품을 게시하고 일시 중지하거나 다시 게시하며 판매를 추적합니다.', 'zh-TW': '將完成的作品上架、暫停或重新上架，並追蹤銷售。', 'zh-CN': '将完成的作品上架、暂停或重新上架，并追踪销售。' },
    'studio.publish': { en: 'List in my shop', fr: 'Mettre dans ma boutique', de: 'In meinem Shop veröffentlichen', es: 'Publicar en mi tienda', ja: 'マイショップに出品', ko: '내 가게에 게시', 'zh-TW': '上架到我的小店', 'zh-CN': '上架到我的小店' },
    'studio.total': { en: 'Total asset value', fr: 'Valeur totale des actifs', de: 'Gesamtwert der Assets', es: 'Valor total de los activos', ja: '資産の合計額', ko: '자산 총액', 'zh-TW': '資產總價值', 'zh-CN': '资产总价值' },
    'studio.count': { en: 'pieces', fr: 'pièces', de: 'Stücke', es: 'piezas', ja: '点', ko: '점', 'zh-TW': '件', 'zh-CN': '件' },
    'studio.promo': { en: 'Refer & earn', fr: 'Parrainez et gagnez', de: 'Empfehlen und verdienen', es: 'Invita y gana', ja: '紹介して稼ぐ', ko: '추천하고 수익', 'zh-TW': '推廣賺傭', 'zh-CN': '推广赚佣' },
    'studio.promo.tip': { en: 'Share your link to earn commission when friends order.', 'zh-TW': '分享您的專屬連結，好友下單後賺取佣金。', 'zh-CN': '分享您的专属链接，好友下单后赚取佣金。' },
    'studio.promo.code': { en: 'Referral code', 'zh-TW': '專屬推廣碼', 'zh-CN': '专属推广码' },
    'studio.promo.rate': { en: 'Commission {rate}', 'zh-TW': '佣金 {rate}', 'zh-CN': '佣金 {rate}' },
    'studio.promo.copy': { en: 'Copy link', 'zh-TW': '複製連結', 'zh-CN': '复制链接' },
    'studio.promo.poster': { en: 'Download poster', 'zh-TW': '下載海報', 'zh-CN': '下载海报' },
    'studio.promo.posterSoon': { en: 'Poster download will be added soon.', 'zh-TW': '海報下載稍後開放。', 'zh-CN': '海报下载稍后开放。' },
    'studio.promo.copied': { en: 'Link copied', 'zh-TW': '連結已複製', 'zh-CN': '链接已复制' },
    'studio.promo.bindings': { en: 'Referral orders', 'zh-TW': '推廣訂單', 'zh-CN': '推广订单' },
    'studio.promo.txns': { en: 'Commission details', 'zh-TW': '佣金明細', 'zh-CN': '佣金明细' },
    'studio.promo.withdrawals': { en: 'Withdrawals', 'zh-TW': '提現記錄', 'zh-CN': '提现记录' },
    'studio.sales': { en: 'Recent sales', fr: 'Ventes récentes', de: 'Letzte Verkäufe', es: 'Ventas recientes', ja: '最近の販売', ko: '최근 판매', 'zh-TW': '近期銷售', 'zh-CN': '近期销售' },
    'studio.pause': { en: 'Unlist', fr: 'Retirer', de: 'Abmelden', es: 'Retirar', ja: '非公開', ko: '내리기', 'zh-TW': '下架', 'zh-CN': '下架' },
    'studio.gate': { en: 'Sign in to manage your shop', fr: 'Connectez-vous pour gérer votre boutique', de: 'Melden Sie sich an, um Ihren Shop zu verwalten', es: 'Inicia sesión para gestionar tu tienda', ja: 'ショップ管理にはログインが必要です', ko: '스토어 관리를 위해 로그인하세요', 'zh-TW': '登入後管理您的商店', 'zh-CN': '登录后管理您的商店' },
    'studio.edit': { en: 'Edit', fr: 'Modifier', de: 'Bearbeiten', es: 'Editar', ja: '編集', ko: '수정', 'zh-TW': '編輯', 'zh-CN': '编辑' },
    'studio.republish': { en: 'Relist', fr: 'Republier', de: 'Erneut listen', es: 'Republicar', ja: '再公開', ko: '다시 올리기', 'zh-TW': '重新上架', 'zh-CN': '重新上架' },
    'studio.save': { en: 'Save', fr: 'Enregistrer', de: 'Speichern', es: 'Guardar', ja: '保存', ko: '저장', 'zh-TW': '保存', 'zh-CN': '保存' },
    'studio.cancel': { en: 'Cancel', fr: 'Annuler', de: 'Abbrechen', es: 'Cancelar', ja: 'キャンセル', ko: '취소', 'zh-TW': '取消', 'zh-CN': '取消' },
    'studio.status.published': { en: 'Listed', fr: 'En ligne', de: 'Gelistet', es: 'Publicado', ja: '出品中', ko: '판매 중', 'zh-TW': '已上架', 'zh-CN': '已上架' },
    'studio.status.paused': { en: 'Unlisted', fr: 'Retiré', de: 'Entfernt', es: 'Retirado', ja: '非公開', ko: '판매 중지', 'zh-TW': '已下架', 'zh-CN': '已下架' },
    'studio.edit.title': { en: 'Edit listing', fr: 'Modifier l’annonce', de: 'Angebot bearbeiten', es: 'Editar listado', ja: '出品を編集', ko: '상품 수정', 'zh-TW': '編輯上架商品', 'zh-CN': '编辑上架商品' },
    'studio.field.title': { en: 'Title', fr: 'Titre', de: 'Titel', es: 'Título', ja: 'タイトル', ko: '제목', 'zh-TW': '標題', 'zh-CN': '标题' },
    'studio.field.desc': { en: 'Description', fr: 'Description', de: 'Beschreibung', es: 'Descripción', ja: '説明', ko: '설명', 'zh-TW': '描述', 'zh-CN': '描述' },
    'studio.field.price': { en: 'Sale price (USD)', fr: 'Prix de vente (USD)', de: 'Verkaufspreis (USD)', es: 'Precio de venta (USD)', ja: '販売価格（USD）', ko: '판매가(USD)', 'zh-TW': '售價（美元）', 'zh-CN': '售价（美元）' },
    'studio.field.cover': { en: 'Cover image URL', fr: 'URL de l’image de couverture', de: 'Titelbild-URL', es: 'URL de imagen de portada', ja: 'カバー画像URL', ko: '대표 이미지 URL', 'zh-TW': '封面圖 URL', 'zh-CN': '封面图 URL' },
    'studio.preview': { en: 'Preview', fr: 'Aperçu', de: 'Vorschau', es: 'Vista previa', ja: 'プレビュー', ko: '미리보기', 'zh-TW': '預覽', 'zh-CN': '预览' },
    'studio.form.invalid': { en: 'Please enter a title and a price above 0.', fr: 'Veuillez saisir un titre et un prix supérieur à 0.', de: 'Bitte Titel und einen Preis über 0 eingeben.', es: 'Introduce un título y un precio mayor que 0.', ja: 'タイトルと0より大きい価格を入力してください。', ko: '제목과 0보다 큰 가격을 입력하세요.', 'zh-TW': '請填寫標題與大於 0 的售價。', 'zh-CN': '请填写标题与大于 0 的售价。' },
    'pub.title': { en: 'Publish to shop', fr: 'Publier en boutique', de: 'Im Shop veröffentlichen', es: 'Publicar en la tienda', ja: 'ショップに公開', ko: '스토어에 게시', 'zh-TW': '一鍵上架獨立站', 'zh-CN': '一键上架独立站' },
    'pub.price': { en: 'Your sale price (USD)', fr: 'Votre prix de vente (USD)', de: 'Ihr Verkaufspreis (USD)', es: 'Su precio de venta (USD)', ja: '販売価格（USD）', ko: '판매가(USD)', 'zh-TW': '您的售價（美元）', 'zh-CN': '您的售价（美元）' },
    'pub.submit': { en: 'Publish', fr: 'Publier', de: 'Veröffentlichen', es: 'Publicar', ja: '公開する', ko: '게시', 'zh-TW': '發布', 'zh-CN': '发布' },
    'pub.cover': { en: 'Main image', 'zh-TW': '商品主圖', 'zh-CN': '商品主图' },
    'pub.cover.hint': { en: 'Choose the photo shoppers see first.', 'zh-TW': '選擇買家第一眼看到的主圖。', 'zh-CN': '选择买家第一眼看到的主图。' },
    'pub.cover.required': { en: 'Please choose a main image.', 'zh-TW': '請選擇一張商品主圖。', 'zh-CN': '请选择一张商品主图。' },
    'pub.min': { en: 'The sale price cannot be below the production quote of $299.', 'zh-TW': '售價不能低於生產報價 299 美元。', 'zh-CN': '售价不能低于生产报价 299 美元。' },

    'co.metal': { en: 'Metal', fr: 'Métal', de: 'Metall', es: 'Metal', ja: '金属', ko: '금속', 'zh-TW': '金屬材質', 'zh-CN': '金属材质' },
    'co.metal.ph': { en: 'Choose a metal', 'zh-TW': '請選擇金屬', 'zh-CN': '请选择金属' },
    'co.metal.note': {
      en: 'Fine gold and fine silver cannot hold gemstones. If you choose either, the detail form will not offer stone setting.',
      'zh-TW': '足金和足銀無法做寶石鑲嵌。選擇這兩種材質後，問卷中不提供寶石鑲嵌選項。',
      'zh-CN': '足金和足银无法做宝石镶嵌。选择这两种材质后，问卷中不提供宝石镶嵌选项。'
    },
    'co.metal.required': { en: 'Please choose a metal before paying the deposit.', 'zh-TW': '支付定金前請先選擇金屬材質。', 'zh-CN': '支付定金前请先选择金属材质。' },
    'co.metal.SILVER_925': { en: '925 silver', 'zh-TW': '925銀', 'zh-CN': '925银' },
    'co.metal.PURE_SILVER': { en: 'Fine silver 999', 'zh-TW': '足銀999', 'zh-CN': '足银999' },
    'co.metal.PURE_GOLD': { en: 'Fine gold', 'zh-TW': '足金', 'zh-CN': '足金' },
    'co.metal.PLATINUM_950': { en: 'Platinum 950', 'zh-TW': '鉑金950', 'zh-CN': '铂金950' },
    'co.metal.K9': { en: '9K gold', 'zh-TW': '9K', 'zh-CN': '9K' },
    'co.metal.K14': { en: '14K gold', 'zh-TW': '14K', 'zh-CN': '14K' },
    'co.metal.K18': { en: '18K gold', 'zh-TW': '18K', 'zh-CN': '18K' },
    'co.metal.K_OTHER': { en: 'Other karat gold', 'zh-TW': 'K金（其他）', 'zh-CN': 'K金（其他）' },
    'co.metal.COPPER': { en: 'Copper', 'zh-TW': '銅', 'zh-CN': '铜' },
    'co.metal.OTHER': { en: 'Other', 'zh-TW': '其他', 'zh-CN': '其他' },
    'brief.open': { en: 'Open the detail form', 'zh-TW': '打開定制細節問卷', 'zh-CN': '打开定制细节问卷' },
    'brief.title': { en: 'Custom detail form', 'zh-TW': '定制細節問卷', 'zh-CN': '定制细节问卷' },
    'brief.lead': {
      en: 'Tell us about each piece. Your designer will follow these choices as far as material, craft and budget allow.',
      'zh-TW': '請按每一件填寫。設計師會參考這些選擇，並在材質、工藝和預算允許的範圍內盡可能採納。',
      'zh-CN': '请按每一件填写。设计师会参考这些选择，并在材质、工艺和预算允许的范围内尽可能采纳。'
    },
    'brief.disclaimer': {
      en: 'We will use your answers as the brief. They will be adopted wherever possible, but we cannot promise every request will be followed exactly.',
      'zh-TW': '設計師會參考您給出的需求，並盡可能採納；受材質、工藝和預算限制，不能保證每一項都按原樣實現。',
      'zh-CN': '设计师会参考您给出的需求，并尽可能采纳；受材质、工艺和预算限制，不能保证每一项都按原样实现。'
    },
    'brief.budget.note': {
      en: 'We will aim for the best result inside your budget. A higher budget can support more complex, finer and more considered design and craft.',
      'zh-TW': '我們會根據您的預算，在這個範圍內做到能呈現的最好效果。更高的預算可以支持更複雜、更精細、更考究的設計與工藝，從而呈現更好的成品效果。',
      'zh-CN': '我们会根据您的预算，在这个范围内做到能呈现的最好效果。更高的预算可以支持更复杂、更精细、更考究的设计与工艺，从而呈现更好的成品效果。'
    },
    'brief.submit': { en: 'Submit', 'zh-TW': '提交問卷', 'zh-CN': '提交问卷' },
    'brief.done': { en: 'Received. You can return to the order chat.', 'zh-TW': '已收到。可以回到訂單群聊。', 'zh-CN': '已收到。可以回到订单群聊。' },
    'brief.back': { en: 'Back to chat', 'zh-TW': '回到群聊', 'zh-CN': '回到群聊' },
    'brief.metal.pure': {
      en: 'Fine gold and fine silver cannot hold gemstones, so this form does not ask about stone setting.',
      'zh-TW': '足金和足銀無法做寶石鑲嵌，因此問卷不提供寶石鑲嵌選項。',
      'zh-CN': '足金和足银无法做宝石镶嵌，因此问卷不提供宝石镶嵌选项。'
    },
    'brief.missing': { en: 'Please complete every required choice.', 'zh-TW': '請把每一項必填內容選完。', 'zh-CN': '请把每一项必填内容选完。' },
    'brief.login': { en: 'Sign in to fill in this form.', 'zh-TW': '請先登入再填寫問卷。', 'zh-CN': '请先登录再填写问卷。' }
  };

  var current = localStorage.getItem('duxury-lang') || 'en';

  function t(key) {
    var entry = T[key];
    if (!entry) return key;
    return entry[current] || entry.en || key;
  }

  function setLang(code) {
    if (!SUPPORTED.some(function (s) { return s.code === code; })) return;
    current = code;
    localStorage.setItem('duxury-lang', code);
    document.documentElement.lang = code;
    apply();
    document.dispatchEvent(new CustomEvent('duxury:langchange', { detail: { lang: code } }));
  }

  function apply() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    // Language switcher labels
    document.querySelectorAll('[data-lang-current]').forEach(function (el) {
      var s = SUPPORTED.find(function (x) { return x.code === current; });
      if (s) el.textContent = s.short;
    });
  }

  var ROLE_NAME_ZH = /^(设计师|建模师|跟单员|跟单|客户|系统|管理员|AI\s*助理)$/;

  function isZhLang(code) {
    return code === 'zh-CN' || code === 'zh-TW';
  }

  function hasKey(key) {
    return !!T[key];
  }

  function localizeOrderStatus(code, fallback) {
    if (!code) return fallback || '';
    var key = 'ws.order.' + code;
    return hasKey(key) ? t(key) : (fallback || code);
  }

  function localizeEventType(type) {
    if (!type) return t('ws.event._default');
    var key = 'ws.event.' + type;
    return hasKey(key) ? t(key) : t('ws.event._default');
  }

  function localizeResolution(code) {
    if (!code) return '';
    var key = 'ws.resolution.' + code;
    return hasKey(key) ? t(key) : code;
  }

  function localizeEventTitle(title, eventType) {
    if (eventType === 'SHIPPING_ADDRESS_REQUEST') return t('ws.shipaddr.title');
    if (eventType === 'SHIPPING_ADDRESS_FILLED') return t('ws.shipaddr.filledTitle');
    if (eventType === 'SHIPPED') {
      var shippedTitle = title != null ? String(title).trim() : '';
      if (shippedTitle === '物流单号已更正') return t('ws.ship.correctedTitle');
      if (shippedTitle === '已重新发货') return t('ws.ship.reshippedTitle');
      if (shippedTitle === '运单已撤销') return t('ws.ship.cancelledTitle');
      if (shippedTitle === '运单已拦截') return t('ws.ship.heldTitle');
      return t('ws.event.SHIPPED');
    }
    var raw = title != null ? String(title).trim() : '';
    if (!raw) {
      return eventType ? localizeEventType(eventType) : '';
    }
    if (eventType === 'REVIEW_PASS' || eventType === 'REVIEW_REJECT' || raw === '工艺验证通过' || raw === '工艺验证驳回' || raw === '工艺验证') {
      return localizeEventType(eventType || (raw.indexOf('驳回') >= 0 ? 'REVIEW_REJECT' : 'REVIEW_PASS'));
    }
    if (isZhLang(current)) return raw;
    var piece = raw.match(/^(设计稿|建模稿)\s*[·•]\s*(.+)$/);
    if (piece) {
      var prefix = piece[1] === '建模稿' ? t('ws.event.title.model') : t('ws.event.title.design');
      return prefix + ' · ' + piece[2];
    }
    return raw;
  }

  function localizeActorName(role, displayName) {
    var name = (displayName || '').trim();
    var roleKeys = {
      DESIGNER: 'ws.role.designer',
      MODELER: 'ws.role.modeler',
      FOLLOW_UP: 'ws.role.tracker',
      SALES_MID: 'ws.role.tracker',
      SALES_PRE: 'ws.role.tracker',
      SUPER_SERVICE: 'ws.role.tracker',
      CUSTOMER: 'ws.role.customer',
      C_PORTAL_CUSTOMER: 'ws.role.customer',
      AI_ASSISTANT: 'ws.role.ai',
      ADMIN: 'ws.role.admin',
      SYSTEM: 'ws.role.system'
    };
    var rk = roleKeys[role];
    if (name && !ROLE_NAME_ZH.test(name)) return name;
    if (rk && hasKey(rk)) return t(rk);
    return name || role || '';
  }

  window.I18N = {
    SUPPORTED: SUPPORTED,
    get current() { return current; },
    t: t,
    setLang: setLang,
    apply: apply,
    localizeOrderStatus: localizeOrderStatus,
    localizeEventType: localizeEventType,
    localizeResolution: localizeResolution,
    localizeEventTitle: localizeEventTitle,
    localizeActorName: localizeActorName,
    // 合并后端多语言文案（blockKey -> {lang: text}），覆盖静态文案后重新渲染
    mergeTranslations: function (translations) {
      if (!translations || typeof translations !== 'object') return;
      Object.keys(translations).forEach(function (key) {
        var entry = translations[key];
        if (!entry || typeof entry !== 'object') return;
        if (!T[key]) T[key] = {};
        Object.keys(entry).forEach(function (lang) {
          if (entry[lang]) T[key][lang] = entry[lang];
        });
      });
      apply();
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    document.documentElement.lang = current;
    apply();
  });
})();
