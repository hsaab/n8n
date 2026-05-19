import {
	insightsAnalystChatRequestSchema,
	insightsAnalystChatResponseSchema,
	insightsAnalystOverviewSchema,
	insightsByTimeSchema,
	insightsByWorkflowSchema,
	insightsDateRangeSchema,
	insightsSummarySchema,
} from '../insights.schema';

describe('insightsSummarySchema', () => {
	test.each([
		{
			name: 'valid insights summary',
			value: {
				total: { value: 525, deviation: 85, unit: 'count' },
				failed: { value: 14, deviation: 3, unit: 'count' },
				failureRate: { value: 1.9, deviation: -5, unit: 'ratio' },
				timeSaved: { value: 54, deviation: -5, unit: 'minute' },
				averageRunTime: { value: 2.5, deviation: -5, unit: 'millisecond' },
			},
			expected: true,
		},
		{
			name: 'invalid failureRate unit',
			value: {
				total: { value: 525, deviation: 85, unit: 'count' },
				failed: { value: 14, deviation: 3, unit: 'count' },
				failureRate: { value: 1.9, deviation: -5, unit: 'time' }, // Wrong unit
				timeSaved: { value: 54, deviation: -5, unit: 'minute' },
				averageRunTime: { value: 2.5, deviation: -5, unit: 'millisecond' },
			},
			expected: false,
		},
		{
			name: 'missing total',
			value: {
				failed: { value: 14, deviation: 3, unit: 'count' },
				failureRate: { value: 1.9, deviation: -5, unit: 'ratio' },
				timeSaved: { value: 54, deviation: -5, unit: 'minute' },
				averageRunTime: { value: 2.5, deviation: -5, unit: 'millisecond' },
			},
			expected: false,
		},
		{
			name: 'wrong data type for value',
			value: {
				total: { value: '525', deviation: 85, unit: 'count' }, // Value should be a number
				failed: { value: 14, deviation: 3, unit: 'count' },
				failureRate: { value: 1.9, deviation: -5, unit: 'ratio' },
				timeSaved: { value: 54, deviation: -5, unit: 'minute' },
				averageRunTime: { value: 2.5, deviation: -5, unit: 'millisecond' },
			},
			expected: false,
		},
		{
			name: 'invalid key in object',
			value: {
				total: { value: 525, deviation: 85, unit: 'count' },
				failed: { value: 14, deviation: 3, unit: 'count' },
				failureRate: { value: 1.9, deviation: -5, unit: 'ratio' },
				timeSaved: { value: 54, deviation: -5, unit: 'minute' },
				averageRunTime: { value: 2.5, deviation: -5, unit: 'millisecond' },
				extraKey: { value: 100, deviation: 10, unit: 'count' }, // Invalid key
			},
			expected: false,
		},
	])('should validate $name', ({ value, expected }) => {
		const result = insightsSummarySchema.safeParse(value);
		expect(result.success).toBe(expected);
	});
});

describe('insightsByWorkflowSchema', () => {
	const validInsightsByWorkflow = {
		count: 2,
		data: [
			{
				workflowId: 'w1',
				workflowName: 'Test Workflow',
				projectId: 'p1',
				projectName: 'Test Project',
				total: 100,
				succeeded: 90,
				failed: 10,
				failureRate: 0.56,
				runTime: 300,
				averageRunTime: 30.5,
				timeSaved: 50,
			},
		],
	};

	test.each([
		{
			name: 'valid workflow insights',
			value: validInsightsByWorkflow,
			expected: true,
		},
		{
			name: 'workflow insights with nullable workflow id and project id',
			value: {
				...validInsightsByWorkflow,
				data: [
					{
						...validInsightsByWorkflow.data[0],
						workflowId: null,
						projectId: null,
					},
				],
			},
			expected: true,
		},
		{
			name: 'wrong data type',
			value: {
				count: 2,
				data: [
					{
						workflowId: 'w1',
						total: '100',
						succeeded: 90,
						failed: 10,
						failureRate: 10,
						runTime: 300,
						averageRunTime: 30,
						timeSaved: 50,
					},
				],
			},
			expected: false,
		},
		{
			name: 'missing required field',
			value: {
				count: 2,
				data: [
					{
						workflowId: 'w1',
						total: 100,
						succeeded: 90,
						failed: 10,
						failureRate: 10,
						runTime: 300,
						averageRunTime: 30,
					},
				],
			},
			expected: false,
		},
		{
			name: 'unexpected key',
			value: {
				count: 2,
				data: [
					{
						workflowId: 'w1',
						total: 100,
						succeeded: 90,
						failed: 10,
						failureRate: 10,
						runTime: 300,
						averageRunTime: 30,
						timeSaved: 50,
						extraKey: 'value',
					},
				],
			},
			expected: false,
		},
	])('should validate $name', ({ value, expected }) => {
		const result = insightsByWorkflowSchema.safeParse(value);
		expect(result.success).toBe(expected);
	});
});

