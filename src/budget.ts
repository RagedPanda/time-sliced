/** Milliseconds of work before the event loop gets a turn: half of a 60 fps frame. */
export const DEFAULT_BUDGET_MS = 8;

/** Reports whether a slice that started at `sliceStartMs` has used up `budgetMs` by `nowMs`. */
export const isBudgetSpent = (sliceStartMs: number, nowMs: number, budgetMs: number): boolean =>
	nowMs - sliceStartMs >= budgetMs;

/** Returns `budgetMs` if it is a positive, finite number of milliseconds, and throws otherwise. */
export const validateBudget = (budgetMs: number): number => {
	if (typeof budgetMs !== 'number' || !Number.isFinite(budgetMs) || budgetMs <= 0) {
		throw new TypeError(`Expected budgetMs to be a positive, finite number, got ${String(budgetMs)}`);
	}

	return budgetMs;
};
