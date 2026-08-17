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
        '当前版本聚焦桌面壳、进程边界、MVVM、日志、错误处理、帮助文档、更新检查和发布打包流程。'
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
        'Dashboard 展示未来现场总览的结构位置。',
        'Device 为后续设备连接和协议适配器预留。',
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
        'communication log 为后续工业协议通信摘要预留。',
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
      paragraphs: ['当前版本不是生产控制系统，也不会连接真实设备。'],
      bullets: [
        '尚未实现 Modbus TCP、OPC UA 或 PLC Simulator。',
        '尚未实现实时采集、报警处理、历史趋势存储或配方执行。',
        '后续工业能力应通过独立 OpenSpec change 增量实现。'
      ]
    },
    {
      id: 'manual-faq',
      title: '常见问题',
      paragraphs: ['如果界面只显示占位内容，这是当前基础阶段的预期状态。'],
      bullets: [
        '看不到真实设备数据：当前尚未实现设备连接和采集。',
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
        'This version focuses on the desktop shell, process boundaries, MVVM, logging, error handling, help content, update checks, and release packaging.'
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
        'Dashboard reserves the future plant overview area.',
        'Device reserves future device connections and protocol adapters.',
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
        'Communication logs are reserved for future industrial protocol summaries.',
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
      paragraphs: ['This version is not a production control system and does not connect to real devices.'],
      bullets: [
        'Modbus TCP, OPC UA, and PLC Simulator are not implemented.',
        'Realtime collection, alarm processing, historian storage, and recipe execution are not implemented.',
        'Future industrial capabilities should be added through separate OpenSpec changes.'
      ]
    },
    {
      id: 'manual-faq',
      title: 'FAQ',
      paragraphs: ['Placeholder content is expected in the current foundation stage.'],
      bullets: [
        'No live device data: device connection and polling are not implemented yet.',
        'Development update status: use a packaged app to verify real update checks.',
        'Empty version notes: confirm CHANGELOG.md contains a current version section.'
      ]
    }
  ]
}
