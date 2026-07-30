import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    react(), 
    viteSingleFile({
      removeViteModuleLoader: true,
    })
  ],
  build: {
    target: 'esnext',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
  server: {
    proxy: {
      '/v3': {
        target: 'http://localhost:9997',
        changeOrigin: true,
      },
      '/metrics': {
        target: 'http://localhost:9997',
        changeOrigin: true,
      },
    },
  }
});
