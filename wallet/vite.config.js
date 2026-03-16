import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'stream', 'crypto', 'events', 'util', 'process'],
      globals: { Buffer: true, process: true },
    }),
  ],
  server: {
    port: 5175,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
