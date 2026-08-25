import {
	insightsAnalystChatResponseSchema,
	insightsAnalystCitationSchema,
	insightsAnalystHighlightSchema,
	insightsAnalystLowImpactSchema,
	insightsAnalystRankingRowSchema,
} from '../insights-analyst.schema';

const chatAnswer = {
	answer: 'Invoice intake saved the most time this month.',
	citations: [
		{
			workflowId: 'insights-demo-ap-invoice-ingestion',
			label: 'AP invoice ingestion',
			metric: '135 hr',
		},
	],
};

const impactHighlight = {
	workflowId: 'insights-demo-ap-invoice-ingestion',
	kind: 'impact',
	workflowName: 'AP invoice ingestion',
	blurb: 'Pulls invoices out of the shared mailbox and files them for approval.',
	metricValue: 8100,
};

const rankingRow = {
	rank: 1,
	workflowId: 'insights-demo-ap-invoice-ingestion',
	name: 'AP invoice ingestion',
	department: 'Finance',
	timeSavedMinutes: 8100,
};

const lowImpactRow = {
	workflowId: 'insights-demo-standup-digest',
	name: 'Daily standup digest',
	blurb: 'Posts yesterday ticket movement into the team channel.',
	timeSavedPerRunMinutes: 7,
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

describe('insightsAnalystCitationSchema', () => {
	it('keeps a citation metric a written string because the model writes it', () => {
		expect(insightsAnalystCitationSchema.safeParse(chatAnswer.citations[0]).success).toBe(true);
		expect(
			insightsAnalystCitationSchema.safeParse({ ...chatAnswer.citations[0], metric: 8100 }).success,
		).toBe(false);
	});
});

describe('insightsAnalystHighlightSchema', () => {
	it('accepts each of the three highlight cards the analyst page renders', () => {
		const kinds = ['impact', 'efficiency', 'attention'];

		for (const kind of kinds) {
			expect(insightsAnalystHighlightSchema.safeParse({ ...impactHighlight, kind }).success).toBe(
				true,
			);
		}
	});

	it('rejects a highlight that still carries the old title and metric strings', () => {
		const result = insightsAnalystHighlightSchema.safeParse({
			workflowId: 'insights-demo-ap-invoice-ingestion',
			title: 'AP invoice ingestion',
			blurb: 'Saved the most time this month',
			metric: '8100 min',
		});

		expect(result.success).toBe(false);
	});

	it('rejects a highlight card kind the design does not have', () => {
		const result = insightsAnalystHighlightSchema.safeParse({
			...impactHighlight,
			kind: 'velocity',
		});

		expect(result.success).toBe(false);
	});

	it('rejects a highlight whose metric arrives pre-formatted instead of numeric', () => {
		const result = insightsAnalystHighlightSchema.safeParse({
			...impactHighlight,
			metricValue: '135 hr',
		});

		expect(result.success).toBe(false);
	});

	it('rejects a highlight that leaves out the workflow name the card headline needs', () => {
		const result = insightsAnalystHighlightSchema.safeParse({
			workflowId: impactHighlight.workflowId,
			kind: impactHighlight.kind,
			blurb: impactHighlight.blurb,
			metricValue: impactHighlight.metricValue,
		});

		expect(result.success).toBe(false);
	});
});

describe('insightsAnalystRankingRowSchema', () => {
	it('accepts a ranking row with a department and numeric minutes saved', () => {
		expect(insightsAnalystRankingRowSchema.safeParse(rankingRow).success).toBe(true);
	});

	it('rejects a ranking row that still carries the old timeSavedLabel string', () => {
		const result = insightsAnalystRankingRowSchema.safeParse({
			rank: 1,
			workflowId: 'insights-demo-ap-invoice-ingestion',
			name: 'AP invoice ingestion',
			timeSavedLabel: '8100 min',
		});

		expect(result.success).toBe(false);
	});

	it('rejects a ranking row without a department, which would leave the table column blank', () => {
		const result = insightsAnalystRankingRowSchema.safeParse({
			rank: rankingRow.rank,
			workflowId: rankingRow.workflowId,
			name: rankingRow.name,
			timeSavedMinutes: rankingRow.timeSavedMinutes,
		});

		expect(result.success).toBe(false);
	});
});

describe('insightsAnalystLowImpactSchema', () => {
	it('accepts a low impact row with numeric minutes saved per run', () => {
		expect(insightsAnalystLowImpactSchema.safeParse(lowImpactRow).success).toBe(true);
	});

	it('rejects a low impact row that still carries the old timeSavedPerRunLabel string', () => {
		const result = insightsAnalystLowImpactSchema.safeParse({
			workflowId: 'insights-demo-standup-digest',
			name: 'Daily standup digest',
			blurb: 'Low time saved per run',
			timeSavedPerRunLabel: '7 min',
		});

		expect(result.success).toBe(false);
	});
});
