/** 首页展示素材（源自 网站美化材料/，已复制至 public/showcase/） */

export const heroSlides = [
  { src: '/showcase/hero-01.jpg', caption: '戒指 · 高精度建模' },
  { src: '/showcase/hero-02.jpg', caption: '戒指 · 工艺细节' },
  { src: '/showcase/hero-03.jpg', caption: '戒指 · 光影呈现' },
  { src: '/showcase/hero-04.jpg', caption: '戒指 · 结构美学' },
  { src: '/showcase/hero-05.jpg', caption: '戒指 · 定制系列' },
  { src: '/showcase/hero-06.jpg', caption: '戒指 · 臻品预览' },
  { src: '/showcase/hero-07.jpg', caption: '高级定制 · 设计手稿' },
  { src: '/showcase/hero-08.jpg', caption: '高级定制 · 原创方案' }
]

export const fallbackCategories = [
  {
    slug: 'ring',
    nameCn: '戒指',
    description: '189 件建模预览 · 设计图与 3D 还原',
    coverUrl: '/showcase/cat-ring.jpg',
    visibleItemCount: 189
  },
  {
    slug: 'necklace',
    nameCn: '项链',
    description: '链饰结构 · 建模精度展示',
    coverUrl: '/showcase/cat-necklace.jpg',
    visibleItemCount: 2
  },
  {
    slug: 'earrings',
    nameCn: '耳饰',
    description: '耳钉耳坠 · 对称与比例',
    coverUrl: '/showcase/cat-earrings.jpg',
    visibleItemCount: 6
  },
  {
    slug: 'bracelet',
    nameCn: '手镯',
    description: '手镯手链 · 曲面与镶嵌',
    coverUrl: '/showcase/cat-bracelet.jpg',
    visibleItemCount: 1
  },
  {
    slug: 'haute-couture',
    nameCn: '高级定制',
    description: '52 张原创设计图 · 一对一专属',
    coverUrl: '/showcase/cat-haute.jpg',
    visibleItemCount: 52
  }
]

export const designModelPairs = [
  {
    title: '戒指',
    design: { src: '/showcase/pair-ring-design.jpg', label: '设计图' },
    model: { src: '/showcase/pair-ring-model.jpg', label: '建模预览' }
  },
  {
    title: '耳饰',
    design: { src: '/showcase/pair-ear-design.jpg', label: '设计图' },
    model: { src: '/showcase/pair-ear-model.jpg', label: '建模预览' }
  },
  {
    title: '手镯',
    design: { src: '/showcase/pair-bracelet-design.jpg', label: '设计图' },
    model: { src: '/showcase/pair-bracelet-model.jpg', label: '建模预览' }
  }
]

export const hauteCoutureStrip = [
  '/showcase/haute-01.jpg',
  '/showcase/haute-02.jpg',
  '/showcase/haute-03.jpg',
  '/showcase/haute-04.jpg',
  '/showcase/haute-05.jpg',
  '/showcase/haute-06.jpg',
  '/showcase/haute-07.jpg',
  '/showcase/haute-08.jpg'
]

export const craftShowcase = [
  {
    src: '/showcase/craft-01.jpg',
    title: '结构精度',
    text: '爪镶、戒臂、石位关系按生产标准还原'
  },
  {
    src: '/showcase/craft-02.jpg',
    title: '光影质感',
    text: '金属曲面与宝石折射，接近成品视觉效果'
  },
  {
    src: '/showcase/craft-03.jpg',
    title: '工艺可读',
    text: '便于 B 端客户确认款式后再进入生产环节'
  }
]

export const atelierFeatures = [
  {
    title: '原创设计',
    text: '从手绘到数字化方案，每件作品独立构思'
  },
  {
    title: '高精度建模',
    text: '面向生产的 3D 数据，支持修模与工艺确认'
  },
  {
    title: 'B 端协同',
    text: '在线提交需求、跟踪进度，缩短定制周期'
  },
  {
    title: '专属定制',
    text: '材质、款式、结构可按订单灵活调整'
  }
]
