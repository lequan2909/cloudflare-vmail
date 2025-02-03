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
  }),

  integrations: [react(), icon({
    include: ['ic', 'logos'],
  })],

  vite: {
    plugins: [tailwindcss()],
  },
})
