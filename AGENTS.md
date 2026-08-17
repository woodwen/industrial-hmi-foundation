# AGENTS.md

## Project Overview

本项目名称为 **Industrial HMI**。

这是一个基于 Electron 的工业自动化上位机 / HMI 学习与工程实践项目，主要用于：

* 工业上位机开发技术学习
* Electron 在工业桌面软件领域的工程实践
* Modbus TCP / OPC UA 等工业通信协议实践
* 工业实时数据、设备控制、报警、趋势、配方等典型场景实践
* 技术面试项目展示

当前业务场景为：

**自动化恒温混料设备监控与控制系统。**

本项目主要使用 PLC Simulator 模拟工业设备，不应在代码、文档或 UI 中暗示系统已经应用于真实生产环境。

---

# Technology Stack

主要技术栈：

* Electron
* React
* TypeScript
* MobX
* MVVM
* SQLite
* Modbus TCP
* OPC UA

测试框架优先沿用项目现有配置，不为了单个需求随意更换测试体系。

包管理器沿用项目初始化后的统一选择，不混用 npm / yarn / pnpm lockfile。

---

# Core Architecture

整体架构：

```text
PLC / PLC Simulator
        │
        │ Modbus TCP / OPC UA
        ▼
Electron Main Process
        │
        ├── DeviceManager
        ├── ProtocolAdapter
        ├── TagService
        ├── PollingScheduler
        ├── TagCache
        ├── CommandService
        ├── AlarmEngine
        └── HistorianService
        │
        ▼
      Preload
        │
        │ Typed IPC API
        ▼
Electron Renderer
        │
        ├── ViewModel
        └── React View
```

必须维持以下依赖方向：

```text
View
↓
ViewModel
↓
Application / Domain Service
↓
Infrastructure
```

不得产生反向依赖。

---

# Electron Process Boundaries

## Main Process

以下能力原则上属于 Main Process：

* TCP / Socket
* Modbus
* OPC UA
* PLC 通信
* DeviceManager
* PollingScheduler
* TagService
* TagCache
* CommandService
* AlarmEngine
* Historian
* SQLite
* 文件系统
* 系统级日志

工业通信不得直接运行在 React Renderer 中。

---

## Preload

Preload 只负责：

* 暴露最小化 API
* IPC 类型转换
* Renderer 与 Main Process 之间的安全边界

要求：

* `contextIsolation` 保持开启
* Renderer 不直接获得 Node.js API
* 不向 Renderer 暴露完整 `ipcRenderer`
* 不暴露 `require`
* 不暴露底层 Modbus / OPC UA Client

优先提供明确的业务 API，例如：

```text
connectDevice
disconnectDevice
writeTag
subscribeTagChanges
subscribeDeviceState
subscribeAlarms
```

而不是暴露通用 IPC 调用入口。

---

## Renderer

Renderer 只负责：

* React UI
* View
* ViewModel
* 用户交互
* 状态展示

Renderer 禁止：

* 直接连接 PLC
* 直接创建 TCP Socket
* 直接访问 Modbus
* 直接访问 OPC UA
* 直接访问 SQLite
* 直接访问 Node.js API

---

# MVVM Rules

React Component 应尽量保持为 View。

业务状态和行为优先进入 ViewModel。

例如：

```text
DashboardPage
↓
DashboardViewModel
↓
TagService API
```

而不是：

```text
DashboardPage
↓
ModbusClient
```

View 不应该理解：

* Modbus Function Code
* Holding Register
* OPC UA NodeId
* TCP reconnect
* SQLite SQL

这些属于更底层模块。

---

# Industrial Domain Model

## Device

设备连接状态至少考虑：

```text
Disconnected
Connecting
Connected
Reconnecting
Fault
```

设备状态转换应显式设计，不使用多个相互独立的 boolean 表示复杂连接状态。

---

# Tag Model

工业数据必须通过统一 Tag 模型。

`TagDefinition` 至少考虑：

```text
id
name
deviceId
address
registerType
dataType
scale
offset
unit
writable
scanRate
```

实时值 `TagValue` 至少包含：

```text
tagId
value
quality
timestamp
```

---

# Tag Quality

Quality 至少支持：

