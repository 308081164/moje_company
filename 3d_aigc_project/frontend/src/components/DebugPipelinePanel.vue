<script setup lang="ts">
import { computed } from 'vue'
import type { DebugSessionInfo, DebugStepResult } from '@/api'

const props = defineProps<{
  session: DebugSessionInfo | null
  loading: boolean
  lastResult: DebugStepResult | null
}>()

const emit = defineEmits<{
  run: [force?: boolean]
  confirm: []
}>()

const currentStep = computed(() => props.session?.steps?.find((s) => s.is_current) ?? null)

const stepStatusTag = computed(() => {
  const st = currentStep.value?.status
  if (st === 'awaiting_confirm') return { type: 'warning' as const, text: '待确认' }
  if (st === 'confirmed') return { type: 'success' as const, text: '已确认' }
  if (st === 'running') return { type: 'info' as const, text: '执行中' }
  if (st === 'failed') return { type: 'danger' as const, text: '失败' }
  return { type: 'info' as const, text: '待执行' }
})

const metricsJson = computed(() => {
  const m = props.lastResult?.metrics ?? currentStep.value?.result?.metrics
  if (!m || Object.keys(m).length === 0) return ''
  return JSON.stringify(m, null, 2)
})

const canRun = computed(() => {
  if (!currentStep.value || props.loading) return false
  const st = currentStep.value.status
  return st === 'pending' || st === 'failed' || st === 'awaiting_confirm'
})

const canConfirm = computed(() => {
  if (!currentStep.value || props.loading) return false
  return currentStep.value.status === 'awaiting_confirm'
})

function stepStatusType(status: string) {
  if (status === 'confirmed') return 'success'
  if (status === 'awaiting_confirm') return 'warning'
  if (status === 'failed') return 'danger'
  if (status === 'running') return 'info'
  return 'info'
}
</script>

<template>
  <div class="debug-panel">
    <div class="debug-panel-header">
      <h3>对齐调试流水线</h3>
      <el-tag v-if="session" size="small" :type="stepStatusTag.type">
        {{ stepStatusTag.text }}
      </el-tag>
    </div>

    <el-steps
      v-if="session"
      :active="session.current_step_index"
      direction="vertical"
      class="debug-steps"
      finish-status="success"
    >
      <el-step
        v-for="step in session.steps"
        :key="step.id"
        :title="step.name"
        :status="
          step.status === 'failed'
            ? 'error'
            : step.status === 'confirmed'
              ? 'success'
              : step.is_current
                ? 'process'
                : 'wait'
        "
      >
        <template #description>
          <div class="step-desc">
            <p><strong>操作：</strong>{{ step.operation }}</p>
            <p><strong>预期：</strong>{{ step.expected }}</p>
            <el-tag v-if="step.status !== 'pending'" size="small" :type="stepStatusType(step.status)">
              {{ step.status }}
            </el-tag>
          </div>
        </template>
      </el-step>
    </el-steps>

    <div v-if="currentStep" class="debug-current">
      <h4>{{ currentStep.name }}</h4>
      <p class="op-line"><span class="label">当前操作</span>{{ currentStep.operation }}</p>
      <p class="op-line"><span class="label">预期结果</span>{{ currentStep.expected }}</p>

      <div v-if="lastResult?.message || currentStep.result?.message" class="result-msg">
        {{ lastResult?.message || currentStep.result?.message }}
      </div>

      <pre v-if="metricsJson" class="metrics-block">{{ metricsJson }}</pre>

      <div class="debug-actions">
        <el-button
          type="primary"
          :loading="loading"
          :disabled="!canRun"
          @click="emit('run', currentStep.status === 'awaiting_confirm')"
        >
          {{ currentStep.status === 'awaiting_confirm' ? '重新执行本步' : '执行本步' }}
        </el-button>
        <el-button
          type="success"
          :loading="loading"
          :disabled="!canConfirm"
          @click="emit('confirm')"
        >
          确认并下一步
        </el-button>
      </div>
    </div>

    <el-empty v-else description="等待调试会话..." />
  </div>
</template>

<style scoped>
.debug-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  overflow: auto;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.15);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.debug-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.debug-panel-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.debug-steps {
  flex: 0 0 auto;
}

.step-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.step-desc p {
  margin: 0 0 4px;
}

.debug-current {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 12px;
}

.debug-current h4 {
  margin: 0 0 8px;
  font-size: 15px;
}

.op-line {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.5;
}

.op-line .label {
  display: inline-block;
  min-width: 64px;
  color: var(--el-text-color-secondary);
}

.result-msg {
  margin: 8px 0;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(64, 158, 255, 0.12);
  font-size: 13px;
}

.metrics-block {
  margin: 8px 0;
  padding: 8px;
  max-height: 180px;
  overflow: auto;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 6px;
}

.debug-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
</style>
