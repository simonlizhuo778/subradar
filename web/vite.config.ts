import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5173,
    // 开发期把 /api 转发到本地后端,避免跨域
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
