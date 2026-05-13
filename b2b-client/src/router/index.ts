import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/HomeView.vue')
  },
  {
    path: '/portal',
    name: 'Portal',
    component: () => import('@/views/PortalView.vue')
  },
  {
    path: '/portal/b2b/order/:token',
    name: 'B2BOrderDetail',
    component: () => import('@/views/OrderDetailView.vue')
  },
  {
    path: '/portal/c/progress/:token',
    name: 'CustomerOrderProgress',
    component: () => import('@/views/CustomerProgressView.vue')
  },
  {
    path: '/order/:token',
    redirect: (to) => {
      const raw = to.params.token
      const token = Array.isArray(raw) ? raw[0] : raw
      return { path: `/portal/b2b/order/${token ?? ''}` }
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth'
      }
    }
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0, behavior: 'smooth' }
  }
})

export default router
