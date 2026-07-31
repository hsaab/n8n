import type { InsightsAnalystOverview } from '@n8n/api-types';
import { insightsAnalystChatStreamChunkSchema } from '@n8n/api-types';
import type { Logger } from '@n8n/backend-common';
import { mock } from 'jest-mock-extended';

import { InsightsAnalystChatService } from '../insights-analyst-chat.service';
import type { InsightsDemoService } from '../insights-demo.service';
import type { InsightsConfig } from '../insights.config';

jest.mock('@ai-sdk/anthropic', () => ({
	createAnthropic: jest.fn(() => jest.fn(() => ({ modelId: 'mock-anthropic-model' }))),
}));

jest.mock('ai', () => ({
	generateObject: jest.fn(),
	streamObject: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { generateObject, streamObject } = require('ai') as {
	generateObject: jest.Mock;
	streamObject: jest.Mock;
};

describe('InsightsAnalystChatService', () => {
	const overview: InsightsAnalystOverview = {
		project: { id: 'project-1', name: 'Demo Operations' },
		dateRange: {
			startDate: '2026-05-01T00:00:00.000Z',
			endDate: '2026-05-19T00:00:00.000Z',
		},
		summary: {
			total: { value: 20, deviation: 5, unit: 'count' },
			failed: { value: 3, deviation: 2, unit: 'count' },
			failureRate: { value: 0.15, deviation: 0.08, unit: 'ratio' },
			timeSaved: { value: 180, deviation: 60, unit: 'minute' },
			averageRunTime: { value: 1000, deviation: null, unit: 'millisecond' },
		},
		byTime: [],
		byWorkflow: {
			count: 2,
			data: [
				{
					workflowId: 'workflow-1',
					workflowName: 'Invoice intake triage',
					projectId: 'project-1',
					projectName: 'Demo Operations',
					total: 10,
					succeeded: 9,
					failed: 1,
					failureRate: 0.1,
					runTime: 1000,
					averageRunTime: 100,
					timeSaved: 150,
				},
				{
					workflowId: 'workflow-2',
					workflowName: 'Vendor onboarding checklist',
					projectId: 'project-1',
					projectName: 'Demo Operations',
					total: 10,
					succeeded: 7,
					failed: 3,
					failureRate: 0.3,
					runTime: 2000,
					averageRunTime: 200,
					timeSaved: 30,
				},
			],
		},
		highlights: [],
		lowImpactWorkflows: [],
		suggestedPrompts: [],
	};

	const llmCitation = {
		workflowId: 'workflow-1',
		workflowName: 'Invoice intake triage',
		metric: 'time saved',
		value: 150,
		unit: 'minute' as const,
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	function createService(apiKey: string) {
		const config = mock<InsightsConfig>({
			analystAnthropicApiKey: apiKey,
			analystModel: 'claude-sonnet-4-5-20250929',
		});
		const demoService = mock<InsightsDemoService>({
			getOverview: jest.fn().mockResolvedValue(overview),
		});
		const logger = mock<Logger>({
			scoped: jest.fn().mockReturnThis(),
		});
		return new InsightsAnalystChatService(config, demoService, logger);
	}

	test('uses deterministic fallback when Anthropic key is empty', async () => {
		const service = createService('');

		const response = await service.ask('Which workflows saved us the most time?');

		expect(response.mode).toBe('fallback');
		expect(response.answer).toContain('Invoice intake triage');
		expect(response.citations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					workflowId: 'workflow-1',
					metric: 'time saved',
					value: 150,
					unit: 'minute',
				}),
			]),
		);
	});

	test('uses deterministic fallback when Anthropic key is whitespace', async () => {
		const service = createService('   ');

		const response = await service.ask('Why did failures increase?');

		expect(response.mode).toBe('fallback');
		expect(response.citations.length).toBeGreaterThan(0);
	});

	test('does not throw when Anthropic key is missing', async () => {
		const service = createService('');

		await expect(service.ask('Which workflows saved us the most time?')).resolves.toEqual(
			expect.objectContaining({ mode: 'fallback' }),
		);
	});

	test('returns empty-data fallback when overview has no workflow rows', async () => {
		const emptyOverview: InsightsAnalystOverview = {
			...overview,
			byWorkflow: { count: 0, data: [] },
		};
		const config = mock<InsightsConfig>({
			analystAnthropicApiKey: '',
			analystModel: 'claude-sonnet-4-5-20250929',
		});
		const demoService = mock<InsightsDemoService>({
			getOverview: jest.fn().mockResolvedValue(emptyOverview),
		});
		const logger = mock<Logger>({
			scoped: jest.fn().mockReturnThis(),
		});
		const service = new InsightsAnalystChatService(config, demoService, logger);

		const response = await service.ask('Which workflows saved us the most time?');

		expect(response).toEqual({
			mode: 'fallback',
			answer: expect.stringContaining('No workflow Insights data'),
			citations: [],
		});
	});

	test('returns mode llm with answer and citations when Anthropic key is set', async () => {
		generateObject.mockResolvedValue({
			object: {
				answer: 'Invoice intake triage saved the most time in this window.',
				citations: [llmCitation],
			},
		});
		const service = createService('test-anthropic-key');

		const response = await service.ask('Which workflows saved us the most time?');

		expect(generateObject).toHaveBeenCalled();
		expect(response.mode).toBe('llm');
		expect(response.answer).toContain('Invoice intake triage');
		expect(response.citations).toEqual(
			expect.arrayContaining([expect.objectContaining(llmCitation)]),
		);
	});

	test('streams deterministic fallback when Anthropic key is empty', async () => {
		const service = createService('');

		const chunks = [];
		for await (const chunk of service.askStream('Why did failures increase?')) {
			chunks.push(chunk);
		}

		expect(chunks).toEqual([
			expect.objectContaining({
				type: 'complete',
				response: expect.objectContaining({ mode: 'fallback' }),
			}),
		]);
	});

	test('streams delta then complete chunks shaped as InsightsAnalystChatStreamChunk when LLM is available', async () => {
		const finalAnswer = 'Invoice intake triage saved the most time.';
		streamObject.mockReturnValue({
			partialObjectStream: (async function* () {
				yield { answer: 'Invoice' };
				yield { answer: finalAnswer };
			})(),
			object: Promise.resolve({
				answer: finalAnswer,
				citations: [llmCitation],
			}),
		});
		const service = createService('test-anthropic-key');

		const chunks = [];
		for await (const chunk of service.askStream('Which workflows saved us the most time?')) {
			chunks.push(chunk);
		}

		expect(chunks.length).toBeGreaterThanOrEqual(2);
		expect(chunks[0]).toEqual(
			expect.objectContaining({
				type: 'delta',
				text: expect.any(String),
			}),
		);
		expect(chunks[chunks.length - 1]).toEqual(
			expect.objectContaining({
				type: 'complete',
				response: expect.objectContaining({
					mode: 'llm',
					answer: finalAnswer,
					citations: expect.arrayContaining([expect.objectContaining(llmCitation)]),
				}),
			}),
		);

		for (const chunk of chunks) {
			expect(insightsAnalystChatStreamChunkSchema.safeParse(chunk).success).toBe(true);
		}
	});
});
