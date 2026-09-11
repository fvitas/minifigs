/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { partsDevPlugin } from './scripts/parts/dev-plugin'

export default defineConfig({
  plugins: [react(), tailwindcss(), partsDevPlugin()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
