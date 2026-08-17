import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const binary = process.platform === 'win32'
  ? join('node_modules', '.bin', 'electron-vite.cmd')
  : join('node_modules', '.bin', 'electron-vite')

if (!existsSync(binary)) {
  console.error('electron-vite binary was not found. Run npm install first.')
  process.exit(1)
}

const child = spawn(binary, ['preview'], {
  env: {
    ...process.env,
    HMI_SMOKE_TEST: '1'
  },
  stdio: 'inherit'
})

const timer = setTimeout(() => {
  child.kill('SIGTERM')
  console.error('Electron smoke start timed out.')
  process.exit(1)
}, 15000)

child.on('exit', (code) => {
  clearTimeout(timer)
  process.exit(code ?? 0)
})
