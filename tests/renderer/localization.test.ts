import { describe, expect, it } from 'vitest'

import { DEFAULT_LANGUAGE, normalizeLanguage, translate } from '../../src/renderer/localization/messages'

describe('Renderer localization', () => {
  it('uses Chinese as the default language', () => {
    expect(DEFAULT_LANGUAGE).toBe('zh-CN')
    expect(normalizeLanguage(undefined)).toBe('zh-CN')
    expect(translate(DEFAULT_LANGUAGE, 'navigation.dashboard')).toBe('仪表盘')
  })

  it('switches to English for covered keys', () => {
    expect(translate('en-US', 'navigation.dashboard')).toBe('Dashboard')
    expect(translate('en-US', 'update.message.available', { version: '0.1.1' })).toContain('0.1.1')
  })

  it('falls back to Chinese when English is missing', () => {
    expect(translate('en-US', 'test.fallbackOnly')).toBe('中文回退文案')
  })
})
