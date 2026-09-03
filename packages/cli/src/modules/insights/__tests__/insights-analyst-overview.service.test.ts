import { insightsAnalystOverviewSchema } from '@n8n/api-types';
import { testDb, testModules } from '@n8n/backend-test-utils';
import { Container } from '@n8n/di';
import { DateTime } from 'luxon';
import { InstanceSettings } from 'n8n-core';

import { createOwner } from '@test-integration/db/users';

import { INSIGHTS_DEMO_WORKFLOW_IDS } from '../insights-analyst-seed-data';
import { InsightsAnalystOverviewService } from '../insights-analyst-overview.service';
import { InsightsAnalystSeedService } from '../insights-analyst-seed.service';
import { InsightsService } from '../insights.service';

function expectPopulatedOverview(value: unknown) {
	const overview = insightsAnalystOverviewSchema.parse(value);
	expect(overview.summary.total.value).toBeGreaterThan(0);
	expect(overview.highlights.map((highlight) => highlight.kind).sort()).toEqual([
		'attention',
		'efficiency',
		'impact',
	]);
	expect(overview.chart.every((point) => 'succeeded' in point && 'failed' in point)).toBe(true);
	expect(overview.citationAllowlist.map((row) => row.workflowId)).toEqual(
		expect.arrayContaining(INSIGHTS_DEMO_WORKFLOW_IDS),
	);
	return overview;
}

beforeAll(async () => {
	await testModules.loadModules(['insights']);
	await testDb.init();
});

beforeEach(async () => {
	(
		Container.get(InstanceSettings) as { instanceType: InstanceSettings['instanceType'] }
	).instanceType = 'main';
	await testDb.truncate([
		'InsightsRaw',
		'InsightsByPeriod',
		'InsightsMetadata',
		'SharedWorkflow',
		'WorkflowEntity',
		'ProjectRelation',
		'Project',
		'User',
	]);
	await createOwner();
});

afterEach(() => {
	jest.restoreAllMocks();
});

afterAll(async () => {
	await testDb.terminate();
});

describe('InsightsAnalystOverviewService', () => {
	it('getOverview calls ensureSeeded', async () => {
		const ensureSeeded = jest.spyOn(InsightsAnalystSeedService.prototype, 'ensureSeeded');

		await Container.get(InsightsAnalystOverviewService).getOverview({});

		expect(ensureSeeded).toHaveBeenCalled();
	});

	it('default window is 30 days of daily succeeded and failed points', async () => {
		const service = Container.get(InsightsAnalystOverviewService);
		const overview = expectPopulatedOverview(await service.getOverview({}));
		const week = expectPopulatedOverview(
			await service.getOverview({
				startDate: DateTime.utc().minus({ days: 7 }).toJSDate(),
				endDate: DateTime.utc().toJSDate(),
			}),
		);

		const chartDays = overview.chart
			.map((point) => DateTime.fromISO(point.date).toMillis())
			.sort((left, right) => left - right);
		const spanDays = (chartDays[chartDays.length - 1] - chartDays[0]) / 86_400_000;

		expect(overview.chart.length).toBeGreaterThanOrEqual(20);
		expect(spanDays).toBeGreaterThanOrEqual(20);
		expect(overview.summary.total.value).toBeGreaterThan(week.summary.total.value);
	});

	it('projectId is accepted and ignored', async () => {
		const service = Container.get(InsightsAnalystOverviewService);
		const unrestricted = expectPopulatedOverview(await service.getOverview({}));
		const filtered = expectPopulatedOverview(
			await service.getOverview({ projectId: 'not-the-demo-project' }),
		);

		expect(filtered.summary.total.value).toBe(unrestricted.summary.total.value);
		expect(filtered.citationAllowlist).toEqual(unrestricted.citationAllowlist);
	});

	it('response has five KPIs, three highlights, ranking, low-impact, and citation allowlist', async () => {
		expectPopulatedOverview(await Container.get(InsightsAnalystOverviewService).getOverview({}));
	});

	it('never calls InsightsService.validateDateFiltersLicense', async () => {
		const validateDateFiltersLicense = jest.spyOn(
			InsightsService.prototype,
			'validateDateFiltersLicense',
		);

		await Container.get(InsightsAnalystOverviewService).getOverview({
			startDate: DateTime.utc().minus({ days: 90 }).toJSDate(),
			endDate: DateTime.utc().toJSDate(),
		});

		expect(validateDateFiltersLicense).not.toHaveBeenCalled();
	});
});
