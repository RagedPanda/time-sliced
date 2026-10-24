import assert from 'node:assert/strict';
import {test} from 'node:test';
import {timeSlicedForEach, timeSlicedMap} from '../src/iterate.ts';
import {createFakeRuntime} from './helpers.ts';

test('timeSlicedMap maps every item with its index, in order', async () => {
	const results = await timeSlicedMap(['a', 'b', 'c'], (letter, index) => `${index}${letter}`);
	assert.deepEqual(results, ['0a', '1b', '2c']);
});

test('timeSlicedMap accepts any iterable', async () => {
	function * numbers() {
		yield 1;
		yield 2;
	}

	assert.deepEqual(await timeSlicedMap(new Set([1, 2]), number => number * 10), [10, 20]);
	assert.deepEqual(await timeSlicedMap(numbers(), number => number * 10), [10, 20]);
	assert.deepEqual(await timeSlicedMap([], number => number), []);
});

test('yields by elapsed time, not by item count', async () => {
	const runtime = createFakeRuntime();
	// 100 cheap items (0.5 ms each), then 5 slow ones (10 ms each).
	const costsMs = [...Array.from({length: 100}, () => 0.5), 10, 10, 10, 10, 10];

	await timeSlicedForEach(costsMs, costMs => {
		runtime.advance(costMs);
	}, {budgetMs: 8, now: runtime.now, yieldToEventLoop: runtime.yieldToEventLoop});

	// A yield every 16 cheap items (6 in all), then one after each slow item (5 more).
	assert.equal(runtime.yieldCount(), 11);
});

test('does not yield when the whole loop fits in one slice', async () => {
	const runtime = createFakeRuntime();

	await timeSlicedForEach([1, 2, 3], () => {
		runtime.advance(1);
	}, {budgetMs: 8, now: runtime.now, yieldToEventLoop: runtime.yieldToEventLoop});

	assert.equal(runtime.yieldCount(), 0);
});

test('a throwing mapper rejects the promise', async () => {
	const failure = new Error('bad row');
	await assert.rejects(timeSlicedMap([1, 2], () => {
		throw failure;
	}), failure);
});

test('an aborted signal rejects before any item runs', async () => {
	const reason = new Error('stop');
	let calls = 0;

	await assert.rejects(timeSlicedForEach([1, 2], () => {
		calls += 1;
	}, {signal: AbortSignal.abort(reason)}), reason);
	assert.equal(calls, 0);
});

test('aborting mid-way stops at the next yield', async () => {
	const runtime = createFakeRuntime();
	const controller = new AbortController();
	const reason = new Error('stop');
	const seen: number[] = [];

	await assert.rejects(timeSlicedForEach([1, 2, 3, 4], item => {
		seen.push(item);
		runtime.advance(8);
		if (item === 2) {
			controller.abort(reason);
		}
	}, {budgetMs: 8, now: runtime.now, yieldToEventLoop: runtime.yieldToEventLoop, signal: controller.signal}), reason);

	assert.deepEqual(seen, [1, 2]);
});

test('timers get to run during a long loop on the real event loop', async () => {
	const busyFor = (ms: number) => {
		const end = performance.now() + ms;
		while (performance.now() < end) {
			// Burn CPU like a real slow row.
		}
	};

	let timerRanAt = -1;
	setTimeout(() => {
		timerRanAt = performance.now();
	}, 0);

	const finishedAt = await timeSlicedForEach(Array.from({length: 20}), () => {
		busyFor(2);
	})
		.then(() => performance.now());

	assert.ok(timerRanAt > 0, 'the timer never ran');
	assert.ok(timerRanAt < finishedAt, 'the timer only ran after the loop finished');
});
