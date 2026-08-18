import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const binExtension = process.platform === 'win32' ? '.cmd' : ''
const electronViteBinary = join('node_modules', '.bin', `electron-vite${binExtension}`)
const electronBinary = join('node_modules', '.bin', `electron${binExtension}`)

for (const binary of [electronViteBinary, electronBinary]) {
  if (!existsSync(binary)) {
    console.error(`${binary} was not found. Run yarn install first.`)
    process.exit(1)
  }
}

await runCommand(electronViteBinary, ['build'], process.env, 30000)
await runCommand(
  electronBinary,
  [join('out', 'main', 'index.js')],
  {
    ...process.env,
    HMI_SMOKE_TEST: '1'
  },
  15000
)

function runCommand(command, args, env, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: 'inherit'
    })

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`${command} ${args.join(' ')} timed out.`))
    }, timeoutMs)

    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })

    child.on('exit', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}.`))
    })
  })
}
