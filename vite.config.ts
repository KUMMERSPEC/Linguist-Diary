
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 必须设置为 './'，这样打包后的 index.html 才会以相对路径引用 JS 和 CSS
  base: './',
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '')
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 确保 CSS 不会被内联到 JS 中，方便调试 404 问题
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        // 固定命名结构，减少部署时的缓存或路径混乱
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
  },
});
