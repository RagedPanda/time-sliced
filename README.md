# time-sliced

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

No dependencies, with TypeScript types. Runs in Node.js 22+, Bun, Deno, browsers and Electron (main and renderer).

## Benchmark

10,000 rows. Most take 0.02 ms, but a run of 1,000 rows in the middle takes 0.5 ms each. A 1 ms heartbeat timer measures how long the event loop is blocked (median of 5 runs, Node.js 24, Apple Silicon):

| Strategy | Total time | Worst stall |
|---|---:|---:|
| No yielding | 681 ms | 681 ms |
| Yield every 500 rows | 682 ms | 250 ms |
| **time-sliced** (8 ms budget) | **723 ms** | **14 ms** |

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
