<template>
  <div v-loading="true" class="inlay-mesh-editor-redirect" element-loading-text="正在进入网格裁剪模式…" />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

onMounted(() => {
  const id = route.params.id as string
  const name = (route.query.name as string) || ''
  router.replace({
    name: 'inlay-library',
    query: {
      mode: 'crop',
      id,
      ...(name ? { name } : {}),
    },
  })
})
</script>

<style scoped>
.inlay-mesh-editor-redirect {
  min-height: 240px;
}
</style>
