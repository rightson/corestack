import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/server': path.resolve(__dirname, './server'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api/trpc': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/api/health': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/api/metrics': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