describe('insightsByTimeSchema', () => {
	test.each([
		{
			name: 'valid insights by time',
			value: {
				date: '2025-03-25T10:34:36.484Z',
				values: {
					total: 200,
					succeeded: 180,
					failed: 20,
					failureRate: 10,
					averageRunTime: 40,
					timeSaved: 100,
				},
			},
			expected: true,
		},
		{
			name: 'invalid date format',
			value: {
				date: '20240325', // Should be a string
				values: {
					total: 200,
					succeeded: 180,
					failed: 20,
					failureRate: 10,
					averageRunTime: 40,
					timeSaved: 100,
				},
			},
			expected: false,
		},
		{
			name: 'invalid field type',
			value: {
				date: 20240325, // Should be a string
				values: {
					total: 200,
					succeeded: 180,
					failed: 20,
					failureRate: 10,
					averageRunTime: 40,
					timeSaved: 100,
				},
			},
			expected: false,
		},
		{
			name: 'missing required key',
			value: {
				date: '2025-03-25T10:34:36.484Z',
				values: {
					total: 200,
					succeeded: 180,
					failed: 20,
					failureRate: 10,
					averageRunTime: 40,
				},
			},
			expected: false,
		},
		{
			name: 'unexpected key',
			value: {
				date: '2025-03-25T10:34:36.484Z',
				values: {
					total: 200,
					failureRate: 10,
					averageRunTime: 40,
					extraKey: 'value',
				},
			},
			expected: false,
		},
	])('should validate $name', ({ value, expected }) => {
		const result = insightsByTimeSchema.safeParse(value);
		expect(result.success).toBe(expected);
	});
});

describe('insightsDateRangeSchema', () => {
	test.each([
		{
			name: 'valid date range',
			value: {
				key: 'day',
				licensed: true,
				granularity: 'hour',
			},
			expected: true,
		},
		{
			name: 'missing required key',
			value: {
				licensed: true,
				granularity: 'hour',
			},
			expected: false,
		},
		{
			name: 'invalid key value',
			value: {
				key: 'invalid',
				licensed: true,
				granularity: 'hour',
			},
			expected: false,
		},
		{
			name: 'missing licensed field',
			value: {
				key: 'day',
				granularity: 'hour',
			},
			expected: false,
		},
		{
			name: 'invalid licensed type',
			value: {
				key: 'day',
				licensed: 'true', // Should be a boolean
				granularity: 'hour',
			},
			expected: false,
		},
		{
			name: 'invalid granularity value',
			value: {
				key: 'day',
				licensed: true,
				granularity: 'invalid',
			},
			expected: false,
		},
		{
			name: 'unexpected additional key',
			value: {
				key: 'day',
				licensed: true,
				granularity: 'hour',
				extraKey: 'value', // Extra key not allowed
			},
			expected: false,
		},
	])('should validate $name', ({ value, expected }) => {
		const result = insightsDateRangeSchema.safeParse(value);
		expect(result.success).toBe(expected);
	});
});

describe('insightsAnalystOverviewSchema', () => {
	const validOverview = {
		generatedAt: '2025-03-25T10:34:36.484Z',
		dateRange: {
			startDate: '2025-03-18T10:34:36.484Z',
			endDate: '2025-03-25T10:34:36.484Z',
		},
		summary: {
			total: { value: 525, deviation: 85, unit: 'count' },
			failed: { value: 14, deviation: 3, unit: 'count' },
			failureRate: { value: 0.019, deviation: -0.05, unit: 'ratio' },
			timeSaved: { value: 540, deviation: 50, unit: 'minute' },
			averageRunTime: { value: 2500, deviation: -50, unit: 'millisecond' },
		},
		byTime: [
			{
				date: '2025-03-25T10:34:36.484Z',
				values: {
					total: 200,
					succeeded: 180,
					failed: 20,
					failureRate: 0.1,
					averageRunTime: 40,
					timeSaved: 100,
				},
			},
		],
		workflows: [
			{
				workflowId: 'workflow-id',
				workflowName: 'AI Support Triage',
				projectId: 'project-id',
				projectName: 'Operations',
				total: 100,
				succeeded: 95,
				failed: 5,
				failureRate: 0.05,
				runTime: 3000,
				averageRunTime: 30,
				timeSaved: 500,
				timeSavedPerExecution: 12,
				trend: 'improving',
				riskLevel: 'low',
				story: 'High-impact workflow saving the team time.',
			},
		],
		highlights: [
			{
				id: 'top-time-saver',
				title: 'Highest automation impact',
				value: 'AI Support Triage',
				description: '500 minutes saved',
				tone: 'positive',
			},
		],
		suggestedPrompts: ['Which workflows need attention?'],
	};

	test.each([
		{
			name: 'valid analyst overview',
			value: validOverview,
			expected: true,
		},
		{
			name: 'invalid workflow risk level',
			value: {
				...validOverview,
				workflows: [{ ...validOverview.workflows[0], riskLevel: 'critical' }],
			},
			expected: false,
		},
		{
			name: 'unexpected overview key',
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

describe('insightsAnalystChat schemas', () => {
	it('validates analyst chat requests', () => {
		const result = insightsAnalystChatRequestSchema.safeParse({
			prompt: 'Which workflows saved the most time?',
			startDate: '2025-03-18T10:34:36.484Z',
		});

		expect(result.success).toBe(true);
	});

	it('validates analyst chat responses with citations', () => {
		const result = insightsAnalystChatResponseSchema.safeParse({
			answer: 'AI Support Triage saved the most time.',
			citations: [
				{
					label: 'Top time saver',
					value: 'AI Support Triage',
					description: '100 runs, 5% failure rate, 500 minutes saved.',
					workflowId: 'workflow-id',
				},
			],
			followUpPrompts: ['Which workflows need attention?'],
			mode: 'llm',
		});

		expect(result.success).toBe(true);
	});

	it('validates fallback-mode analyst chat responses', () => {
		const result = insightsAnalystChatResponseSchema.safeParse({
			answer: 'Deterministic template answer.',
			citations: [],
			followUpPrompts: [],
			mode: 'fallback',
		});

		expect(result.success).toBe(true);
	});

	it('rejects analyst chat responses with an unknown mode', () => {
		const result = insightsAnalystChatResponseSchema.safeParse({
			answer: 'something',
			citations: [],
			followUpPrompts: [],
			mode: 'oracle',
		});

		expect(result.success).toBe(false);
	});
});
