import type { InsightsAnalystChatResponse, InsightsAnalystOverview } from '@n8n/api-types';
import { insightsAnalystChatResponseSchema } from '@n8n/api-types';
import { mockLogger } from '@n8n/backend-test-utils';
import { mock } from 'jest-mock-extended';

import type { InsightsAnalystOverviewService } from '../insights-analyst-overview.service';
import type { InsightsAnalystSeedService } from '../insights-analyst-seed.service';
import { InsightsConfig } from '../insights.config';

const ANTHROPIC_KEY = 'sk-ant-test-key-do-not-log-9f10';
const REJECTED_OPUS_DEFAULT = 'claude-opus-4-7-20260101';
const SONNET_DEFAULT = 'claude-sonnet-4-5-20250929';

const REAL_WORKFLOW_ID = 'insights-demo-ap-invoice-ingestion';
const OTHER_REAL_WORKFLOW_ID = 'insights-demo-standup-digest';
const INVENTED_WORKFLOW_ID = 'invented-workflow-from-the-model';

const demoOverview: InsightsAnalystOverview = {
	summary: {
		total: { deviation: 10, unit: 'count', value: 30 },
		failed: { deviation: 6, unit: 'count', value: 10 },
		failureRate: { deviation: 0.133, unit: 'ratio', value: 0.333 },
		averageRunTime: { deviation: null, unit: 'millisecond', value: 10 },
		timeSaved: { deviation: 5, unit: 'minute', value: 8100 },
	},
	byTime: [],
	highlights: [
		{
			workflowId: REAL_WORKFLOW_ID,
			kind: 'impact',
			workflowName: 'AP invoice ingestion',
			blurb: 'Files invoices from the shared mailbox for approval.',
			metricValue: 8100,
		},
	],
	ranking: [
		{
			rank: 1,
			workflowId: REAL_WORKFLOW_ID,
			name: 'AP invoice ingestion',
			department: 'Finance',
			timeSavedMinutes: 8100,
		},
	],
	lowImpact: [
		{
			workflowId: OTHER_REAL_WORKFLOW_ID,
			name: 'Daily standup digest',
			blurb: 'Posts yesterday ticket movement into the team channel.',
			timeSavedPerRunMinutes: 7,
		},
	],
};

const knownWorkflowIds = new Set([REAL_WORKFLOW_ID, OTHER_REAL_WORKFLOW_ID]);

const modelAnswer = {
	answer: 'AP invoice ingestion saved the most time this month.',
	citations: [
		{
			workflowId: REAL_WORKFLOW_ID,
			label: 'AP invoice ingestion',
			metric: '135 hr',
		},
		{
			workflowId: INVENTED_WORKFLOW_ID,
			label: 'Made-up workflow',
			metric: '99h',
		},
	],
};

jest.mock('ai', () => ({
	__esModule: true,
	generateObject: jest.fn(),
}));

jest.mock('@ai-sdk/anthropic', () => ({
	__esModule: true,
	createAnthropic: jest.fn(() => jest.fn((modelId: string) => ({ modelId }))),
}));

const originalAnalystKey = process.env.N8N_INSIGHTS_ANALYST_ANTHROPIC_API_KEY;
const originalAnalystModel = process.env.N8N_INSIGHTS_ANALYST_MODEL;

function generateObjectMock() {
	return jest.requireMock<{ generateObject: jest.Mock }>('ai').generateObject;
}

function createAnthropicMock() {
	return jest.requireMock<{ createAnthropic: jest.Mock }>('@ai-sdk/anthropic').createAnthropic;
}

function restoreAnalystEnv() {
	if (originalAnalystKey === undefined) {
		delete process.env.N8N_INSIGHTS_ANALYST_ANTHROPIC_API_KEY;
	} else {
		process.env.N8N_INSIGHTS_ANALYST_ANTHROPIC_API_KEY = originalAnalystKey;
	}

	if (originalAnalystModel === undefined) {
		delete process.env.N8N_INSIGHTS_ANALYST_MODEL;
	} else {
		process.env.N8N_INSIGHTS_ANALYST_MODEL = originalAnalystModel;
	}
}

