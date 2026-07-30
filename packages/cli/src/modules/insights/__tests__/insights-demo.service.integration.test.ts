import { insightsAnalystOverviewSchema } from '@n8n/api-types';
import { createTeamProject, testDb, testModules } from '@n8n/backend-test-utils';
import { ProjectRepository, WorkflowRepository } from '@n8n/db';
import { Container } from '@n8n/di';
import { DateTime } from 'luxon';

import {
	INSIGHTS_ANALYST_DEMO_PROJECT_ID,
	INSIGHTS_ANALYST_DEMO_PROJECT_NAME,
	INSIGHTS_ANALYST_DEMO_WORKFLOWS,
} from '../insights-demo.data';
import { InsightsDemoService } from '../insights-demo.service';
import { InsightsService } from '../insights.service';

describe('InsightsDemoService (Integration)', () => {
	beforeAll(async () => {
		await testModules.loadModules(['insights']);
		await testDb.init();
	});

	afterAll(async () => {
		await testDb.terminate();
	});

	beforeEach(async () => {
		await testDb.truncate([
			'InsightsByPeriod',
			'InsightsMetadata',
			'InsightsRaw',
			'ExecutionData',
			'ExecutionEntity',
			'SharedWorkflow',
			'WorkflowEntity',
			'ProjectRelation',
			'Project',
		]);
	});

	test('after seed, overview returns populated Demo Operations InsightsAnalystOverview', async () => {
		const service = Container.get(InsightsDemoService);

		await service.seed();
		const overview = await service.getOverview();

		const parsed = insightsAnalystOverviewSchema.safeParse(overview);
		expect(parsed.success).toBe(true);

		expect(overview.project).toEqual({
			id: INSIGHTS_ANALYST_DEMO_PROJECT_ID,
			name: INSIGHTS_ANALYST_DEMO_PROJECT_NAME,
		});
		expect(overview.summary.total.value).toBeGreaterThan(0);
		expect(overview.summary.timeSaved.value).toBeGreaterThan(0);
		expect(overview.byTime.length).toBeGreaterThan(0);
		expect(overview.byWorkflow.count).toBe(INSIGHTS_ANALYST_DEMO_WORKFLOWS.length);
		expect(overview.byWorkflow.data).toHaveLength(INSIGHTS_ANALYST_DEMO_WORKFLOWS.length);
		expect(overview.highlights.length).toBeGreaterThan(0);
		expect(overview.suggestedPrompts.length).toBeGreaterThan(0);
		expect(overview.dateRange.startDate).toEqual(expect.any(String));
		expect(overview.dateRange.endDate).toEqual(expect.any(String));
	});

	test('running seed twice does not duplicate Demo Operations and cleans stale duplicates', async () => {
		const staleProject = await createTeamProject(INSIGHTS_ANALYST_DEMO_PROJECT_NAME);
		expect(staleProject.id).not.toBe(INSIGHTS_ANALYST_DEMO_PROJECT_ID);

		const service = Container.get(InsightsDemoService);

		await service.seed();
		const afterFirstSeed = {
			projects: await Container.get(ProjectRepository).count({
				where: { name: INSIGHTS_ANALYST_DEMO_PROJECT_NAME },
			}),
			workflows: await Container.get(WorkflowRepository).count(),
		};

		await service.seed();
		const afterSecondSeed = {
			projects: await Container.get(ProjectRepository).count({
				where: { name: INSIGHTS_ANALYST_DEMO_PROJECT_NAME },
			}),
			workflows: await Container.get(WorkflowRepository).count(),
		};

		expect(afterFirstSeed).toEqual(afterSecondSeed);
		expect(afterSecondSeed.projects).toBe(1);
		expect(afterSecondSeed.workflows).toBe(INSIGHTS_ANALYST_DEMO_WORKFLOWS.length);

		const project = await Container.get(ProjectRepository).findOneByOrFail({
			id: INSIGHTS_ANALYST_DEMO_PROJECT_ID,
		});
		expect(project.name).toBe(INSIGHTS_ANALYST_DEMO_PROJECT_NAME);

		const staleStillPresent = await Container.get(ProjectRepository).findOneBy({
			id: staleProject.id,
		});
		expect(staleStillPresent).toBeNull();
	});

	test('production Insights summary path sees seeded aggregates for demo workflows', async () => {
		const demoService = Container.get(InsightsDemoService);
		const insightsService = Container.get(InsightsService);

		await demoService.seed();

		const endDate = DateTime.utc().toJSDate();
		const startDate = DateTime.utc().minus({ days: 30 }).startOf('day').toJSDate();
		const summary = await insightsService.getInsightsSummary({
			startDate,
			endDate,
			projectId: INSIGHTS_ANALYST_DEMO_PROJECT_ID,
		});

		expect(summary.total.value).toBeGreaterThan(0);
		expect(summary.timeSaved.value).toBeGreaterThan(0);
	});
});
