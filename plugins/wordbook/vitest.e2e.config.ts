import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import { standardDecoratorPlugin } from '../../vitest.shared.ts'

// The real-API suite mounts the shipped provider adapters, whose source declares
// Typert `@Remote` methods, so it needs the repository's standard-decorator
// transform exactly like the unit suite does.
export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['../../tsconfig.base.json'] }), standardDecoratorPlugin()],
  test: {
    environment: 'node',
    include: ['src/**/*.e2e.ts'],
    testTimeout: 120_000,
  },
})
