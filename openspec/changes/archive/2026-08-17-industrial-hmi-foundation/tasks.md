## 1. Project Tooling

- [x] 1.1 Create the Electron + React + TypeScript project tooling with `electron-vite`.
- [x] 1.2 Configure separate Main, Preload, and Renderer TypeScript entry points.
- [x] 1.3 Expose dev, typecheck, lint, test, and build commands through npm scripts.
- [x] 1.4 Add MobX and React integration dependencies for Renderer MVVM state management.
- [x] 1.5 Add Vitest for TypeScript unit tests and architecture boundary tests.
- [x] 1.6 Configure Renderer styling with ordinary CSS or CSS Modules without Tailwind or a component library.

## 2. Electron Process Foundation

- [x] 2.1 Implement Main process application lifecycle and BrowserWindow creation.
- [x] 2.2 Configure BrowserWindow with `contextIsolation: true` and `nodeIntegration: false`.
- [x] 2.3 Implement Preload entry using `contextBridge` with a single minimal `window.hmi` API surface.
- [x] 2.4 Define initial `window.hmi` APIs for `app.getInfo()`, `log.write()`, and `errors.report()`.
- [x] 2.5 Define shared TypeScript types for Preload API requests, responses, and application errors.
- [x] 2.6 Register Main IPC handlers through a centralized `main/ipc/` module.

## 3. Renderer MVVM Shell

- [x] 3.1 Create Renderer app shell with React and TypeScript.
- [x] 3.2 Create `AppViewModel` with MobX observable active page state and navigation actions.
- [x] 3.3 Create `DashboardViewModel` with initial dashboard frame state only.
- [x] 3.4 Create `DeviceViewModel` with initial device frame state only.
- [x] 3.5 Create Root or App ViewModel provider with React Context.
- [x] 3.6 Wire React Views to ViewModels using observer-based rendering.

## 4. Base Pages and Navigation

- [x] 4.1 Create `AppViewModel.activePage` based navigation for Dashboard, Device, Alarm, Trend, Recipe, Tag Management, and Settings without React Router.
- [x] 4.2 Create Dashboard page frame without real-time industrial data collection.
- [x] 4.3 Create Device page frame without real device connection behavior.
- [x] 4.4 Create Alarm, Trend, Recipe, Tag Management, and Settings page frames as structural placeholders.
- [x] 4.5 Verify page switching updates active navigation state and visible page content.

## 5. Industrial Module Boundaries

- [x] 5.1 Create reserved Main directories for `device`, `protocol`, `tag`, `alarm`, `historian`, `command`, and `ipc`.
- [x] 5.2 Add lightweight module exports or README notes that describe each reserved Main directory responsibility.
- [x] 5.3 Create Renderer directories for `pages`, `components`, and `viewmodels`.
- [x] 5.4 Ensure Renderer code does not import Main, protocol, TCP, SQLite, or Node.js modules directly.

## 6. Logging and Error Handling

- [x] 6.1 Define a logger interface with application, communication, and error log categories.
- [x] 6.2 Provide a default console sink logger implementation usable by Main and safe Renderer reporting paths.
- [x] 6.3 Reserve a Main-side file sink extension point without requiring file persistence in this change.
- [x] 6.4 Define a unified application error shape with `code`, `message`, optional `detail`, optional `source`, and optional `cause`.
- [x] 6.5 Convert IPC handler failures into the unified error response shape.
- [x] 6.6 Add Renderer top-level error boundary and ViewModel error state handling.

## 7. Tests and Verification

- [x] 7.1 Add unit tests for `AppViewModel` navigation behavior.
- [x] 7.2 Add unit tests for `DashboardViewModel` and `DeviceViewModel` initial state.
- [x] 7.3 Add tests or lint rules that fail when Renderer imports prohibited Node.js, TCP, industrial protocol, or SQLite modules.
- [x] 7.4 Add a contract test or type test for the Preload `window.hmi` API shape, including `app.getInfo()`, `log.write()`, and `errors.report()`.
- [x] 7.5 Run TypeScript compilation and fix all type errors.
- [x] 7.6 Run lint and fix all lint errors.
- [x] 7.7 Run tests and fix all failing tests.
- [x] 7.8 Run build and verify the Electron app can start successfully.

## 8. Scope Guard

- [x] 8.1 Confirm no Modbus implementation is included in this change.
- [x] 8.2 Confirm no OPC UA implementation is included in this change.
- [x] 8.3 Confirm no PLC Simulator, Tag Polling, Alarm processing, Historian storage, or Recipe execution is included in this change.
- [x] 8.4 Confirm all industrial business pages remain structural placeholders only.
- [x] 8.5 Confirm React Router, Tailwind, and component library dependencies are not introduced in this change.

## 9. Completion Readiness

- [x] 9.1 Initialize or confirm `/Users/mac/code/NodeProjects/industrial-hmi-foundation` as an independent git repository before completion commit.
- [x] 9.2 Confirm the project is not merged into `StockMonitor` or another unrelated repository by default.
- [x] 9.3 Confirm `package-lock.json` and `.npmrc` are tracked candidates, while `node_modules/`, `out/`, build outputs, coverage, logs, and system temporary files remain ignored.
- [x] 9.4 Re-run `openspec validate industrial-hmi-foundation --strict`, `openspec validate --all --strict`, `git diff --check`, `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` after git repository setup.
- [x] 9.5 Record optional `npm run dev` manual page navigation inspection as deferred for a human review session; automated completion uses build, tests, and smoke start verification.
- [x] 9.6 Keep OpenSpec archive deferred until the user explicitly requests a completion or archive workflow.
