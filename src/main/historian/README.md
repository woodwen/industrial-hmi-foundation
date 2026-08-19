# Historian Module

Owns Main Process historical storage and trend query behavior.

- SQLite persistence uses `better-sqlite3` behind repository interfaces.
- Tag History records selected trend tags with first-sample, fixed interval, deadband, and quality-change rules.
- Real-time trends use bounded per-tag Ring Buffers.
- Historical trend queries use indexed SQLite time ranges and aggregate large ranges before IPC.
- This phase does not implement automatic history retention cleanup.
