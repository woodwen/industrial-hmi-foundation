## 1. Repository Documentation

- [ ] 1.1 Add root `AGENTS.md` with project purpose, architecture boundaries, coding rules, OpenSpec workflow, validation commands, and scope guards.
- [ ] 1.2 Add root `README.md` covering project positioning, tech stack, setup, scripts, architecture, current pages, help/update entry points, release packaging, and deferred industrial capabilities.
- [ ] 1.3 Add root `CHANGELOG.md` using `## Unreleased / 0.1.0` and future `## vX.Y.Z - YYYY-MM-DD` sections.
- [ ] 1.4 Ensure docs use Chinese by default and include enough English-facing context for bilingual support where appropriate.

## 2. Localization Foundation

- [ ] 2.1 Define `LanguageCode` and typed translation keys for Chinese and English.
- [ ] 2.2 Set Chinese as the default language and implement missing-key fallback to Chinese.
- [ ] 2.3 Wire language state into the existing Renderer MVVM structure without introducing React Router, Tailwind, or a component library.
- [ ] 2.4 Add a user-facing language switch in an appropriate existing page or shell area.
- [ ] 2.5 Update existing navigation and base page text to use the localization layer.

## 3. Help And Version Notes

- [ ] 3.1 Add an application Help entry with `使用说明书`, `版本更新说明`, and `检查更新`.
- [ ] 3.2 Add packaged Chinese and English user manual content that explains current HMI foundation pages, architecture constraints, logging/error basics, update flow, and deferred industrial business scope.
- [ ] 3.3 Add a user manual view/modal that renders the packaged manual for the active language.
- [ ] 3.4 Add a changelog parser for the root `CHANGELOG.md` format.
- [ ] 3.5 Add a version updates view/modal that renders current and historical entries from bundled `CHANGELOG.md`.
- [ ] 3.6 Ensure help views are accessible offline and do not require network requests.

## 4. Update Checking

- [ ] 4.1 Add update-related shared types and typed `window.hmi` API methods/events.
- [ ] 4.2 Add Main update manager based on `electron-updater`, adapted from StockMonitor for this project's API and logging shape.
- [ ] 4.3 Add IPC handlers for checking, downloading, cancelling, opening release download page, and quitting to install.
- [ ] 4.4 In development mode, avoid real update checks and return a deterministic user-visible status.
- [ ] 4.5 In packaged macOS unsigned builds, degrade to manual GitHub Releases download instead of promising automatic install.
- [ ] 4.6 Add Renderer `AppUpdateViewModel` and update status UI using existing MobX and plain CSS patterns.
- [ ] 4.7 Add optional startup update checking if a persisted setting exists; otherwise keep manual checking as the first implementation path.

## 5. GitHub Release Packaging

- [ ] 5.1 Add Electron Builder dependency and package build configuration for macOS, Windows, and Linux.
- [ ] 5.2 Configure GitHub publish provider using the confirmed HMI repository owner/repo, not StockMonitor values.
- [ ] 5.3 Ensure macOS build emits both `dmg` and `zip` artifacts for GitHub Releases update metadata.
- [ ] 5.4 Add release helper scripts for version comparison, changelog release notes extraction, and next dev version preparation.
- [ ] 5.5 Add `.github/workflows/release.yml` using npm commands for install, typecheck, lint, test, build, packaging, and release creation.
- [ ] 5.6 Decide whether GitHub Packages publishing is required; default is GitHub Releases only unless explicitly enabled.

## 6. Tests And Verification

- [ ] 6.1 Add tests for default Chinese language, English switching, and Chinese fallback for missing translations.
- [ ] 6.2 Add tests for Help entry behavior and manual/version notes rendering.
- [ ] 6.3 Add changelog parser and release notes extraction tests.
- [ ] 6.4 Add preload API contract tests for update methods and update event subscription cleanup.
- [ ] 6.5 Add update manager tests for development mode, manual macOS fallback, network error mapping, release download URL, and cancellation.
- [ ] 6.6 Add package/release workflow tests for publish provider, macOS zip artifact, Linux executable name, and uploaded artifact patterns.
- [ ] 6.7 Run `openspec validate add-localized-help-release-readiness --strict`.
- [ ] 6.8 During implementation, run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`.

## 7. Scope Guard

- [ ] 7.1 Confirm no Modbus, OPC UA, PLC Simulator, Tag Polling, Alarm processing, Historian storage, or Recipe execution is introduced.
- [ ] 7.2 Confirm Renderer still does not directly import Node.js, Electron Main APIs, TCP clients, industrial protocol clients, or SQLite clients.
- [ ] 7.3 Confirm StockMonitor references are adapted to this project and no StockMonitor package name, owner/repo, domain text, or yarn-only command leaks into implementation.
