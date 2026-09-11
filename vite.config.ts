/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { partsDevPlugin } from './scripts/parts/dev-plugin'
import { partsCdnPlugin } from './scripts/parts/cdn-plugin'

export default defineConfig({
  plugins: [react(), tailwindcss(), partsDevPlugin(), partsCdnPlugin()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
