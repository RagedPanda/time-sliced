import {DEFAULT_BUDGET_MS, isBudgetSpent, validateBudget} from './budget.ts';
import {yieldToEventLoop as defaultYieldToEventLoop, type YieldToEventLoop} from './yield-to-event-loop.ts';

export type TimeSliceOptions = {
	/** Milliseconds of work before the event loop gets a turn. Default: 8. */
	readonly budgetMs?: number;
	/** Stops the work. Checked before it starts and each time it yields; rejects with the signal's reason. */
	readonly signal?: AbortSignal;
	/** How to give the event loop a turn. Default: the best method the runtime offers. */
	readonly yieldToEventLoop?: YieldToEventLoop;
	/** Clock in milliseconds. Default: `performance.now`. */
	readonly now?: () => number;
};

export type TimeSlicer = {
	/** Whether the current slice has used up its budget, so it is time to `yield()`. */
	readonly isSpent: () => boolean;
	/** Gives the event loop a turn, then starts a new slice. */
	readonly yield: () => Promise<void>;
};

/**
 * Creates a time slicer for a loop you write yourself:
 *
 * ```js
 * const slicer = createTimeSlicer();
 * for (const row of rows) {
 * 	processRow(row);
 * 	if (slicer.isSpent()) await slicer.yield();
 * }
 * ```
 */
export const createTimeSlicer = (options: TimeSliceOptions = {}): TimeSlicer => {
	const budgetMs = validateBudget(options.budgetMs ?? DEFAULT_BUDGET_MS);
	const now = options.now ?? (() => performance.now());
	const yieldToEventLoop = options.yieldToEventLoop ?? defaultYieldToEventLoop;
	const {signal} = options;
	signal?.throwIfAborted();

	let sliceStartMs = now();

	return {
		isSpent: () => isBudgetSpent(sliceStartMs, now(), budgetMs),
		async yield() {
			signal?.throwIfAborted();
			await yieldToEventLoop();
			signal?.throwIfAborted();
			sliceStartMs = now();
		},
	};
};
