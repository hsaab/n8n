import type { InsightsAnalystWorkflowRow, InsightsSummary } from '@n8n/api-types';
import { mockLogger } from '@n8n/backend-test-utils';
import type { ProjectRepository } from '@n8n/db';
import { mock } from 'jest-mock-extended';

import type { InsightsService } from '../../insights.service';
import { InsightsAnalystConfig } from '../insights-analyst.config';
import { INSIGHTS_ANALYST_PROJECT_ID } from '../insights-analyst.constants';
import { InsightsAnalystService } from '../insights-analyst.service';

jest.mock('ai', () => ({
	generateText: jest.fn(),
}));

jest.mock('@ai-sdk/anthropic', () => ({
	createAnthropic: jest.fn(() => (modelId: string) => ({ modelId })),
}));

import { generateText } from 'ai';

const summary: InsightsSummary = {
	total: { value: 100, deviation: null, unit: 'count' },
	failed: { value: 4, deviation: null, unit: 'count' },
	failureRate: { value: 0.04, deviation: null, unit: 'ratio' },
	timeSaved: { value: 240, deviation: null, unit: 'minute' },
	averageRunTime: { value: 1500, deviation: null, unit: 'millisecond' },
};

const invoice: InsightsAnalystWorkflowRow = {
	workflowId: 'insights-demo-invoice',
	workflowName: 'Invoice Intake',
	projectId: INSIGHTS_ANALYST_PROJECT_ID,
	projectName: 'Demo Operations',
	total: 80,
	succeeded: 76,
	failed: 4,
	failureRate: 0.05,
	runTime: 120_000,
	averageRunTime: 1_500,
	timeSaved: 240,
};

describe('InsightsAnalystService chat', () => {
	const generateTextMock = jest.mocked(generateText);
	const rootLogger = mockLogger();
	const logger = rootLogger.scoped('insights');

	function createService(apiKey: string) {
		const insightsService = mock<InsightsService>();
		insightsService.getInsightsSummary.mockResolvedValue(summary);
		insightsService.getInsightsByTime.mockResolvedValue([]);
		insightsService.getInsightsByWorkflow.mockResolvedValue({ count: 1, data: [invoice] });

		const projectRepository = mock<ProjectRepository>();
		projectRepository.findOneBy.mockResolvedValue({
			id: INSIGHTS_ANALYST_PROJECT_ID,
			name: 'Demo Operations',
		} as Awaited<ReturnType<ProjectRepository['findOneBy']>>);

		const config = new InsightsAnalystConfig();
		config.anthropicApiKey = apiKey;

		return new InsightsAnalystService(insightsService, projectRepository, config, rootLogger);
	}

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('returns a fallback response when the API key is empty', async () => {
		const service = createService('');
		const response = await service.chat({ message: 'Where did we save the most time?' });

		expect(response.mode).toBe('fallback');
		expect(response.citations[0]?.workflowId).toBe('insights-demo-invoice');
		expect(response.citations[0]?.value).toBe(240);
		expect(generateTextMock).not.toHaveBeenCalled();
	});

	it('returns a fallback response when the model call throws', async () => {
		generateTextMock.mockRejectedValue(new Error('network'));
		const service = createService('test-key');
		const response = await service.chat({ message: 'Summarize operations' });

		expect(response.mode).toBe('fallback');
		expect(logger.error).toHaveBeenCalled();
	});

	it('returns a fallback response when the model returns malformed JSON', async () => {
		generateTextMock.mockResolvedValue({ text: 'not json' } as Awaited<
			ReturnType<typeof generateText>
		>);
		const service = createService('test-key');
		const response = await service.chat({ message: 'Summarize operations' });

		expect(response.mode).toBe('fallback');
		expect(logger.warn).toHaveBeenCalled();
	});

	it('returns llm mode and drops citations that are not in the workspace', async () => {
		generateTextMock.mockResolvedValue({
			text: JSON.stringify({
				answer: 'Invoice Intake leads time saved.',
				citations: [
					{ workflowId: 'insights-demo-invoice', metric: 'timeSaved' },
					{ workflowId: 'missing-workflow', metric: 'timeSaved' },
				],
			}),
		} as Awaited<ReturnType<typeof generateText>>);
		const service = createService('test-key');
		const response = await service.chat({ message: 'Summarize operations' });

		expect(response.mode).toBe('llm');
		expect(response.answer).toContain('Invoice Intake');
		expect(response.citations).toEqual([
			{
				workflowId: 'insights-demo-invoice',
				workflowName: 'Invoice Intake',
				metric: 'timeSaved',
				value: 240,
			},
		]);
	});
});
