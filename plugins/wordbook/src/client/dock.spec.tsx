/**
 * Dock behavior: the `/word` line it builds, how it classifies what the
 * commands Remote answered, and the markup it renders when idle.
 * @module dsh-wordbook/src/client/dock.spec
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { RemoteResult } from '@deepseek-ai/dsh-api-remotes/client'
import type { CommandExecution } from '@deepseek-ai/dsh-commands'
import { submitWord, wordCommandLine } from './dock.ts'
import { zh } from './locales.ts'
import { WordbookDock, type WordbookDockInjected, type WordbookDockProps } from './WordbookDock.tsx'

/** One successful Remote answer. */
function ok(value: CommandExecution | undefined): RemoteResult<CommandExecution | undefined> {
  return { ok: true, value }
}

/** One failed Remote answer. */
function failed(message: string, code: string): RemoteResult<CommandExecution | undefined> {
  return { ok: false, error: { message, code } } as unknown as RemoteResult<CommandExecution | undefined>
}

/** A settled command execution, of which only presence matters to the dock. */
const execution = { result: { kind: 'success' }, commandId: 'c1' } as unknown as CommandExecution

describe('wordCommandLine', () => {
  it('builds one /word line from the trimmed input', () => {
    expect(wordCommandLine('apple')).toBe('/word apple')
    expect(wordCommandLine('  give up  ')).toBe('/word give up')
  })

  it('reports nothing to send for an empty or blank input', () => {
    expect(wordCommandLine('')).toBeUndefined()
    expect(wordCommandLine('   ')).toBeUndefined()
  })
})

describe('submitWord', () => {
  it('does not dispatch a blank submission', async () => {
    const submit = vi.fn()
    const outcome = await submitWord(submit, '   ')

    expect(outcome).toEqual({ kind: 'empty' })
    expect(submit).not.toHaveBeenCalled()
  })

  it('sends the /word line and reports the accepted submission', async () => {
    const submit = vi.fn(() => Promise.resolve(ok(execution)))
    const outcome = await submitWord(submit, ' apple ')

    expect(submit).toHaveBeenCalledWith('/word apple')
    expect(outcome).toEqual({ kind: 'sent' })
  })

  it('reports a line that resolved to no registered command', async () => {
    const outcome = await submitWord(() => Promise.resolve(ok(undefined)), 'apple')

    expect(outcome).toEqual({ kind: 'unresolved', line: '/word apple' })
  })

  it('reports a wire failure with its code', async () => {
    const outcome = await submitWord(
      () => Promise.resolve(failed('gateway rejected the call', 'gateway/internal')),
      'apple',
    )

    expect(outcome).toEqual({ kind: 'failed', message: 'gateway rejected the call (gateway/internal)' })
  })
})

describe('WordbookDock', () => {
  /** The props the dock needs, with the seats a static render never touches. */
  function props(submit: WordbookDockInjected['submit']): WordbookDockProps {
    const t = ((key: string) => (zh as Record<string, string>)[key] ?? key) as WordbookDockProps['t']
    return { submit, t } as unknown as WordbookDockProps
  }

  it('renders the placeholder and a disabled submit button while empty', () => {
    const html = renderToStaticMarkup(<WordbookDock {...props(() => Promise.resolve({ kind: 'empty' }))} />)

    expect(html).toContain('data-wordbook="dock"')
    expect(html).toContain(zh['dock.placeholder'])
    expect(html).toContain(zh['dock.action'])
    expect(html).toContain('disabled')
  })

  it('renders without a failure line before anything was submitted', () => {
    const html = renderToStaticMarkup(<WordbookDock {...props(() => Promise.resolve({ kind: 'sent' }))} />)

    expect(html).not.toContain('unknown command')
    expect(html).not.toContain('gateway')
  })
})
