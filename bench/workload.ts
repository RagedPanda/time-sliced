// The job every strategy runs: rows of uneven cost, like indexing mail where a run of messages has large attachments.

export const ROW_COUNT = 20_000;
export const CHEAP_ROW_MS = 0.02;
export const HEAVY_ROW_MS = 0.5;
export const HEAVY_ROWS = {from: 8000, to: 9000};

export const isHeavy = (index: number): boolean => index >= HEAVY_ROWS.from && index < HEAVY_ROWS.to;

const busyFor = (ms: number) => {
	const end = performance.now() + ms;
	while (performance.now() < end) {
		// Burn CPU like real per-row work.
	}
};

export const processRow = (index: number): void => {
	busyFor(isHeavy(index) ? HEAVY_ROW_MS : CHEAP_ROW_MS);
};

export const rows: readonly number[] = Array.from({length: ROW_COUNT}, (_, index) => index);
