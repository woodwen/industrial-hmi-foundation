import { describe, expect, it } from 'vitest'

import {
  parseAlarmAcknowledgeRequest,
  parseAlarmHistoryQuery,
  parseAuditQuery,
  parseCreateFirstAdminRequest,
  parseCreateUserRequest,
  parseDeviceCommandRequest,
  parseDeviceReadRequest,
  parseDeviceWriteRequest,
  parseErrorReportInput,
  parseHistoricalTrendQuery,
  parseLoginRequest,
  parseLogEntryInput,
  parseRecipeDownloadRequest,
  parseRecipeDraft,
  parseRecipeIdPayload,
  parseRealtimeTrendRequest
} from '../../src/main/ipc/input-validation'

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

  it('accepts valid device read and write payloads', () => {
    expect(parseDeviceReadRequest({
      pointIds: ['currentTemperature', 'motorRpm', 'currentTemperature']
    }, 'ipc:test')).toEqual({
      pointIds: ['currentTemperature', 'motorRpm']
    })

    expect(parseDeviceWriteRequest({
      pointId: 'targetTemperature',
      value: 62.5
    }, 'ipc:test')).toEqual({
      pointId: 'targetTemperature',
      value: 62.5
    })

    expect(parseDeviceWriteRequest({
      pointId: 'deviceStartCommand',
      value: true
    }, 'ipc:test')).toEqual({
      pointId: 'deviceStartCommand',
      value: true
    })

    expect(parseDeviceCommandRequest({
      commandId: 'setTargetTemperature',
      value: 62.5
    }, 'ipc:test')).toEqual({
      commandId: 'setTargetTemperature',
      value: 62.5
    })

    expect(parseDeviceCommandRequest({
      commandId: 'stop'
    }, 'ipc:test')).toEqual({
      commandId: 'stop',
      value: undefined
    })
  })

  it('rejects invalid device payloads', () => {
    expectInvalidPayload(() => {
      parseDeviceReadRequest({
        pointIds: []
      }, 'ipc:test')
    })
    expectInvalidPayload(() => {
      parseDeviceReadRequest({
        pointIds: ['unknownPoint']
      }, 'ipc:test')
    })
    expectInvalidPayload(() => {
      parseDeviceWriteRequest({
        pointId: 'targetTemperature',
        value: '62.5'
      }, 'ipc:test')
    })
    expectInvalidPayload(() => {
      parseDeviceCommandRequest({
        commandId: 'autoMode'
      }, 'ipc:test')
    })
  })

  it('accepts valid auth, Recipe, and Audit payloads', () => {
    expect(parseCreateFirstAdminRequest({
      username: 'admin',
      displayName: 'Admin',
      password: 'secret1'
    }, 'ipc:test')).toEqual({
      username: 'admin',
      displayName: 'Admin',
      password: 'secret1'
    })
    expect(parseLoginRequest({
      username: 'engineer',
      password: 'secret1'
    }, 'ipc:test')).toEqual({
      username: 'engineer',
      password: 'secret1'
    })
    expect(parseCreateUserRequest({
      username: 'operator',
      displayName: 'Operator',
      role: 'Operator',
      password: 'secret1'
    }, 'ipc:test')).toEqual({
      username: 'operator',
      displayName: 'Operator',
      role: 'Operator',
      password: 'secret1'
    })
    expect(parseRecipeDraft({
      name: 'Standard Recipe',
      description: 'Simulator recipe',
      parameters: {
        targetTemperature: 60,
        rpmSetpoint: 900,
        mixDuration: 300,
        feedDuration: 120
      }
    }, 'ipc:test')).toEqual({
      name: 'Standard Recipe',
      description: 'Simulator recipe',
      parameters: {
        targetTemperature: 60,
        rpmSetpoint: 900,
        mixDuration: 300,
        feedDuration: 120
      }
    })
    expect(parseRecipeIdPayload('recipe-1', 'ipc:test')).toBe('recipe-1')
    expect(parseRecipeDownloadRequest({
      recipeId: 'recipe-1'
    }, 'ipc:test')).toEqual({
      recipeId: 'recipe-1'
    })
    expect(parseAuditQuery({
      action: 'Recipe Download',
      result: 'PartialFailed',
      limit: 100,
      offset: 50
    }, 'ipc:test')).toEqual({
      action: 'Recipe Download',
      result: 'PartialFailed',
      limit: 100,
      offset: 50
    })
  })

  it('rejects invalid auth, Recipe, and Audit payloads', () => {
    expectInvalidPayload(() => {
      parseCreateUserRequest({
        username: 'operator',
        displayName: 'Operator',
        role: 'Supervisor',
        password: 'secret1'
      }, 'ipc:test')
    })
    expectInvalidPayload(() => {
      parseRecipeDraft({
        name: 'Invalid Recipe',
        parameters: {
          targetTemperature: '60'
        }
      }, 'ipc:test')
    })
    expectInvalidPayload(() => {
      parseRecipeDownloadRequest({
        recipeId: ''
      }, 'ipc:test')
    })
    expectInvalidPayload(() => {
      parseAuditQuery({
        result: 'Unknown'
      }, 'ipc:test')
    })
  })

  it('accepts valid alarm and trend payloads', () => {
    expect(parseAlarmAcknowledgeRequest({
      occurrenceId: 'alarm-temp-high-1787011200000',
      user: 'operator'
    }, 'ipc:test')).toEqual({
      occurrenceId: 'alarm-temp-high-1787011200000',
      user: 'operator'
    })

    expect(parseAlarmHistoryQuery({
      level: 'High',
      status: 'Recovered',
      tagId: 'currentTemperature',
      acknowledgeUser: 'operator',
      startTime: '2026-08-18T00:00:00.000Z',
      endTime: '2026-08-18T01:00:00.000Z',
      limit: 200
    }, 'ipc:test')).toEqual({
      level: 'High',
      status: 'Recovered',
      tagId: 'currentTemperature',
      acknowledgeUser: 'operator',
      startTime: '2026-08-18T00:00:00.000Z',
      endTime: '2026-08-18T01:00:00.000Z',
      limit: 200
    })

    expect(parseRealtimeTrendRequest({
      tagIds: ['currentTemperature', 'currentPressure']
    }, 'ipc:test')).toEqual({
      tagIds: ['currentTemperature', 'currentPressure']
    })

    expect(parseHistoricalTrendQuery({
      tagIds: ['currentTemperature'],
      preset: 'custom',
      startTime: '2026-08-18T00:00:00.000Z',
      endTime: '2026-08-18T01:00:00.000Z',
      maxPointsPerTag: 1000
    }, 'ipc:test')).toEqual({
      tagIds: ['currentTemperature'],
      preset: 'custom',
      startTime: '2026-08-18T00:00:00.000Z',
      endTime: '2026-08-18T01:00:00.000Z',
      maxPointsPerTag: 1000
    })
  })

  it('rejects invalid alarm and trend payloads', () => {
    expectInvalidPayload(() => {
      parseAlarmAcknowledgeRequest({
        occurrenceId: ''
      }, 'ipc:test')
    })
    expectInvalidPayload(() => {
      parseAlarmHistoryQuery({
        level: 'Emergency'
      }, 'ipc:test')
    })
    expectInvalidPayload(() => {
      parseRealtimeTrendRequest({
        tagIds: []
      }, 'ipc:test')
    })
    expectInvalidPayload(() => {
      parseHistoricalTrendQuery({
        tagIds: ['currentTemperature'],
        preset: 'custom',
        startTime: '2026-08-18T00:00:00.000Z'
      }, 'ipc:test')
    })
    expectInvalidPayload(() => {
      parseHistoricalTrendQuery({
        tagIds: ['currentTemperature'],
        preset: 'custom',
        startTime: '2026-08-18T01:00:00.000Z',
        endTime: '2026-08-18T00:00:00.000Z'
      }, 'ipc:test')
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
