import { defineConfig } from 'tsdown'

/**
 * AITopo emits only `index` from tsc under `lib/types`. Do not inherit the
 * root workspace brace entry (`index|invariant|startup`), which assumes Cordis
 * package layouts.
 */
export default defineConfig({
  entry: ['lib/types/index.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  dts: false,
  clean: false,
})
