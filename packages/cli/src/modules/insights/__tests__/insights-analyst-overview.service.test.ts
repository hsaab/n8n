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

const workflowRows: InsightsByWorkflow = {
	count: 2,
	data: [
		{
			workflowId: 'insights-demo-ap-invoice-ingestion',
			workflowName: 'AP invoice ingestion',
			projectId: INSIGHTS_DEMO_PROJECT_ID,
			projectName: 'Demo Operations',
			total: 100,
			succeeded: 90,
			failed: 10,
			failureRate: 0.1,
			runTime: 10000,
			averageRunTime: 100,
			timeSaved: 180,
		},
		{
			workflowId: 'insights-demo-inventory-sync',
			workflowName: 'Inventory sync',
			projectId: INSIGHTS_DEMO_PROJECT_ID,
			projectName: 'Demo Operations',
			total: 40,
			succeeded: 40,
			failed: 0,
			failureRate: 0,
			runTime: 2000,
			averageRunTime: 50,
			timeSaved: 8,
		},
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
		insightsService.getInsightsByWorkflow.mockResolvedValue(workflowRows);
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
		insightsService.getInsightsByWorkflow.mockResolvedValue(workflowRows);
		insightsService.getInsightsByTime.mockResolvedValue(thirtyDaySeries);

		const result = await service.getOverview();

		expect(seedService.ensureSeeded).toHaveBeenCalled();
		expect(order[0]).toBe('seed');
		expect(order).toContain('read');
		expect(result.ranking.length).toBeGreaterThan(0);
		expect(
			result.ranking.every((row) =>
				workflowRows.data.some((workflow) => workflow.workflowId === row.workflowId),
			),
		).toBe(true);
	});

	it('does not apply the community date-range license cap on a 30-day overview', async () => {
		const startDate = DateTime.now().minus({ days: 30 }).toJSDate();
		const endDate = DateTime.now().toJSDate();

		insightsService.getInsightsSummary.mockResolvedValue(populatedSummary);
		insightsService.getInsightsByWorkflow.mockResolvedValue(workflowRows);
		insightsService.getInsightsByTime.mockResolvedValue(thirtyDaySeries);

		const result = await service.getOverview({ startDate, endDate });

		expect(insightsService.validateDateFiltersLicense).not.toHaveBeenCalled();
		expect(insightsAnalystOverviewSchema.safeParse(result).success).toBe(true);
		expect(result.byTime).toEqual(thirtyDaySeries);
	});
});
