import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const releaseWorkflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8')
const appImageSafePathPattern = /^[\p{L}\p{N}._\- ]+$/u

describe('package build config', () => {
  it('uses this project identity for Electron Builder', () => {
    expect(packageJson.build.appId).toBe('com.industrialhmi.foundation')
    expect(packageJson.build.productName).toBe('Industrial HMI Foundation')
    expect(packageJson.build.artifactName).toBe('Industrial-HMI-Foundation-${version}-${arch}.${ext}')
    expect(packageJson.build.icon).toBe('build/icon.png')
    expect(packageJson.build.directories.buildResources).toBe('build')
    expect(packageJson.build.directories.output).toBe('release')
    expect(packageJson.build.linux.executableName).toBe('industrial-hmi-foundation')
    expect(packageJson.build.linux.executableName).toMatch(appImageSafePathPattern)
    expect(packageJson.build.linux.executableName).not.toContain('@')
    expect(packageJson.build.linux.executableName).not.toContain('/')
  })

  it('uses GitHub Releases as the desktop update source', () => {
    expect(packageJson.build.publish).toEqual([
      {
        provider: 'github',
        owner: 'woodwen',
        repo: 'industrial-hmi-foundation',
        releaseType: 'release'
      }
    ])
  })

  it('builds and uploads artifacts needed by update checks', () => {
    expect(packageJson.build.mac.icon).toBe('build/icon.icns')
    expect(packageJson.build.win.icon).toBe('build/icon.ico')
    expect(packageJson.build.linux.icon).toBe('build/icon.png')
    expect(packageJson.build.mac.target).toEqual(expect.arrayContaining(['dmg', 'zip']))
    expect(releaseWorkflow).toContain('branches:\n      - master')
    expect(releaseWorkflow).toContain('yarn install --frozen-lockfile')
    expect(releaseWorkflow).toContain('yarn typecheck')
    expect(releaseWorkflow).toContain('yarn lint')
    expect(releaseWorkflow).toContain('yarn test')
    expect(releaseWorkflow).toContain('node scripts/extract-changelog-release-notes.mjs --check')
    expect(releaseWorkflow).toContain('release/*.dmg')
    expect(releaseWorkflow).toContain('release/*.zip')
    expect(releaseWorkflow).toContain('release/*.yml')
    expect(releaseWorkflow).toContain('release/*.blockmap')
    expect(releaseWorkflow).toContain('--title "$RELEASE_TAG"')
    expect(releaseWorkflow).not.toContain('npm publish')
  })

  it('ships project icon assets for every desktop platform', () => {
    const pngPath = new URL('../build/icon.png', import.meta.url)
    const icnsPath = new URL('../build/icon.icns', import.meta.url)
    const icoPath = new URL('../build/icon.ico', import.meta.url)

    expect(existsSync(pngPath)).toBe(true)
    expect(existsSync(icnsPath)).toBe(true)
    expect(existsSync(icoPath)).toBe(true)
    expect(readFileSync(pngPath).subarray(1, 4).toString('ascii')).toBe('PNG')
    expect(readFileSync(icnsPath).subarray(0, 4).toString('ascii')).toBe('icns')
    expect(readFileSync(icoPath).readUInt16LE(2)).toBe(1)
  })

  it('unpacks the SQLite native module from asar packages', () => {
    expect(packageJson.dependencies).toHaveProperty('better-sqlite3')
    expect(packageJson.build.asar).toBe(true)
    expect(packageJson.build.asarUnpack).toEqual(expect.arrayContaining([
      'node_modules/better-sqlite3/**'
    ]))
  })

  it('prepares the next dev version after publishing without creating release loops', () => {
    expect(releaseWorkflow).toContain('prepare-next-dev-version:')
    expect(releaseWorkflow).toContain('git ls-remote --exit-code --heads origin dev')
    expect(releaseWorkflow).toContain('Development branch')
    expect(releaseWorkflow).toContain('git fetch origin dev:refs/remotes/origin/dev')
    expect(releaseWorkflow).toContain('git checkout -B dev origin/dev')
    expect(releaseWorkflow).toContain('node scripts/prepare-next-dev-version.mjs')
    expect(releaseWorkflow).toContain('--release-date "$(date -u +%F)"')
    expect(releaseWorkflow).toContain('[skip release] [skip ci]')
    expect(releaseWorkflow).toContain('git push origin HEAD:dev')
    expect(releaseWorkflow).not.toContain('git checkout -b dev')
  })

  it('keeps the release workflow on Yarn and GitHub Releases only', () => {
    expect(releaseWorkflow).not.toContain('npm ci')
    expect(releaseWorkflow).not.toContain('npm run')
    expect(releaseWorkflow).not.toContain('npx ')
    expect(releaseWorkflow).not.toContain('packages: write')
    expect(releaseWorkflow).not.toContain('registry-url')
    expect(releaseWorkflow).not.toContain('npm publish')
    expect(releaseWorkflow).not.toContain('conventional')
  })
})
