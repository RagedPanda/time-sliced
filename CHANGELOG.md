# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `timeSlicedMap` and `timeSlicedForEach`: map or iterate any iterable, giving the event loop a turn once a time budget (8 ms by default) has passed instead of every N items, so a run of slow items can no longer freeze the app.
- `createTimeSlicer` for loops that don't fit a map, such as `while` loops, tree walks and nested loops.
- `yieldToEventLoop`, which yields with the best method the runtime has: `scheduler.yield()`, then `setImmediate`, then `MessageChannel`, then `setTimeout`.
- `AbortSignal` support to stop a loop early.
- TypeScript types. Runs in Node.js 22+, Bun, Deno, browsers and Electron.

[unreleased]: https://github.com/RagedPanda/time-sliced/commits/main
