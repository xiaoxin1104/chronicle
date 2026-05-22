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
  // 支持 tcx-wasm WebAssembly 模块 + 性能优化
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    // WASM 文件保持独立，不内联为 base64
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // WASM 单独分块
        manualChunks: (id) => {
          if (id.includes('tcx-wasm') || id.includes('token-core')) return 'wallet-core'
        },
      },
    },
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
