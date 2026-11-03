/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// KIXIMA — frontend dev server. A API do backend Java corre em
// http://localhost:4001 (application.yml: server.port, omissão 4001). O
// proxy evita problemas de CORS em desenvolvimento.
// API_PROXY_TARGET aponta o proxy a outro anfitrião/porta sem mexer no código: na linha de comandos
// (API_PROXY_TARGET=http://192.168.1.20:4001 npm run dev) ou num `.env.local` (ver .env.example). A variável da shell
// tem prioridade. Se o destino não responder, o Vite devolve 500 com corpo vazio — o terminal mostra «http proxy error».
export default defineConfig(({ mode }) => {
  const alvoApi = process.env.API_PROXY_TARGET || loadEnv(mode, process.cwd(), '').API_PROXY_TARGET || 'http://localhost:4001';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: alvoApi,
          changeOrigin: true,
        },
        // Chat de Suporte / Chat Comercial / notificações em tempo real —
        // mesma origem lógica que a API, precisa de `ws: true` porque é uma
        // ligação WebSocket, não um pedido HTTP normal. STOMP nativo
        // (WebSocketConfig.java no backend), endpoint /ws.
        '/ws': {
          target: alvoApi,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Separa as bibliotecas de terceiros em chunks próprios e cacheáveis —
          // mudam raramente, pelo que o browser reutiliza-os entre deploys.
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-sentry': ['@sentry/react'],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
      css: false,
      // Os testes de ponta a ponta correm no Playwright, num browser a sério, e
      // importam '@playwright/test' — que o vitest não sabe executar. Sem esta
      // exclusão apanhava-os pelo sufixo .spec.js e reportava dois ficheiros
      // falhados enquanto dizia que todos os testes passavam: um resultado que
      // não se percebe e que ensina a ignorar o vermelho.
      exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    },
  };
});
