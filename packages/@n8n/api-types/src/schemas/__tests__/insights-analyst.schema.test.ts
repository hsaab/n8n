import { InsightsDateFilterDto } from '../../dto/insights/date-filter.dto';
import {
	InsightsAnalystOverviewQueryDto,
	insightsAnalystChatResponseSchema,
	insightsAnalystOverviewSchema,
} from '../insights-analyst.schema';

const validSummary = {
	total: { value: 2554, deviation: 85, unit: 'count' },
	failed: { value: 194, deviation: 3, unit: 'count' },
	failureRate: { value: 0.076, deviation: -5, unit: 'ratio' },
	timeSaved: { value: 28740, deviation: -5, unit: 'minute' },
	averageRunTime: { value: 31540, deviation: -5, unit: 'millisecond' },
};

const validHighlights = [
	{
		kind: 'impact',
		workflowId: 'wf-invoice',
		workflowName: 'AP invoice ingestion',
		description: 'Routes supplier invoices into the finance queue.',
		value: 8040,
	},
	{
		kind: 'efficiency',
		workflowId: 'wf-vendor',
		workflowName: 'Vendor onboarding nudges',
		description: 'Keeps vendor onboarding moving with reminder emails.',
		value: 5,
	},
	{
		kind: 'attention',
		workflowId: 'wf-shipments',
		workflowName: 'Collects delayed shipments',
		description: 'Flags late shipment updates for operations.',
		value: 60,
	},
];

const validChart = [
	{
		date: '2026-04-19T00:00:00.000Z',
		succeeded: 80,
		failed: 6,
	},
	{
		date: '2026-04-20T00:00:00.000Z',
		succeeded: 74,
		failed: 8,
	},
];

const validRanking = [
	{ workflowId: 'wf-invoice', workflowName: 'AP invoice ingestion', timeSaved: 8040 },
	{ workflowId: 'wf-leads', workflowName: 'Lead enrichment & scoring', timeSaved: 5520 },
	{ workflowId: 'wf-orders', workflowName: 'Order routing escalations', timeSaved: 4680 },
	{ workflowId: 'wf-it', workflowName: 'New-hire IT provisioning', timeSaved: 3240 },
	{ workflowId: 'wf-vendor', workflowName: 'Vendor onboarding nudges', timeSaved: 1260 },
];

const validLowImpact = [
	{
		workflowId: 'wf-vendor',
		workflowName: 'Vendor onboarding nudges',
		description: 'Reminder emails for incomplete vendor packets.',
		timeSavedPerExecution: 5,
	},
	{
		workflowId: 'wf-standup',
		workflowName: 'Daily standup digest',
		description: 'Collects standup notes into one channel post.',
		timeSavedPerExecution: 7,
	},
	{
		workflowId: 'wf-survey',
		workflowName: 'Customer survey follow-up',
		description: 'Sends a follow-up when a survey score is low.',
		timeSavedPerExecution: 8,
	},
];

const validCitationAllowlist = [
	{ workflowId: 'wf-invoice', workflowName: 'AP invoice ingestion' },
	{ workflowId: 'wf-leads', workflowName: 'Lead enrichment & scoring' },
	{ workflowId: 'wf-orders', workflowName: 'Order routing escalations' },
	{ workflowId: 'wf-it', workflowName: 'New-hire IT provisioning' },
	{ workflowId: 'wf-vendor', workflowName: 'Vendor onboarding nudges' },
	{ workflowId: 'wf-shipments', workflowName: 'Collects delayed shipments' },
	{ workflowId: 'wf-standup', workflowName: 'Daily standup digest' },
	{ workflowId: 'wf-survey', workflowName: 'Customer survey follow-up' },
];

const validOverview = {
	summary: validSummary,
	highlights: validHighlights,
	chart: validChart,
	ranking: validRanking,
	lowImpact: validLowImpact,
	citationAllowlist: validCitationAllowlist,
};

describe('insightsAnalystOverviewSchema', () => {
	test('A caller can request the default or selected overview window', () => {
		expect(InsightsAnalystOverviewQueryDto).toBe(InsightsDateFilterDto);

		expect(InsightsAnalystOverviewQueryDto.safeParse({}).success).toBe(true);
		expect(
			InsightsAnalystOverviewQueryDto.safeParse({
				startDate: '2026-04-19',
				endDate: '2026-05-19',
			}).success,
		).toBe(true);
	});

	test.each([
		{
			name: 'valid overview payload',
			value: validOverview,
			expected: true,
		},
		{
			name: 'two highlights instead of three',
			value: {
				...validOverview,
				highlights: validHighlights.slice(0, 2),
			},
			expected: false,
		},
		{
			name: 'four ranking rows instead of five',
			value: {
				...validOverview,
				ranking: validRanking.slice(0, 4),
			},
			expected: false,
		},
		{
			name: 'two low-impact tiles instead of three',
			value: {
				...validOverview,
				lowImpact: validLowImpact.slice(0, 2),
			},
			expected: false,
		},
		{
			name: 'missing citation allowlist',
			value: {
				summary: validSummary,
				highlights: validHighlights,
				chart: validChart,
				ranking: validRanking,
				lowImpact: validLowImpact,
			},
			expected: false,
		},
		{
			name: 'chart point missing failed series',
			value: {
				...validOverview,
				chart: [{ date: '2026-04-19T00:00:00.000Z', succeeded: 80 }],
			},
			expected: false,
		},
		{
			name: 'unexpected key',
			value: {
				...validOverview,
				extraKey: true,
			},
			expected: false,
		},
	])('should validate $name', ({ value, expected }) => {
		const result = insightsAnalystOverviewSchema.safeParse(value);
		expect(result.success).toBe(expected);
	});
});

describe('insightsAnalystChatResponseSchema', () => {
	test.each([
		{
			name: 'valid llm chat response',
			value: {
				mode: 'llm',
				finding: 'Invoice ingestion saved the most time.',
				evidence: 'AP invoice ingestion saved 134 hours in this window.',
				recommendation: 'Keep that workflow healthy before adding more volume.',
				citations: [{ workflowId: 'wf-invoice', workflowName: 'AP invoice ingestion' }],
			},
			expected: true,
		},
		{
			name: 'valid fallback chat response',
			value: {
				mode: 'fallback',
				finding: 'Failures rose on shipment collection.',
				evidence: 'Collects delayed shipments had 60 failed executions.',
				recommendation: 'Inspect that workflow first.',
				citations: [{ workflowId: 'wf-shipments', workflowName: 'Collects delayed shipments' }],
			},
			expected: true,
		},
		{
			name: 'invalid mode',
			value: {
				mode: 'streaming',
				finding: 'Invoice ingestion saved the most time.',
				evidence: 'AP invoice ingestion saved 134 hours in this window.',
				recommendation: 'Keep that workflow healthy before adding more volume.',
				citations: [],
			},
			expected: false,
		},
		{
			name: 'missing finding',
			value: {
				mode: 'fallback',
				evidence: 'AP invoice ingestion saved 134 hours in this window.',
				recommendation: 'Keep that workflow healthy before adding more volume.',
				citations: [],
			},
			expected: false,
		},
	])('should validate $name', ({ value, expected }) => {
		const result = insightsAnalystChatResponseSchema.safeParse(value);
		expect(result.success).toBe(expected);
	});
});
