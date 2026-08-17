import { readFileSync, readdirSync, statSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = join(process.cwd(), 'src', 'renderer')
const nodeBuiltinImportPaths = builtinModules.flatMap((moduleName) => {
  const normalizedName = moduleName.replace(/^node:/, '')
  return [normalizedName, `node:${normalizedName}`]
})
const prohibitedImports = new Set([
  ...nodeBuiltinImportPaths,
  'electron',
  'sqlite3',
  'better-sqlite3',
  'modbus-serial',
  'node-opcua'
])
const prohibitedPatterns = [
  /from\s+['"][./]+main[/'"]/,
  /from\s+['"][./]+.*\/main[/'"]/
]

describe('Renderer architecture boundary', () => {
  it('does not import Node, Electron Main, protocol, or SQLite capabilities directly', () => {
    const violations = listSourceFiles(rendererRoot).flatMap((filePath) => {
      const source = readFileSync(filePath, 'utf8')
      const importStatements = source.matchAll(/import\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g)
      return Array.from(importStatements).flatMap((match) => {
        const importPath = match[1]
        if (prohibitedImports.has(importPath) || prohibitedPatterns.some((pattern) => pattern.test(match[0]))) {
          return [`${filePath}: ${match[0]}`]
        }

        return []
      })
    })

    expect(violations).toEqual([])
  })
})

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      return listSourceFiles(fullPath)
    }

    if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      return [fullPath]
    }

    return []
  })
}
