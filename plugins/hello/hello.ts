import type { Context } from '@deepseek-ai/cordis'

export const name = 'hello-plugin'

export function apply(_ctx: Context) {
  console.log('[hello-plugin] plugin loaded!')
}
