import { mockLogger } from '@n8n/backend-test-utils';
import type { InsightsAnalystWorkflowRow } from '@n8n/api-types';

import { InsightsAnalystChat } from '../insights-analyst.chat';
import { InsightsAnalystConfig } from '../insights-analyst.config';

const workflows: InsightsAnalystWorkflowRow[] = [
	{
		workflowId: 'insights-demo-workflow-01',
		workflowName: 'Invoice reminder',
		total: 10,
		failed: 1,
		failureRate: 0.1,
		timeSaved: 120,
		averageRunTime: 1000,
		timeSavedPerExecution: 15,
		description: 'Routes supplier invoices and asks finance to review only the exceptions.',
	},
	{
		workflowId: 'insights-demo-workflow-06',
		workflowName: 'Support ticket triage',
		total: 4,
		failed: 3,
		failureRate: 0.75,
		timeSaved: 20,
		averageRunTime: 500,
		timeSavedPerExecution: 6,
		description: 'Collects delayed tickets and shows where support should intervene first.',
	},
];

describe('InsightsAnalystChat', () => {
	const config = new InsightsAnalystConfig();
	const chat = new InsightsAnalystChat(config, mockLogger());

	beforeEach(() => {
		config.anthropicApiKey = '';
		jest.restoreAllMocks();
	});

	it('returns a fallback answer when the API key is empty', async () => {
		const result = await chat.answer('Which workflow saved the most time?', workflows);

		expect(result.mode).toBe('fallback');
		expect(result.citations[0]?.workflowId).toBe('insights-demo-workflow-01');
		expect(result.citations[0]?.metric).toBe('timeSaved');
	});

	it('returns a fallback answer when the model call throws', async () => {
		config.anthropicApiKey = 'sk-test';
		jest.spyOn(chat, 'complete').mockRejectedValue(new Error('unavailable'));

		const result = await chat.answer('Summarize the workspace', workflows);

		expect(result.mode).toBe('fallback');
	});

	it('returns a fallback answer when the model returns malformed JSON', async () => {
		config.anthropicApiKey = 'sk-test';
		jest.spyOn(chat, 'complete').mockResolvedValue('not json');

		const result = await chat.answer('Summarize the workspace', workflows);

		expect(result.mode).toBe('fallback');
	});

	it('returns llm mode and drops unknown workflow citations', async () => {
		config.anthropicApiKey = 'sk-test';
		jest.spyOn(chat, 'complete').mockResolvedValue(
			JSON.stringify({
				answer: 'Invoice reminder leads time saved.',
				citations: [
					{
						workflowId: 'insights-demo-workflow-01',
						workflowName: 'Wrong name',
						metric: 'timeSaved',
						value: 120,
					},
					{
						workflowId: 'missing-workflow',
						workflowName: 'Missing',
						metric: 'total',
						value: 1,
					},
				],
			}),
		);

		const result = await chat.answer('Summarize the workspace', workflows);

		expect(result.mode).toBe('llm');
		expect(result.citations).toEqual([
			{
				workflowId: 'insights-demo-workflow-01',
				workflowName: 'Invoice reminder',
				metric: 'timeSaved',
				value: 120,
			},
		]);
	});
});
