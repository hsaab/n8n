import type { InsightsByTime, InsightsByWorkflow, InsightsSummary } from '@n8n/api-types';
import { insightsAnalystOverviewSchema } from '@n8n/api-types';
import { mock } from 'jest-mock-extended';
import { DateTime } from 'luxon';

import { INSIGHTS_DEMO_PROJECT_ID } from '../insights-analyst-seed.constants';
import type { InsightsAnalystSeedService } from '../insights-analyst-seed.service';
import { InsightsAnalystOverviewService } from '../insights-analyst-overview.service';
import type { InsightsService } from '../insights.service';

const emptySummary: InsightsSummary = {
	total: { deviation: null, unit: 'count', value: 0 },
	failed: { deviation: null, unit: 'count', value: 0 },
	failureRate: { deviation: null, unit: 'ratio', value: 0 },
	averageRunTime: { deviation: null, unit: 'millisecond', value: 0 },
	timeSaved: { deviation: null, unit: 'minute', value: 0 },
};

const populatedSummary: InsightsSummary = {
	total: { deviation: 10, unit: 'count', value: 30 },
	failed: { deviation: 6, unit: 'count', value: 10 },
	failureRate: { deviation: 0.133, unit: 'ratio', value: 0.333 },
	averageRunTime: { deviation: 2, unit: 'millisecond', value: 10 },
	timeSaved: { deviation: 5, unit: 'minute', value: 188 },
};

const AP_INVOICE_ID = 'insights-demo-ap-invoice-ingestion';
const LEAD_ENRICHMENT_ID = 'insights-demo-lead-enrichment';
const STANDUP_DIGEST_ID = 'insights-demo-standup-digest';
const DELAYED_SHIPMENT_ID = 'insights-demo-delayed-shipment-triage';
const RETIRED_WORKFLOW_ID = 'insights-demo-retired-quarterly-report';

function workflowRow(
	workflowId: string,
	workflowName: string,
	counts: { succeeded: number; failed: number; timeSaved: number },
): InsightsByWorkflow['data'][number] {
	const total = counts.succeeded + counts.failed;

	return {
		workflowId,
		workflowName,
		projectId: INSIGHTS_DEMO_PROJECT_ID,
		projectName: 'Demo Operations',
		total,
		succeeded: counts.succeeded,
		failed: counts.failed,
		failureRate: total === 0 ? 0 : counts.failed / total,
		runTime: counts.succeeded * 1000,
		averageRunTime: total === 0 ? 0 : (counts.succeeded * 1000) / total,
		timeSaved: counts.timeSaved,
	};
}

/**
 * Deliberately unsorted, so the ranking order proves the service sorts rather
 * than trusting whatever order the insights query returned. Time saved per run
 * is a clean integer for every row: digest 7, enrichment 8, shipment 9, invoice 10.
 */
const demoWorkflowRows: InsightsByWorkflow = {
	count: 4,
	data: [
		workflowRow(STANDUP_DIGEST_ID, 'Daily standup digest', {
			succeeded: 240,
			failed: 2,
			timeSaved: 1680,
		}),
		workflowRow(AP_INVOICE_ID, 'AP invoice ingestion', {
			succeeded: 540,
			failed: 12,
			timeSaved: 5400,
		}),
		workflowRow(DELAYED_SHIPMENT_ID, 'Delayed shipment triage', {
			succeeded: 150,
			failed: 60,
			timeSaved: 1350,
		}),
		workflowRow(LEAD_ENRICHMENT_ID, 'Lead enrichment & scoring', {
			succeeded: 450,
			failed: 30,
			timeSaved: 3600,
		}),
	],
};

const sevenDaySeries: InsightsByTime[] = [
	{
		date: '2023-10-08T00:00:00.000Z',
		values: {
			total: 8,
			succeeded: 7,
			failed: 1,
			failureRate: 1 / 8,
			averageRunTime: 9,
			timeSaved: 12,
		},
	},
];

