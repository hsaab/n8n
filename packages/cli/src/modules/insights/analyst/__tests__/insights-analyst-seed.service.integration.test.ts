import { testDb, testModules } from '@n8n/backend-test-utils';
import { Container } from '@n8n/di';
import { ProjectRepository } from '@n8n/db';
import { WorkflowRepository } from '@n8n/db';

import { InsightsByPeriodRepository } from '../../database/repositories/insights-by-period.repository';
import {
	INSIGHTS_ANALYST_PROJECT_ID,
	INSIGHTS_ANALYST_PROJECT_MARKER,
	INSIGHTS_ANALYST_WORKFLOWS,
} from '../insights-analyst.constants';
import { totalTimeSavedMinutes } from '../insights-analyst-seed.data';
import { InsightsAnalystSeedService } from '../insights-analyst-seed.service';

describe('InsightsAnalystSeedService', () => {
	let seedService: InsightsAnalystSeedService;

	beforeAll(async () => {
		await testModules.loadModules(['insights']);
		await testDb.init();
		seedService = Container.get(InsightsAnalystSeedService);
	});

	beforeEach(async () => {
		await testDb.truncate([
			'InsightsRaw',
			'InsightsByPeriod',
			'InsightsMetadata',
			'ExecutionEntity',
			'SharedWorkflow',
			'WorkflowEntity',
			'ProjectRelation',
			'Project',
		]);
	});

	afterAll(async () => {
		await testDb.terminate();
	});

	it('seeds one demo project and the same totals on a second run', async () => {
		await seedService.seed();
		await Container.get(ProjectRepository).save(
			Container.get(ProjectRepository).create({
				id: 'insights-demo-stale',
				name: 'Demo Operations',
				description: INSIGHTS_ANALYST_PROJECT_MARKER,
				type: 'team',
				icon: null,
			}),
		);

		await seedService.seed();

		const projects = await Container.get(ProjectRepository).find({
			where: { description: INSIGHTS_ANALYST_PROJECT_MARKER },
		});
		const workflows = await Container.get(WorkflowRepository).find();
		const periods = await Container.get(InsightsByPeriodRepository).find();
		const timeSaved = periods
			.filter((row) => row.type === 'time_saved_min')
			.reduce((sum, row) => sum + Number(row.value), 0);

		expect(projects.map((project) => project.id)).toEqual([INSIGHTS_ANALYST_PROJECT_ID]);
		expect(workflows).toHaveLength(INSIGHTS_ANALYST_WORKFLOWS.length);
		expect(timeSaved).toBe(totalTimeSavedMinutes());
	});
});