```text
Good
Bad
Uncertain
```

禁止仅使用：

```text
tagId + value
```

表示实时工业数据。

设备断线、通信失败或数据超时后，不允许历史旧值继续被 UI 当作正常实时数据展示。

可以保留 last value，但必须同时正确更新：

```text
quality
timestamp
```

---

# Protocol Abstraction

工业协议必须通过统一抽象层接入。

建议：

```text
IProtocolAdapter

├── ModbusAdapter
└── OpcUaAdapter
```

业务层不得直接依赖具体 Modbus 或 OPC UA 第三方库。

第三方协议库只能存在于 Infrastructure / Protocol Adapter 层。

协议差异不得被强行完全抹平。

例如：

* Modbus 主要采用 Polling
* OPC UA 可以采用 Subscription

允许 Protocol Adapter 暴露 capability 描述协议能力。

---

# PLC Simulator

在没有真实 PLC 的情况下，通过独立 PLC Simulator 完成开发和测试。

PLC Simulator 必须与 Electron HMI 解耦。

Simulator 应能够独立启动和关闭。

业务场景至少模拟：

* Temperature
* Target Temperature
* Level
* Pressure
* Motor RPM
* Motor Running
* Inlet Valve
* Outlet Valve
* Production Count
* Operation Mode

后续可以增加：

* connection loss
* response delay
* write failure
* sensor abnormal value

Simulator 只是测试设备，不得让业务代码对 Simulator 产生特殊依赖。

目标是未来可以：

```text
PLC Simulator
→
真实 Modbus PLC
```

而不需要修改业务层。

---

# Polling Rules

禁止：

```text
一个 Tag 一个 setInterval
```

周期采集统一由 `PollingScheduler` 管理。

Polling 优先按照以下因素进行分组：

1. device
2. scanRate
3. registerType
4. address continuity

例如：

```text
40001
40002
40003
40004
```

应尽可能批量读取，而不是执行四次 Modbus 请求。

---

# Scan Groups

不同类型数据允许不同采样频率。

例如：

```text
Fast
100ms

Normal
500ms

Slow
1000ms
```

实际值根据业务和性能测试调整。

不得因为 UI 需要更高刷新率就无限提高 PLC Polling Frequency。

---

# UI Refresh

必须区分：

```text
PLC Sampling Rate
```

和：

```text
UI Refresh Rate
```

禁止：

```text
每次 PLC 数据变化
↓
立即发送单条 IPC
↓
立即 React Render
```

大量实时数据需要考虑：

* batching
* throttle
* debounce
* change detection

避免高频 IPC 和 React Render。

---

# Tag Cache

实时数据应首先进入统一：

```text
TagCache
```

然后再向：

```text
ViewModel
AlarmEngine
Historian
Trend
```

分发。

避免不同模块重复读取 PLC。

---

# Device Communication

所有设备通信必须考虑：

* connect timeout
* request timeout
* disconnect
* reconnect
* invalid response
* malformed data
* partial failure
* resource cleanup

设备通信异常不得导致 Renderer 崩溃。

---

# Reconnect

自动重连使用受控 backoff。

例如：

```text
1s
2s
4s
8s
10s
10s
...
```

必须存在最大重连间隔。

禁止零间隔无限重试。

重新连接成功以后需要重新建立：

* Polling
* Subscription
* Device State
* Tag Quality

---

# Device Commands

所有写设备操作统一通过：

```text
CommandService
```

数据流：

```text
View
↓
ViewModel
↓
IPC
↓
CommandService
↓
ProtocolAdapter
↓
PLC
```

禁止 UI 直接写 PLC。

Command 至少考虑：

* writable
* value range
* timeout
* error
* result
* audit

---

# Write Verification

必须区分：

```text
通信写入成功
```

和：

```text
设备状态已经达到目标
```

根据场景选择：

* write response
* read-back
* PLC acknowledgement

不要默认 Modbus write 成功就代表整个业务操作成功。

---

# Alarm

报警不能仅实现为 UI Toast。

Alarm 应作为独立 Domain。

生命周期至少考虑：

```text
Inactive
Active
Acknowledged
Recovered
```

需要明确：

```text
Acknowledged != Recovered
```

报警应支持：