function freshInsightsConfig(overrides?: { apiKey?: string; model?: string }) {
	delete process.env.N8N_INSIGHTS_ANALYST_ANTHROPIC_API_KEY;
	delete process.env.N8N_INSIGHTS_ANALYST_MODEL;

	if (overrides?.apiKey !== undefined) {
		process.env.N8N_INSIGHTS_ANALYST_ANTHROPIC_API_KEY = overrides.apiKey;
	}
	if (overrides?.model !== undefined) {
		process.env.N8N_INSIGHTS_ANALYST_MODEL = overrides.model;
	}

	return new InsightsConfig();
}

function loggedCalls(logger: ReturnType<typeof mockLogger>) {
	const scoped = logger.scoped('insights');
	const methods = ['error', 'warn', 'info', 'debug'] as const;

	return [logger, scoped].flatMap((target) =>
		methods.flatMap((method) => {
			const fn = target[method] as unknown as jest.Mock;
			return fn.mock?.calls ?? [];
		}),
	);
}

function expectFallback(response: InsightsAnalystChatResponse) {
	const parsed = insightsAnalystChatResponseSchema.safeParse(response);
	// Report the offending field rather than a bare `false`.
	expect(parsed.error?.issues ?? []).toEqual([]);
	expect(parsed.success).toBe(true);
	expect(response.mode).toBe('fallback');
	expect(response.answer.length).toBeGreaterThan(0);
	expect(response.citations.every((citation) => knownWorkflowIds.has(citation.workflowId))).toBe(
		true,
	);
}

async function loadChatService() {
	const { InsightsAnalystChatService } = await import('../insights-analyst-chat.service');
	return InsightsAnalystChatService;
}

describe('Insights Analyst model default', () => {
	afterEach(() => {
		restoreAnalystEnv();
	});

	it('defaults the Insights Analyst model to claude-sonnet-4-5-20250929', () => {
		const config = freshInsightsConfig();

		expect(config.analystModel).toBe(SONNET_DEFAULT);
	});

	it('rejects claude-opus-4-7-20260101 as the Insights Analyst model default', () => {
		const config = freshInsightsConfig();

		expect(config.analystModel).toEqual(expect.any(String));
		expect(config.analystModel).not.toBe(REJECTED_OPUS_DEFAULT);
	});
});

