<template>
  <div class="home-container">
    <!-- 导航栏 -->
    <header class="header">
      <div class="header-content">
        <div class="logo">
          <span class="logo-icon">✨</span>
          <span class="logo-text">MOJE 珠宝</span>
        </div>
        <nav class="nav">
          <a href="#about" class="nav-link">关于我们</a>
          <a href="#products" class="nav-link">产品展示</a>
          <a href="#contact" class="nav-link">联系方式</a>
        </nav>
        <router-link to="/portal" class="b2b-entrance">
          <span class="entrance-text">B端业务入口</span>
          <span class="entrance-arrow">→</span>
        </router-link>
      </div>
    </header>

    <!-- Hero Section -->
    <section class="hero">
      <div class="hero-background">
        <div class="hero-gradient"></div>
      </div>
      <div class="hero-content">
        <div class="hero-text">
          <h1 class="hero-title">{{ portal?.heroTitle || '匠心定制·永恒经典' }}</h1>
          <p class="hero-subtitle">{{ portal?.heroSubtitle || 'MOJE 珠宝 - 专注高端珠宝定制服务' }}</p>
          <div v-if="portal?.carousel?.length" class="hero-carousel">
            <img v-for="(c, i) in portal.carousel" :key="i" :src="c.url" alt="" />
          </div>
          <div class="hero-buttons">
            <router-link to="/portal" class="btn-primary">立即定制</router-link>
            <a href="#about" class="btn-secondary">了解更多</a>
          </div>
        </div>
      </div>
      <div class="scroll-indicator">
        <span class="scroll-text">向下滚动</span>
        <div class="scroll-arrow"></div>
      </div>
    </section>

    <!-- 关于我们 -->
    <section id="about" class="section about-section">
      <div class="section-header">
        <span class="section-label">About Us</span>
        <h2 class="section-title">关于 MOJE</h2>
        <div class="section-divider"></div>
      </div>
      <div class="about-content">
        <div class="about-text">
          <div v-if="portal?.aboutHtml" class="about-description" v-html="portal.aboutHtml"></div>
          <p v-else class="about-description">
            MOJE 珠宝创立于2018年，致力于为全球客户提供高端定制珠宝服务。
            我们拥有专业的设计团队和精湛的工艺，每一件作品都凝聚着匠人的心血。
          </p>
          <div class="about-features">
            <div class="feature-item">
              <div class="feature-icon">💎</div>
              <h3 class="feature-title">精选原石</h3>
              <p class="feature-text">全球甄选优质钻石、彩宝，确保每件作品都熠熠生辉</p>
            </div>
            <div class="feature-item">
              <div class="feature-icon">✍️</div>
              <h3 class="feature-title">原创设计</h3>
              <p class="feature-text">资深设计师团队，每款设计都独一无二</p>
            </div>
            <div class="feature-item">
              <div class="feature-icon">⚒️</div>
              <h3 class="feature-title">精湛工艺</h3>
              <p class="feature-text">传统手工技艺与现代科技的完美结合</p>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🎯</div>
              <h3 class="feature-title">专属定制</h3>
              <p class="feature-text">一对一专属服务，打造您的专属珠宝</p>
            </div>
          </div>
        </div>
        <div class="about-image">
          <div v-if="portal?.companyPhotos?.length" class="company-photo-strip">
            <img v-for="(p, i) in portal.companyPhotos" :key="i" :src="p.url" alt="企业实拍" />
          </div>
          <div v-else class="about-image-placeholder">
            <span class="image-icon">🏛️</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 产品展示 -->
    <section id="products" class="section products-section">
      <div class="section-header">
        <span class="section-label">Our Collection</span>
        <h2 class="section-title">产品展示</h2>
        <div class="section-divider"></div>
      </div>
      <div class="products-grid">
        <router-link
          v-for="cat in portal?.categories || []"
          :key="cat.slug"
          :to="`/gallery/${cat.slug}`"
          class="product-card product-card--link"
        >
          <div class="product-image">
            <img v-if="cat.coverUrl" :src="cat.coverUrl" :alt="cat.nameCn" class="product-cover" />
            <span v-else class="product-icon">💎</span>
          </div>
          <div class="product-info">
            <h3 class="product-name">{{ cat.nameCn }}</h3>
            <p class="product-description">{{ cat.description || '查看该分类下管理员精选的建模与设计展示图' }}</p>
            <span class="product-tag">{{ cat.visibleItemCount }} 张展示</span>
          </div>
        </router-link>
        <template v-if="!(portal?.categories?.length)">
          <div class="product-card" v-for="(product, index) in products" :key="index">
            <div class="product-image">
              <span class="product-icon">{{ product.icon }}</span>
            </div>
            <div class="product-info">
              <h3 class="product-name">{{ product.name }}</h3>
              <p class="product-description">{{ product.description }}</p>
              <span class="product-tag">{{ product.tag }}</span>
            </div>
          </div>
        </template>
      </div>
    </section>

    <!-- CTA Section - 显眼的B端需求入口 -->
    <section class="cta-section">
      <div class="cta-content">
        <h2 class="cta-title">准备开始您的定制之旅？</h2>
        <p class="cta-subtitle">欢迎B端合作伙伴洽谈合作，共创美好未来</p>
        <div class="cta-buttons">
          <router-link to="/portal" class="btn-primary btn-large">
            <span>立即提交需求</span>
            <span>→</span>
          </router-link>
        </div>
      </div>
    </section>

    <!-- 联系我们 -->
    <section id="contact" class="section contact-section">
      <div class="section-header">
        <span class="section-label">Contact Us</span>
        <h2 class="section-title">联系我们</h2>
        <div class="section-divider"></div>
      </div>
      <div class="contact-content">
        <div class="contact-info">
          <div class="contact-item">
            <div class="contact-icon">📍</div>
            <div class="contact-details">
              <h4>地址</h4>
              <p>{{ portal?.address || '上海市静安区南京西路1266号恒隆广场33楼' }}</p>
            </div>
          </div>
          <div class="contact-item">
            <div class="contact-icon">📞</div>
            <div class="contact-details">
              <h4>电话</h4>
              <p>{{ portal?.contactPhone || '400-888-8888' }}</p>
            </div>
          </div>
          <div class="contact-item" v-if="portal?.contactWechat">
            <div class="contact-icon">💬</div>
            <div class="contact-details">
              <h4>微信</h4>
              <p>{{ portal.contactWechat }}</p>
            </div>
          </div>
          <div class="contact-item">
            <div class="contact-icon">✉️</div>
            <div class="contact-details">
              <h4>邮箱</h4>
              <p>{{ portal?.contactEmail || 'info@moje珠宝.com' }}</p>
            </div>
          </div>
          <div class="contact-item">
            <div class="contact-icon">🕐</div>
            <div class="contact-details">
              <h4>营业时间</h4>
              <p>{{ portal?.businessHours || '周一至周日 10:00-21:00' }}</p>
            </div>
          </div>
        </div>
        <div class="contact-map">
          <div class="map-placeholder">
            <span class="map-icon">🗺️</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 页脚 -->
    <footer class="footer">
      <div class="footer-content">
        <div class="footer-brand">
          <div class="footer-logo">
            <span class="logo-icon">✨</span>
            <span class="logo-text">MOJE 珠宝</span>
          </div>
          <p class="footer-slogan">匠心定制·永恒经典</p>
        </div>
        <div class="footer-links">
          <div class="footer-column">
            <h4 class="footer-title">快速链接</h4>
            <a href="#about" class="footer-link">关于我们</a>
            <a href="#products" class="footer-link">产品展示</a>
            <a href="#contact" class="footer-link">联系我们</a>
          </div>
          <div class="footer-column">
            <h4 class="footer-title">服务支持</h4>
            <router-link to="/portal" class="footer-link">B端业务</router-link>
            <a href="#" class="footer-link">配送说明</a>
            <a href="#" class="footer-link">售后服务</a>
          </div>
        </div>
        <div class="footer-contact">
          <h4 class="footer-title">关注我们</h4>
          <div class="social-links">
            <a href="#" class="social-link">📱</a>
            <a href="#" class="social-link">💬</a>
            <a href="#" class="social-link">📷</a>
            <a href="#" class="social-link">🎵</a>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© 2024 MOJE 珠宝. All rights reserved. | 
          <a href="#" class="footer-bottom-link">隐私政策</a> | 
          <a href="#" class="footer-bottom-link">使用条款</a>
        </p>
        <p class="footer-domain">官网地址：www.MOJE珠宝.com</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getPortalHome, type PortalHomePublicDto } from '@/api'

