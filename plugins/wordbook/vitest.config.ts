import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import { standardDecoratorPlugin } from '../../vitest.shared.ts'

// The Host half imports the LLM runtime, whose source declares Typert
// `@Remote` methods, so this project needs the repository's standard-decorator
// transform even though the other plugins under plugins/ do not.
export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['../../tsconfig.base.json'] }), standardDecoratorPlugin()],
  test: {
    environment: 'node',
    include: ['src/**/*.spec.{ts,tsx}'],
  },
})
