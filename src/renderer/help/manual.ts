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
        '当前版本在基础桌面壳、进程边界、MVVM、日志、错误处理、帮助文档、更新检查和发布打包流程之上，加入模拟 PLC 的 Modbus TCP 手工链路验证、Tag 周期采集、实时监控、设备状态机、受控自动重连和基础 CommandService 控制。'
      ],
      bullets: [
        'Renderer 是受限 UI 层，只通过 window.hmi 访问桌面能力。',
        'Main 进程负责窗口生命周期、IPC handler、日志、更新检查和后续工业基础设施。',
        'Preload 只暴露最小 typed API，不暴露 raw ipcRenderer 或 Node.js 模块。'
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
        'Alarm、Trend、Recipe 和 Tag Management 当前只展示占位结构。',
        'Settings 当前展示日志与错误上报基础项。'
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
        '已实现独立 PLC Simulator、Modbus TCP adapter、DeviceManager、设备状态机、自动重连、Tag 模型、TagCache、PollingScheduler、Dashboard 实时监控、Device Tag Monitor、CommandService 和基础写入验证。',
        '尚未实现报警处理、历史趋势存储、配方执行、权限审计或 OPC UA。',
        '后续工业能力应通过独立 OpenSpec change 增量实现。'
      ]
    },
    {
      id: 'manual-faq',
      title: '常见问题',
      paragraphs: ['如果 Device 页面无法读取数据，先确认 PLC Simulator 已独立启动。'],
      bullets: [
        '看不到实时数据：运行 yarn simulator:start 后再在 Device 页面 Connect。',
        'Tag Quality 显示 Bad：检查 Simulator 是否停止或通信是否中断；恢复 Simulator 后 HMI 会按 backoff 自动重连，已进入 Fault 时再手工 Connect。',
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
        'This version adds manual Modbus TCP verification, periodic Tag sampling, realtime monitoring, an explicit device state machine, bounded automatic reconnect, and basic CommandService control for a simulated PLC on top of the desktop shell, process boundaries, MVVM, logging, error handling, help content, update checks, and release packaging.'
      ],
      bullets: [
        'Renderer is a restricted UI layer and accesses desktop capabilities only through window.hmi.',
        'Main owns the window lifecycle, IPC handlers, logging, update checks, and future industrial infrastructure.',
        'Preload exposes a minimal typed API and does not expose raw ipcRenderer or Node.js modules.'
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
        'Alarm, Trend, Recipe, and Tag Management currently show structural placeholders.',
        'Settings currently exposes logging and error reporting basics.'
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
        'PLC Simulator, Modbus TCP adapter, DeviceManager, explicit device state machine, automatic reconnect, Tag model, TagCache, PollingScheduler, Dashboard realtime monitoring, Device Tag Monitor, CommandService, and basic write verification are implemented.',
        'Alarm processing, historian storage, recipe execution, permission audit, and OPC UA are not implemented.',
        'Future industrial capabilities should be added through separate OpenSpec changes.'
      ]
    },
    {
      id: 'manual-faq',
      title: 'FAQ',
      paragraphs: ['If Device cannot read data, confirm the PLC Simulator is running independently.'],
      bullets: [
        'No realtime data: run yarn simulator:start, then use Connect on the Device page.',
        'Tag Quality shows Bad: check whether the Simulator stopped or communication was interrupted; after the Simulator recovers, HMI reconnects automatically with backoff, and Fault still requires manual Connect.',
        'Development update status: use a packaged app to verify real update checks.',
        'Empty version notes: confirm CHANGELOG.md contains a current version section.'
      ]
    }
  ]
}
