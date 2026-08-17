import { describe, expect, it } from 'vitest'

import { parseErrorReportInput, parseLogEntryInput } from '../../src/main/ipc/input-validation'

describe('IPC input validation', () => {
  it('accepts a valid renderer log entry payload', () => {
    const result = parseLogEntryInput(
      {
        category: 'application',
        level: 'info',
        message: 'Navigation changed',
        context: {
          page: 'device',
          retries: 0,
          active: true,
          previous: null
        },
        source: 'renderer'
      },
      'ipc:test'
    )

    expect(result).toEqual({
      category: 'application',
      level: 'info',
      message: 'Navigation changed',
      context: {
        page: 'device',
        retries: 0,
        active: true,
        previous: null
      },
      source: 'renderer'
    })
  })

  it('rejects invalid renderer log entry payloads', () => {
    expectInvalidPayload(() => {
      parseLogEntryInput(
        {
          category: 'application',
          level: 'trace',
          message: 'Invalid level'
        },
        'ipc:test'
      )
    })
  })

  it('accepts a valid renderer error report payload', () => {
    const result = parseErrorReportInput(
      {
        code: 'RENDERER_UNHANDLED_ERROR',
        message: 'Render failed',
        detail: 'stack',
        source: 'renderer:error-boundary',
        cause: 'component stack',
        componentStack: 'component stack'
      },
      'ipc:test'
    )

    expect(result).toEqual({
      code: 'RENDERER_UNHANDLED_ERROR',
      message: 'Render failed',
      detail: 'stack',
      source: 'renderer:error-boundary',
      cause: 'component stack',
      componentStack: 'component stack'
    })
  })

  it('rejects invalid renderer error report payloads', () => {
    expectInvalidPayload(() => {
      parseErrorReportInput(null, 'ipc:test')
    })
  })
})

function expectInvalidPayload(action: () => void): void {
  try {
    action()
  } catch (error) {
    expect(error).toMatchObject({
      code: 'IPC_INVALID_PAYLOAD',
      source: 'ipc:test'
    })
    return
  }

  throw new Error('Expected payload validation to fail.')
}
