<template>
  <div
    class="task-input-thumb"
    :class="{ loading: loading, empty: !loading && !url, failed: failed }"
  >
    <img
      v-if="url && !failed"
      :src="url"
      alt=""
      draggable="false"
      @load="handleLoad"
      @error="handleError"
    />
    <el-icon v-else-if="loading" :size="18" class="task-input-thumb-spinner"><Loading /></el-icon>
    <el-icon v-else :size="20"><Picture /></el-icon>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { Loading, Picture } from '@element-plus/icons-vue'

const props = defineProps<{
  previewUrl?: string | null
}>()

const url = ref<string | null>(null)
const loading = ref(false)
const failed = ref(false)

function reset() {
  url.value = null
  loading.value = false
  failed.value = false
}

function handleLoad() {
  loading.value = false
}

function handleError() {
  loading.value = false
  failed.value = true
}

watch(
  () => props.previewUrl,
  (next) => {
    reset()
    if (!next) return
    loading.value = true
    url.value = next
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  reset()
})
</script>

<style scoped>
.task-input-thumb {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
  background: #f0f2f5;
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
}

.task-input-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.task-input-thumb.loading {
  background: #f5f7fa;
}

.task-input-thumb.empty,
.task-input-thumb.failed {
  background: #f0f2f5;
}

.task-input-thumb-spinner {
  animation: task-input-thumb-spin 1s linear infinite;
}

@keyframes task-input-thumb-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
