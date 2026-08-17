## 1. Repository Documentation

- [x] 1.1 Add root `AGENTS.md` with project purpose, architecture boundaries, coding rules, OpenSpec workflow, validation commands, and scope guards.
- [x] 1.2 Add root `README.md` covering project positioning, tech stack, setup, scripts, architecture, current pages, help/update entry points, release packaging, and deferred industrial capabilities.
- [x] 1.3 Add root `CHANGELOG.md` using `## Unreleased / 0.1.0` and future `## vX.Y.Z - YYYY-MM-DD` sections.
- [x] 1.4 Ensure docs use Chinese by default and include enough English-facing context for bilingual support where appropriate.

## 2. Localization Foundation

- [x] 2.1 Define `LanguageCode` and typed translation keys for Chinese and English.
- [x] 2.2 Set Chinese as the default language and implement missing-key fallback to Chinese.
- [x] 2.3 Wire language state into the existing Renderer MVVM structure without introducing React Router, Tailwind, or a component library.
- [x] 2.4 Add a user-facing language switch in an appropriate existing page or shell area.
- [x] 2.5 Update existing navigation and base page text to use the localization layer.

## 3. Help And Version Notes

- [x] 3.1 Add an application Help entry with `使用说明书`, `版本更新说明`, and `检查更新`.
- [x] 3.2 Add packaged Chinese and English user manual content that explains current HMI foundation pages, architecture constraints, logging/error basics, update flow, and deferred industrial business scope.
- [x] 3.3 Add a user manual view/modal that renders the packaged manual for the active language.
- [x] 3.4 Add a changelog parser for the root `CHANGELOG.md` format.
- [x] 3.5 Add a version updates view/modal that renders current and historical entries from bundled `CHANGELOG.md`.
- [x] 3.6 Ensure help views are accessible offline and do not require network requests.

## 4. Update Checking

- [x] 4.1 Add update-related shared types and typed `window.hmi` API methods/events.
- [x] 4.2 Add Main update manager based on `electron-updater`, adapted from StockMonitor for this project's API and logging shape.
- [x] 4.3 Add IPC handlers for checking, downloading, cancelling, opening release download page, and quitting to install.
- [x] 4.4 In development mode, avoid real update checks and return a deterministic user-visible status.
- [x] 4.5 In packaged macOS unsigned builds, degrade to manual GitHub Releases download instead of promising automatic install.
- [x] 4.6 Add Renderer `AppUpdateViewModel` and update status UI using existing MobX and plain CSS patterns.
- [x] 4.7 Keep manual update checking as the first implementation path and do not enable startup auto-checking by default.

## 5. GitHub Release Packaging

- [x] 5.1 Add Electron Builder dependency and package build configuration for macOS, Windows, and Linux using `Industrial HMI Foundation`, `com.industrialhmi.foundation`, `Industrial-HMI-Foundation-${version}-${arch}.${ext}`, `release`, and `industrial-hmi-foundation`.
- [x] 5.2 Configure GitHub publish provider from this project's remote owner/repo or explicit project config, not StockMonitor values.
- [x] 5.3 Ensure macOS build emits both `dmg` and `zip` artifacts for GitHub Releases update metadata.
- [x] 5.4 Add release helper scripts for version comparison, changelog release notes extraction, and next dev version preparation.
- [x] 5.5 Add `.github/workflows/release.yml` triggered by push to `master`, using npm commands for install, typecheck, lint, test, build, packaging, and release creation.
- [x] 5.6 Keep GitHub Packages publishing disabled by default; publish only GitHub Releases and desktop artifacts.

## 6. Tests And Verification

- [x] 6.1 Add tests for default Chinese language, English switching, and Chinese fallback for missing translations.
- [x] 6.2 Add tests for Help entry behavior and manual/version notes rendering.
- [x] 6.3 Add changelog parser and release notes extraction tests.
- [x] 6.4 Add preload API contract tests for update methods and update event subscription cleanup.
- [x] 6.5 Add update manager tests for development mode, manual macOS fallback, network error mapping, release download URL, and cancellation.
- [x] 6.6 Add package/release workflow tests for publish provider, `master` trigger branch, macOS zip artifact, Linux executable name, GitHub Releases-only publishing, and uploaded artifact patterns.
- [x] 6.7 Run `openspec validate add-localized-help-release-readiness --strict`.
- [x] 6.8 During implementation, run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`.

## 7. Scope Guard

- [x] 7.1 Confirm no Modbus, OPC UA, PLC Simulator, Tag Polling, Alarm processing, Historian storage, or Recipe execution is introduced.
- [x] 7.2 Confirm Renderer still does not directly import Node.js, Electron Main APIs, TCP clients, industrial protocol clients, or SQLite clients.
- [x] 7.3 Confirm StockMonitor references are adapted to this project and no StockMonitor package name, owner/repo, domain text, or yarn-only command leaks into implementation.
