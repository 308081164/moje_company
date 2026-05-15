<template>
  <div class="gallery-page">
    <header class="gallery-header">
      <router-link to="/" class="back-link">← 返回首页</router-link>
      <h1>{{ detail?.nameCn || slug }}</h1>
      <p v-if="detail?.description" class="sub">{{ detail.description }}</p>
    </header>
    <div v-if="loading" class="loading">加载中…</div>
    <div v-else-if="!detail?.items?.length" class="empty">该分类暂无展示素材</div>
    <div v-else class="grid">
      <figure v-for="(it, idx) in detail.items" :key="idx" class="cell">
        <a :href="it.url" target="_blank" rel="noopener noreferrer">
          <img :src="it.url" :alt="it.caption || '作品'" loading="lazy" />
        </a>
        <figcaption v-if="it.caption">{{ it.caption }}</figcaption>
      </figure>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getPortalCategory, type PortalCategoryDetailPublicDto } from '@/api'

const route = useRoute()
const slug = ref(String(route.params.slug || ''))
const detail = ref<PortalCategoryDetailPublicDto | null>(null)
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    detail.value = await getPortalCategory(slug.value)
  } catch {
    detail.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => void load())
watch(
  () => route.params.slug,
  (s) => {
    slug.value = String(s || '')
    void load()
  }
)
</script>

<style scoped>
.gallery-page {
  min-height: 100vh;
  background: #0f0f12;
  color: #f5f5f5;
  padding: 24px 16px 48px;
}
.gallery-header {
  max-width: 1200px;
  margin: 0 auto 24px;
}
.back-link {
  color: #c9a962;
  text-decoration: none;
  display: inline-block;
  margin-bottom: 12px;
}
h1 {
  margin: 0;
  font-size: 28px;
}
.sub {
  color: #aaa;
  margin-top: 8px;
}
.loading,
.empty {
  text-align: center;
  color: #888;
  padding: 48px 0;
}
.grid {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}
.cell {
  margin: 0;
  background: #1a1a20;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #2a2a32;
}
.cell img {
  width: 100%;
  height: 220px;
  object-fit: cover;
  display: block;
}
figcaption {
  padding: 8px 10px 12px;
  font-size: 13px;
  color: #ccc;
}
</style>
