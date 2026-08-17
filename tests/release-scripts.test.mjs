import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  compareStableVersions,
  findLatestStableReleaseVersion,
  getReleaseDecision
} from '../scripts/check-release-version.mjs'
import { extractChangelogSection } from '../scripts/extract-changelog-release-notes.mjs'
import {
  getNextDevVersion,
  prepareNextDevVersion
} from '../scripts/prepare-next-dev-version.mjs'

describe('release scripts', () => {
  it('decides to release only when package version is newer than stable GitHub releases', () => {
    expect(compareStableVersions('0.1.1', '0.1.0')).toBe(1)
    expect(findLatestStableReleaseVersion([
      { tag_name: 'v0.1.0', draft: false, prerelease: false },
      { tag_name: 'v0.2.0-beta.1', draft: false, prerelease: true },
      { tag_name: 'notes', draft: false, prerelease: false }
    ])).toBe('0.1.0')
    expect(getReleaseDecision({
      currentVersion: '0.1.1',
      releases: [{ tag_name: 'v0.1.0', draft: false, prerelease: false }]
    })).toMatchObject({
      shouldRelease: true,
      version: '0.1.1',
      tag: 'v0.1.1',
      latestVersion: '0.1.0'
    })
  })

  it('extracts release notes from unreleased or released changelog sections', () => {
    const markdown = `# Changelog

## Unreleased / 0.1.1

### Added

- 新增检查更新

## v0.1.0 - 2026-08-17

### Added

- 初始版本
`

    expect(extractChangelogSection(markdown, '0.1.1')).toContain('新增检查更新')
    expect(extractChangelogSection(markdown, '0.1.0')).toContain('初始版本')
  })

  it('prepares the next development version in package and changelog files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'hmi-release-'))
    const packageJsonPath = join(directory, 'package.json')
    const changelogPath = join(directory, 'CHANGELOG.md')
    writeFileSync(packageJsonPath, `${JSON.stringify({ version: '0.1.0' }, null, 2)}\n`)
    writeFileSync(changelogPath, '# Changelog\n\n## Unreleased / 0.1.0\n\n### Added\n\n- 初始版本\n')

    const result = prepareNextDevVersion({
      packageJsonPath,
      changelogPath,
      releasedVersion: '0.1.0',
      releaseDate: '2026-08-17'
    })

    expect(result).toMatchObject({
      changed: true,
      nextVersion: '0.1.1'
    })
    expect(getNextDevVersion('0.1.100')).toBe('0.2.0')
    expect(readFileSync(packageJsonPath, 'utf8')).toContain('"version": "0.1.1"')
    expect(readFileSync(changelogPath, 'utf8')).toContain('## v0.1.0 - 2026-08-17')
  })
})
