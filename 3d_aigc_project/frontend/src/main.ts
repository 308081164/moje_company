import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

import App from './App.vue'
import router from './router'
import './style.css'

// 创建Vue应用实例
const app = createApp(App)

// 注册插件
app.use(createPinia())     // 状态管理
app.use(router)            // 路由
app.use(ElementPlus, {     // Element Plus UI组件库
  locale: zhCn,            // 中文语言包
})

// 挂载应用
app.mount('#app')