describe('InsightsAnalystChatService', () => {
	const seedService = mock<InsightsAnalystSeedService>();
	const overviewService = mock<InsightsAnalystOverviewService>();
	const logger = mockLogger();

	afterEach(() => {
		restoreAnalystEnv();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		seedService.ensureSeeded.mockResolvedValue(undefined);
		overviewService.getOverview.mockResolvedValue(demoOverview);
		generateObjectMock().mockResolvedValue({ object: modelAnswer });
	});

	async function createService(overrides?: { apiKey?: string; model?: string }) {
		const InsightsAnalystChatService = await loadChatService();
		const config = freshInsightsConfig(overrides);

		return new InsightsAnalystChatService(config, seedService, overviewService, logger);
	}

	it('returns a fallback answer when no Anthropic key is configured', async () => {
		const service = await createService();

		const response = await service.chat({
			question: 'Which workflow saved the most time?',
			suggestedPromptId: 'time-saved',
		});

		expect(seedService.ensureSeeded).toHaveBeenCalled();
		expect(generateObjectMock()).not.toHaveBeenCalled();
		expect(createAnthropicMock()).not.toHaveBeenCalled();
		expectFallback(response);
	});

	it('returns a fallback answer when the Anthropic provider call throws', async () => {
		generateObjectMock().mockRejectedValue(new Error('anthropic unavailable'));
		const service = await createService({ apiKey: ANTHROPIC_KEY });

		const response = await service.chat({ question: 'Which workflow saved the most time?' });

		expect(seedService.ensureSeeded).toHaveBeenCalled();
		expectFallback(response);
		expect(loggedCalls(logger).length).toBeGreaterThan(0);
		expect(JSON.stringify(loggedCalls(logger))).not.toContain(ANTHROPIC_KEY);
	});

	it('returns a fallback answer when the model reply does not fit the answer schema', async () => {
		generateObjectMock().mockRejectedValue(new Error('response did not match schema'));
		const service = await createService({ apiKey: ANTHROPIC_KEY });

		const response = await service.chat({ question: 'Which workflow saved the most time?' });

		expectFallback(response);
		expect(JSON.stringify(loggedCalls(logger))).not.toContain(ANTHROPIC_KEY);
	});

	it('reads the top ranked workflow back in whole hours when it saved more than an hour', async () => {
		const service = await createService();

		const response = await service.chat({ question: 'Which workflow saved the most time?' });

		expect(response.citations).toEqual([
			{
				workflowId: REAL_WORKFLOW_ID,
				label: 'AP invoice ingestion',
				metric: '135 hr',
			},
		]);
		expectFallback(response);
	});

	it('reads the top ranked workflow back in minutes when it saved under an hour', async () => {
		overviewService.getOverview.mockResolvedValue({
			...demoOverview,
			ranking: [
				{
					rank: 1,
					workflowId: OTHER_REAL_WORKFLOW_ID,
					name: 'Daily standup digest',
					department: 'Operations',
					timeSavedMinutes: 45,
				},
			],
		});
		const service = await createService();

		const response = await service.chat({ question: 'Which workflow saved the most time?' });

		expect(response.citations[0]?.metric).toBe('45 min');
		expectFallback(response);
	});

	it('cites the leading highlight by workflow name when the ranking is empty', async () => {
		overviewService.getOverview.mockResolvedValue({
			...demoOverview,
			ranking: [],
			highlights: [
				{
					workflowId: OTHER_REAL_WORKFLOW_ID,
					kind: 'impact',
					workflowName: 'Daily standup digest',
					blurb: 'Posts yesterday ticket movement into the team channel.',
					metricValue: 45,
				},
			],
		});
		const service = await createService();

		const response = await service.chat({ question: 'Which workflow saved the most time?' });

		expect(response.citations).toEqual([
			{
				workflowId: OTHER_REAL_WORKFLOW_ID,
				label: 'Daily standup digest',
				metric: '45 min',
			},
		]);
		expect(response.answer).toContain('Daily standup digest');
		expectFallback(response);
	});

	it('never cites the attention card, whose metric counts failures rather than minutes', async () => {
		overviewService.getOverview.mockResolvedValue({
			...demoOverview,
			ranking: [],
			highlights: [
				{
					workflowId: OTHER_REAL_WORKFLOW_ID,
					kind: 'attention',
					workflowName: 'Delayed shipment triage',
					blurb: 'Chases carriers when a shipment misses its promised window.',
					metricValue: 60,
				},
			],
		});
		const service = await createService();

		const response = await service.chat({ question: 'Which workflow saved the most time?' });

		// 60 failures formatted as time would read "1 hr saved" on the rail.
		expect(response.citations).toEqual([]);
		expect(response.answer).not.toContain('Delayed shipment triage');
		expectFallback(response);
	});

	it('returns an llm answer that keeps only real workflow citations', async () => {
		const service = await createService({ apiKey: ANTHROPIC_KEY });

		const response = await service.chat({ question: 'Which workflow saved the most time?' });

		expect(seedService.ensureSeeded).toHaveBeenCalled();
		expect(generateObjectMock()).toHaveBeenCalled();
		expect(insightsAnalystChatResponseSchema.safeParse(response).success).toBe(true);
		expect(response.mode).toBe('llm');
		expect(response.answer.length).toBeGreaterThan(0);
		expect(response.citations.map((citation) => citation.workflowId)).toEqual([REAL_WORKFLOW_ID]);
		expect(
			response.citations.some((citation) => citation.workflowId === INVENTED_WORKFLOW_ID),
		).toBe(false);
		expect(JSON.stringify(loggedCalls(logger))).not.toContain(ANTHROPIC_KEY);
	});
});
