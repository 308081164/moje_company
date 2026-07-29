import { createRouter, createWebHistory } from 'vue-router'
import { APP_NAME } from '@/constants/brand'

// 路由配置
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { title: '3D模型生成' },
    },
    {
      path: '/tasks',
      name: 'tasks',
      component: () => import('@/views/TasksView.vue'),
      meta: { title: '任务管理' },
    },
    {
      path: '/inlay-library',
      name: 'inlay-library',
      component: () => import('@/views/InlayLibraryView.vue'),
      meta: { title: '镶嵌结构库' },
    },
    {
      path: '/inlay-library/:id/mesh-edit',
      name: 'inlay-mesh-edit',
      component: () => import('@/views/InlayMeshEditorView.vue'),
      meta: { title: '网格裁剪' },
    },
    {
      path: '/mesh-convert',
      name: 'mesh-convert',
      component: () => import('@/views/MeshConvertView.vue'),
      meta: { title: '格式转换' },
    },
  ],
})

// 路由守卫：更新页面标题
router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || APP_NAME} - ${APP_NAME}`
  next()
})

export default router
