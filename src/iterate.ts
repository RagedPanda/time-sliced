import {createTimeSlicer, type TimeSliceOptions} from './time-slicer.ts';

/** Runs `step` on each item in order, yielding to the event loop whenever the time budget is spent. */
const runTimeSliced = async <Item>(
	items: Iterable<Item>,
	step: (item: Item, index: number) => void,
	options: TimeSliceOptions,
): Promise<void> => {
	const slicer = createTimeSlicer(options);
	let index = 0;

	for (const item of items) {
		step(item, index);
		index += 1;

		if (slicer.isSpent()) {
			await slicer.yield();
		}
	}
};

/**
 * Like `Array.from(items, mapper)`, but gives the event loop a turn whenever
 * `budgetMs` of work has passed, however long each item takes.
 */
export const timeSlicedMap = async <Item, Result>(
	items: Iterable<Item>,
	mapper: (item: Item, index: number) => Result,
	options: TimeSliceOptions = {},
): Promise<Result[]> => {
	const results: Result[] = [];
	await runTimeSliced(items, (item, index) => {
		results.push(mapper(item, index));
	}, options);
	return results;
};

/**
 * Calls `callback` on each item in order, and gives the event loop a turn
 * whenever `budgetMs` of work has passed, however long each item takes.
 */
export const timeSlicedForEach = async <Item>(
	items: Iterable<Item>,
	callback: (item: Item, index: number) => void,
	options: TimeSliceOptions = {},
): Promise<void> => runTimeSliced(items, callback, options);
