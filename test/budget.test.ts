import assert from 'node:assert/strict';
import {test} from 'node:test';
import {isBudgetSpent, validateBudget} from '../src/budget.ts';

test('isBudgetSpent compares elapsed time with the budget', () => {
	const cases = [
		{sliceStartMs: 0, nowMs: 7.9, budgetMs: 8, expected: false},
		{sliceStartMs: 0, nowMs: 8, budgetMs: 8, expected: true},
		{sliceStartMs: 100, nowMs: 150, budgetMs: 8, expected: true},
		{sliceStartMs: 100, nowMs: 100, budgetMs: 8, expected: false},
	];

	for (const {sliceStartMs, nowMs, budgetMs, expected} of cases) {
		assert.equal(isBudgetSpent(sliceStartMs, nowMs, budgetMs), expected, `${sliceStartMs} -> ${nowMs} with ${budgetMs}`);
	}
});

test('validateBudget accepts positive finite numbers', () => {
	assert.equal(validateBudget(8), 8);
	assert.equal(validateBudget(0.5), 0.5);
});

test('validateBudget rejects anything else', () => {
	for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '8' as unknown as number]) {
		assert.throws(() => validateBudget(invalid), TypeError);
	}
});
