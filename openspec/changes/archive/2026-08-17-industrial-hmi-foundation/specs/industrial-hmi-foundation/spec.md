## ADDED Requirements

### Requirement: Electron Process Architecture
The system SHALL provide a clear Electron Main, Preload, and Renderer architecture for the Industrial HMI desktop application.

#### Scenario: Application process entries exist
- **WHEN** the foundation implementation is complete
- **THEN** the project SHALL contain separate Main, Preload, and Renderer source entries
- **AND** each entry SHALL have a clear responsibility boundary

#### Scenario: Secure browser window configuration
- **WHEN** Main creates the application BrowserWindow
- **THEN** `contextIsolation` SHALL be enabled
- **AND** `nodeIntegration` SHALL be disabled

### Requirement: Foundation Tooling Defaults
The system SHALL use the confirmed default foundation tooling for this change.

#### Scenario: Electron Vite tooling is used
- **WHEN** the project tooling is implemented
- **THEN** the build setup SHALL use `electron-vite` for Main, Preload, and Renderer entry points
- **AND** project commands SHALL be exposed through npm scripts

#### Scenario: Vitest is used for foundation tests
- **WHEN** the foundation test structure is implemented
- **THEN** the TypeScript unit and architecture boundary tests SHALL run through Vitest

#### Scenario: Styling stays lightweight
- **WHEN** Renderer page frames are implemented
- **THEN** styles SHALL use ordinary CSS or CSS Modules
- **AND** this foundation change SHALL NOT require Tailwind or a component library

### Requirement: Renderer MVVM Layering
The system SHALL organize Renderer code with React, TypeScript, MobX, and MVVM layering.

#### Scenario: View consumes ViewModel state
- **WHEN** a Renderer page displays application state
- **THEN** the React View SHALL read state from a ViewModel
- **AND** the View SHALL delegate user actions to ViewModel methods

#### Scenario: Layer direction is preserved
- **WHEN** Renderer logic is added
- **THEN** dependencies SHALL follow View -> ViewModel -> Application Service / Domain Service -> Infrastructure
- **AND** View code SHALL NOT call Infrastructure directly

#### Scenario: ViewModels are provided through React Context
- **WHEN** Renderer Views need access to shared ViewModels
- **THEN** the application SHALL provide Root or App ViewModel access through React Context
- **AND** pages SHALL NOT depend on hidden global ViewModel construction

### Requirement: Restricted Renderer Capabilities
The system SHALL prevent Renderer code from directly accessing Node.js, TCP communication, industrial protocol implementations, or SQLite.

#### Scenario: Renderer has no Node.js globals
- **WHEN** the Renderer runs in the Electron window
- **THEN** it SHALL NOT have direct Node.js integration
- **AND** it SHALL access desktop capabilities only through the Preload API

#### Scenario: Renderer imports are constrained
- **WHEN** lint or architecture boundary checks run
- **THEN** Renderer source SHALL NOT import Node.js APIs, Electron Main APIs, TCP clients, Modbus clients, OPC UA clients, or SQLite clients directly

### Requirement: Minimal Typed Preload API
The system SHALL expose a minimal, type-safe Preload API to Renderer through a single controlled surface.

#### Scenario: Renderer uses exposed HMI API
- **WHEN** Renderer needs desktop application capabilities
- **THEN** it SHALL call the typed API exposed by Preload
- **AND** it SHALL NOT receive raw `ipcRenderer`, arbitrary IPC channel access, or Node.js modules

#### Scenario: Initial HMI API remains minimal
- **WHEN** the foundation Preload API is implemented
- **THEN** `window.hmi` SHALL expose only foundation use cases such as `app.getInfo()`, `log.write()`, and `errors.report()`
- **AND** it SHALL NOT expose industrial protocol operations in this change

#### Scenario: IPC errors use unified responses
- **WHEN** a Preload API call fails
- **THEN** the failure SHALL be represented using the unified application error model
- **AND** the Renderer ViewModel SHALL be able to store and display the error state

### Requirement: Base Navigation Pages
The system SHALL provide base page frames and navigation for Dashboard, Device, Alarm, Trend, Recipe, Tag Management, and Settings.

#### Scenario: User switches between base pages
- **WHEN** the user selects a navigation item
- **THEN** the Renderer SHALL show the selected page frame
- **AND** the navigation state SHALL reflect the active page

#### Scenario: Navigation uses AppViewModel state
- **WHEN** base page navigation is implemented
- **THEN** it SHALL use `AppViewModel.activePage` or equivalent ViewModel state
- **AND** this foundation change SHALL NOT require React Router

#### Scenario: Pages remain business-empty
- **WHEN** any base page is opened in this foundation change
- **THEN** the page SHALL provide only structural UI and placeholder state
- **AND** it SHALL NOT implement real Modbus, OPC UA, PLC Simulator, Tag Polling, Alarm, Historian, or Recipe behavior

### Requirement: Foundation ViewModels
The system SHALL provide foundational ViewModels for application shell, dashboard, and device page state.

#### Scenario: AppViewModel manages navigation
- **WHEN** the user changes pages
- **THEN** `AppViewModel` SHALL update the active page state
- **AND** Renderer Views SHALL observe that state through MobX

