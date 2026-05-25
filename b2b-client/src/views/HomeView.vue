<template>
  <div class="home-container">
    <header class="header" :class="{ 'header--solid': headerSolid }">
      <div class="header-content">
        <div class="logo">
          <img src="/icons/icon-maskable.svg" alt="" class="nav-logo-mark" width="36" height="36" />
          <div class="logo-text-block">
            <span class="logo-text">恒鎏珠宝</span>
            <span class="logo-sub">定制服务</span>
          </div>
        </div>
        <nav class="nav">
          <a href="#about" class="nav-link">关于我们</a>
          <a href="#collections" class="nav-link">作品系列</a>
          <a href="#atelier" class="nav-link">工坊工艺</a>
          <a href="#contact" class="nav-link">联系方式</a>
        </nav>
        <router-link to="/portal" class="b2b-entrance">
          <span class="entrance-text">B端业务入口</span>
          <span class="entrance-arrow">→</span>
        </router-link>
      </div>
    </header>

    <!-- Hero：全屏单品轮播（Boucheron / Chanel 风格，无模特） -->
    <section class="hero">
      <div class="hero-slides">
        <div
          v-for="(slide, i) in heroSlides"
          :key="slide.src"
          class="hero-slide"
          :class="{ 'hero-slide--active': i === activeHero }"
        >
          <img :src="slide.src" :alt="slide.caption" class="hero-slide-img" />
          <div class="hero-slide-vignette" />
        </div>
      </div>
      <div class="hero-overlay">
        <p class="hero-eyebrow">恒鎏珠宝 · B2B Atelier</p>
        <h1 class="hero-title">{{ portal?.heroTitle || '匠心定制 · 永恒经典' }}</h1>
        <p class="hero-subtitle">
          {{ portal?.heroSubtitle || '以设计图与高精度 3D 建模，为 B 端伙伴呈现可生产的珠宝方案' }}
        </p>
        <div class="hero-actions">
          <router-link to="/portal" class="btn-primary">立即定制</router-link>
          <a href="#collections" class="btn-ghost">浏览作品</a>
        </div>
        <p class="hero-caption">{{ heroSlides[activeHero]?.caption }}</p>
      </div>
      <div class="hero-dots">
        <button
          v-for="(_, i) in heroSlides"
          :key="i"
          type="button"
          class="hero-dot"
          :class="{ 'hero-dot--active': i === activeHero }"
          :aria-label="`第 ${i + 1} 张`"
          @click="activeHero = i"
        />
      </div>
      <div class="scroll-indicator">
        <span class="scroll-text">Scroll</span>
        <div class="scroll-line" />
      </div>
    </section>

    <!-- 系列：不对称编辑网格（Bulgari / Pomellato） -->
    <section id="collections" class="section collections-section">
      <div class="section-intro">
        <span class="section-label">Collections</span>
        <h2 class="section-title">作品系列</h2>
        <p class="section-desc">以产品摄影级呈现，聚焦结构、材质与光影——无需模特，作品即主角。</p>
      </div>
      <div class="collections-grid">
        <router-link
          v-for="(cat, index) in displayCategories"
          :key="cat.slug"
          :to="`/gallery/${cat.slug}`"
          class="collection-card"
          :class="`collection-card--${index % 5}`"
        >
          <div class="collection-media">
            <img
              v-if="cat.coverUrl"
              :src="cat.coverUrl"
              :alt="cat.nameCn"
              class="collection-img"
              loading="lazy"
            />
          </div>
          <div class="collection-meta">
            <span class="collection-count">{{ cat.visibleItemCount }} 件作品</span>
            <h3 class="collection-name">{{ cat.nameCn }}</h3>
            <p class="collection-desc">{{ cat.description || '查看该分类精选展示' }}</p>
            <span class="collection-link">探索系列 →</span>
          </div>
        </router-link>
      </div>
    </section>

    <!-- 设计 → 建模（Chaumet / Buccellati 工坊叙事） -->
    <section id="process" class="section process-section">
      <div class="section-intro section-intro--light">
        <span class="section-label">From Sketch to Masterpiece</span>
        <h2 class="section-title">设计图 · 建模预览</h2>
        <p class="section-desc">从平面方案到可生产 3D 数据，直观呈现恒鎏珠宝定制全流程。</p>
      </div>
      <div class="process-grid">
        <article v-for="pair in designModelPairs" :key="pair.title" class="process-card">
          <h3 class="process-card-title">{{ pair.title }}</h3>
          <div class="process-pair">
            <figure class="process-figure">
              <img :src="pair.design.src" :alt="`${pair.title}设计图`" loading="lazy" />
              <figcaption>{{ pair.design.label }}</figcaption>
            </figure>
            <div class="process-arrow" aria-hidden="true">→</div>
            <figure class="process-figure process-figure--model">
              <img :src="pair.model.src" :alt="`${pair.title}建模预览`" loading="lazy" />
              <figcaption>{{ pair.model.label }}</figcaption>
            </figure>
          </div>
        </article>
      </div>
    </section>

    <!-- 高级定制横滑（Repossi / Chanel 横向画廊） -->
    <section class="haute-section">
      <div class="haute-header">
        <div>
          <span class="section-label section-label--gold">Haute Couture</span>
          <h2 class="section-title section-title--inline">高级定制设计图</h2>
        </div>
        <p class="haute-note">52 张原创方案 · 横滑浏览精选</p>
      </div>
      <div class="haute-track">
        <figure v-for="(src, i) in hauteCoutureStrip" :key="src" class="haute-item">
          <img :src="src" :alt="`高级定制设计 ${i + 1}`" loading="lazy" />
        </figure>
      </div>
    </section>

    <!-- 工坊工艺 -->
    <section id="atelier" class="section atelier-section">
      <div class="section-intro">
        <span class="section-label">Atelier</span>
        <h2 class="section-title">高精度珠宝建模</h2>
        <p class="section-desc">面向 B 端确认与生产的 3D 呈现，细节可审、结构可读。</p>
      </div>
      <div class="craft-grid">
        <article v-for="item in craftShowcase" :key="item.title" class="craft-card">
          <div class="craft-image-wrap">
            <img :src="item.src" :alt="item.title" loading="lazy" />
          </div>
          <div class="craft-body">
            <h3>{{ item.title }}</h3>
            <p>{{ item.text }}</p>
          </div>
        </article>
      </div>
    </section>

    <!-- 关于 -->
    <section id="about" class="section about-section">
      <div class="about-layout">
        <div class="about-visual">
          <img
            v-if="portal?.companyPhotos?.length"
            :src="portal.companyPhotos[0].url"
            alt="企业展示"
            class="about-photo"
          />
          <img v-else src="/showcase/about-01.jpg" alt="恒鎏珠宝定制作品" class="about-photo" />
        </div>
        <div class="about-copy">
          <span class="section-label">About 恒鎏珠宝</span>
          <h2 class="section-title section-title--left">关于恒鎏珠宝</h2>
          <div v-if="portal?.aboutHtml" class="about-description" v-html="portal.aboutHtml" />
          <p v-else class="about-description">
            恒鎏珠宝专注高端珠宝定制与 B 端协同服务。我们以原创设计、高精度建模与透明订单流程，
            帮助合作伙伴高效完成从需求到成品的全链路交付。
          </p>
          <ul class="about-features">
            <li v-for="f in atelierFeatures" :key="f.title">
              <strong>{{ f.title }}</strong>
              <span>{{ f.text }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="cta-section">
      <div class="cta-bg">
        <img src="/showcase/cta-bg.jpg" alt="" aria-hidden="true" />
      </div>
      <div class="cta-content">
        <span class="section-label section-label--gold">Partner With Us</span>
        <h2 class="cta-title">开启 B 端定制合作</h2>
        <p class="cta-subtitle">提交需求、上传参考图，Agent 智能录入或表单均可快速下单</p>
        <router-link to="/portal" class="btn-primary btn-large">立即提交需求</router-link>
      </div>
    </section>

    <!-- 联系 -->
    <section id="contact" class="section contact-section">
      <div class="section-intro">
        <span class="section-label">Contact</span>
        <h2 class="section-title">联系我们</h2>
      </div>
      <div class="contact-grid">
        <div class="contact-list">
          <div class="contact-item">
            <span class="contact-label">地址</span>
            <p>{{ portal?.address || '上海市静安区南京西路1266号恒隆广场33楼' }}</p>
          </div>
          <div class="contact-item">
            <span class="contact-label">电话</span>
            <p>{{ portal?.contactPhone || '400-888-8888' }}</p>
          </div>
          <div v-if="portal?.contactWechat" class="contact-item">
            <span class="contact-label">微信</span>
            <p>{{ portal.contactWechat }}</p>
          </div>
          <div class="contact-item">
            <span class="contact-label">邮箱</span>
            <p>{{ portal?.contactEmail || 'info@hengliujewelry.com' }}</p>
          </div>
          <div class="contact-item">
            <span class="contact-label">营业时间</span>
            <p>{{ portal?.businessHours || '周一至周日 10:00–21:00' }}</p>
          </div>
        </div>
        <div class="contact-aside">
          <p class="contact-aside-title">B 端业务咨询</p>
          <p class="contact-aside-text">欢迎珠宝零售商、定制工作室与品牌方洽谈长期合作。</p>
          <router-link to="/portal" class="btn-outline">进入业务门户</router-link>
        </div>
      </div>
    </section>

    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <img src="/icons/icon-maskable.svg" alt="" width="28" height="28" />
          <div>
            <div class="footer-logo-text">恒鎏珠宝</div>
            <div class="footer-tagline">匠心定制 · 永恒经典</div>
          </div>
        </div>
        <div class="footer-links">
          <a href="#about">关于我们</a>
          <a href="#collections">作品系列</a>
          <router-link to="/portal">B端业务</router-link>
          <a href="#contact">联系我们</a>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© {{ new Date().getFullYear() }} 恒鎏珠宝 · All rights reserved.</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getPortalHome, type PortalHomePublicDto } from '@/api'
