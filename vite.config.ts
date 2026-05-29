import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Backend target + HTTP Basic creds. Defaults match the revived local Flask
  // backend (roadio-master). Override via .env.local for other environments.
  // Creds live ONLY in the dev proxy here — never shipped in the client bundle.
  const backendTarget = env.BACKEND_URL || 'http://localhost:5000'
  const basicUser = env.BACKEND_BASIC_USER || 'shinom'
  const basicPass = env.BACKEND_BASIC_PASS || 'iloveToRide'
  const basicAuth =
    'Basic ' + Buffer.from(`${basicUser}:${basicPass}`).toString('base64')

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Roadio',
          short_name: 'Roadio',
          description: 'Location-based driving game',
          theme_color: '#0b0f1a',
          background_color: '#0b0f1a',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // API responses are dynamic + auth'd; never precache /api.
          navigateFallbackDenylist: [/^\/api/],
        },
      }),
    ],
    server: {
      host: true,
      proxy: {
        // All backend calls go through here. The proxy injects Basic auth so
        // the browser never holds credentials and CORS is sidestepped.
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (p) => p.replace(/^\/api/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', basicAuth)
            })
          },
        },
      },
    },
  }
})
