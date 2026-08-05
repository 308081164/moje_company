<template>
  <div class="app-container">
    <!-- 顶部导航栏 -->
    <el-header class="app-header">
      <div class="app-header-inner">
        <div class="header-left">
          <h1 class="app-title">
            <el-icon><Box /></el-icon>
            {{ APP_NAME }}
          </h1>
          <span class="app-subtitle">{{ APP_SUBTITLE }}</span>
        </div>
        <el-menu
          :default-active="activeMenu"
          mode="horizontal"
          :ellipsis="false"
          class="header-menu"
          router
        >
          <el-menu-item index="/">
            <el-icon><MagicStick /></el-icon>
            模型生成
          </el-menu-item>
          <el-menu-item index="/tasks">
            <el-icon><List /></el-icon>
            任务管理
          </el-menu-item>
          <el-menu-item index="/inlay-library">
            <el-icon><Collection /></el-icon>
            镶嵌结构库
          </el-menu-item>
          <el-menu-item index="/mesh-convert">
            <el-icon><Switch /></el-icon>
            格式转换
          </el-menu-item>
          <el-menu-item index="/debug">
            <el-icon><Tools /></el-icon>
            对齐调试
          </el-menu-item>
        </el-menu>
        <div class="header-right">
          <!-- 系统状态指示器 -->
          <el-tooltip :content="systemStatus" placement="bottom">
            <el-tag :type="systemOnline ? 'success' : 'danger'" effect="dark" round>
              <el-icon><Monitor /></el-icon>
              {{ systemOnline ? '系统正常' : '系统异常' }}
            </el-tag>
          </el-tooltip>
        </div>
      </div>
    </el-header>

    <!-- 主内容区域 -->
    <el-main class="app-main">
      <router-view />
    </el-main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Box, MagicStick, List, Monitor, Collection, Switch, Tools } from '@element-plus/icons-vue'
import { getSystemInfo } from '@/api'
import { APP_NAME, APP_SUBTITLE } from '@/constants/brand'

const route = useRoute()

// 当前激活的菜单项
const activeMenu = computed(() => route.path)

// 系统状态
const systemOnline = ref(false)
const systemStatus = ref('')

// 检查系统状态（后端可能晚于前端启动，静默重试）
onMounted(async () => {
  const load = async () => {
    const res = await getSystemInfo()
    systemOnline.value = true
    const gpuInfo = (res.data as any).gpuInfo?.[0]?.name
      || (res.data as any).gpu_info
      || '未知'
    const model = (res.data as any).recommended_model
      || (res.data as any).model_version
      || '未知'
    systemStatus.value = `GPU: ${gpuInfo} | 模型: ${model}`
  }

  for (let i = 0; i < 8; i++) {
    try {
      await load()
      return
    } catch {
      if (i < 7) {
        await new Promise((r) => setTimeout(r, 3000))
      }
    }
  }
  systemOnline.value = false
  systemStatus.value = '无法连接到后端服务（请确认 8854 业务服务已启动）'
})
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
}

.app-header {
  background: linear-gradient(135deg, #141210 0%, #1c1917 50%, #292524 100%);
  padding: 0 var(--app-padding-x);
  height: var(--header-height) !important;
  box-shadow: 0 1px 0 rgba(184, 149, 106, 0.15), 0 4px 20px rgba(0, 0, 0, 0.2);
  z-index: 200;
  border-bottom: 1px solid rgba(184, 149, 106, 0.12);
}

.app-header-inner {
  display: flex;
  align-items: center;
  max-width: var(--app-max-width);
  width: 100%;
  margin: 0 auto;
  min-width: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-right: 48px;
}

.app-title {
  color: #fafaf9;
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  letter-spacing: 0.02em;
}

.app-title .el-icon {
  color: var(--accent);
}

.app-subtitle {
  color: rgba(250, 250, 249, 0.45);
  font-size: 12px;
  white-space: nowrap;
  padding-left: 14px;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.header-menu {
  flex: 1;
  background: transparent !important;
  border-bottom: none !important;
}

.header-menu .el-menu-item {
  color: rgba(250, 250, 249, 0.65) !important;
  border-bottom: 2px solid transparent !important;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.02em;
  padding: 0 18px;
  height: var(--header-height);
  line-height: var(--header-height);
}

.header-menu .el-menu-item:hover {
  color: #fafaf9 !important;
  background-color: rgba(184, 149, 106, 0.08) !important;
}

.header-menu .el-menu-item.is-active {
  color: var(--accent) !important;
  border-bottom-color: var(--accent) !important;
  background-color: rgba(184, 149, 106, 0.06) !important;
}

.header-right {
  display: flex;
  align-items: center;
}

.header-right .el-tag {
  background: rgba(34, 197, 94, 0.15) !important;
  border: 1px solid rgba(34, 197, 94, 0.3) !important;
  color: #86efac !important;
}

.app-main {
  flex: 1;
  padding: 20px var(--app-padding-x) 0;
  max-width: var(--app-max-width);
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
  min-width: 0;
  overflow-x: hidden;
}
</style>
