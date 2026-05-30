import { defineConfig, loadEnv } from 'vite'
import type { ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Backend target + HTTP Basic creds. Defaults to the LIVE Heroku backend, so
  // dev and preview hit remote out of the box. Override BACKEND_URL in
  // .env.local (e.g. http://localhost:5050) to point at a local Flask backend.
  // Creds live ONLY in the proxy here — never shipped in the client bundle.
  const backendTarget =
    env.BACKEND_URL || 'https://roadio-revive-ede3dca3face.herokuapp.com'
  const basicUser = env.BACKEND_BASIC_USER || 'shinom'
  const basicPass = env.BACKEND_BASIC_PASS || 'iloveToRide'
  const basicAuth =
    'Basic ' + Buffer.from(`${basicUser}:${basicPass}`).toString('base64')

  // Shared proxy: forwards /api/* to the backend and injects Basic auth so the
  // browser never holds credentials and CORS is sidestepped. Applied to both
  // the dev server and `vite preview` (serving the production build).
  const apiProxy: Record<string, ProxyOptions> = {
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
  }

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
          // The lazy mapbox-gl chunk is ~1.8 MB — allow precaching it.
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          // Cache remote static art (marker/reaction/game icons) at runtime.
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/raw\.githubusercontent\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'roadio-remote-img',
                expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    // mapbox-gl is an intentionally code-split lazy chunk; don't warn on it.
    build: { chunkSizeWarningLimit: 1900 },
    server: { host: true, proxy: apiProxy },
    preview: { host: true, proxy: apiProxy },
  }
})