const portal = ref<PortalHomePublicDto | null>(null)

const products = ref([
  {
    icon: '💍',
    name: '经典钻戒系列',
    description: '璀璨钻石与贵金属的完美结合',
    tag: '经典款'
  },
  {
    icon: '👑',
    name: '高级定制',
    description: '专属设计，为您打造独一无二的珠宝',
    tag: '定制款'
  },
  {
    icon: '📿',
    name: '彩宝系列',
    description: '红宝石、蓝宝石、祖母绿等彩色宝石',
    tag: '彩宝'
  },
  {
    icon: '🎗️',
    name: '黄金系列',
    description: '传统工艺与现代设计的完美融合',
    tag: '黄金'
  },
  {
    icon: '🔗',
    name: '手链系列',
    description: '精致细腻，点缀您的手腕',
    tag: '手链'
  },
  {
    icon: '⭐',
    name: '耳钉系列',
    description: '简约优雅，尽显高贵气质',
    tag: '耳钉'
  }
])
onMounted(async () => {
  try {
    portal.value = await getPortalHome()
  } catch {
    portal.value = null
  }
})
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  background: var(--white-color);
}

/* Header */
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(201, 169, 98, 0.1);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 40px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  font-size: 32px;
}

.logo-text {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-color);
  letter-spacing: 2px;
}

