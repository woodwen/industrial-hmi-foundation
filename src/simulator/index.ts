import { createInterface } from 'node:readline'

import { PlcSimulator } from './plc-simulator'

async function main(): Promise<void> {
  const simulator = new PlcSimulator()
  await simulator.start()

  console.info(`PLC Simulator listening at ${simulator.getStatus().endpoint}`)
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

async function handleCommand(command: string, simulator: PlcSimulator, readline: ReturnType<typeof createInterface>): Promise<void> {
  const [action, value] = command.split(/\s+/)

  if (command === 'status') {
    console.info(JSON.stringify(simulator.getStatus(), null, 2))
    return
  }

  if (command === 'help') {
    printHelp()
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

  if (action === 'delay') {
    if (value === 'off') {
      simulator.clearResponseDelay()
      console.info('PLC Simulator response delay disabled.')
      return
    }

    const delayMs = Number(value)
    if (Number.isInteger(delayMs) && delayMs >= 0) {
      simulator.setResponseDelay(delayMs)
      console.info(`PLC Simulator response delay set to ${delayMs}ms.`)
      return
    }
  }

  if (action === 'write-fail') {
    if (value === 'once') {
      simulator.failNextWrite()
      console.info('PLC Simulator will fail the next write request.')
      return
    }

    if (value === 'on') {
      simulator.setWriteFailureMode('always')
      console.info('PLC Simulator write failure enabled.')
      return
    }

    if (value === 'off') {
      simulator.setWriteFailureMode('off')
      console.info('PLC Simulator write failure disabled.')
      return
    }
  }

  if (command === 'network-error') {
    simulator.triggerNetworkError()
    console.info('PLC Simulator network error triggered.')
    return
  }

  if (command === 'clear-faults') {
    simulator.clearFaults()
    console.info('PLC Simulator fault injection cleared.')
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
  console.info('Commands: status, disconnect, recover, delay <ms>, delay off, write-fail once|on|off, network-error, clear-faults, stop')
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
