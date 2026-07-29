<template>
  <el-drawer
    v-model="visible"
    title="草稿箱"
    direction="rtl"
    size="380px"
    append-to-body
    class="draft-drawer"
  >
    <div class="draft-drawer-body">
      <div class="draft-toolbar">
        <el-button type="primary" plain size="small" @click="emit('new-draft')">
          <el-icon><Plus /></el-icon>
          新建草稿
        </el-button>
        <span v-if="activeDraftId" class="active-hint">
          <el-tag type="success" size="small" effect="plain">当前编辑中</el-tag>
        </span>
      </div>

      <div v-if="!draftList.length" class="draft-empty">
        <el-icon :size="48" color="#dcdfe6"><FolderOpened /></el-icon>
        <p>暂无草稿</p>
        <p class="draft-empty-hint">填写任务信息时会自动保存，刷新页面后可在此继续</p>
      </div>

      <div v-else class="draft-list">
        <div
          v-for="draft in draftList"
          :key="draft.id"
          class="draft-item"
          :class="{ active: draft.id === activeDraftId }"
          @click="emit('restore', draft.id)"
        >
          <DraftListThumbnail :draft-id="draft.id" />
          <div class="draft-item-main">
            <div class="draft-item-title">
              {{ draft.title }}
              <el-tag v-if="draft.id === activeDraftId" type="success" size="small" effect="plain">
                当前
              </el-tag>
            </div>
            <div class="draft-item-stage">{{ draft.stageSummary }}</div>
            <div class="draft-item-meta">
              <el-tag size="small" effect="plain">{{ modeLabel(draft.uploadMode) }}</el-tag>
              <span class="draft-item-time">{{ formatUpdatedAt(draft.updatedAt) }}</span>
            </div>
          </div>
          <el-button
            class="draft-delete-btn"
            type="danger"
            link
            :icon="Delete"
            title="删除草稿"
            @click.stop="confirmDelete(draft.id, draft.title)"
          />
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Delete, FolderOpened, Plus } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import DraftListThumbnail from '@/components/DraftListThumbnail.vue'
import type { DraftMeta } from '@/utils/draftStorage'

const props = defineProps<{
  modelValue: boolean
  draftList: DraftMeta[]
  activeDraftId: string | null
  formatUpdatedAt: (ts: number) => string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  restore: [draftId: string]
  delete: [draftId: string]
  'new-draft': []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const modeLabels: Record<DraftMeta['uploadMode'], string> = {
  single: '单图',
  sheet: '单图多视角',
  multi: '六面体',
}

function modeLabel(mode: DraftMeta['uploadMode']): string {
  return modeLabels[mode]
}

async function confirmDelete(id: string, title: string) {
  try {
    await ElMessageBox.confirm(
      `确定删除草稿「${title}」？此操作不可恢复。`,
      '删除草稿',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    emit('delete', id)
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
.draft-drawer-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100%;
}

.draft-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.active-hint {
  flex-shrink: 0;
}

.draft-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 16px;
  text-align: center;
  color: var(--text-secondary);
}

.draft-empty p {
  margin: 0;
  font-size: 14px;
}

.draft-empty-hint {
  font-size: 12px !important;
  color: var(--text-muted) !important;
  max-width: 240px;
  line-height: 1.6;
}

.draft-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.draft-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  background: #fafbfc;
}

.draft-item:hover {
  border-color: #c6e2ff;
  background: #f0f7ff;
}

.draft-item.active {
  border-color: #67c23a;
  background: #f0f9eb;
}

.draft-item-main {
  flex: 1;
  min-width: 0;
}

.draft-item-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
  word-break: break-all;
}

.draft-item-stage {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 8px;
}

.draft-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.draft-item-time {
  font-size: 12px;
  color: var(--text-muted);
}

.draft-delete-btn {
  flex-shrink: 0;
  margin-top: 2px;
}
</style>
