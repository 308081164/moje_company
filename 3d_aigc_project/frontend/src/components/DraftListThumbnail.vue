<template>
  <div class="draft-thumb" :class="{ loading: loading, empty: !loading && !url }">
    <img v-if="url" :src="url" alt="" draggable="false" />
    <el-icon v-else-if="loading" :size="22" class="draft-thumb-spinner"><Loading /></el-icon>
    <el-icon v-else :size="24"><Picture /></el-icon>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { Loading, Picture } from '@element-plus/icons-vue'
import { getDraftThumbnailBlob } from '@/composables/useGenerationDraft'

const props = defineProps<{
  draftId: string
}>()

const url = ref<string | null>(null)
const loading = ref(true)
let objectUrl: string | null = null
let requestId = 0

function revokeUrl() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }
  url.value = null
}

async function loadThumbnail(draftId: string) {
  const current = ++requestId
  loading.value = true
  revokeUrl()

  try {
    const blob = await getDraftThumbnailBlob(draftId)
    if (current !== requestId) return
    if (blob) {
      objectUrl = URL.createObjectURL(blob)
      url.value = objectUrl
    }
  } catch {
    if (current !== requestId) return
  } finally {
    if (current === requestId) loading.value = false
  }
}

watch(
  () => props.draftId,
  (id) => {
    if (id) loadThumbnail(id)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  requestId++
  revokeUrl()
})
</script>

<style scoped>
.draft-thumb {
  flex-shrink: 0;
  width: 72px;
  height: 72px;
  border-radius: 6px;
  overflow: hidden;
  background: #eef1f5;
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
}

.draft-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.draft-thumb.loading {
  background: #f5f7fa;
}

.draft-thumb.empty {
  background: #f0f2f5;
}

.draft-thumb-spinner {
  animation: draft-thumb-spin 1s linear infinite;
}

@keyframes draft-thumb-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
