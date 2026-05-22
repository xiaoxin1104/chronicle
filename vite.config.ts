import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@repo/ui': path.resolve(__dirname, './packages/ui/src'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  // 支持 tcx-wasm WebAssembly 模块
  build: {
    target: 'esnext',
  },
  // 代理 Anthropic API 请求，避免浏览器跨域限制
  server: {
    proxy: {
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/anthropic/, ''),
      },
    },
  },
  // 允许 Cloudflare Tunnel 主机访问
  preview: {
    allowedHosts: ['localhost', '.trycloudflare.com'],
  },
  // 确保 WASM 文件能被正确解析
  optimizeDeps: {
    exclude: ['@consenlabs/tcx-wasm'],
  },
})
