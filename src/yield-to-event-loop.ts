/** Gives the event loop a turn: timers, I/O, rendering and input run before the promise resolves. */
export type YieldToEventLoop = () => Promise<void>;

/** The globals used to pick a way of yielding. `globalThis` in production, a stub in tests. */
export type YieldGlobals = {
	scheduler?: {yield?: () => Promise<void>};
	setImmediate?: (callback: () => void) => unknown;
	MessageChannel?: typeof MessageChannel;
	setTimeout: (callback: () => void, delayMs: number) => unknown;
};

/**
 * Picks the best way to yield that the runtime offers.
 *
 * - `scheduler.yield()` (Chromium browsers) resumes ahead of other queued tasks.
 * - `setImmediate` (Node.js, Bun) runs after pending I/O callbacks.
 * - `MessageChannel` (other browsers, Deno, workers) avoids the 4 ms clamp on nested `setTimeout`.
 * - `setTimeout(0)` is the last resort.
 */
export const pickYieldToEventLoop = (globals: YieldGlobals): YieldToEventLoop => {
	const {scheduler, setImmediate, MessageChannel: Channel, setTimeout} = globals;

	if (typeof scheduler?.yield === 'function') {
		return async () => scheduler.yield!();
	}

	if (typeof setImmediate === 'function') {
		return async () => new Promise<void>(resolve => {
			setImmediate(resolve);
		});
	}

	if (typeof Channel === 'function') {
		return async () => new Promise<void>(resolve => {
			const channel = new Channel();
			channel.port1.addEventListener('message', () => {
				channel.port1.close();
				resolve();
			});
			channel.port1.start();
			channel.port2.postMessage(undefined);
		});
	}

	return async () => new Promise<void>(resolve => {
		setTimeout(resolve, 0);
	});
};

/** Yields with the best method of the current runtime. */
export const yieldToEventLoop: YieldToEventLoop = pickYieldToEventLoop(globalThis as unknown as YieldGlobals);
