import { describe, expectTypeOf, it } from 'vitest'

import type { AppInfo, ErrorReportInput, HmiApi, HmiResult, LogEntryInput } from '../../src/shared/hmi-api'

describe('Preload HMI API contract', () => {
  it('exposes the foundation API shape only', () => {
    expectTypeOf<HmiApi['app']['getInfo']>().returns.toEqualTypeOf<Promise<HmiResult<AppInfo>>>()
    expectTypeOf<HmiApi['log']['write']>().parameters.toEqualTypeOf<[LogEntryInput]>()
    expectTypeOf<HmiApi['log']['write']>().returns.toEqualTypeOf<Promise<HmiResult<void>>>()
    expectTypeOf<HmiApi['errors']['report']>().parameters.toEqualTypeOf<[ErrorReportInput]>()
    expectTypeOf<HmiApi['errors']['report']>().returns.toEqualTypeOf<Promise<HmiResult<void>>>()
  })
})
