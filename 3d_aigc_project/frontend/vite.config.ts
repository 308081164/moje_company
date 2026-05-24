import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // 开发服务器配置
  server: {
    port: 8853,
    host: '0.0.0.0',
    // API代理：将 /api 请求转发到后端业务服务
    proxy: {
      '/api': {
        target: 'http://localhost:8854',
        changeOrigin: true,
      },
    },
  },
  // 构建配置
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    // chunk大小警告阈值
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // 分包策略
        manualChunks: {
          'element-plus': ['element-plus'],
          'three': ['three'],
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
        },
      },
    },
  },
})
