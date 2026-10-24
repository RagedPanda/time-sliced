// How long does each strategy take, and how long does it freeze the event loop?
// Run with: npm run bench (add -- --markdown for a README table)
import {cpus} from 'node:os';
import {measure, medianOf, type Measurement} from './measure.ts';
import {strategies} from './strategies.ts';
import {CHEAP_ROW_MS, HEAVY_ROW_MS, HEAVY_ROWS, ROW_COUNT} from './workload.ts';

const RUNS = 3;
const FROZEN_MS = 50;
const SLOW_FACTOR = 1.15;

const verdict = ({totalMs, worstStallMs}: Measurement, baselineMs: number): string => {
	const frozen = worstStallMs > FROZEN_MS;
	const slowdown = `${(totalMs / baselineMs).toFixed(1)}x slower`;
	const slow = totalMs > baselineMs * SLOW_FACTOR;
	if (frozen) {
		return slow ? `freezes, ${slowdown}` : 'freezes';
	}

	return slow ? `responsive, ${slowdown}` : 'responsive and fast';
};

const formatMs = (ms: number): string => ms >= 10_000 ? `${(ms / 1000).toFixed(1)} s` : `${ms.toFixed(0)} ms`;

const plainName = (name: string): string => name.replaceAll(/\]\([^)]*\)|[`*[]/g, '');

const measureStrategy = async (run: () => Promise<void>): Promise<Measurement> => {
	const measurements: Measurement[] = [];
	for (let attempt = 0; attempt < RUNS; attempt++) {
		measurements.push(await measure(run));
	}

	return medianOf(measurements);
};

const markdown = process.argv.includes('--markdown');
const heavyCount = HEAVY_ROWS.to - HEAVY_ROWS.from;
console.log(`${ROW_COUNT.toLocaleString('en')} rows at ${CHEAP_ROW_MS} ms, except ${heavyCount.toLocaleString('en')} heavy rows at ${HEAVY_ROW_MS} ms. Median of ${RUNS} runs, Node.js ${process.versions.node}, ${cpus()[0]?.model ?? 'unknown CPU'}.\n`);
console.log(markdown ? '| Strategy | Total time | Longest freeze | Result |\n|---|---:|---:|---|' : `${'strategy'.padEnd(30)}${'total'.padStart(10)}${'longest freeze'.padStart(16)}`);

// One untimed pass of the fast strategies first, so JIT warm-up doesn't land in the first measured runs.
for (const strategy of strategies.filter(candidate => !candidate.name.includes('setTimeout'))) {
	await strategy.run();
}

let baselineMs = 0;
for (const strategy of strategies) {
	const result = await measureStrategy(strategy.run);
	baselineMs ||= result.totalMs;
	const cells = [formatMs(result.totalMs), formatMs(result.worstStallMs), verdict(result, baselineMs)] as const;
	console.log(markdown
		? `| ${strategy.name} | ${cells.join(' | ')} |`
		: `${plainName(strategy.name).padEnd(30)}${cells[0].padStart(10)}${cells[1].padStart(16)}  ${cells[2]}`);
}
