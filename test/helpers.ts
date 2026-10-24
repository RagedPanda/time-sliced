/** A clock the test moves by hand, and a yield that counts its calls instead of waiting. */
export const createFakeRuntime = () => {
	let nowMs = 0;
	let yieldCount = 0;

	return {
		now: () => nowMs,
		advance(ms: number) {
			nowMs += ms;
		},
		async yieldToEventLoop() {
			yieldCount += 1;
		},
		yieldCount: () => yieldCount,
	};
};
