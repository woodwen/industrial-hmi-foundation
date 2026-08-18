import { createInterface } from 'node:readline'

import { PlcSimulator } from './plc-simulator'

async function main(): Promise<void> {
  const simulator = new PlcSimulator()
  await simulator.start()

  console.info(`PLC Simulator listening at ${simulator.getStatus().endpoint}`)
  console.info('Commands: status, disconnect, recover, stop')

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout
  })

  readline.on('line', (line) => {
    void handleCommand(line.trim(), simulator, readline)
  })

  process.once('SIGINT', () => {
    void shutdown(simulator, readline)
  })

  process.once('SIGTERM', () => {
    void shutdown(simulator, readline)
  })
}

async function handleCommand(command: string, simulator: PlcSimulator, readline: ReturnType<typeof createInterface>): Promise<void> {
  if (command === 'status') {
    console.info(JSON.stringify(simulator.getStatus(), null, 2))
    return
  }

  if (command === 'disconnect') {
    await simulator.disconnect()
    console.info('PLC Simulator disconnected.')
    return
  }

  if (command === 'recover') {
    await simulator.recover()
    console.info(`PLC Simulator listening at ${simulator.getStatus().endpoint}`)
    return
  }

  if (command === 'stop' || command === 'exit' || command === 'quit') {
    await shutdown(simulator, readline)
    return
  }

  if (command.length > 0) {
    console.info('Unknown command. Available commands: status, disconnect, recover, stop')
  }
}

async function shutdown(simulator: PlcSimulator, readline: ReturnType<typeof createInterface>): Promise<void> {
  readline.close()
  await simulator.stop()
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
