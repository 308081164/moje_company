<template>
  <div class="app-container">
    <!-- 顶部导航栏 -->
    <el-header class="app-header">
      <div class="header-left">
        <h1 class="app-title">
          <el-icon><Box /></el-icon>
          3D AIGC
        </h1>
        <span class="app-subtitle">图片生成3D模型平台</span>
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
import { Box, MagicStick, List, Monitor } from '@element-plus/icons-vue'
import { getSystemInfo } from '@/api'

const route = useRoute()

// 当前激活的菜单项
const activeMenu = computed(() => route.path)

// 系统状态
const systemOnline = ref(false)
const systemStatus = ref('')

// 检查系统状态
onMounted(async () => {
  try {
    const res = await getSystemInfo()
    systemOnline.value = true
    systemStatus.value = `GPU: ${res.data.gpu_info || '未知'} | 模型: ${res.data.model_version || '未知'}`
  } catch {
    systemOnline.value = false
    systemStatus.value = '无法连接到后端服务'
  }
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
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  padding: 0 24px;
  height: 60px !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-right: 40px;
}

.app-title {
  color: #fff;
  font-size: 20px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.app-subtitle {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  white-space: nowrap;
}

.header-menu {
  flex: 1;
  background: transparent !important;
  border-bottom: none !important;
}

.header-menu .el-menu-item {
  color: rgba(255, 255, 255, 0.75) !important;
  border-bottom: 2px solid transparent !important;
  font-size: 14px;
}

.header-menu .el-menu-item:hover {
  color: #fff !important;
  background-color: rgba(255, 255, 255, 0.08) !important;
}

.header-menu .el-menu-item.is-active {
  color: #409eff !important;
  border-bottom-color: #409eff !important;
}

.header-right {
  display: flex;
  align-items: center;
}

.app-main {
  flex: 1;
  padding: 24px;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}
</style>