.nav {
  display: flex;
  gap: 40px;
}

.nav-link {
  text-decoration: none;
  color: var(--text-color);
  font-size: 15px;
  font-weight: 500;
  position: relative;
  transition: color 0.3s;
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 0;
  width: 0;
  height: 2px;
  background: var(--primary-color);
  transition: width 0.3s;
}

.nav-link:hover {
  color: var(--primary-color);
}

.nav-link:hover::after {
  width: 100%;
}

.b2b-entrance {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  background: linear-gradient(135deg, var(--primary-color), #E5C89A);
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  transition: transform 0.3s, box-shadow 0.3s;
}

.b2b-entrance:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(201, 169, 98, 0.3);
}

.entrance-arrow {
  font-size: 16px;
  transition: transform 0.3s;
}

.b2b-entrance:hover .entrance-arrow {
  transform: translateX(3px);
}

/* Hero Section */
.hero {
  height: 100vh;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin-top: 80px;
  overflow: hidden;
}

.hero-background {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, #FDFBF8 0%, #F5F0EB 50%, #EDE8E0 100%);
}

.hero-gradient {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(circle at 20% 30%, rgba(201, 169, 98, 0.08) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(201, 169, 98, 0.05) 0%, transparent 50%);
}

.hero-content {
  position: relative;
  z-index: 1;
  text-align: center;
  max-width: 900px;
  padding: 0 20px;
}

.hero-title {
  font-size: 72px;
  font-weight: 700;
  color: var(--text-color);
  line-height: 1.2;
  margin-bottom: 20px;
  letter-spacing: 4px;
}

.hero-subtitle {
  font-size: 20px;
  color: #666;
  margin-bottom: 50px;
  letter-spacing: 2px;
}

.hero-buttons {
  display: flex;
  gap: 20px;
  justify-content: center;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px 40px;
  background: linear-gradient(135deg, var(--primary-color), #E5C89A);
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 16px;
  letter-spacing: 1px;
  transition: transform 0.3s, box-shadow 0.3s;
}

.btn-primary:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 35px rgba(201, 169, 98, 0.35);
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 16px 40px;
  background: transparent;
  color: var(--text-color);
  text-decoration: none;
  border: 2px solid var(--text-color);
  border-radius: 8px;
  font-weight: 600;
  font-size: 16px;
  letter-spacing: 1px;
  transition: all 0.3s;
}

.btn-secondary:hover {
  background: var(--text-color);
  color: white;
}

.btn-large {
  padding: 20px 60px;
  font-size: 18px;
}

.scroll-indicator {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  z-index: 1;
}

.scroll-text {
  display: block;
  color: #888;
  font-size: 13px;
  margin-bottom: 10px;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.scroll-arrow {
  width: 30px;
  height: 50px;
  border: 2px solid var(--primary-color);
  border-radius: 15px;
  margin: 0 auto;
  position: relative;
}

.scroll-arrow::after {
  content: '';
  position: absolute;
  top: 10px;
  left: 50%;
  width: 4px;
  height: 4px;
  background: var(--primary-color);
  border-radius: 50%;
  transform: translateX(-50%);
  animation: scrollDown 1.5s infinite;
}

@keyframes scrollDown {
  0% { opacity: 1; top: 10px; }
  100% { opacity: 0; top: 30px; }
}

/* Section */
.section {
  padding: 100px 40px;
  max-width: 1400px;
  margin: 0 auto;
}

.section-header {
  text-align: center;
  margin-bottom: 60px;
}

.section-label {
  display: inline-block;
  color: var(--primary-color);
  font-size: 13px;
  letter-spacing: 3px;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.section-title {
  font-size: 42px;
  font-weight: 700;
  color: var(--text-color);
  margin-bottom: 20px;
}

.section-divider {
  width: 60px;
  height: 3px;
  background: var(--primary-color);
  margin: 0 auto;
}

/* About Section */
.about-section {
  background: #FDFBF8;
}

.about-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 80px;
  align-items: center;
}

.about-description {
  font-size: 18px;
  line-height: 1.8;
  color: #555;
  margin-bottom: 50px;
}

.about-features {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
}

.feature-item {
  text-align: center;
}

.feature-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.feature-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 8px;
}

