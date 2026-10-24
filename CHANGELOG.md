# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-10-24

### Changed

- The README benchmark now compares time-sliced with the usual ways to keep Node.js responsive: `await` in a loop, `async.eachSeries`, `setTimeout(0)` or `setImmediate` after every row, and yielding every 500 rows. time-sliced is the only one that stays responsive while running at close to plain-loop speed.
- The README shows how to import with ES modules, CommonJS and TypeScript, and adds examples for servers, Electron's main process, search-as-you-type, CLI spinners, tree walks and tests.
- No code changes: this release updates the README shown on npm.

## [0.1.0] - 2026-10-24

### Added

- `timeSlicedMap` and `timeSlicedForEach`: map or iterate any iterable, giving the event loop a turn once a time budget (8 ms by default) has passed instead of every N items, so a run of slow items can no longer freeze the app.
- `createTimeSlicer` for loops that don't fit a map, such as `while` loops, tree walks and nested loops.
- `yieldToEventLoop`, which yields with the best method the runtime has: `scheduler.yield()`, then `setImmediate`, then `MessageChannel`, then `setTimeout`.
- `AbortSignal` support to stop a loop early.
- ESM and CommonJS builds, each with TypeScript types, so both `import` and `require` work. Runs in Node.js 22+, Bun, Deno, browsers and Electron.

[unreleased]: https://github.com/RagedPanda/time-sliced/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/RagedPanda/time-sliced/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/RagedPanda/time-sliced/releases/tag/v0.1.0
