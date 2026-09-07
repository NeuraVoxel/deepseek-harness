import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root,
  server: { port: 5179, open: true },
  resolve: {
    alias: {
      '@neuravoxel/aitopo': path.resolve(root, '../src'),
    },
  },
})
