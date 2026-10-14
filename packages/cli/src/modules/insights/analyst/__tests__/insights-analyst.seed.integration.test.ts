import { createTeamProject, testDb, testModules } from '@n8n/backend-test-utils';
import { ProjectRepository, WorkflowRepository } from '@n8n/db';
import { Container } from '@n8n/di';
import { In } from '@n8n/typeorm';

import { InsightsByPeriodRepository } from '../../database/repositories/insights-by-period.repository';
import {
	DEMO_PROJECT_ID,
	DEMO_PROJECT_NAME,
	DEMO_WORKFLOW_IDS,
} from '../insights-analyst.constants';
import { InsightsAnalystSeed } from '../insights-analyst.seed';

describe('InsightsAnalystSeed', () => {
	jest.setTimeout(60_000);
	beforeAll(async () => {
		await testModules.loadModules(['insights']);
		await testDb.init();
	});

	beforeEach(async () => {
		await testDb.truncate([
			'ExecutionEntity',
			'InsightsByPeriod',
			'InsightsMetadata',
			'SharedWorkflow',
			'WorkflowEntity',
			'ProjectRelation',
			'Project',
		]);
	});

	afterAll(async () => {
		await testDb.terminate();
	});

	it('keeps one demo project and the same aggregate rows when run twice', async () => {
		const seed = Container.get(InsightsAnalystSeed);
		const projectRepository = Container.get(ProjectRepository);
		const workflowRepository = Container.get(WorkflowRepository);
		const periodRepository = Container.get(InsightsByPeriodRepository);

		await seed.run();

		const project = await projectRepository.findOneBy({ id: DEMO_PROJECT_ID });
		expect(project?.name).toBe(DEMO_PROJECT_NAME);
		expect(await workflowRepository.count({ where: { id: In(DEMO_WORKFLOW_IDS) } })).toBe(8);
		const periodCount = await periodRepository.count();
		expect(periodCount).toBeGreaterThan(0);

		await createTeamProject(DEMO_PROJECT_NAME);
		await seed.run();

		expect(await projectRepository.count({ where: { name: DEMO_PROJECT_NAME } })).toBe(1);
		expect(await projectRepository.findOneBy({ id: DEMO_PROJECT_ID })).toBeTruthy();
		expect(await periodRepository.count()).toBe(periodCount);
		expect(await workflowRepository.count({ where: { id: In(DEMO_WORKFLOW_IDS) } })).toBe(8);
	});
});
