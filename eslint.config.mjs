import { builtinModules } from 'node:module'

import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const nodeBuiltinImportPaths = Array.from(
  new Set(
    builtinModules.flatMap((moduleName) => {
      const normalizedName = moduleName.replace(/^node:/, '')
      return [normalizedName, `node:${normalizedName}`]
    })
  )
)

export default [
  {
    ignores: ['node_modules/**', 'out/**', 'dist/**', 'release/**', 'coverage/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.vitest
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        projectService: true
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error'
    }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...nodeBuiltinImportPaths,
            'electron',
            'sqlite3',
            'better-sqlite3',
            'modbus-serial',
            'node-opcua'
          ],
          patterns: ['../main/*', '../../main/*', '../../../main/*']
        }
      ],
      'no-restricted-globals': [
        'error',
        { name: 'process', message: 'Renderer code must use typed preload APIs instead of Node globals.' },
        { name: 'Buffer', message: 'Renderer code must use typed preload APIs instead of Node globals.' },
        { name: 'require', message: 'Renderer code must use typed preload APIs instead of Node globals.' },
        { name: 'module', message: 'Renderer code must use typed preload APIs instead of Node globals.' },
        { name: 'exports', message: 'Renderer code must use typed preload APIs instead of Node globals.' },
        { name: '__dirname', message: 'Renderer code must use typed preload APIs instead of Node globals.' },
        { name: '__filename', message: 'Renderer code must use typed preload APIs instead of Node globals.' }
      ]
    }
  }
]