* threshold
* level
* delay
* debounce
* timestamp
* triggerValue

---

# Historian

历史数据统一通过 Historian Service 管理。

第一阶段使用 SQLite。

禁止所有业务模块直接编写 SQL。

历史采集需要考虑：

* fixed interval
* change based
* deadband

避免无意义地将每次 Polling 结果全部写入数据库。

---

# Trend

实时趋势与历史趋势分开处理。

实时趋势优先：

```text
Ring Buffer
```

历史趋势：

```text
SQLite
```

趋势数据必须设置合理的数据量上限。

禁止实时趋势无限保存数据导致内存持续增长。

---

# Recipe

Recipe 是工业业务对象，不只是 UI 表单。

Recipe Download 流程应类似：

```text
Recipe
↓
Validate
↓
Generate Commands
↓
Write PLC
↓
Read-back / Verify
↓
Result
```

必须处理部分失败。

禁止部分写入失败时仍返回整体成功。

---

# Permission

权限不能只通过：

```text
隐藏按钮
```

实现。

Renderer 可以根据权限控制 UI。

Main Process / CommandService 对关键写操作仍需要进行权限验证。

---

# Audit

关键控制操作必须可审计。

至少考虑：

```text
timestamp
user
action
target
oldValue
newValue
result
```

典型审计操作：

* Start
* Stop
* Setpoint Change
* Valve Control
* Recipe Download
* Alarm Acknowledge
* Configuration Change

---

# Logging

日志至少区分：

```text
Application
Communication
Error
```

通信日志需要能够辅助排查：

* device
* request
* response
* timeout
* reconnect
* command failure

避免记录密码、Token 等敏感信息。

高频 Polling 不应默认输出大量无意义 INFO 日志。

---

# Error Handling

禁止：

```text
catch {
}
```

吞掉异常。

异常至少需要：

* 记录上下文
* 转换为可理解的业务错误
* 正确更新 Device State / Tag Quality

底层协议异常尽量不要直接暴露给 UI。

例如不要让 UI 接收到：

```text
ECONNRESET
```

而应该转换为明确的设备通信状态或业务错误。

---

# Resource Cleanup

特别检查以下资源：

* setInterval
* setTimeout
* Socket
* Modbus client
* OPC UA session
* OPC UA subscription
* IPC listener
* EventEmitter listener
* database connection

设备断开、页面销毁、应用退出时必须正确释放。

---

# Testing

核心 Domain Logic 应优先编写测试。

重点覆盖：

* Tag decode
* scale / offset
* Device State Machine
* reconnect
* Tag Quality
* Alarm condition
* Recipe validation
* Permission
* Command validation

协议层至少提供关键 Integration Test。

如果修改已有功能，应优先增加防回归测试。

---

# OpenSpec Workflow

本项目使用 OpenSpec 管理较大的功能变更。

原则：

**AGENTS.md 定义长期工程规则。**

**OpenSpec change 定义当前需求。**

不要把某一期具体业务需求长期写入 AGENTS.md。

复杂功能原则上：

```text
proposal
↓
design
↓
specs
↓
tasks
↓
implementation
↓
review
↓
commit
↓
archive
```

---

# Before Implementation

如果当前任务对应 OpenSpec change：

必须先阅读：

```text
proposal
design
specs
tasks
```

确认：

* scope
* architecture
* acceptance criteria
* tasks

再开始修改代码。

禁止只阅读 `tasks.md` 就直接实现。

---

# Scope Control

严格按照当前 OpenSpec change 的范围实施。

禁止：

* 顺手开发下一期功能
* 大范围无关重构
* 因“以后可能需要”提前设计大量抽象
* 无需求依据增加复杂框架
* 擅自替换核心技术栈

发现当前架构确实阻碍需求时：

先说明问题和建议，再进行最小必要调整。

---

# Dependency Rules

新增生产依赖前必须先确认：

1. 当前项目是否已经有可用能力
2. 是否真的需要新增依赖
3. 依赖是否维护活跃
4. 是否适合 Electron
5. 是否影响打包
6. 是否影响跨平台能力

禁止为了几十行简单逻辑随意增加第三方库。

---

# Code Style

优先遵循已有项目代码风格。

