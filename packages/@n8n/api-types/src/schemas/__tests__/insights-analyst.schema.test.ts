/**
 * FE-9 slice 1: Insights Analyst shared Zod contracts.
 * Tip shape from 41201cf7df; stream chunk contract from design-doc / tip chat service.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tipSummary = {
	total: { value: 10, deviation: 2, unit: 'count' as const },
	failed: { value: 1, deviation: 0, unit: 'count' as const },
	failureRate: { value: 0.1, deviation: 0.02, unit: 'ratio' as const },
	timeSaved: { value: 120, deviation: 30, unit: 'minute' as const },
	averageRunTime: { value: 300, deviation: null, unit: 'millisecond' as const },
};

const tipByWorkflow = {
	count: 1,
	data: [
		{
			workflowId: 'workflow-1',
			workflowName: 'Demo workflow',
			projectId: 'project-1',
			projectName: 'Demo project',
			total: 10,
			succeeded: 9,
			failed: 1,
			failureRate: 0.1,
			runTime: 3000,
			averageRunTime: 300,
			timeSaved: 120,
		},
	],
};

const tipOverview = {
	project: { id: 'project-1', name: 'Demo project' },
	dateRange: {
		startDate: '2026-05-01T00:00:00.000Z',
		endDate: '2026-05-19T00:00:00.000Z',
	},
	summary: tipSummary,
	byTime: [
		{
			date: '2026-05-19T00:00:00.000Z',
			values: {
				total: 10,
				succeeded: 9,
				failed: 1,
				failureRate: 0.1,
				averageRunTime: 300,
				timeSaved: 120,
			},
		},
	],
	byWorkflow: tipByWorkflow,
	highlights: [
		{
			id: 'highest-impact',
			title: 'Highest automation impact',
			workflowId: 'workflow-1',
			workflowName: 'Demo workflow',
			description: 'Saved the most time',
			trend: 'positive' as const,
			value: 120,
			unit: 'minute' as const,
		},
	],
	lowImpactWorkflows: [
		{
			workflowId: 'workflow-1',
			workflowName: 'Demo workflow',
			description: 'Review this workflow',
			timeSaved: 120,
			total: 10,
		},
	],
	suggestedPrompts: ['Which workflows saved us the most time?'],
};

const tipChatResponse = {
	answer: 'Demo workflow saved the most time.',
	mode: 'fallback' as const,
	citations: [
		{
			workflowId: 'workflow-1',
			workflowName: 'Demo workflow',
			metric: 'time saved',
			value: 120,
			unit: 'minute' as const,
		},
	],
};

describe('Insights Analyst package exports', () => {
	test('schema module exports overview, chat, and stream contracts', async () => {
		const schemas = await import('../insights.schema');

		expect(schemas.insightsAnalystOverviewSchema).toBeDefined();
		expect(schemas.insightsAnalystChatRequestSchema).toBeDefined();
		expect(schemas.insightsAnalystChatResponseSchema).toBeDefined();
		expect(schemas.insightsAnalystChatStreamChunkSchema).toBeDefined();
	});

	test('package index re-exports analyst overview, chat, and stream types', () => {
		const indexPath = join(dirname(fileURLToPath(import.meta.url)), '../../index.ts');
		const indexSource = readFileSync(indexPath, 'utf8');

		expect(indexSource).toContain('insightsAnalystOverviewSchema');
		expect(indexSource).toContain('insightsAnalystChatRequestSchema');
		expect(indexSource).toContain('insightsAnalystChatResponseSchema');
		expect(indexSource).toContain('insightsAnalystChatStreamChunkSchema');
		expect(indexSource).toContain('InsightsAnalystOverview');
		expect(indexSource).toContain('InsightsAnalystChatRequest');
		expect(indexSource).toContain('InsightsAnalystChatResponse');
		expect(indexSource).toContain('InsightsAnalystChatStreamChunk');
	});
});

describe('insightsAnalystOverviewSchema', () => {
	test('accepts tip-shaped overview payload', async () => {
		const { insightsAnalystOverviewSchema } = await import('../insights.schema');

		expect(insightsAnalystOverviewSchema.safeParse(tipOverview).success).toBe(true);
	});

	test('rejects overview missing required project', async () => {
		const { insightsAnalystOverviewSchema } = await import('../insights.schema');
		const { project: _project, ...withoutProject } = tipOverview;

		expect(insightsAnalystOverviewSchema.safeParse(withoutProject).success).toBe(false);
	});
});

describe('insightsAnalystChatRequestSchema', () => {
	test('accepts non-empty question', async () => {
		const { insightsAnalystChatRequestSchema } = await import('../insights.schema');

		expect(insightsAnalystChatRequestSchema.safeParse({ question: 'What changed?' }).success).toBe(
			true,
		);
	});

	test('rejects empty question', async () => {
		const { insightsAnalystChatRequestSchema } = await import('../insights.schema');

		expect(insightsAnalystChatRequestSchema.safeParse({ question: '' }).success).toBe(false);
	});

	test('rejects whitespace-only question', async () => {
		const { insightsAnalystChatRequestSchema } = await import('../insights.schema');

		expect(insightsAnalystChatRequestSchema.safeParse({ question: '   ' }).success).toBe(false);
	});

	test('rejects missing question', async () => {
		const { insightsAnalystChatRequestSchema } = await import('../insights.schema');

		expect(insightsAnalystChatRequestSchema.safeParse({}).success).toBe(false);
	});
});

describe('insightsAnalystChatResponseSchema', () => {
	test('accepts tip-shaped chat response', async () => {
		const { insightsAnalystChatResponseSchema } = await import('../insights.schema');

		expect(insightsAnalystChatResponseSchema.safeParse(tipChatResponse).success).toBe(true);
	});

	test('rejects invalid chat mode', async () => {
		const { insightsAnalystChatResponseSchema } = await import('../insights.schema');

		expect(
			insightsAnalystChatResponseSchema.safeParse({
				...tipChatResponse,
				mode: 'unknown',
			}).success,
		).toBe(false);
	});
});

describe('insightsAnalystChatStreamChunkSchema', () => {
	test('accepts delta stream event', async () => {
		const { insightsAnalystChatStreamChunkSchema } = await import('../insights.schema');

		expect(
			insightsAnalystChatStreamChunkSchema.safeParse({ type: 'delta', text: 'Hello' }).success,
		).toBe(true);
	});

	test('accepts complete stream event with tip-shaped response', async () => {
		const { insightsAnalystChatStreamChunkSchema } = await import('../insights.schema');

		expect(
			insightsAnalystChatStreamChunkSchema.safeParse({
				type: 'complete',
				response: tipChatResponse,
			}).success,
		).toBe(true);
	});

	test('rejects unknown stream event type', async () => {
		const { insightsAnalystChatStreamChunkSchema } = await import('../insights.schema');

		expect(
			insightsAnalystChatStreamChunkSchema.safeParse({ type: 'error', text: 'nope' }).success,
		).toBe(false);
	});
});
