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
    'nav.studio': { en: 'Studio', fr: 'Studio', de: 'Studio', es: 'Estudio', ja: 'スタジオ', ko: '스튜디오', 'zh-TW': '商家後台', 'zh-CN': '商家后台' },
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
    'ws.progress.title': { en: 'Order Progress', fr: 'Avancement de la commande', de: 'Bestellfortschritt', es: 'Progreso del pedido', ja: '注文の進捗', ko: '주문 진행 상황', 'zh-TW': '訂單進度', 'zh-CN': '订单进度' },
    'ws.progress.delivery.confirm': { en: 'Confirm receipt and pay the balance?', fr: 'Confirmer la réception et payer le solde ?', de: 'Empfang bestätigen und Restbetrag zahlen?', es: '¿Confirmar recepción y pagar el saldo?', ja: '受領を確認して残金を支払いますか？', ko: '수령 확인 및 잔금을 결제하시겠습니까?', 'zh-TW': '確認收貨並支付尾款？', 'zh-CN': '确认收货并支付尾款？' },
    'ws.progress.reject.ph': { en: 'Please enter rejection reason', fr: 'Veuillez saisir le motif du rejet', de: 'Bitte Ablehnungsgrund eingeben', es: 'Introduzca el motivo del rechazo', ja: '却下理由を入力してください', ko: '거부 사유를 입력하세요', 'zh-TW': '請輸入駁回原因', 'zh-CN': '请输入驳回原因' },
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
      en: 'A deposit unlocks your dedicated design team', fr: 'Un acompte débloque votre équipe dédiée',
      de: 'Eine Anzahlung schaltet Ihr Team frei', es: 'Un depósito desbloquea su equipo dedicado',
      ja: '内金で専用チームをアンロック', ko: '예약금으로 전담 팀을 이용하세요',
      'zh-TW': '支付定金即可解鎖專屬設計團隊', 'zh-CN': '支付定金即可解锁专属设计团队'
    },
    'svc.custom.title': {
      en: 'Bring Your Design', fr: 'Apportez votre design', de: 'Eigenes Design',
      es: 'Traiga su diseño', ja: 'お手持ちのデザイン', ko: '도면 직접 제출',
      'zh-TW': '來圖定制', 'zh-CN': '来图定制'
    },
    'svc.custom.desc': {
      en: 'Submit your own design drawings and we craft it into reality.',
      fr: 'Soumettez vos propres dessins et nous les réalisons.',
      de: 'Reichen Sie Ihre eigenen Entwürfe ein, wir setzen sie um.',
      es: 'Envíe sus propios dibujos y los hacemos realidad.',
      ja: 'お手持ちの設計図をお送りいただき、私たちが形にします。',
      ko: '보유한 도면을 제출하시면 저희가 실물로 제작합니다.',
      'zh-TW': '提交您自帶的設計圖，我們為您打造為實物。',
      'zh-CN': '提交您自带的設計图，我们为您打造为实物。'
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
    'svc.custom.price': { en: '$49', fr: '49 $', de: '49 $', es: '49 $', ja: '$49', ko: '$49', 'zh-TW': '49美元', 'zh-CN': '49美元' },
    'svc.designer.title': {
      en: 'Designer Design', fr: 'Design par designer', de: 'Designer-Entwurf',
      es: 'Diseño por diseñador', ja: 'デザイナー設計', ko: '디자이너 디자인',
      'zh-TW': '設計師設計', 'zh-CN': '设计师设计'
    },
    'svc.designer.desc': {
      en: 'Commission our designers to create a bespoke design from your inspiration.',
      fr: 'Confiez à nos designers la création d’un design sur mesure.',
      de: 'Lassen Sie unsere Designer ein maßgeschneidertes Design entwerfen.',
      es: 'Encargue a nuestros diseñadores un diseño a medida.',
      ja: 'あなたの着想から、デザイナーがオーダーメイドのデザインを制作します。',
      ko: '영감을 바탕으로 디자이너가 맞춤 디자인을 제작합니다.',
      'zh-TW': '委託我們的設計師，從您的靈感出發設計專屬款式。',
      'zh-CN': '委托我们的设计师，从您的灵感出发设计专属款式。'
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
    'svc.designer.price': { en: '$99', fr: '99 $', de: '99 $', es: '99 $', ja: '$99', ko: '$99', 'zh-TW': '99美元', 'zh-CN': '99美元' },
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
    'login.or': { en: 'or', fr: 'ou', de: 'oder', es: 'o', ja: 'または', ko: '또는', 'zh-TW': '或', 'zh-CN': '或' },
    'login.code.ph': { en: 'Verification code', fr: 'Code de vérification', de: 'Bestätigungscode', es: 'Código de verificación', ja: '認証コード', ko: '인증 코드', 'zh-TW': '驗證碼', 'zh-CN': '验证码' },
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
    'co.pay': { en: 'Pay deposit', fr: 'Payer l’acompte', de: 'Anzahlung zahlen', es: 'Pagar depósito', ja: '内金を支払う', ko: '예약금 결제', 'zh-TW': '支付定金', 'zh-CN': '支付定金' },
    'co.secure': { en: '256-bit encrypted · secure payment', fr: 'Chiffrement 256 bits · paiement sécurisé', de: '256-Bit-Verschlüsselung · sichere Zahlung', es: 'Cifrado de 256 bits · pago seguro', ja: '256bit暗号化 · 安全な決済', ko: '256비트 암호화 · 안전 결제', 'zh-TW': '256位元加密 · 安全支付', 'zh-CN': '256位加密 · 安全支付' },
    'co.back': { en: 'Back', fr: 'Retour', de: 'Zurück', es: 'Volver', ja: '戻る', ko: '뒤로', 'zh-TW': '返回', 'zh-CN': '返回' },
    'co.success': {
      en: 'Deposit received — your group chat is ready!', fr: 'Acompte reçu — votre chat est prêt !',
      de: 'Anzahlung erhalten — Ihr Chat ist bereit!', es: 'Depósito recibido — ¡su chat está listo!',
      ja: '内金を受領しました — チャットの準備ができました！', ko: '예약금 수령 완료 — 채팅이 준비되었습니다!',
      'zh-TW': '定金已收到 — 您的群聊已就緒！', 'zh-CN': '定金已收到 — 您的群聊已就绪！'
    },
    'co.enter': { en: 'Enter Order Workspace', fr: 'Entrer dans l’espace', de: 'Zum Workspace', es: 'Entrar al espacio', ja: 'ワークスペースへ', ko: '워크스페이스로 이동', 'zh-TW': '進入訂單工作台', 'zh-CN': '进入订单工作台' },
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
    'shop.note': { en: 'Note (optional)', fr: 'Remarque (optionnel)', de: 'Hinweis (optional)', es: 'Nota (opcional)', ja: '備考（任意）', ko: '메모(선택)', 'zh-TW': '備註（選填）', 'zh-CN': '备注（选填）' },
    'shop.name': { en: 'Your name', fr: 'Votre nom', de: 'Ihr Name', es: 'Su nombre', ja: 'お名前', ko: '이름', 'zh-TW': '稱呼', 'zh-CN': '称呼' },
    'shop.contact': { en: 'Contact', fr: 'Contact', de: 'Kontakt', es: 'Contacto', ja: '連絡先', ko: '연락처', 'zh-TW': '聯繫方式', 'zh-CN': '联系方式' },
    'studio.title': { en: 'Seller studio', fr: 'Espace vendeur', de: 'Verkäuferstudio', es: 'Estudio del vendedor', ja: '出品者スタジオ', ko: '판매자 스튜디오', 'zh-TW': '商家後台', 'zh-CN': '商家后台' },
    'studio.sub': { en: 'Sales, listings and withdrawable balance', fr: 'Ventes, annonces et solde retirable', de: 'Verkäufe, Angebote und auszahlbares Guthaben', es: 'Ventas, listados y saldo retirable', ja: '売上・出品・出金可能残高', ko: '판매·상품·출금 가능 잔액', 'zh-TW': '銷售、上架作品與可提現餘額', 'zh-CN': '销售、上架作品与可提现金额' },
    'studio.available': { en: 'Withdrawable', fr: 'Retirable', de: 'Auszahlbar', es: 'Retirable', ja: '出金可能', ko: '출금 가능', 'zh-TW': '可提現', 'zh-CN': '可提现' },
    'studio.pending': { en: 'Pending', fr: 'En attente', de: 'Ausstehend', es: 'Pendiente', ja: '保留中', ko: '대기 중', 'zh-TW': '待結算', 'zh-CN': '待结算' },
    'studio.earned': { en: 'Total earned', fr: 'Total gagné', de: 'Gesamtverdienst', es: 'Total ganado', ja: '累計収益', ko: '총수익', 'zh-TW': '累計收益', 'zh-CN': '累计收益' },
    'studio.withdraw': { en: 'Withdraw', fr: 'Retirer', de: 'Auszahlen', es: 'Retirar', ja: '出金', ko: '출금', 'zh-TW': '提現', 'zh-CN': '提现' },
    'studio.listings': { en: 'My Shelf', fr: 'Mon étagère', de: 'Mein Regal', es: 'Mi estante', ja: 'マイシェルフ', ko: '내 진열대', 'zh-TW': '我的貨架', 'zh-CN': '我的货架' },
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
    'pub.submit': { en: 'Publish', fr: 'Publier', de: 'Veröffentlichen', es: 'Publicar', ja: '公開する', ko: '게시', 'zh-TW': '發布', 'zh-CN': '发布' }
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

  window.I18N = {
    SUPPORTED: SUPPORTED,
    get current() { return current; },
    t: t,
    setLang: setLang,
    apply: apply,
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
