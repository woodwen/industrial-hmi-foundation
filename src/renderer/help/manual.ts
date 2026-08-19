import type { LanguageCode } from '../localization/messages'

export interface ManualSection {
  id: string
  title: string
  paragraphs: string[]
  bullets: string[]
}

export const userManualByLanguage: Record<LanguageCode, ManualSection[]> = {
  'zh-CN': [
    {
      id: 'manual-purpose',
      title: '应用定位',
      paragraphs: [
        'Industrial HMI Foundation 是工业自动化上位机/HMI 的 Electron 基础工程，用于学习、面试展示和后续能力演进。',
        '当前版本在基础桌面壳、进程边界、MVVM、日志、错误处理、帮助文档、更新检查和发布打包流程之上，加入模拟设备的 Modbus TCP / OPC UA 链路验证、Tag 采集、实时监控、设备状态机、受控自动重连、报警、Historian、趋势、Recipe、权限、审计和 CommandService 控制。'
      ],
      bullets: [
        'Renderer 是受限 UI 层，只通过 window.hmi 访问桌面能力。',
        'Main 进程负责窗口生命周期、IPC handler、日志、更新检查和后续工业基础设施。',
        'Preload 只暴露最小 typed API，不暴露 raw ipcRenderer 或 Node.js 模块。',
        '项目说明书在 docs/project-manual.md 中详细解释开发目的、协议映射和关键工程问答。'
      ]
    },
    {
      id: 'manual-pages',
      title: '基础页面',
      paragraphs: ['左侧导航提供 Dashboard、Device、Alarm、Trend、Recipe、Tag Management 和 Settings 页面骨架。'],
      bullets: [
        'Dashboard 展示模拟混料设备的温度、液位、压力、转速、运行状态、模式和生产计数。',
        'Device 可以连接独立启动的模拟 PLC，并通过 CommandService 写入目标温度/手动转速、执行启停和阀门控制。',
        'Device Tag Monitor 展示默认 Tag 的 Value、Unit、Quality 和 Timestamp。',
        'Alarm、Trend、Recipe 和 Audit 页面用于展示报警确认/恢复、历史趋势、配方下载和审计记录。',
        '权限模型区分 Operator、Engineer 和 Admin；Renderer 可以调整界面，但关键写操作仍由 Main Process 权威校验。',
        'Settings 可以选择 Modbus TCP 或 OPC UA 通信配置，并在 Simulator 区域启动/停止本地 Modbus TCP 或 OPC UA Simulator。'
      ]
    },
    {
      id: 'manual-language',
      title: '语言切换',
      paragraphs: ['应用默认使用中文。顶部语言控件可以在中文和英文之间切换。'],
      bullets: [
        '语言选择在当前应用中保持一致。',
        '英文缺失翻译时会回退到中文，避免空白或调试 key 出现在界面中。',
        '使用说明书会随当前语言切换。'
      ]
    },
    {
      id: 'manual-logs-errors',
      title: '日志与错误',
      paragraphs: ['项目提供 application、communication 和 error 三类日志基础，并使用统一错误模型跨层传递错误。'],
      bullets: [
        'application log 用于应用生命周期和用户操作摘要。',
        'communication log 记录设备连接、断开、手工读写、轮询摘要、超时和通信错误。',
        'error log 用于 IPC、Main 和 Renderer 顶层错误。',
        'Audit Log 记录 Start、Stop、Setpoint Change、Valve Control、Recipe Download 和 Alarm Acknowledge 等关键操作。',
        '错误 shape 包含 code、message、detail、source 和 cause。'
      ]
    },
    {
      id: 'manual-updates',
      title: '检查更新',
      paragraphs: ['通过 Help 中的检查更新入口可以手动检查 GitHub Releases 上的新版本。'],
      bullets: [
        '开发环境不会执行真实远端更新检查。',
        '自动下载默认关闭，发现新版本后由用户确认。',
        'macOS 未签名包不承诺应用内自动安装，会引导打开 GitHub Releases 下载页手动安装。'
      ]
    },
    {
      id: 'manual-scope',
      title: '当前边界',
      paragraphs: ['当前版本不是生产控制系统，设备通信仅用于连接本项目提供的模拟 PLC 或兼容测试端点。'],
      bullets: [
        '已实现独立 PLC Simulator、应用内 Simulator 控制、Modbus TCP adapter、DeviceManager、设备状态机、自动重连、Tag 模型、TagCache、PollingScheduler、Dashboard 实时监控、Device Tag Monitor、CommandService 和基础写入验证。',
        'OPC UA 默认使用本地 anonymous / no-security simulator，不代表生产 OPC UA 安全配置。',
        'Modbus RTU 当前未实现 runtime；文档只解释 RTU 协议概念和未来接入方式。',
        'Tag Quality 显示 Bad 或 Uncertain 时，页面可以保留 last value，但不能把旧值当作正常实时数据。',
        '历史趋势写入 SQLite，实时趋势使用有上限的 ring buffer。',
        '配方下载会经过校验、命令生成、写入和 read-back / verify；部分失败不能返回整体成功。',
        '后续工业能力应通过独立 OpenSpec change 增量实现。'
      ]
    },
    {
      id: 'manual-faq',
      title: '常见问题',
      paragraphs: ['如果 Device 页面无法读取数据，先确认 PLC Simulator 已独立启动。'],
      bullets: [
        '看不到实时数据：先在 Settings 的 Simulator 区域启动 Modbus TCP Simulator，再到 Device 页面 Connect；维护者也可以用 yarn simulator:start 独立启动。',
        '使用 OPC UA：先在 Settings 的 Simulator 区域启动 OPC UA Simulator，并在 Settings 中选择 OPC UA endpoint；维护者也可以用 yarn simulator:opcua:start 独立启动。',
        'Tag Quality 显示 Bad：检查 Simulator 是否停止或通信是否中断；恢复 Simulator 后 HMI 会按 backoff 自动重连，已进入 Fault 时再手工 Connect。',
        '报警仍然显示：Acknowledge 只表示已确认，工况恢复后才进入 Recovered。',
        '检查更新提示开发环境：请使用 packaged 应用验证真实更新检查。',
        '版本更新说明为空：请确认 CHANGELOG.md 中存在当前版本区块。'
      ]
    }
  ],
  'en-US': [
    {
      id: 'manual-purpose',
      title: 'Purpose',
      paragraphs: [
        'Industrial HMI Foundation is an Electron foundation for an industrial HMI desktop application.',
        'This version adds Modbus TCP / OPC UA verification, Tag acquisition, realtime monitoring, an explicit device state machine, bounded automatic reconnect, alarms, historian, trends, Recipe download, permissions, audit, and CommandService control on top of the desktop shell, process boundaries, MVVM, logging, error handling, help content, update checks, and release packaging.'
      ],
      bullets: [
        'Renderer is a restricted UI layer and accesses desktop capabilities only through window.hmi.',
        'Main owns the window lifecycle, IPC handlers, logging, update checks, and future industrial infrastructure.',
        'Preload exposes a minimal typed API and does not expose raw ipcRenderer or Node.js modules.',
        'The detailed project manual lives in docs/project-manual.md and explains the project purpose, protocol mapping, and engineering Q&A.'
      ]
    },
    {
      id: 'manual-pages',
      title: 'Pages',
      paragraphs: ['The sidebar provides Dashboard, Device, Alarm, Trend, Recipe, Tag Management, and Settings frames.'],
      bullets: [
        'Dashboard shows temperature, level, pressure, RPM, running state, mode, and production count for the simulated mixer.',
        'Device can connect to the independently started simulated PLC, write target temperature/manual RPM, and execute start/stop and valve controls through CommandService.',
        'Device Tag Monitor shows Value, Unit, Quality, and Timestamp for the default Tags.',
        'Alarm, Trend, Recipe, and Audit pages show alarm acknowledgement/recovery, historical trends, Recipe download, and audit records.',
        'Permissions distinguish Operator, Engineer, and Admin; Renderer can adjust UI, but Main Process still authorizes critical writes.',
        'Settings can select Modbus TCP or OPC UA communication configuration and start/stop the local Modbus TCP or OPC UA Simulator.'
      ]
    },
    {
      id: 'manual-language',
      title: 'Language',
      paragraphs: ['The application uses Chinese by default. The top language control switches between Chinese and English.'],
      bullets: [
        'The selected language remains consistent during app use.',
        'Missing English translations fall back to Chinese.',
        'The user manual follows the active language.'
      ]
    },
    {
      id: 'manual-logs-errors',
      title: 'Logs And Errors',
      paragraphs: ['The project provides application, communication, and error log categories with a unified error shape.'],
      bullets: [
        'Application logs capture lifecycle and user operation summaries.',
        'Communication logs capture device connect, disconnect, manual reads, writes, polling summaries, timeouts, and communication errors.',
        'Error logs capture IPC, Main, and Renderer top-level errors.',
        'Audit Log records critical operations such as Start, Stop, Setpoint Change, Valve Control, Recipe Download, and Alarm Acknowledge.',
        'The error shape contains code, message, detail, source, and cause.'
      ]
    },
    {
      id: 'manual-updates',
      title: 'Updates',
      paragraphs: ['Use the Help update entry to manually check GitHub Releases for a new version.'],
      bullets: [
        'Development builds do not perform real remote update checks.',
        'Automatic download is disabled until the user confirms.',
        'Unsigned macOS builds use a manual GitHub Releases download path instead of in-app installation.'
      ]
    },
    {
      id: 'manual-scope',
      title: 'Current Scope',
      paragraphs: ['This version is not a production control system. Device communication is intended for the bundled PLC Simulator or a compatible test endpoint.'],
      bullets: [
        'PLC Simulator, in-app Simulator control, Modbus TCP adapter, DeviceManager, explicit device state machine, automatic reconnect, Tag model, TagCache, PollingScheduler, Dashboard realtime monitoring, Device Tag Monitor, CommandService, and basic write verification are implemented.',
        'OPC UA defaults to a local anonymous / no-security simulator and is not a production OPC UA security profile.',
        'Modbus RTU runtime is not implemented; the documentation only explains the protocol concept and future adapter path.',
        'Bad or Uncertain Tag Quality can keep the last value visible, but it must not be treated as healthy realtime data.',
        'Historical trends are stored in SQLite, while realtime trends use bounded ring buffers.',
        'Recipe download validates parameters, generates commands, writes values, and performs read-back / verify; partial failure is not overall success.',
        'Future industrial capabilities should be added through separate OpenSpec changes.'
      ]
    },
    {
      id: 'manual-faq',
      title: 'FAQ',
      paragraphs: ['If Device cannot read data, confirm the PLC Simulator is running independently.'],
      bullets: [
        'No realtime data: start the Modbus TCP Simulator from Settings, then use Connect on the Device page; maintainers can still use yarn simulator:start for independent validation.',
        'Using OPC UA: start the OPC UA Simulator from Settings and select the OPC UA endpoint in Settings; maintainers can still use yarn simulator:opcua:start for independent validation.',
        'Tag Quality shows Bad: check whether the Simulator stopped or communication was interrupted; after the Simulator recovers, HMI reconnects automatically with backoff, and Fault still requires manual Connect.',
        'Alarm remains visible: Acknowledge only records operator confirmation; the condition must recover before the alarm is Recovered.',
        'Development update status: use a packaged app to verify real update checks.',
        'Empty version notes: confirm CHANGELOG.md contains a current version section.'
      ]
    }
  ]
}
