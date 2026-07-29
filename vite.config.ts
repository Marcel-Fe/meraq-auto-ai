import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// base muss dem Repo-Namen entsprechen, damit GitHub Pages die Assets findet
export default defineConfig({
  base: '/meraq-auto-ai/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'MERAQ AUTO AI',
        short_name: 'MERAQ',
        description: 'Dein intelligenter Begleiter für alle Fahrzeuge. Mehr Leben. Weniger Stress.',
        lang: 'de',
        start_url: '/meraq-auto-ai/',
        scope: '/meraq-auto-ai/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#05070D',
        theme_color: '#05070D',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: '/meraq-auto-ai/index.html',
        runtimeCaching: [
          {
            // KI-Aufrufe niemals aus dem Cache beantworten
            urlPattern: /^https:\/\/api\.anthropic\.com\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
  },
})
