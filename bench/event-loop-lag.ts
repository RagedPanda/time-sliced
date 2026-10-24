// How long does the event loop stay blocked while a loop processes rows of uneven cost?
// Run with: npm run bench
import {timeSlicedForEach, yieldToEventLoop} from '../src/index.ts';

const ROW_COUNT = 10_000;
const CHEAP_ROW_MS = 0.02;
const HEAVY_ROW_MS = 0.5;
// Rows 4000 to 4999 are heavy, like a run of emails with large attachments.
const isHeavy = (index: number) => index >= 4000 && index < 5000;

const busyFor = (ms: number) => {
	const end = performance.now() + ms;
	while (performance.now() < end) {
		// Burn CPU like real per-row work.
	}
};

const processRow = (index: number) => {
	busyFor(isHeavy(index) ? HEAVY_ROW_MS : CHEAP_ROW_MS);
};

const rows = Array.from({length: ROW_COUNT}, (_, index) => index);

const strategies: Record<string, () => Promise<void>> = {
	'no yielding': async () => {
		for (const row of rows) {
			processRow(row);
		}
	},
	'yield every 500 rows': async () => {
		for (const row of rows) {
			processRow(row);
			if (row % 500 === 499) {
				await yieldToEventLoop();
			}
		}
	},
	'time-sliced (8 ms budget)': async () => {
		await timeSlicedForEach(rows, processRow);
	},
};

/** Runs `run` while a 1 ms heartbeat timer records the longest gap between its ticks. */
const measure = async (run: () => Promise<void>) => {
	let lastTickMs = performance.now();
	let worstStallMs = 0;
	const recordGap = () => {
		const nowMs = performance.now();
		worstStallMs = Math.max(worstStallMs, nowMs - lastTickMs);
		lastTickMs = nowMs;
	};

	const heartbeat = setInterval(recordGap, 1);
	const startMs = performance.now();
	await run();
	const totalMs = performance.now() - startMs;
	recordGap(); // A loop that never yields shows up as one gap that ends here.
	clearInterval(heartbeat);
	return {totalMs, worstStallMs};
};

const RUNS = 5;
const median = (values: number[]) => values.toSorted((first, second) => first - second)[Math.floor(values.length / 2)]!;

const measureMedian = async (run: () => Promise<void>) => {
	const results = [];
	for (let attempt = 0; attempt < RUNS; attempt++) {
		results.push(await measure(run));
	}

	return {
		totalMs: median(results.map(result => result.totalMs)),
		worstStallMs: median(results.map(result => result.worstStallMs)),
	};
};

const format = (ms: number) => `${ms.toFixed(0)} ms`.padStart(8);

console.log(`${ROW_COUNT} rows, ${CHEAP_ROW_MS} ms each, except 1000 heavy rows at ${HEAVY_ROW_MS} ms. Median of ${RUNS} runs.\n`);
console.log(`${'strategy'.padEnd(28)}${'total'.padStart(8)}  ${'worst stall'.padStart(11)}`);

for (const [name, run] of Object.entries(strategies)) {
	const {totalMs, worstStallMs} = await measureMedian(run);
	console.log(`${name.padEnd(28)}${format(totalMs)}  ${format(worstStallMs).padStart(11)}`);
}
