# time-sliced

[![npm version](https://img.shields.io/npm/v/time-sliced)](https://www.npmjs.com/package/time-sliced)
[![CI](https://github.com/RagedPanda/time-sliced/actions/workflows/ci.yml/badge.svg)](https://github.com/RagedPanda/time-sliced/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/RagedPanda/time-sliced/actions/workflows/ci.yml)
[![npm downloads](https://img.shields.io/npm/dm/time-sliced)](https://www.npmjs.com/package/time-sliced)
[![bundle size](https://img.shields.io/bundlejs/size/time-sliced)](https://bundlejs.com/?q=time-sliced)
[![types](https://img.shields.io/npm/types/time-sliced)](https://www.npmjs.com/package/time-sliced)
[![node](https://img.shields.io/node/v/time-sliced)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/time-sliced)](LICENSE)

> Run long loops without freezing the event loop: yield on a **time budget**, not every N items

The usual fix for a loop that freezes the UI or stalls a server looks like this:

```js
for (const [index, row] of rows.entries()) {
	processRow(row);
	if (index % 500 === 0) await new Promise(resolve => setImmediate(resolve));
}
```

It assumes every row costs the same. It works in testing, and then a run of slow rows arrives: large emails, big JSON blobs, rows that hit a slow path. Each chunk of 500 now holds the thread for hundreds of milliseconds. The app beachballs, timers fire late and requests time out, even though the loop "yields".

`time-sliced` yields once a time budget has passed (8 ms by default), however long each item takes:

```js
import {timeSlicedForEach} from 'time-sliced';

await timeSlicedForEach(rows, processRow);
```

## Install

```sh
npm install time-sliced
```

No dependencies. Runs in Node.js 22+, Bun, Deno, browsers and Electron (main and renderer).

It ships ESM and CommonJS, with TypeScript types for both:

```js
// ES modules
import {timeSlicedMap, timeSlicedForEach, createTimeSlicer} from 'time-sliced';
```

```js
// CommonJS
const {timeSlicedMap, timeSlicedForEach, createTimeSlicer} = require('time-sliced');
```

```ts
// TypeScript: the option and slicer types are exported too
import {timeSlicedForEach, type TimeSliceOptions} from 'time-sliced';
```

## Benchmark

One job, run with each way people usually try to keep Node.js responsive: 20,000 rows at 0.02 ms each, with a run of 1,000 heavy rows at 0.5 ms in the middle. A 1 ms heartbeat timer measures the longest time the event loop was frozen. Median of 3 runs, Node.js 24.17, Apple M5:

| Strategy | Total time | Longest freeze | Result |
|---|---:|---:|---|
| Plain loop | 897 ms | 897 ms | freezes |
| `await` every row | 887 ms | 887 ms | freezes |
| [async](https://www.npmjs.com/package/async) `eachSeries` | 882 ms | 882 ms | freezes |
| `setTimeout(0)` every row | 24.6 s | 16 ms | responsive, 27.4x slower |
| `setImmediate` every row | 1286 ms | 6 ms | responsive, 1.4x slower |
| `setImmediate` every 500 rows | 908 ms | 254 ms | freezes |
| **time-sliced** | **921 ms** | **11 ms** | **responsive and fast** |

What the numbers show:

- **`await` and `async.eachSeries` don't help.** Awaiting a promise that is already resolved only runs microtasks. Timers, I/O and rendering still wait for the whole loop.
- **Yielding after every row works, but you pay for every yield.** `setImmediate` costs about 15 µs per yield, 40% extra here. `setTimeout(0)` costs over 1 ms per yield (Node.js clamps it to 1 ms, browsers to 4 ms once nested), so the job takes 27 times as long.
- **Yielding every N rows is fast until the rows get slow.** 500 cheap rows take 10 ms, but 500 heavy rows take 250 ms, and that's the freeze users see.
- **time-sliced yields once 8 ms have passed.** It yields often while rows are slow and rarely while they're cheap. The job takes about the same time as the plain loop, and the event loop is never frozen for much longer than the budget.

Run it yourself with `npm run bench`.

## Usage

### Map or iterate

```js
import {timeSlicedMap, timeSlicedForEach} from 'time-sliced';

const parsed = await timeSlicedMap(rawMessages, message => parseMessage(message));

await timeSlicedForEach(rows, row => {
	searchIndex.add(row);
});
```

Both accept any iterable (arrays, `Set`, `Map`, generators) and run the callback in order, one item at a time.

### Your own loop

When the work doesn't fit a map, such as a `while` loop, a tree walk or several nested loops, use a slicer:

```js
import {createTimeSlicer} from 'time-sliced';

const slicer = createTimeSlicer();

for (const folder of folders) {
	for (const message of folder.messages) {
		indexMessage(message);
		if (slicer.isSpent()) await slicer.yield();
	}
}
```

### Stop early

```js
const controller = new AbortController();
cancelButton.onclick = () => controller.abort();

await timeSlicedForEach(rows, processRow, {signal: controller.signal});
```

The signal is checked before the loop starts and every time it yields. An aborted loop rejects with the signal's reason.

## Examples

### Keep a server answering while it imports a file

```js
app.post('/import', async (request, response) => {
	const rows = parseCsv(request.body);
	// Health checks and other API calls keep getting answered during a 50,000-row import.
	const records = await timeSlicedMap(rows, row => toRecord(row));
	await database.insertMany(records);
	response.json({imported: records.length});
});
```

On a server, nothing has to render at 60 fps, so a bigger budget means fewer yields: `{budgetMs: 25}` still keeps every other request waiting no more than about 25 ms.

### Index a mailbox in Electron's main process without the beachball

A busy main process freezes every window. Report progress only when the slicer yields, so the IPC traffic stays small:

```js
const {ipcMain} = require('electron');
const {createTimeSlicer} = require('time-sliced');

ipcMain.handle('index-mailbox', async (event, messages) => {
	const slicer = createTimeSlicer();
	for (const [index, message] of messages.entries()) {
		searchIndex.add(message);
		if (slicer.isSpent()) {
			event.sender.send('index-progress', index / messages.length);
			await slicer.yield();
		}
	}
});
```

### Search as the user types, cancelling the previous search

```js
import {timeSlicedForEach} from 'time-sliced';

let controller;

searchInput.addEventListener('input', async () => {
	controller?.abort();
	controller = new AbortController();
	const query = searchInput.value.toLowerCase();
	const matches = [];

	try {
		await timeSlicedForEach(notes, note => {
			if (note.text.toLowerCase().includes(query)) {
				matches.push(note);
			}
		}, {signal: controller.signal});
		renderResults(matches);
	} catch (error) {
		if (error.name !== 'AbortError') {
			throw error;
		}
	}
});
```

Typing stays smooth, because each keystroke gets handled within one slice. An older search stops at its next yield instead of finishing work nobody will see.

### Keep a CLI spinner moving

Spinners and progress bars animate on timers, so a loop that never yields freezes them:

```js
import ora from 'ora';
import {timeSlicedForEach} from 'time-sliced';

const spinner = ora('Hashing files').start();
await timeSlicedForEach(fileContents, content => {
	hashes.push(hash(content));
});
spinner.succeed();
```

### Walk a tree

A slicer works anywhere you can put an `if`, including recursion:

```js
import {createTimeSlicer} from 'time-sliced';

const slicer = createTimeSlicer();

const countFiles = async node => {
	let count = node.isFile ? 1 : 0;
	for (const child of node.children ?? []) {
		count += await countFiles(child);
	}

	if (slicer.isSpent()) {
		await slicer.yield();
	}

	return count;
};
```

### Test without real timers

Pass a fake clock and yield function to check how often your code yields:

```js
let nowMs = 0;
let yields = 0;

await timeSlicedForEach(rows, () => {
	nowMs += 2; // Each row "takes" 2 ms.
}, {
	now: () => nowMs,
	yieldToEventLoop: async () => {
		yields += 1;
	},
});
```

## API

### `timeSlicedMap(items, mapper, options?)`

Returns a `Promise` of the mapped array, like `Array.from(items, mapper)`. `mapper(item, index)` must be synchronous; for concurrent async work use [p-map](https://github.com/sindresorhus/p-map).

### `timeSlicedForEach(items, callback, options?)`

Calls `callback(item, index)` on each item in order. Returns a `Promise<void>`.

### `createTimeSlicer(options?)`

Returns `{isSpent(), yield()}`:

- `isSpent()`: whether `budgetMs` has passed since the current slice started.
- `yield()`: gives the event loop a turn, then starts a new slice.

### `yieldToEventLoop()`

Gives the event loop a single turn, using the best method the runtime has: `scheduler.yield()` in Chromium, `setImmediate` in Node.js and Bun, `MessageChannel` elsewhere (avoiding the 4 ms clamp of nested `setTimeout`), and `setTimeout(0)` as a last resort.

### Options

| Option | Default | |
|---|---|---|
| `budgetMs` | `8` | Milliseconds of work before yielding. 8 ms leaves room for rendering in a 60 fps frame; a server can use more. |
| `signal` | | An `AbortSignal` that stops the loop. |
| `yieldToEventLoop` | best for the runtime | A custom way to yield, such as `() => scheduler.yield()` or `() => new Promise(resolve => setTimeout(resolve, 0))`. |
| `now` | `performance.now` | The clock, in milliseconds. Useful in tests. |

## Good to know

- **A single item longer than the budget still blocks for that long.** Time slicing splits work *between* items. If one item takes 200 ms, move it to a [worker thread](https://nodejs.org/api/worker_threads.html) or split it.
- **Overhead is about 30 ns per item**: one `performance.now()` call. That is invisible next to real per-item work, but for millions of trivial items, process them in small batches per callback.
- **It doesn't make the work faster**; it lets everything else run in between. Total time stays about the same.

## Related

- [p-map](https://github.com/sindresorhus/p-map): map over async work with limited concurrency.
- [`scheduler.yield()`](https://developer.mozilla.org/docs/Web/API/Scheduler/yield): the browser primitive this uses when available.

## License

MIT
