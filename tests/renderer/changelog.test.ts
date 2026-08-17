import { describe, expect, it } from 'vitest'

import { parseChangelog } from '../../src/renderer/help/changelog'

describe('Changelog parser', () => {
  it('parses current and released version sections', () => {
    const entries = parseChangelog(`# Changelog

## Unreleased / 0.1.1

### Added

- 新增帮助入口

## v0.1.0 - 2026-08-17

### Fixed

- 修复发布说明
`)

    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      id: 'current-0-1-1',
      title: '当前版本 0.1.1',
      version: '0.1.1',
      current: true
    })
    expect(entries[1].date).toBe('2026-08-17')
    expect(entries[1].groups[0].items[0].text).toBe('修复发布说明')
  })

  it('filters entries without items', () => {
    expect(parseChangelog('## Unreleased / 0.1.0\n\n### Added\n')).toEqual([])
  })
})
