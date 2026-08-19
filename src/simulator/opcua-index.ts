import { createInterface } from 'node:readline'

import { OpcUaSimulator } from './opcua-simulator'

async function main(): Promise<void> {
  const simulator = new OpcUaSimulator()
  await simulator.start()

  console.info(`OPC UA Simulator listening at ${simulator.getStatus().endpoint}`)
  printHelp()

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

async function handleCommand(
  command: string,
  simulator: OpcUaSimulator,
  readline: ReturnType<typeof createInterface>
): Promise<void> {
  if (command === 'status') {
    console.info(JSON.stringify(simulator.getStatus(), null, 2))
    return
  }

  if (command === 'tick') {
    simulator.tick()
    console.info('OPC UA Simulator advanced one process tick.')
    return
  }

  if (command === 'help') {
    printHelp()
    return
  }

  if (command === 'stop' || command === 'exit' || command === 'quit') {
    await shutdown(simulator, readline)
    return
  }

  if (command.length > 0) {
    console.info('Unknown command.')
    printHelp()
  }
}

function printHelp(): void {
  console.info('Commands: status, tick, stop')
}

async function shutdown(simulator: OpcUaSimulator, readline: ReturnType<typeof createInterface>): Promise<void> {
  readline.close()
  await simulator.stop()
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
