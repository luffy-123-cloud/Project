import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    proxy: {
      // Dev-only: avoids browser CORS when calling PlantNet from localhost
      '/plantnet-api': {
        target: 'https://my-api.plantnet.org',
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/plantnet-api/, ''),
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg', 'farmer-illustration.png'],
      manifest: {
        name: 'Sarpanch AI',
        short_name: 'SarpanchAI',
        description: 'AI-powered farming companion for every Indian farmer',
        theme_color: '#2D6A2D',
        background_color: '#FFFBF2',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/farmer-illustration.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.openweathermap\.org\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'weather-cache', expiration: { maxAgeSeconds: 3600 } }
          },
          {
            urlPattern: /^https:\/\/agmarknet\.gov\.in\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'market-cache', expiration: { maxAgeSeconds: 7200 } }
          },
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'firestore-cache', expiration: { maxAgeSeconds: 300 } }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