#### Scenario: DashboardViewModel provides dashboard frame state
- **WHEN** Dashboard is rendered
- **THEN** `DashboardViewModel` SHALL provide initial dashboard frame state without real-time industrial data collection

#### Scenario: DeviceViewModel provides device frame state
- **WHEN** Device is rendered
- **THEN** `DeviceViewModel` SHALL provide initial device frame state without real device connections

### Requirement: Industrial Module Directory Boundaries
The system SHALL define source directories for future industrial domain modules without implementing their business logic in this change.

#### Scenario: Main industrial directories are present
- **WHEN** the foundation implementation is complete
- **THEN** the Main source area SHALL reserve directories for `device`, `protocol`, `tag`, `alarm`, `historian`, `command`, and `ipc`
- **AND** those directories SHALL communicate their intended responsibility through names, exports, or lightweight documentation

#### Scenario: Renderer UI directories are present
- **WHEN** the foundation implementation is complete
- **THEN** the Renderer source area SHALL contain directories for `pages`, `components`, and `viewmodels`

### Requirement: Unified Logging Infrastructure
The system SHALL provide a unified logging foundation with application, communication, and error log categories.

#### Scenario: Application events are logged
- **WHEN** application lifecycle or UI-level operational events occur
- **THEN** the system SHALL be able to record them as application logs

#### Scenario: Communication log category exists
- **WHEN** future industrial communication behavior is added
- **THEN** the system SHALL provide a communication log category ready for protocol connection, request, response, timeout, and reconnect summaries
- **AND** this foundation change SHALL NOT implement real protocol traffic logging

#### Scenario: Initial logger uses console sink
- **WHEN** the foundation logger is implemented
- **THEN** it SHALL provide a logger interface and default console sink
- **AND** file log persistence SHALL remain an extension point unless a later change specifies it

#### Scenario: Errors are logged
- **WHEN** unhandled application errors or IPC handler errors occur
- **THEN** the system SHALL be able to record them as error logs with useful context

### Requirement: Unified Error Handling
The system SHALL provide a unified application error model and top-level error handling pattern.

#### Scenario: Error shape is consistent
- **WHEN** application errors cross layer or process boundaries
- **THEN** they SHALL use a consistent shape containing `code` and `message`
- **AND** they MAY include `detail`, `source`, and `cause` for diagnostics

#### Scenario: Main converts errors
- **WHEN** a Main process service or IPC handler throws
- **THEN** the system SHALL convert the error to the unified application error shape before returning it across process boundaries

#### Scenario: Renderer captures UI errors
- **WHEN** a Renderer View or ViewModel encounters an error
- **THEN** the system SHALL capture it through a top-level error handling mechanism
- **AND** the relevant ViewModel SHALL expose user-visible error state

### Requirement: Foundation Test Structure
The system SHALL provide a basic test structure for TypeScript compilation, linting, unit tests, build verification, and architecture boundary validation.

#### Scenario: Verification commands pass
- **WHEN** maintainers run the project verification commands
- **THEN** TypeScript compilation, lint, test, and build SHALL pass for the foundation implementation

#### Scenario: ViewModel behavior is tested
- **WHEN** unit tests run
- **THEN** tests SHALL verify basic `AppViewModel`, `DashboardViewModel`, and `DeviceViewModel` behavior

#### Scenario: Renderer boundary is tested
- **WHEN** architecture boundary tests run
- **THEN** tests SHALL verify Renderer does not directly import prohibited Node.js, TCP, industrial protocol, or SQLite capabilities

### Requirement: Repository Completion Readiness
The system SHALL define repository and completion-readiness rules for finalizing this foundation change.

#### Scenario: Independent repository is used
- **WHEN** maintainers prepare the foundation project for local completion commit
- **THEN** `/Users/mac/code/NodeProjects/industrial-hmi-foundation` SHALL be treated as an independent git repository
- **AND** the project SHALL NOT be merged into `StockMonitor` or another unrelated project repository by default

#### Scenario: Tracked files are explicit
- **WHEN** maintainers prepare files for commit
- **THEN** source files, OpenSpec artifacts, project configuration, `package-lock.json`, and `.npmrc` SHALL be eligible for tracking
- **AND** `node_modules/`, `out/`, build outputs, coverage, logs, and system temporary files SHALL remain excluded

#### Scenario: Final validation includes git diff check
- **WHEN** the project has a git repository and maintainers prepare a local completion commit
- **THEN** `git diff --check` SHALL be run with the OpenSpec and project validation commands
- **AND** a failure or unavailable git repository SHALL be reported before completing the commit

#### Scenario: Archive remains explicit
- **WHEN** this change is only being updated or reviewed
- **THEN** OpenSpec archive SHALL NOT be performed automatically
- **AND** archive SHALL require an explicit completion or archive workflow request

### Requirement: Deferred Industrial Business Scope
The system SHALL explicitly defer real industrial business capabilities from this foundation change.

#### Scenario: Deferred features are not implemented
- **WHEN** this foundation change is implemented
- **THEN** Modbus, OPC UA, PLC Simulator, Tag Polling, Alarm processing, Historian storage, and Recipe execution SHALL remain unimplemented
- **AND** any related directories or pages SHALL be structural placeholders only
