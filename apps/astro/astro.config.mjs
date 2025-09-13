import cloudflare from '@astrojs/cloudflare'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import icon from 'astro-icon'

import { defineConfig } from 'astro/config'

// https://astro.build/config
export default defineConfig({
  output: 'server',

  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
    imageService: 'compile',
  }),

  integrations: [
    react(),
    icon({
      include: {
        ic: ['twotone-shield', 'twotone-info', 'twotone-timer'],
        mdi: ['arrow-left'],
        logos: ['cloudflare-icon'],
      },
    }),
  ],

  vite: {
    resolve: {
      // Use react-dom/server.edge instead of react-dom/server.browser for React 19.
      // Without this, MessageChannel from node:worker_threads needs to be polyfilled.
      alias: import.meta.env.PROD && {
        'react-dom/server': 'react-dom/server.edge',
      },
    },
    plugins: [tailwindcss()],
  },
})
