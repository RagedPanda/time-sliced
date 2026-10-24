export type Measurement = {
	totalMs: number;
	worstStallMs: number;
};

/** Runs `run` while a 1 ms heartbeat timer records the longest gap between its ticks. */
export const measure = async (run: () => Promise<void>): Promise<Measurement> => {
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

export const median = (values: readonly number[]): number =>
	values.toSorted((first, second) => first - second)[Math.floor(values.length / 2)]!;

export const medianOf = (measurements: readonly Measurement[]): Measurement => ({
	totalMs: median(measurements.map(measurement => measurement.totalMs)),
	worstStallMs: median(measurements.map(measurement => measurement.worstStallMs)),
});
