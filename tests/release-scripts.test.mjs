import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  compareStableVersions,
  findLatestStableReleaseVersion,
  getReleaseDecision,
  getStableReleaseVersion,
  parseStableVersion
} from '../scripts/check-release-version.mjs'
import {
  assertPackageChangelogVersion,
  extractChangelogSection,
  readChangelogReleaseNotes
} from '../scripts/extract-changelog-release-notes.mjs'
import {
  archiveReleasedChangelogVersion,
  getNextDevVersion,
  parseBoundedVersion,
  prepareNextDevVersion
} from '../scripts/prepare-next-dev-version.mjs'

const tempDirs = []

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

function createTempDir() {
  const directory = mkdtempSync(join(tmpdir(), 'hmi-release-'))
  tempDirs.push(directory)
  return directory
}

describe('release scripts', () => {
  it('parses only stable SemVer package versions', () => {
    expect(parseStableVersion('1.2.3')).toEqual({ raw: '1.2.3', major: 1, minor: 2, patch: 3 })
    expect(parseStableVersion('v1.2.3')).toBeNull()
    expect(parseStableVersion('1.2.3-beta.1')).toBeNull()
    expect(parseStableVersion('1.2.3+build.1')).toBeNull()
    expect(() => compareStableVersions('1.2.3-beta.1', '1.2.3')).toThrow('stable semver')
  })

  it('decides to release only when package version is newer than stable GitHub releases', () => {
    expect(compareStableVersions('0.1.1', '0.1.0')).toBe(1)
    expect(getStableReleaseVersion({ tag_name: 'v0.1.0', draft: false, prerelease: false })).toBe(
      '0.1.0'
    )
    expect(getStableReleaseVersion({ tag_name: '0.1.0', draft: false, prerelease: false })).toBeNull()
    expect(findLatestStableReleaseVersion([
      { tag_name: 'v0.1.2', draft: true, prerelease: false },
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
    expect(getReleaseDecision({
      currentVersion: '0.1.0',
      releases: [{ tag_name: 'v0.1.0', draft: false, prerelease: false }]
    }).shouldRelease).toBe(false)
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
    expect(() => extractChangelogSection(markdown, '0.1.2')).toThrow(
      'CHANGELOG.md must contain notes for version 0.1.2'
    )
    expect(() => extractChangelogSection('## Unreleased / 0.1.2\n', '0.1.2')).toThrow(
      'must not be empty'
    )
  })

  it('validates package version against the top changelog Unreleased section', () => {
    const directory = createTempDir()
    const packageJsonPath = join(directory, 'package.json')
    const changelogPath = join(directory, 'CHANGELOG.md')
    writeFileSync(packageJsonPath, `${JSON.stringify({ version: '0.1.1' }, null, 2)}\n`)
    writeFileSync(changelogPath, '# Changelog\n\n## Unreleased / 0.1.1\n\n### Added\n\n- 当前说明\n')

    expect(
      readChangelogReleaseNotes({
        packageJsonPath,
        changelogPath
      })
    ).toMatchObject({
      version: '0.1.1',
      notes: expect.stringContaining('当前说明')
    })
    expect(
      assertPackageChangelogVersion(
        '# Changelog\n\n## Unreleased / 0.1.1\n\n- 当前说明\n',
        '0.1.1'
      )
    ).toBe('0.1.1')
    expect(() =>
      assertPackageChangelogVersion('# Changelog\n\n## Unreleased / 0.1.0\n', '0.1.1')
    ).toThrow('must match package.json version 0.1.1')
  })

  it('prepares the next development version in package and changelog files', () => {
    const directory = createTempDir()
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
    expect(parseBoundedVersion('0.100.100')).toMatchObject({ major: 0, minor: 100, patch: 100 })
    expect(() => parseBoundedVersion('0.101.0')).toThrow('between 0 and 100')
    expect(getNextDevVersion('0.1.99')).toBe('0.1.100')
    expect(getNextDevVersion('0.1.100')).toBe('0.2.0')
    expect(getNextDevVersion('0.100.100')).toBe('1.0.0')
    expect(readFileSync(packageJsonPath, 'utf8')).toContain('"version": "0.1.1"')
    expect(readFileSync(changelogPath, 'utf8')).toContain('## v0.1.0 - 2026-08-17')
    expect(archiveReleasedChangelogVersion(
      '# Changelog\n\n## Unreleased / 0.1.1\n\n### Changed\n\n- 版本策略\n',
      '0.1.1',
      '0.1.2',
      '2026-08-18'
    )).toContain('## Unreleased / 0.1.2\n\n## v0.1.1 - 2026-08-18')
  })

  it('does not modify dev files when version state is already ahead or inconsistent', () => {
    const directory = createTempDir()
    const packageJsonPath = join(directory, 'package.json')
    const changelogPath = join(directory, 'CHANGELOG.md')
    writeFileSync(packageJsonPath, `${JSON.stringify({ version: '0.2.0' }, null, 2)}\n`)
    writeFileSync(changelogPath, '# Changelog\n\n## Unreleased / 0.2.0\n\n### Added\n\n- 下一版本\n')

    expect(prepareNextDevVersion({ packageJsonPath, changelogPath, releasedVersion: '0.1.100' }))
      .toMatchObject({
        changed: false,
        nextVersion: '0.2.0'
      })
    expect(readFileSync(packageJsonPath, 'utf8')).toContain('"version": "0.2.0"')

    writeFileSync(packageJsonPath, `${JSON.stringify({ version: '0.1.0' }, null, 2)}\n`)
    expect(() =>
      prepareNextDevVersion({ packageJsonPath, changelogPath, releasedVersion: '0.1.1' })
    ).toThrow('dev package version 0.1.0 is lower than released version 0.1.1')
  })
})
