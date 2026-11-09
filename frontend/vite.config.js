import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // Only generates the service worker. Registration and the manifest are done by hand in
    // src/offline/pwa.js, so nothing can reload the page and the central host isn't installable.
    VitePWA({
      disable: Boolean(process.env.VITEST),
      injectRegister: false,
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/health$/],
        skipWaiting: false,
        clientsClaim: false,
        inlineWorkboxRuntime: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // Versioned by a query string that changes on every upload
            urlPattern: /\/api\/band\/logo(\?|$)/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'band-logo',
              expiration: { maxEntries: 4 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,vue}'],
      exclude: ['src/main.js', 'src/assets/**'],
    },
  },
})
