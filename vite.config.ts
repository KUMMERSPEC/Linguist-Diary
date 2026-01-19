
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 必须设置为 './'，确保打包后的静态资源引用路径正确
  base: './',
  define: {
    // 注入 API_KEY 环境变量
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '')
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // 使用标准的命名约定，减少构建错误
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