原则：

* TypeScript strict
* 明确类型
* 避免 `any`
* 优先小函数
* 明确模块职责
* 避免循环依赖
* 避免 God Class
* 避免超大 ViewModel
* 避免 UI 与 Protocol 耦合

不要为了使用设计模式而使用设计模式。

---

# Comments

注释解释：

```text
为什么这样设计
```

而不是重复：

```text
代码正在做什么
```

对于以下逻辑建议增加说明：

* Modbus address mapping
* batching
* reconnect
* Quality
* state machine
* alarm lifecycle
* industrial domain decisions

---

# Documentation

发生重要架构变化时同步更新相关文档。

特别是：

* Architecture
* Modbus Mapping
* Tag Model
* Device State Machine
* Alarm Lifecycle
* Development Guide

代码和文档不能长期不一致。

---

# Verification

完成代码修改以后，根据项目现有 scripts 执行适用检查。

通常至少包括：

```bash
typecheck
lint
test
build
```

如果项目脚本名称不同，以 `package.json` 为准。

涉及 OpenSpec change 时执行：

```bash
openspec validate <change-id> --strict
openspec validate --all --strict
git diff --check
```

发现失败必须明确汇报。

禁止把失败测试描述为成功。

---

# Git

除非用户明确要求，否则：

* 不主动 push
* 不主动 merge
* 不主动 archive OpenSpec change
* 不修改无关 commit
* 不重写 Git history
* 不执行危险 Git 命令

不要为了让工作区“看起来干净”删除用户已有修改。

---

# Code Review Rules

Review 时重点检查：

## Architecture

* Main / Preload / Renderer 是否越界
* View 是否直接操作 Protocol
* ViewModel 是否承担过多基础设施职责
* Domain 是否直接依赖第三方协议库

## Industrial Communication

* 是否存在重复 Timer
* Polling 是否可能重入
* Modbus 请求是否存在不受控并发
* 是否正确处理 timeout
* 是否正确处理 disconnect
* reconnect 是否可能形成死循环
* 是否正确释放连接资源

## Real-time Data

* Tag 是否包含 Quality
* 数据是否可能无限过期仍显示 Good
* IPC 是否过于频繁
* React 是否产生无意义高频 Render
* Trend 数据是否无限增长

## Commands

* 是否校验 writable
* 是否校验 value range
* 是否处理 timeout
* 是否存在写成功但状态未确认的问题
* 是否记录 Audit

## Alarm

* Active / Acknowledged / Recovered 是否混淆
* 是否存在报警抖动
* 是否持久化必要生命周期信息

## Tests

* 核心逻辑是否有测试
* 测试是否只测试 mock，而没有验证真实业务行为
* 异常路径是否覆盖

---

# Definition of Done

一个任务只有满足以下条件才认为完成：

1. 当前需求实现完成。
2. 没有明显超出 scope。
3. 架构边界保持正确。
4. 必要测试已新增或更新。
5. TypeScript 检查通过。
6. lint 通过。
7. test 通过。
8. build 通过。
9. OpenSpec validation 通过。
10. `git diff --check` 通过。
11. 文档与实现保持一致。
12. 已检查异常路径和资源释放。
13. 已说明仍然存在的风险和限制。

如果某一项无法完成，必须明确说明原因，不得默认忽略。

---

# Development Priorities

发生设计取舍时，优先级如下：

```text
业务正确性
>
设备通信可靠性
>
数据正确性
>
异常可恢复性
>
架构可维护性
>
可测试性
>
性能
>
UI视觉效果
```

工业软件首先保证：

```text
通信正确
数据正确
状态正确
控制正确
异常可恢复
```

然后再考虑视觉效果。

---

# Current Development Strategy

项目采用分阶段实现。

大致方向：

```text
Foundation
↓
PLC Simulator + Modbus TCP
↓
Tag + Polling + Monitoring
↓
Control + Reconnect + Quality
↓
Alarm + Historian + Trend
↓
Recipe + Permission + Audit
↓
OPC UA + Hardening
```

这只是项目 Roadmap。

**当前实际实施范围始终以当前 OpenSpec change 为准。**

不得因为 Roadmap 中存在后续功能而提前实现。