const thirtyDaySeries: InsightsByTime[] = [
	{
		date: '2023-09-15T00:00:00.000Z',
		values: {
			total: 20,
			succeeded: 16,
			failed: 4,
			failureRate: 0.2,
			averageRunTime: 11,
			timeSaved: 40,
		},
	},
	{
		date: '2023-10-08T00:00:00.000Z',
		values: {
			total: 8,
			succeeded: 7,
			failed: 1,
			failureRate: 1 / 8,
			averageRunTime: 9,
			timeSaved: 12,
		},
	},
];

function daySpan(startDate: Date, endDate: Date) {
	return DateTime.fromJSDate(endDate).diff(DateTime.fromJSDate(startDate), 'days').days;
}

function expectAboutToday(date: Date) {
	const hoursFromNow = Math.abs(DateTime.fromJSDate(date).diffNow('hours').hours);
	expect(hoursFromNow).toBeLessThan(25);
}

describe('InsightsAnalystOverviewService', () => {
	const seedService = mock<InsightsAnalystSeedService>();
	const insightsService = mock<InsightsService>();
	let service: InsightsAnalystOverviewService;

	beforeEach(() => {
		jest.resetAllMocks();
		seedService.ensureSeeded.mockResolvedValue(undefined);
		insightsService.getInsightsSummary.mockResolvedValue(emptySummary);
		insightsService.getInsightsByWorkflow.mockResolvedValue({ count: 0, data: [] });
		insightsService.getInsightsByTime.mockResolvedValue([]);
		service = new InsightsAnalystOverviewService(seedService, insightsService);
	});

	it('defaults the overview window to the last 30 days on the demo project', async () => {
		insightsService.getInsightsSummary.mockResolvedValue(populatedSummary);
		insightsService.getInsightsByWorkflow.mockResolvedValue(demoWorkflowRows);
		insightsService.getInsightsByTime.mockResolvedValue(thirtyDaySeries);

		const result = await service.getOverview();

		expect(insightsService.getInsightsSummary).toHaveBeenCalledWith(
			expect.objectContaining({ projectId: INSIGHTS_DEMO_PROJECT_ID }),
		);
		expect(insightsService.getInsightsByWorkflow).toHaveBeenCalledWith(
			expect.objectContaining({ projectId: INSIGHTS_DEMO_PROJECT_ID }),
		);
		expect(insightsService.getInsightsByTime).toHaveBeenCalledWith(
			expect.objectContaining({ projectId: INSIGHTS_DEMO_PROJECT_ID }),
		);

		const { startDate, endDate } = insightsService.getInsightsByTime.mock.calls[0][0];
		expectAboutToday(endDate);
		expect(daySpan(startDate, endDate)).toBeGreaterThanOrEqual(29);
		expect(daySpan(startDate, endDate)).toBeLessThanOrEqual(31);
		expect(insightsService.validateDateFiltersLicense).not.toHaveBeenCalled();
		expect(insightsAnalystOverviewSchema.safeParse(result).success).toBe(true);
		expect(result.summary).toEqual(populatedSummary);
		expect(result.byTime).toEqual(thirtyDaySeries);
	});

	it('ignores a client projectId and always reads insights-demo-project', async () => {
		await service.getOverview({ projectId: 'customer-ops-project' });

		expect(insightsService.getInsightsSummary).toHaveBeenCalledWith(
			expect.objectContaining({ projectId: INSIGHTS_DEMO_PROJECT_ID }),
		);
		expect(insightsService.getInsightsByWorkflow).toHaveBeenCalledWith(
			expect.objectContaining({ projectId: INSIGHTS_DEMO_PROJECT_ID }),
		);
		expect(insightsService.getInsightsByTime).toHaveBeenCalledWith(
			expect.objectContaining({ projectId: INSIGHTS_DEMO_PROJECT_ID }),
		);
		expect(insightsService.getInsightsSummary).not.toHaveBeenCalledWith(
			expect.objectContaining({ projectId: 'customer-ops-project' }),
		);
	});

	it('clamps a requested range that is older than 30 days', async () => {
		const startDate = DateTime.now().minus({ days: 90 }).toJSDate();
		const endDate = DateTime.now().toJSDate();

		await service.getOverview({ startDate, endDate });

		const args = insightsService.getInsightsByTime.mock.calls[0][0];
		expect(args.startDate.getTime()).toBeGreaterThan(startDate.getTime());
		expect(daySpan(args.startDate, args.endDate)).toBeLessThanOrEqual(31);
		expect(insightsService.validateDateFiltersLicense).not.toHaveBeenCalled();
	});

	it('changes the chart buckets when the date range changes', async () => {
		const today = DateTime.now().toJSDate();
		const sevenDaysAgo = DateTime.now().minus({ days: 7 }).toJSDate();

		insightsService.getInsightsByTime
			.mockResolvedValueOnce(sevenDaySeries)
			.mockResolvedValueOnce(thirtyDaySeries);

		const week = await service.getOverview({ startDate: sevenDaysAgo, endDate: today });
		const month = await service.getOverview();

		const weekWindow = insightsService.getInsightsByTime.mock.calls[0][0];
		const monthWindow = insightsService.getInsightsByTime.mock.calls[1][0];

		expect(daySpan(weekWindow.startDate, weekWindow.endDate)).toBeGreaterThanOrEqual(6);
		expect(daySpan(weekWindow.startDate, weekWindow.endDate)).toBeLessThanOrEqual(8);
		expect(monthWindow.startDate.getTime()).toBeLessThan(weekWindow.startDate.getTime());
		expect(week.byTime).toEqual(sevenDaySeries);
		expect(month.byTime).toEqual(thirtyDaySeries);
		expect(week.byTime).not.toEqual(month.byTime);
	});

	it('returns a valid empty overview when the demo project has no data', async () => {
		const result = await service.getOverview();

		expect(insightsAnalystOverviewSchema.safeParse(result).success).toBe(true);
		expect(result.summary.total.value).toBe(0);
		expect(result.byTime).toEqual([]);
		expect(result.highlights).toEqual([]);
		expect(result.ranking).toEqual([]);
		expect(result.lowImpact).toEqual([]);
		expect(insightsService.validateDateFiltersLicense).not.toHaveBeenCalled();
	});

	it('seeds demo period data on the first overview read after owner setup', async () => {
		const order: string[] = [];
		seedService.ensureSeeded.mockImplementation(async () => {
			order.push('seed');
		});
		insightsService.getInsightsSummary.mockImplementation(async () => {
			order.push('read');
			return populatedSummary;
		});
		insightsService.getInsightsByWorkflow.mockResolvedValue(demoWorkflowRows);
		insightsService.getInsightsByTime.mockResolvedValue(thirtyDaySeries);

		const result = await service.getOverview();

		expect(seedService.ensureSeeded).toHaveBeenCalled();
		expect(order[0]).toBe('seed');
		expect(order).toContain('read');
		expect(result.ranking.length).toBeGreaterThan(0);
		expect(
			result.ranking.every((row) =>
				demoWorkflowRows.data.some((workflow) => workflow.workflowId === row.workflowId),
			),
		).toBe(true);
	});

	it('does not apply the community date-range license cap on a 30-day overview', async () => {
		const startDate = DateTime.now().minus({ days: 30 }).toJSDate();
		const endDate = DateTime.now().toJSDate();

		insightsService.getInsightsSummary.mockResolvedValue(populatedSummary);
		insightsService.getInsightsByWorkflow.mockResolvedValue(demoWorkflowRows);
		insightsService.getInsightsByTime.mockResolvedValue(thirtyDaySeries);

		const result = await service.getOverview({ startDate, endDate });

		expect(insightsService.validateDateFiltersLicense).not.toHaveBeenCalled();
		expect(insightsAnalystOverviewSchema.safeParse(result).success).toBe(true);
		expect(result.byTime).toEqual(thirtyDaySeries);
	});

	it('shows three highlight cards in impact, efficiency and attention order', async () => {
		insightsService.getInsightsByWorkflow.mockResolvedValue(demoWorkflowRows);

		const { highlights } = await service.getOverview();

		expect(highlights.map((highlight) => highlight.kind)).toEqual([
			'impact',
			'efficiency',
			'attention',
		]);
		expect(highlights.map((highlight) => highlight.workflowId)).toEqual([
			AP_INVOICE_ID,
			STANDUP_DIGEST_ID,
			DELAYED_SHIPMENT_ID,
		]);
		// Total minutes saved, then minutes saved per successful run, then failed runs.
		expect(highlights.map((highlight) => highlight.metricValue)).toEqual([5400, 7, 60]);
	});

	it('names the workflow on every highlight card and describes it from the demo catalog', async () => {
		insightsService.getInsightsByWorkflow.mockResolvedValue(demoWorkflowRows);

		const { highlights, lowImpact } = await service.getOverview();

		expect(highlights.map((highlight) => highlight.workflowName)).toEqual([
			'AP invoice ingestion',
			'Daily standup digest',
			'Delayed shipment triage',
		]);
		expect(highlights.every((highlight) => highlight.blurb.length > 0)).toBe(true);

		// The efficiency card and the first low impact row are the same workflow, so a
		// catalog-sourced blurb reads the same in both places.
		const efficiency = highlights[1];
		const sameWorkflowRow = lowImpact.find((row) => row.workflowId === efficiency.workflowId);
		expect(sameWorkflowRow?.blurb).toBe(efficiency.blurb);
	});

	it('ranks every demo workflow by time saved and tags it with the owning department', async () => {
		insightsService.getInsightsByWorkflow.mockResolvedValue(demoWorkflowRows);

		const { ranking } = await service.getOverview();

		expect(ranking).toEqual([
			expect.objectContaining({
				rank: 1,
				workflowId: AP_INVOICE_ID,
				department: 'Finance',
				timeSavedMinutes: 5400,
			}),
			expect.objectContaining({
				rank: 2,
				workflowId: LEAD_ENRICHMENT_ID,
				department: 'Revenue Ops',
				timeSavedMinutes: 3600,
			}),
			expect.objectContaining({
				rank: 3,
				workflowId: STANDUP_DIGEST_ID,
				department: 'Operations',
				timeSavedMinutes: 1680,
			}),
			expect.objectContaining({
				rank: 4,
				workflowId: DELAYED_SHIPMENT_ID,
				department: 'Operations',
				timeSavedMinutes: 1350,
			}),
		]);
	});

	it('lists the three workflows that save the least time per run, lowest first', async () => {
		insightsService.getInsightsByWorkflow.mockResolvedValue(demoWorkflowRows);

		const { lowImpact } = await service.getOverview();

		expect(lowImpact.map((row) => row.workflowId)).toEqual([
			STANDUP_DIGEST_ID,
			LEAD_ENRICHMENT_ID,
			DELAYED_SHIPMENT_ID,
		]);
		expect(lowImpact.map((row) => row.timeSavedPerRunMinutes)).toEqual([7, 8, 9]);
		expect(lowImpact.some((row) => row.workflowId === AP_INVOICE_ID)).toBe(false);
	});

	it('still lists three low impact workflows when they all save well over two minutes per run', async () => {
		insightsService.getInsightsByWorkflow.mockResolvedValue(demoWorkflowRows);

		const { lowImpact } = await service.getOverview();

		// Every seeded workflow saves more than two minutes per run, so a minimum-savings
		// filter would empty this list and the analyst page would render nothing here.
		expect(lowImpact).toHaveLength(3);
		expect(lowImpact.every((row) => row.timeSavedPerRunMinutes > 2)).toBe(true);
	});

	it('renders a workflow missing from the demo catalog without a department or blurb', async () => {
		insightsService.getInsightsByWorkflow.mockResolvedValue({
			count: 1,
			data: [
				workflowRow(RETIRED_WORKFLOW_ID, 'Quarterly board report', {
					succeeded: 20,
					failed: 1,
					timeSaved: 120,
				}),
			],
		});

		const { highlights, ranking, lowImpact } = await service.getOverview();

		expect(highlights).toHaveLength(3);
		expect(highlights.every((highlight) => highlight.workflowId === RETIRED_WORKFLOW_ID)).toBe(
			true,
		);
		expect(highlights.map((highlight) => highlight.blurb)).toEqual(['', '', '']);
		expect(ranking[0].department).toBe('');
		expect(lowImpact[0].blurb).toBe('');
	});
});
