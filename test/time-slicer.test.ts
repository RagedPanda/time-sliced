import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createTimeSlicer} from '../src/time-slicer.ts';
import {createFakeRuntime} from './helpers.ts';

test('isSpent turns true once the budget has passed', () => {
	const runtime = createFakeRuntime();
	const slicer = createTimeSlicer({budgetMs: 8, now: runtime.now, yieldToEventLoop: runtime.yieldToEventLoop});

	runtime.advance(7);
	assert.equal(slicer.isSpent(), false);
	runtime.advance(1);
	assert.equal(slicer.isSpent(), true);
});

test('yield gives the event loop a turn and starts a new slice', async () => {
	const runtime = createFakeRuntime();
	const slicer = createTimeSlicer({budgetMs: 8, now: runtime.now, yieldToEventLoop: runtime.yieldToEventLoop});

	runtime.advance(20);
	await slicer.yield();

	assert.equal(runtime.yieldCount(), 1);
	assert.equal(slicer.isSpent(), false);
});

test('the default budget is 8 ms', () => {
	const runtime = createFakeRuntime();
	const slicer = createTimeSlicer({now: runtime.now, yieldToEventLoop: runtime.yieldToEventLoop});

	runtime.advance(7.9);
	assert.equal(slicer.isSpent(), false);
	runtime.advance(0.1);
	assert.equal(slicer.isSpent(), true);
});

test('an already aborted signal throws its reason straight away', () => {
	const reason = new Error('stop');
	assert.throws(() => createTimeSlicer({signal: AbortSignal.abort(reason)}), reason);
});

test('yield rejects with the reason if the signal aborts while the event loop has its turn', async () => {
	const controller = new AbortController();
	const reason = new Error('stop');
	const slicer = createTimeSlicer({
		signal: controller.signal,
		async yieldToEventLoop() {
			controller.abort(reason);
		},
	});

	await assert.rejects(slicer.yield(), reason);
});

test('an invalid budget throws', () => {
	assert.throws(() => createTimeSlicer({budgetMs: 0}), TypeError);
});
