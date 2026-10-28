(function () {
  'use strict';

  var app = document.getElementById('briefApp');
  var params = new URLSearchParams(window.location.search);
  var orderId = params.get('orderId');
  var form = null;
  var stepIndex = 0;
  var guideKey = '';

  function t(key) { return window.I18N.t(key); }

  function L(zh, tw, en) {
    var lang = window.I18N.current;
    if (lang === 'zh-TW') return tw;
    if (lang === 'zh-CN') return zh;
    return en;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function answerOf(pieceId) {
    form.pieces = form.pieces || [];
    var found = form.pieces.find(function (p) { return String(p.pieceId) === String(pieceId); });
    if (!found) {
      found = { pieceId: pieceId };
      form.pieces.push(found);
    }
    return found;
  }

  function nameOf(pieceId) {
    var found = (form.pieceNames || []).find(function (p) { return String(p.pieceId) === String(pieceId); });
    return found ? (found.name || ('#' + found.seq)) : ('#' + pieceId);
  }

  function labelOf(list, value) {
    var found = list.find(function (item) { return item.value === value; });
    return found ? found.label : '';
  }

  function choice(value, zh, tw, en, noteZh, noteTw, noteEn, art) {
    return {
      value: value,
      label: L(zh, tw, en),
      note: L(noteZh, noteTw, noteEn),
      art: art || ''
    };
  }

  function chainChoices() {
    return [
      choice('O', 'O字链', 'O字鏈', 'Cable', '圆圈相连，贴肤顺滑，是最常见的日常链。', '圓圈相連，貼膚順滑，是最常見的日常鏈。', 'Round links. Smooth and everyday.', 'O'),
      choice('CROSS', '十字链', '十字鏈', 'Figaro', '一长一短交替，节奏比圆链更明显。', '一長一短交替，節奏比圓鏈更明顯。', 'Long and short links alternate.', 'CROSS'),
      choice('CHOPARD', '肖邦链', '肖邦鏈', 'Chopard', '扁链节紧扣，不会扭转，垂下来是一条平整的光带。', '扁鏈節緊扣，不會扭轉，垂下來是一條平整的光帶。', 'Flat links that do not twist.', 'CHOPARD'),
      choice('WAVE', '水波链', '水波鏈', 'Singapore', '链身带螺旋，光线下有细碎闪光，分量轻。', '鏈身帶螺旋，光線下有細碎閃光，分量輕。', 'A light twisted sparkle.', 'WAVE'),
      choice('TWIST', '绞丝链', '絞絲鏈', 'Rope', '像绳子拧在一起，纹理清楚，看起来更厚。', '像繩子擰在一起，紋理清楚，看起來更厚。', 'Twisted strands, visibly textured.', 'TWIST'),
      choice('BOX', '盒仔链', '盒仔鏈', 'Box', '方链节像小盒子扣住，表面光滑，结构结实。', '方鏈節像小盒子扣住，表面光滑，結構結實。', 'Square links. Smooth and sturdy.', 'BOX'),
      choice('BEAD', '珠珠链', '珠珠鏈', 'Bead', '一颗颗小圆珠，外观柔和，偏可爱或复古。', '一顆顆小圓珠，外觀柔和，偏可愛或復古。', 'Small beads, soft and playful.', 'BEAD'),
      choice('SNAKE', '蛇骨链', '蛇骨鏈', 'Snake', '扁平贴合，晃动时整片反光，手感很顺。', '扁平貼合，晃動時整片反光，手感很順。', 'A flat ribbon of light.', 'SNAKE'),
      choice('CURB', '侧身链', '側身鏈', 'Curb', '链节被压扁，贴在皮肤上不会立起来。', '鏈節被壓扁，貼在皮膚上不會立起來。', 'Flattened links that lie against the skin.', 'CURB'),
      choice('DIAMOND_CUT', '车花链', '車花鏈', 'Diamond-cut', '链节上切了小刻面，比素链更闪，要避免硬磕。', '鏈節上切了小刻面，比素鏈更閃，要避免硬磕。', 'Faceted links. Brighter, but avoid hard knocks.', 'DIAMOND_CUT'),
      choice('STAR', '满天星', '滿天星', 'Star', '链身上有细小星点切工，远看像散落的光点。', '鏈身上有細小星點切工，遠看像散落的光點。', 'Tiny star cuts scatter light.', 'STAR'),
      choice('OTHER', '其他', '其他', 'Other', '心里有具体样式的话，设计师会在群里和您确认。', '心裡有具體樣式的話，設計師會在群裡和您確認。', 'Tell your designer the exact style in chat.', 'OTHER')
    ];
  }

  function stoneChoices() {
    return [
      choice('CZ', '锆石', '鋯石', 'Cubic zirconia', '火彩偏彩虹，亮度高，价格友好。近看玻璃感更明显。', '火彩偏彩虹，亮度高，價格友好。近看玻璃感更明顯。', 'Bright rainbow fire. More glassy up close.', 'cz'),
      choice('MOISSANITE', '莫桑钻', '莫桑鑽', 'Moissanite', '火彩很强，比钻石更彩虹。硬度高，日常不容易刮花。', '火彩很強，比鑽石更彩虹。硬度高，日常不容易刮花。', 'Strong rainbow fire and high hardness.', 'moissanite'),
      choice('SYN_CORUNDUM', '合成刚玉', '合成剛玉', 'Synthetic corundum', '和红宝石、蓝宝石同一家族。颜色浓，晶体感强。', '和紅寶石、藍寶石同一家族。顏色濃，晶體感強。', 'Ruby and sapphire family. Dense color.', 'corundum'),
      choice('SYN_SPINEL', '合成尖晶', '合成尖晶', 'Synthetic spinel', '火彩温和，颜色干净，看起来比莫桑更安静。', '火彩溫和，顏色乾淨，看起來比莫桑更安靜。', 'Softer fire, quieter color.', 'spinel'),
      choice('GLASS', '玻璃', '玻璃', 'Glass', '最轻，颜色可以很透。硬度低，容易留下细痕。', '最輕，顏色可以很透。硬度低，容易留下細痕。', 'Light and translucent. Scratches more easily.', 'glass'),
      choice('LAB_DIAMOND', '培育钻', '培育鑽', 'Lab diamond', '晶体和钻石相同。闪光偏白亮，边缘更利落，彩虹没有莫桑那么跳。', '晶體和鑽石相同。閃光偏白亮，邊緣更利落，彩虹沒有莫桑那麼跳。', 'Crisp white sparkle, less rainbow than moissanite.', 'lab'),
      choice('OTHER', '其他', '其他', 'Other', '可以说您更在意闪、颜色，还是预算。', '可以說您更在意閃、顏色，還是預算。', 'Say whether you care more about sparkle, color, or budget.', 'stone-other')
    ];
  }

  function colorChoices() {
    return [
      choice('COLORLESS', '无色', '無色', 'Colorless', '冰透，用来衬托金属本身的光。', '冰透，用來襯托金屬本身的光。', 'Icy. Lets the metal shine.', ''),
      choice('YELLOW', '黄', '黃', 'Yellow', '暖色，从香槟到金黄。和黄金会融在一起，和白金对比更清楚。', '暖色，從香檳到金黃。和黃金會融在一起，和白金對比更清楚。', 'Warm, from champagne to gold.', ''),
      choice('PINK', '粉', '粉', 'Pink', '柔和，贴肤时通常更温柔。', '柔和，貼膚時通常更溫柔。', 'Soft against the skin.', ''),
      choice('BLUE', '蓝', '藍', 'Blue', '冷色。天蓝和深蓝差别很大，设计师会再和您确认深浅。', '冷色。天藍和深藍差別很大，設計師會再和您確認深淺。', 'Cool. Depth will be confirmed with you.', ''),
      choice('GREEN', '绿', '綠', 'Green', '从薄荷到浓绿。颜色越浓，越需要金属托住。', '從薄荷到濃綠。顏色越濃，越需要金屬托住。', 'From mint to deep green.', ''),
      choice('RED', '红', '紅', 'Red', '深色更沉稳，浅色更接近粉。', '深色更沉穩，淺色更接近粉。', 'Deep reads richer; pale reads pink.', ''),
      choice('BLACK', '黑', '黑', 'Black', '不透或半透，适合想要和金属拉开对比的款。', '不透或半透，適合想要和金屬拉開對比的款。', 'Opaque contrast against the metal.', ''),
      choice('MULTI', '多色', '多色', 'Multi', '同一件上用两种以上颜色。具体搭配可以在群里补图。', '同一件上用兩種以上顏色。具體搭配可以在群裡補圖。', 'More than one color. Share a reference in chat.', ''),
      choice('OTHER', '其他', '其他', 'Other', '在群里发一张您喜欢的颜色参考即可。', '在群裡發一張您喜歡的顏色參考即可。', 'Send a color reference in chat.', '')
    ];
  }

  function stepsFor() {
    var list = [{
      id: 'welcome',
      kind: 'info',
      art: 'welcome',
      kicker: form.orderNumber || '',
      title: L('先把每一件的细节确认清楚', '先把每一件的細節確認清楚', 'Let us confirm each piece'),
      lead: t('brief.lead'),
      guideTitle: L('设计师会尽量照着做', '設計師會盡量照著做', 'Your designer will follow this'),
      guideBody: t('brief.disclaimer') + (form.metalLabel ? '\n\n' + L('这单金属：', '這單金屬：', 'Metal: ') + form.metalLabel : '')
    }];
    if (form.inlayAllowed === false) {
      list.push({
        id: 'pure',
        kind: 'info',
        art: 'pure',
        kicker: form.metalLabel || '',
        title: L('这件金属不做宝石镶嵌', '這件金屬不做寶石鑲嵌', 'This metal is not set with stones'),
        lead: t('brief.metal.pure'),
        guideTitle: L('为什么没有镶石这一步', '為什麼沒有鑲石這一步', 'Why stone setting is not offered'),
        guideBody: L(
          '足金和足银比较软，爪镶和密钉都抓不稳，佩戴时石头容易松。所以选了这两种金属，问卷里不会再问宝石。如果您希望镶石，需要改成 K 金、925 银或铂金。',
          '足金和足銀比較軟，爪鑲和密釘都抓不穩，佩戴時石頭容易鬆。所以選了這兩種金屬，問卷裡不會再問寶石。如果您希望鑲石，需要改成 K 金、925 銀或鉑金。',
          'Fine gold and fine silver are too soft to hold a stone securely. Stone setting is skipped. K-gold, 925 silver or platinum can be set.'
        )
      });
    }
    (form.pieceNames || []).forEach(function (meta) {
      var piece = answerOf(meta.pieceId);
      var who = nameOf(meta.pieceId);
      list.push({
        id: meta.pieceId + ':type',
        pieceId: meta.pieceId,
        field: 'jewelryType',
        art: 'ring',
        kicker: who,
        title: L('这件是什么？', '這件是什麼？', 'What is this piece?'),
        lead: L('先选品类。后面的尺寸和链子，会按品类只问需要的那几项。', '先選品類。後面的尺寸和鏈子，會按品類只問需要的那幾項。', 'The next questions follow this category.'),
        guideTitle: L('一件只选一个品类', '一件只選一個品類', 'One category per piece'),
        guideBody: L('对戒、项链配吊坠如果是两件，会在各自的步骤里分开问。', '對戒、項鍊配吊墜如果是兩件，會在各自的步驟裡分開問。', 'Sets are asked piece by piece.'),
        choices: [
          choice('RING', '戒指', '戒指', 'Ring', '需要圈号。', '需要圈號。', 'Needs a ring size.', 'ring'),
          choice('NECKLACE', '项链', '項鍊', 'Necklace', '可选择是否配链。', '可選擇是否配鏈。', 'Chain is optional.', 'necklace'),
          choice('BROOCH', '胸针', '胸針', 'Brooch', '不需要尺寸。', '不需要尺寸。', 'No size needed.', 'brooch'),
          choice('EARRING', '耳钉/耳饰', '耳釘/耳飾', 'Earrings', '不需要尺寸。', '不需要尺寸。', 'No size needed.', 'earring'),
          choice('BRACELET', '手镯', '手鐲', 'Bangle', '按圈口量。', '按圈口量。', 'Measured at the wrist.', 'bracelet'),
          choice('COLLARBONE', '锁骨链', '鎖骨鏈', 'Collarbone chain', '需要选链子样式。', '需要選鏈子樣式。', 'Choose a chain.', 'collar'),
          choice('HAIR', '发饰', '髮飾', 'Hair ornament', '发夹、簪子或发链。', '髮夾、簪子或髮鏈。', 'Clip, pin or chain.', 'hair'),
          choice('CHARM', '小挂件', '小掛件', 'Charm', '不需要尺寸。', '不需要尺寸。', 'No size needed.', 'charm'),
          choice('OTHER', '其他', '其他', 'Other', '群里再补充。', '群裡再補充。', 'Add detail in chat.', 'other')
        ]
      });
      if (piece.jewelryType === 'RING') {
        list.push({
          id: meta.pieceId + ':ring',
          pieceId: meta.pieceId,
          field: 'ringUnit',
          textField: 'ringSize',
          art: 'measure',
          kicker: who,
          title: L('圈号是多少？', '圈號是多少？', 'What size is the ring?'),
          lead: L('用细线绕手指最粗处一圈，不要太紧或太松，量出的周长再对照单位。傍晚手指略胀，那时量更不容易戴不上。', '用細線繞手指最粗處一圈，不要太緊或太鬆，量出的周長再對照單位。傍晚手指略脹，那時量更不容易戴不上。', 'Wrap a thread around the widest part of the finger, not tight or loose. Evening is more reliable.'),
          guideTitle: L('怎么确认圈号', '怎麼確認圈號', 'How to confirm the size'),
          guideBody: L(
            '港码在国内最常用。美码、欧码、英码是不同对照体系，不要把数字直接混用。如果只有内径，选「内径（mm）」并填写直径。宽戒或满镶会觉得更紧，可以略选大半码。',
            '港碼在國內最常用。美碼、歐碼、英碼是不同對照體系，不要把數字直接混用。如果只有內徑，選「內徑（mm）」並填寫直徑。寬戒或滿鑲會覺得更緊，可以略選大半碼。',
            'Hong Kong, US, EU and UK sizes are different systems. Do not mix the numbers. Wide or fully set bands feel tighter.'
          ),
          choices: [
            choice('HK', '港码', '港碼', 'HK', '国内最常见。', '國內最常見。', 'Most used here.', 'measure'),
            choice('US', '美码', '美碼', 'US', '和港码不是同一套数字。', '和港碼不是同一套數字。', 'Not the same numbers as HK.', 'measure'),
            choice('EU', '欧码', '歐碼', 'EU', '通常接近周长毫米数。', '通常接近周長毫米數。', 'Often close to circumference in mm.', 'measure'),
            choice('UK', '英码', '英碼', 'UK', '用字母表示。', '用字母表示。', 'Lettered sizes.', 'measure'),
            choice('INNER_MM', '内径 mm', '內徑 mm', 'Inner mm', '量戒圈内侧直径。', '量戒圈內側直徑。', 'Inside diameter.', 'measure'),
            choice('OTHER', '其他', '其他', 'Other', '在数字旁我们会按您写的单位理解。', '在數字旁我們會按您寫的單位理解。', 'We will read the unit you write.', 'other')
          ],
          inputLabel: L('圈号数字', '圈號數字', 'Size'),
          inputPh: L('例如 12 或 16.5', '例如 12 或 16.5', 'e.g. 12 or 16.5')
        });
      }
      if (piece.jewelryType === 'NECKLACE') {
        list.push({
          id: meta.pieceId + ':withChain',
          pieceId: meta.pieceId,
          field: 'withChain',
          art: 'necklace',
          kicker: who,
          title: L('这件项链要配链吗？', '這件項鍊要配鏈嗎？', 'Should this necklace include a chain?'),
          lead: L('只做吊坠也可以。配链的话，下一步再选样式。', '只做吊墜也可以。配鏈的話，下一步再選樣式。', 'A pendant alone is fine. A chain is chosen next.'),
          guideTitle: L('吊坠和链可以分开', '吊墜和鏈可以分開', 'Pendant and chain are separate'),
          guideBody: L('不配链时，我们只做主体。您以后可以自己穿绳或另配链。', '不配鏈時，我們只做主體。您以後可以自己穿繩或另配鏈。', 'Without a chain we make the pendant only.', ),
          choices: [
            choice('YES', '配链', '配鏈', 'Include a chain', '下一步选择链子样式。', '下一步選擇鏈子樣式。', 'Choose the style next.', 'chain'),
            choice('NO', '不配链', '不配鏈', 'No chain', '只做吊坠或主体。', '只做吊墜或主體。', 'Pendant only.', 'charm')
          ]
        });
        if (piece.withChain === true || piece.withChain === 'YES') {
          list.push(chainStep(meta.pieceId, who));
        }
      }
      if (piece.jewelryType === 'COLLARBONE') list.push(chainStep(meta.pieceId, who));
      if (piece.jewelryType === 'BRACELET') {
        list.push({
          id: meta.pieceId + ':bracelet',
          pieceId: meta.pieceId,
          field: 'braceletMeasure',
          textField: 'braceletValue',
          art: 'bracelet',
          kicker: who,
          title: L('手镯怎么量？', '手鐲怎麼量？', 'How should we measure the bangle?'),
          lead: L('三种圈口量法不同，请先选和您的镯子一致的那种，再填数字。', '三種圈口量法不同，請先選和您的鐲子一致的那種，再填數字。', 'Pick the method that matches the bracelet, then enter the number.'),
          guideTitle: L('三种圈口', '三種圈口', 'Three ways to measure'),
          guideBody: L(
            '闭口硬镯量内径：镯子放平，量内侧最宽的直线距离，单位毫米。欧式硬镯量内圈周长，单位厘米。开口手链量手腕最细处的周长，我们会再留 1.5～2 厘米，避免扣上后勒手。',
            '閉口硬鐲量內徑：鐲子放平，量內側最寬的直線距離，單位毫米。歐式硬鐲量內圈周長，單位厘米。開口手鏈量手腕最細處的周長，我們會再留 1.5～2 厘米，避免扣上後勒手。',
            'Closed bangles use inner diameter in mm. European bangles use inner circumference in cm. Open bracelets use the wrist, and we add 1.5–2 cm of ease.'
          ),
          choices: [
            choice('CLOSED_MM', '闭口硬镯', '閉口硬鐲', 'Closed bangle', '填内径，单位毫米。', '填內徑，單位毫米。', 'Inner diameter in mm.', 'bangle-id'),
            choice('EUROPE_CM', '欧式硬镯', '歐式硬鐲', 'European bangle', '填内圈周长，单位厘米。', '填內圈周長，單位厘米。', 'Inner circumference in cm.', 'bangle-circ'),
            choice('OPEN_WRIST_CM', '开口手链', '開口手鏈', 'Open bracelet', '填腕围，单位厘米。我们另加 1.5～2 厘米余量。', '填腕圍，單位厘米。我們另加 1.5～2 厘米餘量。', 'Wrist size in cm. We add 1.5–2 cm.', 'bangle-open')
          ],
          inputLabel: L('尺寸数字', '尺寸數字', 'Measurement'),
          inputPh: L('例如 58 或 16', '例如 58 或 16', 'e.g. 58 or 16')
        });
      }
      if (piece.jewelryType === 'HAIR') {
        list.push({
          id: meta.pieceId + ':hair',
          pieceId: meta.pieceId,
          field: 'hairKind',
          art: 'hair',
          kicker: who,
          title: L('是哪种发饰？', '是哪種髮飾？', 'Which hair ornament?'),
          lead: L('发夹、簪子和发链的结构和受力不一样。', '髮夾、簪子和髮鏈的結構和受力不一樣。', 'Clips, pins and chains are built differently.'),
          guideTitle: L('怎么选', '怎麼選', 'How to choose'),
          guideBody: L('发夹要夹住头发，簧片要有弹性。簪子靠插入固定，杆不能太软。发链是绕在头发或辫子上的细链。', '髮夾要夾住頭髮，簧片要有彈性。簪子靠插入固定，桿不能太軟。髮鏈是繞在頭髮或辮子上的細鏈。', 'A clip needs a spring. A pin is pushed through the hair. A chain wraps a braid.'),
          choices: [
            choice('CLIP', '发夹', '髮夾', 'Clip', '夹持，适合半扎或刘海。', '夾持，適合半紮或劉海。', 'Clips a section of hair.', 'hair-clip'),
            choice('PIN', '簪子', '簪子', 'Pin', '插入发髻。', '插入髮髻。', 'Slides into a bun.', 'hair-pin'),
            choice('CHAIN', '发链', '髮鏈', 'Hair chain', '绕在辫子或发束上。', '繞在辮子或髮束上。', 'Wraps a braid.', 'hair-chain'),
            choice('OTHER', '其他', '其他', 'Other', '群里说明戴法。', '群裡說明戴法。', 'Describe how it is worn.', 'other')
          ]
        });
      }
      list.push({
        id: meta.pieceId + ':plating',
        pieceId: meta.pieceId,
        field: 'plating',
        art: 'plating',
        kicker: who,
        title: L('需要电镀吗？', '需要電鍍嗎？', 'Do you want plating?'),
        lead: L('电镀是在金属表面再罩一层颜色。不镀就保留材料本身的颜色。', '電鍍是在金屬表面再罩一層顏色。不鍍就保留材料本身的顏色。', 'Plating adds a surface color. Without it you see the metal itself.'),
        guideTitle: L('颜色和金属不是一回事', '顏色和金屬不是一回事', 'Color and metal differ'),
        guideBody: L(
          '例如 14K 本身多是黄金色。如果您想要白金那种冷白，需要选电镀白。白电镀久了高点可能磨出底色，这是正常损耗，不是褪成另一种金属。分色是一件上同时有两种颜色。',
          '例如 14K 本身多是黃金色。如果您想要白金那種冷白，需要選電鍍白。白電鍍久了高點可能磨出底色，這是正常損耗，不是褪成另一種金屬。分色是一件上同時有兩種顏色。',
          '14K is usually yellow. White plating makes it look cool. High points can wear back to the base color over time. Two-tone means two colors on one piece.'
        ),
        choices: [
          choice('NONE', '不电镀', '不電鍍', 'No plating', '保留金属本色。', '保留金屬本色。', 'Keep the metal color.', 'plating-none'),
          choice('WHITE', '白', '白', 'White', '冷白，接近铂金或银。', '冷白，接近鉑金或銀。', 'Cool white.', 'plating-white'),
          choice('YELLOW', '黄', '黃', 'Yellow', '暖金，颜色更均匀。', '暖金，顏色更均勻。', 'Even warm gold.', 'plating-yellow'),
          choice('ROSE', '玫瑰金', '玫瑰金', 'Rose', '偏粉的暖红。', '偏粉的暖紅。', 'Warm pink-gold.', 'plating-rose'),
          choice('SPLIT', '分色', '分色', 'Two-tone', '一件上两种金属色。', '一件上兩種金屬色。', 'Two colors on one piece.', 'plating-split'),
          choice('OTHER', '其他', '其他', 'Other', '在群里说明颜色。', '在群裡說明顏色。', 'Describe the color in chat.', 'other')
        ]
      });
      list.push({
        id: meta.pieceId + ':enamel',
        pieceId: meta.pieceId,
        field: 'enamel',
        art: 'enamel',
        kicker: who,
        title: L('要做法琅吗？', '要做法瑯嗎？', 'Do you want enamel?'),
        lead: L('珐琅是烧在金属上的彩色釉，用来做块面颜色，不是电镀。', '琺瑯是燒在金屬上的彩色釉，用來做塊面顏色，不是電鍍。', 'Enamel is colored glass fused onto metal, not plating.'),
        guideTitle: L('珐琅适合什么', '琺瑯適合什麼', 'When enamel works'),
        guideBody: L('适合想要明确色块的款，比如蓝底、绿叶。釉面怕硬磕，边缘通常会留一圈金属保护。如果不需要大块颜色，选不需要。', '適合想要明確色塊的款，比如藍底、綠葉。釉面怕硬磕，邊緣通常會留一圈金屬保護。如果不需要大塊顏色，選不需要。', 'Use it for solid color areas. The edge is usually protected by metal. Skip it if you do not want color blocks.'),
        choices: [
          choice('YES', '需要', '需要', 'Yes', '做彩色釉面。', '做彩色釉面。', 'Add enamel color.', 'enamel'),
          choice('NO', '不需要', '不需要', 'No', '只有金属和镶石。', '只有金屬和鑲石。', 'Metal and stones only.', 'metal')
        ]
      });
      if (form.inlayAllowed !== false) {
        list.push({
          id: meta.pieceId + ':inlay',
          pieceId: meta.pieceId,
          field: 'inlay',
          art: 'stone',
          kicker: who,
          title: L('要镶石头吗？', '要鑲石頭嗎？', 'Set any stones?'),
          lead: L('可以自己指定，也可以交给设计师按预算选。', '可以自己指定，也可以交給設計師按預算選。', 'Choose yourself, or let the designer decide within the budget.'),
          guideTitle: L('这只是偏好', '這只是偏好', 'This is a preference'),
          guideBody: L('具体粒数、切工和尺寸由设计师按结构和预算填写。您选的品类和颜色会被尽量采纳，但不能保证原样实现。', '具體粒數、切工和尺寸由設計師按結構和預算填寫。您選的品類和顏色會被盡量採納，但不能保證原樣實現。', 'Count, cut and size are set by the designer. Your preference is followed where the budget allows.'),
          choices: [
            choice('NO', '不镶嵌', '不鑲嵌', 'No stones', '只做金属。', '只做金屬。', 'Metal only.', 'plating'),
            choice('YES', '我来选', '我來選', 'I will choose', '下一步选品类和颜色。', '下一步選品類和顏色。', 'Choose material and color next.', 'stone'),
            choice('DESIGNER', '让设计师决定', '讓設計師決定', 'Designer decides', '按预算选最合适的石头。', '按預算選最合適的石頭。', 'The designer chooses within budget.', 'welcome')
          ]
        });
        if (piece.inlay === 'YES') {
          list.push({
            id: meta.pieceId + ':stone',
            pieceId: meta.pieceId,
            field: 'stoneCategory',
            art: 'stone',
            kicker: who,
            title: L('喜欢哪种石头？', '喜歡哪種石頭？', 'Which stone do you prefer?'),
            lead: L('差别主要在火彩、硬度和颜色是否浓。下面每一种都可以点开看说明。', '差別主要在火彩、硬度和顏色是否濃。下面每一種都可以點開看說明。', 'They differ in fire, hardness and color depth.'),
            guideTitle: L('先看质感，不看价格牌', '先看質感，不看價格牌', 'Look at the character first'),
            guideBody: L('火彩强的石头彩虹更多。培育钻更接近钻石的白亮。玻璃和锆石更轻、更好做颜色，但也更容易留下使用痕迹。', '火彩強的石頭彩虹更多。培育鑽更接近鑽石的白亮。玻璃和鋯石更輕、更好做顏色，但也更容易留下使用痕跡。', 'High fire means more rainbow. A lab diamond is whiter. Glass and cubic zirconia take color easily and show wear sooner.'),
            choices: stoneChoices()
          });
          list.push({
            id: meta.pieceId + ':color',
            pieceId: meta.pieceId,
            field: 'stoneColor',
            art: 'stone',
            kicker: who,
            title: L('想要什么颜色？', '想要什麼顏色？', 'Which color?'),
            lead: L('同一色系里深浅差很多。这里先定方向，深浅由设计师按参考图再确认。', '同一色系裡深淺差很多。這裡先定方向，深淺由設計師按參考圖再確認。', 'This sets the direction. Depth is confirmed from your reference.'),
            guideTitle: L('颜色会受金属影响', '顏色會受金屬影響', 'Metal changes the color'),
            guideBody: L('黄金会把浅色石头衬得更暖，白或铂金会让颜色更冷、更清楚。若您有照片，发到订单群里最准确。', '黃金會把淺色石頭襯得更暖，白或鉑金會讓顏色更冷、更清楚。若您有照片，發到訂單群裡最準確。', 'Yellow gold warms a pale stone. White metal makes the color cooler and clearer.'),
            choices: colorChoices()
          });
        }
      }
    });
    list.push({
      id: 'budget',
      kind: 'amount',
      art: 'budget',
      kicker: L('整单', '整單', 'Whole order'),
      title: L('成品预算大概是多少？', '成品預算大概是多少？', 'What is the finished budget?'),
      lead: t('brief.budget.note'),
      guideTitle: L('请自己填写金额', '請自己填寫金額', 'Enter the amount yourself'),
      guideBody: L(
        '不设固定档位。写下您心里的成品预算，单位是人民币元，例如 8000，或 1.2万。我们会在这个金额附近做成能呈现的最好效果。更高的预算可以支持更复杂的结构、更精细的刻面，以及更考究的表面。这不是最终报价。',
        '不設固定檔位。寫下您心裡的成品預算，單位是人民幣元，例如 8000，或 1.2萬。我們會在這個金額附近做成能呈現的最好效果。更高的預算可以支持更複雜的結構、更精細的刻面，以及更考究的表面。這不是最終報價。',
        'Type the finished budget in CNY, for example 8000. We will aim for the best result around that amount. This is not the final quote.'
      )
    });
    list.push({
      id: 'review',
      kind: 'review',
      art: 'review',
      kicker: form.orderNumber || '',
      title: L('请看一眼再提交', '請看一眼再提交', 'Review before sending'),
      lead: t('brief.disclaimer'),
      guideTitle: L('提交之后', '提交之後', 'After you send it'),
      guideBody: L('这些选择会交给设计师。拉丝、喷砂、钉砂等其他工艺不在这里选，由设计师按实物填写。某一件设计被确认后，问卷不能再改。', '這些選擇會交給設計師。拉絲、噴砂、釘砂等其他工藝不在這裡選，由設計師按實物填寫。某一件設計被確認後，問卷不能再改。', 'The designer receives this. Other surface finishes are chosen by the designer. The form locks after a design is confirmed.')
    });
    return list;
  }

  function chainStep(pieceId, who) {
    return {
      id: pieceId + ':chain',
      pieceId: pieceId,
      field: 'chainStyle',
      art: 'chain',
      kicker: who,
      title: L('要哪种链子？', '要哪種鏈子？', 'Which chain?'),
      lead: L('点一下可以看到它贴肤、闪光和厚薄的差别。', '點一下可以看到它貼膚、閃光和厚薄的差別。', 'Select one to see how it sits and shines.'),
      guideTitle: L('链子的差别', '鏈子的差別', 'How the chains differ'),
      guideBody: L('圆链最顺。扁链更贴脖子。刻面越多越闪，也更怕磕。不确定时可以选其他，并在群里发图。', '圓鏈最順。扁鏈更貼脖子。刻面越多越閃，也更怕磕。不確定時可以選其他，並在群裡發圖。', 'Round links feel easiest. Flat links sit closer. More facets mean more sparkle and less tolerance for knocks.'),
      choices: chainChoices()
    };
  }

  function currentSteps() {
    return stepsFor();
  }

  function readValue(step) {
    if (step.id === 'budget') return form.budgetBand || '';
    if (!step.pieceId) return '';
    var piece = answerOf(step.pieceId);
    if (step.field === 'withChain') {
      if (piece.withChain === true) return 'YES';
      if (piece.withChain === false) return 'NO';
      return '';
    }
    return piece[step.field] || '';
  }

  function writeValue(step, value) {
    if (step.id === 'budget') {
      form.budgetBand = value;
      return;
    }
    var piece = answerOf(step.pieceId);
    if (step.field === 'withChain') piece.withChain = value === 'YES';
    else piece[step.field] = value;
    if (step.field === 'jewelryType') {
      piece.ringUnit = '';
      piece.ringSize = '';
      piece.withChain = null;
      piece.chainStyle = '';
      piece.braceletMeasure = '';
      piece.braceletValue = '';
      piece.hairKind = '';
    }
    if (step.field === 'withChain' && value !== 'YES') piece.chainStyle = '';
    if (step.field === 'inlay' && value !== 'YES') {
      piece.stoneCategory = '';
      piece.stoneColor = '';
    }
  }

  function stepError(step) {
    if (step.kind === 'info' || step.kind === 'review' || step.kind === 'amount') {
      if (step.kind === 'amount' && !String(form.budgetBand || '').trim()) return t('brief.missing');
      return '';
    }
    if (!readValue(step)) return t('brief.missing');
    if (step.textField) {
      var piece = answerOf(step.pieceId);
      if (!String(piece[step.textField] || '').trim()) return t('brief.missing');
    }
    return '';
  }

  function summaryLines() {
    var lines = [];
    if (form.metalLabel) lines.push(L('金属 ', '金屬 ', 'Metal ') + form.metalLabel);
    (form.pieceNames || []).forEach(function (meta) {
      var piece = answerOf(meta.pieceId);
      var bits = [nameOf(meta.pieceId)];
      var type = labelOf([
        choice('RING', '戒指', '戒指', 'Ring', '', '', ''),
        choice('NECKLACE', '项链', '項鍊', 'Necklace', '', '', ''),
        choice('BROOCH', '胸针', '胸針', 'Brooch', '', '', ''),
        choice('EARRING', '耳钉/耳饰', '耳釘/耳飾', 'Earrings', '', '', ''),
        choice('BRACELET', '手镯', '手鐲', 'Bangle', '', '', ''),
        choice('COLLARBONE', '锁骨链', '鎖骨鏈', 'Collarbone chain', '', '', ''),
        choice('HAIR', '发饰', '髮飾', 'Hair ornament', '', '', ''),
        choice('CHARM', '小挂件', '小掛件', 'Charm', '', '', ''),
        choice('OTHER', '其他', '其他', 'Other', '', '', '')
      ], piece.jewelryType);
      if (type) bits.push(type);
      if (piece.jewelryType === 'RING' && piece.ringSize) bits.push((piece.ringUnit || '') + ' ' + piece.ringSize);
      if (piece.withChain === true) bits.push(L('配链', '配鏈', 'chain'));
      if (piece.withChain === false) bits.push(L('不配链', '不配鏈', 'no chain'));
      if (piece.chainStyle) bits.push(labelOf(chainChoices(), piece.chainStyle));
      if (piece.braceletValue) bits.push(piece.braceletValue);
      if (piece.plating) {
        var platingName = { NONE: L('不电镀', '不電鍍', 'no plating'), WHITE: L('电镀白', '電鍍白', 'white'), YELLOW: L('电镀黄', '電鍍黃', 'yellow'), ROSE: L('玫瑰金', '玫瑰金', 'rose'), SPLIT: L('分色', '分色', 'two-tone'), OTHER: L('其他电镀', '其他電鍍', 'other plating') };
        bits.push(platingName[piece.plating] || piece.plating);
      }
      if (piece.enamel) bits.push(piece.enamel === 'YES' ? L('要珐琅', '要琺瑯', 'enamel') : L('不要珐琅', '不要琺瑯', 'no enamel'));
      if (piece.inlay === 'DESIGNER') bits.push(L('镶石交给设计师', '鑲石交給設計師', 'designer chooses stones'));
      if (piece.inlay === 'YES') bits.push((piece.stoneCategory || '') + ' ' + (piece.stoneColor || ''));
      lines.push(bits.filter(Boolean).join(' · '));
    });
    if (form.budgetBand) lines.push(L('预算 ', '預算 ', 'Budget ') + form.budgetBand);
    return lines;
  }

  function collect() {
    return {
      budgetBand: form.budgetBand,
      pieces: (form.pieceNames || []).map(function (meta) {
        var piece = answerOf(meta.pieceId);
        var item = {
          pieceId: Number(meta.pieceId),
          jewelryType: piece.jewelryType,
          plating: piece.plating,
          enamel: piece.enamel
        };
        if (piece.jewelryType === 'RING') {
          item.ringUnit = piece.ringUnit;
          item.ringSize = piece.ringSize;
        }
        if (piece.jewelryType === 'NECKLACE') {
          item.withChain = piece.withChain === true;
          if (item.withChain) item.chainStyle = piece.chainStyle;
        }
        if (piece.jewelryType === 'COLLARBONE') item.chainStyle = piece.chainStyle;
        if (piece.jewelryType === 'BRACELET') {
          item.braceletMeasure = piece.braceletMeasure;
          item.braceletValue = piece.braceletValue;
        }
        if (piece.jewelryType === 'HAIR') item.hairKind = piece.hairKind;
        if (form.inlayAllowed === false) item.inlay = 'NO';
        else {
          item.inlay = piece.inlay;
          if (item.inlay === 'YES') {
            item.stoneCategory = piece.stoneCategory;
            item.stoneColor = piece.stoneColor;
          }
        }
        return item;
      })
    };
  }

  function showGuide(art, title, body) {
    var guide = document.querySelector('.wiz__guide');
    if (!guide) return;
    guide.innerHTML = '';
    var picture = el('div', 'wiz__art');
    picture.innerHTML = window.BRIEF_ART.plate(art);
    guide.appendChild(picture);
    guide.appendChild(el('h2', 'wiz__guide-title', title));
    String(body || '').split('\n').forEach(function (line) {
      if (line.trim()) guide.appendChild(el('p', 'wiz__guide-body', line));
    });
  }

  function render() {
    var steps = currentSteps();
    if (stepIndex >= steps.length) stepIndex = steps.length - 1;
    if (stepIndex < 0) stepIndex = 0;
    var step = steps[stepIndex];
    app.innerHTML = '';
    var shell = el('section', 'wiz');
    var top = el('header', 'wiz__top');
    top.appendChild(el('span', 'wiz__brand', 'duxury'));
    top.appendChild(el('span', 'wiz__order', form.orderNumber || ''));
    top.appendChild(el('span', 'wiz__count', (stepIndex + 1) + ' / ' + steps.length));
    shell.appendChild(top);
    var bar = el('div', 'wiz__progress');
    var fill = el('span', 'wiz__progress-fill');
    fill.style.width = Math.round(((stepIndex + 1) / steps.length) * 100) + '%';
    bar.appendChild(fill);
    shell.appendChild(bar);

    var stage = el('div', 'wiz__stage');
    var guide = el('aside', 'wiz__guide');
    stage.appendChild(guide);
    var ask = el('div', 'wiz__ask');
    if (step.kicker) ask.appendChild(el('p', 'wiz__kicker', step.kicker));
    ask.appendChild(el('h1', 'wiz__title', step.title));
    ask.appendChild(el('p', 'wiz__lead', step.lead));

    if (step.kind === 'review') {
      var list = el('ul', 'wiz__review');
      summaryLines().forEach(function (line) {
        list.appendChild(el('li', '', line));
      });
      ask.appendChild(list);
    } else if (step.choices) {
      var grid = el('div', 'wiz__choices');
      var selected = readValue(step);
      step.choices.forEach(function (item) {
        var card = el('button', 'wiz__choice' + (item.value === selected ? ' is-on' : ''));
        card.type = 'button';
        var glyph = el('span', 'wiz__glyph');
        glyph.innerHTML = window.BRIEF_ART.mark(item.art || 'other');
        if (step.field === 'stoneColor') {
          glyph.className = 'wiz__swatch wiz__swatch--' + item.value.toLowerCase();
          glyph.innerHTML = '';
        }
        card.appendChild(glyph);
        var text = el('span', 'wiz__choice-text');
        text.appendChild(el('strong', '', item.label));
        text.appendChild(el('small', '', item.note));
        card.appendChild(text);
        function focusChoice() {
          guideKey = item.value;
          showGuide(item.art || step.art, item.label, item.note);
        }
        card.addEventListener('mouseenter', focusChoice);
        card.addEventListener('focus', focusChoice);
        card.addEventListener('click', function () {
          writeValue(step, item.value);
          render();
        });
        grid.appendChild(card);
      });
      ask.appendChild(grid);
    }

    if (step.textField) {
      var piece = answerOf(step.pieceId);
      var field = el('label', 'wiz__input');
      field.appendChild(el('span', '', step.inputLabel));
      var input = document.createElement('input');
      input.value = piece[step.textField] || '';
      input.placeholder = step.inputPh || '';
      input.addEventListener('input', function () {
        piece[step.textField] = input.value;
      });
      field.appendChild(input);
      ask.appendChild(field);
    }
    if (step.kind === 'amount') {
      var money = el('label', 'wiz__input wiz__input--money');
      money.appendChild(el('span', '', L('成品预算', '成品預算', 'Finished budget')));
      var amount = document.createElement('input');
      amount.maxLength = 80;
      amount.placeholder = L('例如 8000 或 1.2万', '例如 8000 或 1.2萬', 'e.g. 8000');
      amount.value = form.budgetBand || '';
      amount.addEventListener('input', function () {
        form.budgetBand = amount.value.trim();
      });
      money.appendChild(amount);
      money.appendChild(el('small', '', L('单位是人民币元，按您心里的成品价填写。', '單位是人民幣元，按您心裡的成品價填寫。', 'In CNY, for the finished piece.')));
      ask.appendChild(money);
    }
    var error = el('p', 'wiz__error');
    ask.appendChild(error);
    stage.appendChild(ask);
    shell.appendChild(stage);

    var footer = el('footer', 'wiz__bar');
    var back = el('button', 'wiz__back', L('上一步', '上一步', 'Back'));
    back.type = 'button';
    back.disabled = stepIndex === 0;
    back.addEventListener('click', function () {
      stepIndex -= 1;
      guideKey = '';
      render();
    });
    var next = el('button', 'wiz__next', step.kind === 'review' ? t('brief.submit') : L('下一步', '下一步', 'Next'));
    next.type = 'button';
    next.addEventListener('click', function () {
      var message = stepError(step);
      if (message) {
        error.textContent = message;
        return;
      }
      if (step.kind === 'review') {
        next.disabled = true;
        window.DUXURY_API.submitOrderBrief(orderId, collect()).then(done).catch(function (err) {
          next.disabled = false;
          error.textContent = err.message || 'Error';
        });
        return;
      }
      var id = step.id;
      stepIndex += 1;
      var nextSteps = currentSteps();
      var same = nextSteps.findIndex(function (item) { return item.id === id; });
      if (same >= 0) stepIndex = same + 1;
      if (stepIndex >= nextSteps.length) stepIndex = nextSteps.length - 1;
      guideKey = '';
      render();
    });
    footer.appendChild(back);
    footer.appendChild(next);
    shell.appendChild(footer);
    app.appendChild(shell);
    var active = (step.choices || []).find(function (item) { return item.value === (guideKey || readValue(step)); });
    if (active) showGuide(active.art || step.art, active.label, active.note);
    else showGuide(step.art, step.guideTitle, step.guideBody);
    stage.classList.add('is-in');
  }

  function done() {
    app.innerHTML = '';
    var card = el('section', 'wiz wiz--done');
    card.appendChild(el('p', 'wiz__brand', 'duxury'));
    card.appendChild(el('h1', 'wiz__title', t('brief.done')));
    card.appendChild(el('p', 'wiz__lead', t('brief.disclaimer')));
    var link = el('a', 'wiz__next', t('brief.back'));
    link.href = 'order-workspace.html';
    card.appendChild(link);
    app.appendChild(card);
  }

  function showLogin(message) {
    app.innerHTML = '';
    var card = el('section', 'brief__card');
    card.appendChild(el('p', 'brief__brand', 'duxury'));
    card.appendChild(el('h1', 'brief__title', t('brief.title')));
    card.appendChild(el('p', 'brief__lead', message || t('brief.login')));
    var email = document.createElement('input');
    email.className = 'checkout__input';
    email.type = 'email';
    email.placeholder = 'you@example.com';
    var code = document.createElement('input');
    code.className = 'checkout__input';
    code.placeholder = L('验证码', '驗證碼', 'Code');
    code.style.display = 'none';
    var button = el('button', 'btn btn--gold btn--lg brief__submit', L('发送验证码', '發送驗證碼', 'Send code'));
    button.type = 'button';
    var hint = el('p', 'brief__hint');
    button.addEventListener('click', function () {
      if (code.style.display === 'none') {
        window.DUXURY_API.sendVerificationCode(email.value.trim(), 'LOGIN').then(function () {
          code.style.display = '';
          button.textContent = L('登录', '登入', 'Sign in');
          hint.textContent = L('验证码已发送', '驗證碼已發送', 'Code sent');
        }).catch(function (err) {
          hint.textContent = err.message || 'Error';
        });
        return;
      }
      window.DUXURY_API.loginByCode(email.value.trim(), code.value.trim()).then(function (data) {
        localStorage.setItem('duxury-token', data.accessToken || '');
        localStorage.setItem('duxury-user', JSON.stringify({
          method: 'email',
          email: data.email || email.value.trim(),
          displayName: data.displayName || email.value.trim()
        }));
        load();
      }).catch(function (err) {
        hint.textContent = err.message || 'Error';
      });
    });
    card.appendChild(email);
    card.appendChild(code);
    card.appendChild(button);
    card.appendChild(hint);
    app.appendChild(card);
  }

  function load() {
    if (!orderId) {
      app.innerHTML = '';
      app.appendChild(el('p', 'brief__lead', 'Missing order'));
      return;
    }
    if (window.DUXURY_API.expireIfNeeded && window.DUXURY_API.expireIfNeeded()) {
      showLogin(t('login.expired'));
      return;
    }
    if (!localStorage.getItem('duxury-token')) {
      showLogin();
      return;
    }
    window.DUXURY_API.getOrderBrief(orderId).then(function (data) {
      form = data || {};
      form.pieces = form.pieces || [];
      stepIndex = 0;
      render();
    }).catch(function (err) {
      if (err.status === 401) {
        showLogin(t('login.expired'));
        return;
      }
      app.innerHTML = '';
      app.appendChild(el('p', 'brief__lead', err.message || 'Error'));
    });
  }

  document.addEventListener('duxury:auth-expired', function () {
    showLogin(t('login.expired'));
  });
  document.addEventListener('duxury:langchange', function () {
    if (form) render();
    else if (!localStorage.getItem('duxury-token')) showLogin();
  });

  load();
})();