.feature-text {
  font-size: 14px;
  color: #777;
  line-height: 1.6;
}

.about-image {
  display: flex;
  justify-content: center;
}

.about-image-placeholder {
  width: 100%;
  height: 500px;
  background: linear-gradient(135deg, #F5F0EB, #EDE8E0);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
}

.image-icon {
  font-size: 100px;
  opacity: 0.3;
}

/* Products Section */
.products-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 30px;
}

.product-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  transition: transform 0.3s, box-shadow 0.3s;
}

.product-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
}

.product-card--link {
  text-decoration: none;
  color: inherit;
  display: block;
}

.product-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-carousel {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  margin: 20px 0 8px;
  padding-bottom: 4px;
}

.hero-carousel img {
  height: 120px;
  width: auto;
  max-width: 220px;
  object-fit: cover;
  border-radius: 10px;
  flex-shrink: 0;
}

.company-photo-strip {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.company-photo-strip img {
  width: 100%;
  border-radius: 12px;
  object-fit: cover;
  max-height: 200px;
}

.product-image {
  height: 280px;
  background: linear-gradient(135deg, #F5F0EB, #EDE8E0);
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-icon {
  font-size: 80px;
}

.product-info {
  padding: 24px;
}

.product-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 8px;
}

.product-description {
  font-size: 14px;
  color: #777;
  margin-bottom: 16px;
}

.product-tag {
  display: inline-block;
  padding: 4px 12px;
  background: rgba(201, 169, 98, 0.1);
  color: var(--primary-color);
  font-size: 12px;
  border-radius: 4px;
}

/* CTA Section */
.cta-section {
  padding: 100px 40px;
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
}

.cta-content {
  max-width: 900px;
  margin: 0 auto;
  text-align: center;
}

.cta-title {
  font-size: 48px;
  font-weight: 700;
  color: white;
  margin-bottom: 16px;
}

.cta-subtitle {
  font-size: 18px;
  color: #aaa;
  margin-bottom: 40px;
}

.cta-buttons {
  display: flex;
  justify-content: center;
}

/* Contact Section */
.contact-section {
  background: #FDFBF8;
}

.contact-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
}

.contact-info {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.contact-item {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.contact-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.contact-details h4 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 6px;
}

.contact-details p {
  font-size: 14px;
  color: #777;
  line-height: 1.6;
}

.contact-map {
  display: flex;
  justify-content: center;
}

.map-placeholder {
  width: 100%;
  height: 400px;
  background: linear-gradient(135deg, #E5E4E2, #D5D5D5);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.map-icon {
  font-size: 80px;
  opacity: 0.3;
}

/* Footer */
.footer {
  background: #1a1a1a;
  color: white;
  padding: 60px 40px 20px;
}

.footer-content {
  max-width: 1400px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 2fr 2fr 1fr;
  gap: 80px;
  margin-bottom: 40px;
}

.footer-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.footer-logo .logo-text {
  color: white;
}

.footer-slogan {
  color: #888;
  font-size: 14px;
}

.footer-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.footer-title {
  font-size: 16px;
  font-weight: 600;
  color: white;
  margin-bottom: 8px;
}

.footer-link,
.footer-bottom-link {
  color: #aaa;
  text-decoration: none;
  font-size: 14px;
  transition: color 0.3s;
}

.footer-link:hover,
.footer-bottom-link:hover {
  color: var(--primary-color);
}

.social-links {
  display: flex;
  gap: 16px;
}

.social-link {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  transition: all 0.3s;
}

.social-link:hover {
  background: var(--primary-color);
  transform: translateY(-3px);
}

.footer-bottom {
  max-width: 1400px;
  margin: 0 auto;
  padding-top: 30px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
}

.footer-bottom p {
  color: #777;
  font-size: 13px;
}

.footer-domain {
  margin-top: 10px;
  color: var(--primary-color);
}

/* Responsive */
@media (max-width: 1024px) {
  .about-content,
  .contact-content {
    grid-template-columns: 1fr;
  }

  .products-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .footer-content {
    grid-template-columns: 1fr 1fr;
  }

  .hero-title {
    font-size: 48px;
  }
}

@media (max-width: 768px) {
  .nav {
    display: none;
  }

  .products-grid {
    grid-template-columns: 1fr;
  }

  .footer-content {
    grid-template-columns: 1fr;
    gap: 40px;
  }

  .hero-title {
    font-size: 36px;
  }

  .hero-buttons {
    flex-direction: column;
  }

  .section {
    padding: 60px 20px;
  }

  .header-content {
    padding: 0 20px;
  }
}
</style>
