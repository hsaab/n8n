import { insightsAnalystChatResponseSchema } from '../insights-analyst.schema';

const chatAnswer = {
	answer: 'Invoice intake saved the most time this month.',
	citations: [
		{
			workflowId: 'insights-demo-ap-invoice',
			label: 'AP invoice ingestion',
			metric: '12h saved',
		},
	],
};

describe('insightsAnalystChatResponseSchema', () => {
	it('rejects a chat response that leaves out mode', () => {
		const result = insightsAnalystChatResponseSchema.safeParse(chatAnswer);

		expect(result.success).toBe(false);
	});

	it('accepts a chat response that uses llm or fallback mode', () => {
		expect(
			insightsAnalystChatResponseSchema.safeParse({ ...chatAnswer, mode: 'llm' }).success,
		).toBe(true);
		expect(
			insightsAnalystChatResponseSchema.safeParse({ ...chatAnswer, mode: 'fallback' }).success,
		).toBe(true);
	});

	it('rejects a chat response with an unknown mode', () => {
		const result = insightsAnalystChatResponseSchema.safeParse({
			...chatAnswer,
			mode: 'unknown',
		});

		expect(result.success).toBe(false);
	});
});
