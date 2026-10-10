import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 容器生产环境由 nginx 同源代理 /api；
// 本地 npm run dev 时通过下方 proxy 转发到本机后端，避免跨域。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