import {
  heroSlides,
  fallbackCategories,
  designModelPairs,
  hauteCoutureStrip,
  craftShowcase,
  atelierFeatures
} from '@/data/homeShowcase'

const portal = ref<PortalHomePublicDto | null>(null)
const headerSolid = ref(false)
const activeHero = ref(0)
let heroTimer: ReturnType<typeof setInterval> | null = null

const displayCategories = computed(() => {
  const fromApi = portal.value?.categories?.filter((c) => c.coverUrl || c.visibleItemCount > 0)
  if (fromApi?.length) return fromApi
  return fallbackCategories
})

const onScroll = () => {
  headerSolid.value = window.scrollY > 48
}

onMounted(async () => {
  window.addEventListener('scroll', onScroll, { passive: true })
  heroTimer = setInterval(() => {
    activeHero.value = (activeHero.value + 1) % heroSlides.length
  }, 5500)
  try {
    portal.value = await getPortalHome()
  } catch {
    portal.value = null
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  if (heroTimer) clearInterval(heroTimer)
})
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  background: var(--ivory, #f7f4ef);
  color: var(--charcoal, #1a1814);
}

/* Header */
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  transition: background 0.4s ease, border-color 0.4s ease;
  border-bottom: 1px solid transparent;
}

.header--solid {
  background: rgba(247, 244, 239, 0.94);
  backdrop-filter: blur(12px);
  border-bottom-color: rgba(26, 24, 20, 0.08);
}

.header--solid .nav-link,
.header--solid .logo-text {
  color: var(--charcoal, #1a1814);
}

.header:not(.header--solid) .nav-link,
.header:not(.header--solid) .logo-text,
.header:not(.header--solid) .logo-sub {
  color: #fff;
}

.header:not(.header--solid) .logo-sub {
  opacity: 0.75;
}

.header-content {
  max-width: 1320px;
  margin: 0 auto;
  padding: 0 clamp(20px, 4vw, 48px);
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-logo-mark {
  border-radius: 8px;
}

.logo-text-block {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.logo-text {
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.28em;
}

.logo-sub {
  font-size: 10px;
  letter-spacing: 0.35em;
  text-transform: uppercase;
}

.nav {
  display: flex;
  gap: clamp(20px, 3vw, 40px);
}

.nav-link {
  text-decoration: none;
  font-size: 13px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.92;
  transition: opacity 0.25s;
}

.nav-link:hover {
  opacity: 1;
}

.b2b-entrance {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  border: 1px solid rgba(201, 169, 98, 0.85);
  color: #fff;
  text-decoration: none;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  transition: background 0.3s, color 0.3s;
}

.header--solid .b2b-entrance {
  background: var(--charcoal, #1a1814);
  border-color: var(--charcoal, #1a1814);
  color: #fff;
}

.b2b-entrance:hover {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #fff;
}

/* Hero */
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  background: #0e0d0b;
}

.hero-slides {
  position: absolute;
  inset: 0;
}

.hero-slide {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 1.2s ease;
}

.hero-slide--active {
  opacity: 1;
}

.hero-slide-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transform: scale(1.03);
  animation: heroKen 8s ease-out forwards;
}

.hero-slide--active .hero-slide-img {
  animation: heroKen 8s ease-out forwards;
}

@keyframes heroKen {
  from {
    transform: scale(1.08);
  }
  to {
    transform: scale(1);
  }
}

.hero-slide-vignette {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(to top, rgba(14, 13, 11, 0.88) 0%, rgba(14, 13, 11, 0.35) 45%, rgba(14, 13, 11, 0.15) 100%),
    linear-gradient(to right, rgba(14, 13, 11, 0.5) 0%, transparent 55%);
}

.hero-overlay {
  position: relative;
  z-index: 2;
  max-width: 1320px;
  width: 100%;
  margin: 0 auto;
  padding: 140px clamp(20px, 4vw, 48px) 120px;
}

.hero-eyebrow {
  font-size: 11px;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: var(--primary-light, #e5c89a);
  margin-bottom: 20px;
}

.hero-title {
  font-family: var(--font-serif);
  font-size: clamp(36px, 6vw, 68px);
  font-weight: 400;
  line-height: 1.15;
  color: #fff;
  max-width: 12ch;
  margin-bottom: 20px;
}

.hero-subtitle {
  font-size: clamp(14px, 1.6vw, 17px);
  line-height: 1.75;
  color: rgba(255, 255, 255, 0.78);
  max-width: 520px;
  margin-bottom: 36px;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 28px;
}

.btn-primary,
.btn-ghost,
.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 14px 32px;
  text-decoration: none;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  transition: all 0.3s ease;
}

.btn-primary {
  background: var(--primary-color);
  color: #fff;
  border: 1px solid var(--primary-color);
}

.btn-primary:hover {
  background: var(--primary-dark);
  border-color: var(--primary-dark);
}

.btn-ghost {
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.45);
}

.btn-ghost:hover {
  border-color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.btn-outline {
  color: var(--charcoal);
  border: 1px solid var(--charcoal);
}

.btn-outline:hover {
  background: var(--charcoal);
  color: #fff;
}

.btn-large {
  padding: 16px 40px;
}

.hero-caption {
  font-size: 12px;
  letter-spacing: 0.2em;
  color: rgba(255, 255, 255, 0.55);
  text-transform: uppercase;
}

.hero-dots {
  position: absolute;
  right: clamp(20px, 4vw, 48px);
  bottom: 120px;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hero-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.45);
  background: transparent;
  cursor: pointer;
  padding: 0;
  transition: all 0.3s;
}

.hero-dot--active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  transform: scale(1.15);
}

.scroll-indicator {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  text-align: center;
}

.scroll-text {
  display: block;
  font-size: 10px;
  letter-spacing: 0.3em;
  color: rgba(255, 255, 255, 0.45);
  margin-bottom: 8px;
}

.scroll-line {
  width: 1px;
  height: 40px;
  margin: 0 auto;
  background: linear-gradient(to bottom, var(--primary-color), transparent);
  animation: scrollPulse 2s ease infinite;
}

@keyframes scrollPulse {
  0%,
  100% {
    opacity: 0.4;
    transform: scaleY(0.8);
  }
  50% {
    opacity: 1;
    transform: scaleY(1);
  }
}

/* Sections */
.section {
  max-width: 1320px;
  margin: 0 auto;
  padding: clamp(72px, 10vw, 120px) clamp(20px, 4vw, 48px);
}

.section-intro {
  text-align: center;
  max-width: 640px;
  margin: 0 auto 56px;
}

.section-intro--light .section-title,
.section-intro--light .section-desc {
  color: #f7f4ef;
}

.section-label {
  display: block;
  font-size: 11px;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: var(--warm-gray, #6b6560);
  margin-bottom: 12px;
}

.section-label--gold {
  color: var(--primary-color);
}

.section-title {
  font-family: var(--font-serif);
  font-size: clamp(28px, 4vw, 42px);
  font-weight: 400;
  margin-bottom: 16px;
}

.section-title--left {
  text-align: left;
}

.section-title--inline {
  display: inline;
  margin-left: 12px;
}

.section-desc {
  font-size: 15px;
  line-height: 1.8;
  color: var(--warm-gray, #6b6560);
}

/* Collections */
.collections-section {
  background: var(--ivory, #f7f4ef);
}

.collections-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 20px;
}

.collection-card {
  position: relative;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  background: #fff;
  min-height: 360px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.collection-card--0 {
  grid-column: span 7;
  min-height: 480px;
}

.collection-card--1 {
  grid-column: span 5;
}

.collection-card--2 {
  grid-column: span 5;
}

.collection-card--3 {
  grid-column: span 4;
}

.collection-card--4 {
  grid-column: span 3;
}

.collection-media {
  position: absolute;
  inset: 0;
}

.collection-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.collection-card:hover .collection-img {
  transform: scale(1.06);
}

.collection-meta {
  position: relative;
  z-index: 1;
  padding: 28px;
  background: linear-gradient(to top, rgba(26, 24, 20, 0.82), transparent);
  color: #fff;
}

.collection-count {
  font-size: 10px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  opacity: 0.75;
}

.collection-name {
  font-family: var(--font-serif);
  font-size: 28px;
  font-weight: 400;
  margin: 8px 0;
}

.collection-desc {
  font-size: 13px;
  opacity: 0.8;
  margin-bottom: 12px;
}

.collection-link {
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  opacity: 0.9;
}

/* Process */
.process-section {
  background: var(--charcoal, #1a1814);
  max-width: none;
  padding-left: 0;
  padding-right: 0;
}

.process-section .section-intro,
.process-grid {
  max-width: 1320px;
  margin-left: auto;
  margin-right: auto;
  padding-left: clamp(20px, 4vw, 48px);
  padding-right: clamp(20px, 4vw, 48px);
}

.process-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.process-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 24px;
}

.process-card-title {
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 400;
  color: #fff;
  margin-bottom: 20px;
  text-align: center;
}

.process-pair {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
  align-items: center;
}

.process-figure {
  margin: 0;
}

.process-figure img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  background: #fff;
}

.process-figure figcaption {
  text-align: center;
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  margin-top: 10px;
}

.process-figure--model img {
  background: #2a2824;
}

.process-arrow {
  color: var(--primary-color);
  font-size: 18px;
}

/* Haute strip */
.haute-section {
  background: #11100e;
  padding: 72px 0 80px;
  overflow: hidden;
}

.haute-header {
  max-width: 1320px;
  margin: 0 auto 32px;
  padding: 0 clamp(20px, 4vw, 48px);
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  flex-wrap: wrap;
}

.haute-header .section-title {
  color: #fff;
  margin: 0;
}

.haute-note {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.haute-track {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 0 clamp(20px, 4vw, 48px) 8px;
  scroll-snap-type: x mandatory;
  scrollbar-width: thin;
}

.haute-item {
  flex: 0 0 clamp(220px, 28vw, 320px);
  margin: 0;
  scroll-snap-align: start;
}

.haute-item img {
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  display: block;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* Craft */
.atelier-section {
  background: #fff;
}

.craft-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.craft-card {
  border: 1px solid rgba(26, 24, 20, 0.08);
}

.craft-image-wrap {
  aspect-ratio: 4 / 3;
  overflow: hidden;
}

.craft-image-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s ease;
}

.craft-card:hover .craft-image-wrap img {
  transform: scale(1.04);
}

.craft-body {
  padding: 24px;
}

.craft-body h3 {
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 400;
  margin-bottom: 8px;
}

.craft-body p {
  font-size: 14px;
  line-height: 1.7;
  color: var(--warm-gray);
}

/* About */
.about-section {
  background: var(--ivory, #f7f4ef);
}

.about-layout {
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  gap: clamp(32px, 5vw, 72px);
  align-items: center;
}

.about-photo {
  width: 100%;
  aspect-ratio: 4 / 5;
  object-fit: cover;
  display: block;
}

.about-description {
  font-size: 16px;
  line-height: 1.85;
  color: var(--warm-gray);
  margin-bottom: 32px;
}

.about-features {
  list-style: none;
  display: grid;
  gap: 20px;
}

.about-features li {
  padding-left: 16px;
  border-left: 2px solid var(--primary-color);
}

.about-features strong {
  display: block;
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 400;
  margin-bottom: 4px;
}

.about-features span {
  font-size: 14px;
  color: var(--warm-gray);
  line-height: 1.6;
}

/* CTA */
.cta-section {
  position: relative;
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.cta-bg {
  position: absolute;
  inset: 0;
}

.cta-bg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cta-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(26, 24, 20, 0.72);
}

.cta-content {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 48px 24px;
  max-width: 640px;
}

.cta-title {
  font-family: var(--font-serif);
  font-size: clamp(28px, 4vw, 44px);
  font-weight: 400;
  color: #fff;
  margin-bottom: 16px;
}

.cta-subtitle {
  color: rgba(255, 255, 255, 0.72);
  margin-bottom: 32px;
  line-height: 1.7;
}

/* Contact */
.contact-section {
  background: #fff;
}

.contact-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 48px;
}

.contact-list {
  display: grid;
  gap: 24px;
}

.contact-label {
  display: block;
  font-size: 10px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--warm-gray);
  margin-bottom: 6px;
}

.contact-item p {
  font-size: 15px;
  line-height: 1.6;
}

.contact-aside {
  padding: 32px;
  background: var(--ivory);
  border: 1px solid rgba(26, 24, 20, 0.06);
}

.contact-aside-title {
  font-family: var(--font-serif);
  font-size: 22px;
  margin-bottom: 12px;
}

.contact-aside-text {
  font-size: 14px;
  color: var(--warm-gray);
  line-height: 1.7;
  margin-bottom: 24px;
}

/* Footer */
.footer {
  background: var(--charcoal);
  color: rgba(255, 255, 255, 0.65);
  padding: 48px clamp(20px, 4vw, 48px) 24px;
}

.footer-inner {
  max-width: 1320px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
  padding-bottom: 32px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.footer-logo-text {
  font-family: var(--font-serif);
  letter-spacing: 0.25em;
  color: #fff;
}

.footer-tagline {
  font-size: 11px;
  letter-spacing: 0.15em;
  margin-top: 4px;
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.footer-links a {
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  transition: color 0.25s;
}

.footer-links a:hover {
  color: var(--primary-light);
}

.footer-bottom {
  max-width: 1320px;
  margin: 24px auto 0;
  text-align: center;
  font-size: 12px;
}

@media (max-width: 1024px) {
  .collections-grid {
    grid-template-columns: 1fr 1fr;
  }

  .collection-card--0,
  .collection-card--1,
  .collection-card--2,
  .collection-card--3,
  .collection-card--4 {
    grid-column: span 1;
    min-height: 320px;
  }

  .collection-card--0 {
    grid-column: span 2;
    min-height: 400px;
  }

  .process-grid,
  .craft-grid {
    grid-template-columns: 1fr;
  }

  .about-layout,
  .contact-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .nav {
    display: none;
  }

  .hero-dots {
    flex-direction: row;
    right: auto;
    left: 50%;
    transform: translateX(-50%);
    bottom: 88px;
  }

  .collections-grid {
    grid-template-columns: 1fr;
  }

  .collection-card--0 {
    grid-column: span 1;
  }

  .process-pair {
    grid-template-columns: 1fr;
  }

  .process-arrow {
    text-align: center;
    transform: rotate(90deg);
  }
}
</style>
