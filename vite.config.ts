import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  // Пакет vk-bridge указывает "browser" → UMD; Vite тянет его и после сборки ломается default.send
  // (в консоли: send is not a function → «Приложение не инициализировано»). Форсируем ESM-сборку.
  resolve: {
    alias: {
      '@vkontakte/vk-bridge': path.resolve(
        __dirname,
        'node_modules/@vkontakte/vk-bridge/dist/index.es.js',
      ),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    /** Локальная отладка Telegram/VK без CORS: VITE_API_BASE=/api в .env.development */
    proxy: {
      '/api': {
        target: 'https://serg.srvmysticode.ru',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
