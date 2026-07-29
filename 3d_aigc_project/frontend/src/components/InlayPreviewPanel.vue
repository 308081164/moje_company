<template>

  <div class="inlay-preview-panel">

    <div v-if="!item" class="panel-empty">

      <el-empty description="选择条目查看 3D 预览" :image-size="64" />

    </div>

    <template v-else>

      <div class="panel-header">

        <h3>{{ item.display_name || item.filename }}</h3>

        <div class="panel-actions">

          <el-button v-if="!hasRealMesh" size="small" type="warning" :loading="converting" @click="onConvertMesh">

            转换 Mesh

          </el-button>

          <el-button size="small" :loading="regenerating" @click="onRegeneratePreview">

            重新生成预览

          </el-button>

        </div>

      </div>



      <div v-if="showNoRealMeshHint" class="no-real-mesh-hint">

        <el-alert

          title="暂无真实 3D 几何"

          type="info"

          show-icon

          :closable="false"

        >

          <template #default>

            <p v-if="item.mesh_is_proxy">当前仅有合成占位网格（四爪镶模板），不代表 JewelCAD 真实造型。</p>

            <p v-else>此 JCD 无法从点云重建 3D 网格，请使用 JewelCAD 导出 OBJ 或点击「转换 Mesh」重试。</p>

            <p v-if="item.preview_method && item.preview_method !== 'mesh_render'" class="hint-2d">

              2D 预览来自 {{ previewMethodLabel }}，与 3D 来源不同。

            </p>

          </template>

        </el-alert>

      </div>



      <ModelViewer

        v-if="hasRealMesh"

        :model-url="meshUrl"

        :model-format="meshFormat"

        preview-mode="white"

        @error="onMeshError"

      />

      <div v-else class="viewer-placeholder">

        <el-empty description="无可用真实 3D 模型" :image-size="72" />

      </div>



      <div v-if="meshError && hasRealMesh" class="mesh-error-hint">

        <el-alert :title="meshError" type="warning" show-icon :closable="false" />

      </div>



      <el-descriptions :column="1" size="small" border class="panel-meta">

        <el-descriptions-item label="格式">{{ item.primary_format || item.file_format }}</el-descriptions-item>

        <el-descriptions-item label="Legacy 路径">{{ item.legacy_path || item.id }}</el-descriptions-item>

        <el-descriptions-item label="真实 3D">

          <el-tag :type="hasRealMesh ? 'success' : 'info'" size="small">

            {{ hasRealMesh ? '可用' : '不可用' }}

          </el-tag>

        </el-descriptions-item>

        <el-descriptions-item v-if="item.mesh_method" label="Mesh 来源">

          {{ item.mesh_method }}

          <el-tag v-if="item.mesh_is_proxy" size="small" type="warning" style="margin-left: 6px">占位</el-tag>

        </el-descriptions-item>

        <el-descriptions-item v-if="item.preview_method" label="2D 预览来源">

          {{ previewMethodLabel }}

          <span v-if="item.preview_quality"> ({{ item.preview_quality?.toFixed(3) }})</span>

        </el-descriptions-item>

      </el-descriptions>

    </template>

  </div>

</template>



<script setup lang="ts">

import { ref, computed, watch } from 'vue'

import { ElMessage } from 'element-plus'

import ModelViewer from '@/components/ModelViewer.vue'

import { convertInlayMesh, regenerateInlayPreview, type InlayV2Info } from '@/api'



const props = defineProps<{

  item: InlayV2Info | null

  itemUuid?: string

}>()

const meshError = ref('')

const converting = ref(false)

const regenerating = ref(false)

const useObjFallback = ref(false)



const hasRealMesh = computed(() => {

  if (!props.item) return false

  if (props.item.mesh_is_proxy) return false

  return props.item.mesh_ready === true

})



const showNoRealMeshHint = computed(() => props.item != null && !hasRealMesh.value)



const previewMethodLabel = computed(() => {

  const m = props.item?.preview_method

  const labels: Record<string, string> = {

    bmp: 'JewelCAD BMP 渲染',

    png: 'PNG 预览图',

    embedded_bmp: 'JCD 内嵌 BMP',

    jcd_pointcloud: 'JCD 点云投影',

    mesh_render: 'Mesh 渲染',

    placeholder: '占位图',

  }

  return (m && labels[m]) || m || '未知'

})



const meshUrl = computed(() => {

  if (!hasRealMesh.value || !props.item) return ''

  const uuid = props.itemUuid || extractUuid(props.item)

  if (!uuid) return ''

  if (useObjFallback.value) {

    return `/api/inlay/v2/items/${uuid}/mesh`

  }

  return `/api/inlay/v2/items/${uuid}/mesh/glb`

})



const meshFormat = computed<'GLB' | 'OBJ'>(() => (useObjFallback.value ? 'OBJ' : 'GLB'))



function extractUuid(item: InlayV2Info): string {

  if (item.id && item.id.includes('-') && item.id.length === 36) return item.id

  return item.id

}



watch(

  () => props.item?.id,

  () => {

    meshError.value = ''

    useObjFallback.value = false

  }

)



function onMeshError(err: string) {

  if (!useObjFallback.value) {

    useObjFallback.value = true

    meshError.value = ''

    return

  }

  meshError.value = err || '3D 模型加载失败，可尝试转换 Mesh'

}



async function onConvertMesh() {

  const uuid = props.itemUuid || props.item?.id

  if (!uuid) return

  converting.value = true

  try {

    await convertInlayMesh(uuid)

    ElMessage.success('Mesh 转换任务已入队')

  } catch {

    ElMessage.warning('转换请求失败')

  } finally {

    converting.value = false

  }

}



async function onRegeneratePreview() {

  const uuid = props.itemUuid || props.item?.id

  if (!uuid) return

  regenerating.value = true

  try {

    await regenerateInlayPreview(uuid)

    ElMessage.success('预览生成任务已入队')

  } catch {

    ElMessage.warning('预览任务提交失败')

  } finally {

    regenerating.value = false

  }

}

</script>



<style scoped>

.inlay-preview-panel {

  display: flex;

  flex-direction: column;

  gap: 12px;

  height: 100%;

}



.panel-empty {

  flex: 1;

  display: flex;

  align-items: center;

  justify-content: center;

}



.panel-header {

  display: flex;

  justify-content: space-between;

  align-items: flex-start;

  gap: 8px;

}



.panel-header h3 {

  margin: 0;

  font-size: 15px;

  word-break: break-all;

}



.panel-actions {

  display: flex;

  gap: 6px;

  flex-shrink: 0;

}



.panel-meta {

  margin-top: 4px;

}



.mesh-error-hint,

.no-real-mesh-hint {

  margin-top: -4px;

}



.no-real-mesh-hint p {

  margin: 4px 0 0;

  font-size: 13px;

  line-height: 1.5;

}



.hint-2d {

  color: var(--el-text-color-secondary);

}



.viewer-placeholder {

  min-height: 280px;

  display: flex;

  align-items: center;

  justify-content: center;

  background: #2a2a3e;

  border-radius: 8px;

}



:deep(.model-viewer) {

  min-height: 280px;

  border-radius: 8px;

  overflow: hidden;

}

</style>

