import assert from 'node:assert/strict';
import {test} from 'node:test';
import {pickYieldToEventLoop, yieldToEventLoop, type YieldGlobals} from '../src/yield-to-event-loop.ts';

/** Globals where every method records its name when used, so a test can see which one was picked. */
const recordingGlobals = (available: ReadonlyArray<keyof YieldGlobals>) => {
	const used: string[] = [];

	class FakeChannel {
		port1 = {
			listener: () => {},
			addEventListener(_type: string, listener: () => void) {
				this.listener = listener;
			},
			start() {},
			close() {},
		};

		port2 = {
			postMessage: () => {
				used.push('MessageChannel');
				this.port1.listener();
			},
		};
	}

	const all: YieldGlobals = {
		scheduler: {
			async yield() {
				used.push('scheduler.yield');
			},
		},
		setImmediate(callback) {
			used.push('setImmediate');
			callback();
		},
		MessageChannel: FakeChannel as unknown as typeof MessageChannel,
		setTimeout(callback) {
			used.push('setTimeout');
			callback();
		},
	};

	const globals = Object.fromEntries(Object.entries(all)
		.filter(([name]) => name === 'setTimeout' || available.includes(name as keyof YieldGlobals))) as YieldGlobals;

	return {globals, used};
};

test('picks the best method the runtime has', async () => {
	const cases: Array<{available: Array<keyof YieldGlobals>; expected: string}> = [
		{available: ['scheduler', 'setImmediate', 'MessageChannel'], expected: 'scheduler.yield'},
		{available: ['setImmediate', 'MessageChannel'], expected: 'setImmediate'},
		{available: ['MessageChannel'], expected: 'MessageChannel'},
		{available: [], expected: 'setTimeout'},
	];

	for (const {available, expected} of cases) {
		const {globals, used} = recordingGlobals(available);
		await pickYieldToEventLoop(globals)();
		assert.deepEqual(used, [expected], `with ${available.join(', ') || 'nothing'}`);
	}
});

test('a scheduler without yield() is skipped', async () => {
	const {globals, used} = recordingGlobals(['setImmediate']);
	await pickYieldToEventLoop({...globals, scheduler: {}})();
	assert.deepEqual(used, ['setImmediate']);
});

test('the default lets a pending setImmediate run first', async () => {
	let ran = false;
	setImmediate(() => {
		ran = true;
	});
	await yieldToEventLoop();
	assert.equal(ran, true);
});
