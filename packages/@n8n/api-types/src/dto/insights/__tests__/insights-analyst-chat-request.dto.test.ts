import { InsightsAnalystChatRequestDto } from '../insights-analyst-chat-request.dto';

const MAX_QUESTION_LENGTH = 2000;

describe('InsightsAnalystChatRequestDto', () => {
	describe('Valid requests', () => {
		test.each([
			{
				name: 'question only (default window)',
				request: {
					question: 'Which workflows saved us the most time?',
				},
				parsedResult: {
					question: 'Which workflows saved us the most time?',
				},
			},
			{
				name: 'question with selected date window',
				request: {
					question: 'Why did failures increase?',
					startDate: '2026-04-19',
					endDate: '2026-05-19',
				},
				parsedResult: {
					question: 'Why did failures increase?',
					startDate: new Date('2026-04-19'),
					endDate: new Date('2026-05-19'),
				},
			},
			{
				name: 'question at maximum length',
				request: {
					question: 'A'.repeat(MAX_QUESTION_LENGTH),
				},
				parsedResult: {
					question: 'A'.repeat(MAX_QUESTION_LENGTH),
				},
			},
		])('should validate $name', ({ request, parsedResult }) => {
			const result = InsightsAnalystChatRequestDto.safeParse(request);
			expect(result.success).toBe(true);
			if (parsedResult) {
				expect(result.data).toMatchObject(parsedResult);
			}
		});
	});

	describe('Malformed chat input is rejected before any model or database work runs', () => {
		test.each([
			{
				name: 'empty question',
				request: {
					question: '',
				},
				expectedErrorPaths: ['question'],
			},
			{
				name: 'whitespace-only question',
				request: {
					question: '   ',
				},
				expectedErrorPaths: ['question'],
			},
			{
				name: 'oversized question',
				request: {
					question: 'A'.repeat(MAX_QUESTION_LENGTH + 1),
				},
				expectedErrorPaths: ['question'],
			},
			{
				name: 'invalid date window',
				request: {
					question: 'Summarize this for an ops review.',
					startDate: '2025-13-01',
					endDate: 'not-a-date',
				},
				expectedErrorPaths: ['startDate', 'endDate'],
			},
			{
				name: 'missing question',
				request: {
					startDate: '2026-04-19',
					endDate: '2026-05-19',
				},
				expectedErrorPaths: ['question'],
			},
		])('should fail validation for $name', ({ request, expectedErrorPaths }) => {
			const result = InsightsAnalystChatRequestDto.safeParse(request);
			const issuesPaths = new Set(result.error?.issues.map((issue) => issue.path[0]));

			expect(result.success).toBe(false);
			expect(new Set(issuesPaths)).toEqual(new Set(expectedErrorPaths));
		});
	});
});
