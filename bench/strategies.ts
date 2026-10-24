// The ways people keep a long loop from freezing Node.js, each running the same workload.
import async from 'async';
import {timeSlicedForEach} from '../src/index.ts';
import {processRow, rows} from './workload.ts';

export type Strategy = {
	name: string;
	run: () => Promise<void>;
};

const setImmediatePromise = () => new Promise<void>(resolve => {
	setImmediate(resolve);
});

const setTimeoutPromise = () => new Promise<void>(resolve => {
	setTimeout(resolve, 0);
});

const processRowAsync = async (row: number) => {
	processRow(row);
};

export const strategies: readonly Strategy[] = [
	{
		name: 'Plain loop',
		async run() {
			for (const row of rows) {
				processRow(row);
			}
		},
	},
	{
		name: '`await` every row',
		async run() {
			for (const row of rows) {
				await processRowAsync(row);
			}
		},
	},
	{
		name: '[async](https://www.npmjs.com/package/async) `eachSeries`',
		async run() {
			await async.eachSeries([...rows], (row, done) => {
				processRow(row);
				done();
			});
		},
	},
	{
		name: '`setTimeout(0)` every row',
		async run() {
			for (const row of rows) {
				processRow(row);
				await setTimeoutPromise();
			}
		},
	},
	{
		name: '`setImmediate` every row',
		async run() {
			for (const row of rows) {
				processRow(row);
				await setImmediatePromise();
			}
		},
	},
	{
		name: '`setImmediate` every 500 rows',
		async run() {
			for (const row of rows) {
				processRow(row);
				if (row % 500 === 499) {
					await setImmediatePromise();
				}
			}
		},
	},
	{
		name: '**time-sliced**',
		async run() {
			await timeSlicedForEach(rows, processRow);
		},
	},
];
