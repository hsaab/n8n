import {
	createTeamProject,
	createWorkflow,
	getProjectRoleForUser,
	testDb,
	testModules,
} from '@n8n/backend-test-utils';
import { ProjectRepository, SharedWorkflowRepository, WorkflowRepository } from '@n8n/db';
import { Container } from '@n8n/di';
import { DateTime } from 'luxon';
import { InstanceSettings } from 'n8n-core';

import { createCompactedInsightsEvent } from '@/modules/insights/database/entities/__tests__/db-utils';
import { InsightsByPeriodRepository } from '@/modules/insights/database/repositories/insights-by-period.repository';
import { InsightsMetadataRepository } from '@/modules/insights/database/repositories/insights-metadata.repository';
import { InsightsAnalystSeedService } from '@/modules/insights/insights-analyst-seed.service';
import { ProjectService } from '@/services/project.service.ee';

import { createOwner } from '../shared/db/users';

const CANONICAL_PROJECT_ID = 'insights-demo-project';
const PERIOD_TYPES = ['success', 'failure', 'runtime_ms', 'time_saved_min'] as const;

function setInstanceType(instanceType: InstanceSettings['instanceType']) {
	(
		Container.get(InstanceSettings) as { instanceType: InstanceSettings['instanceType'] }
	).instanceType = instanceType;
}

async function ensureSeeded() {
	await Container.get(InsightsAnalystSeedService).ensureSeeded();
}

async function demoWorkflows() {
	const sharings = await Container.get(SharedWorkflowRepository).find({
		where: { projectId: CANONICAL_PROJECT_ID },
		relations: { workflow: true },
	});
	return sharings.map((sharing) => sharing.workflow);
}

beforeAll(async () => {
	await testModules.loadModules(['insights']);
	await testDb.init();
});

beforeEach(async () => {
	setInstanceType('main');
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
});

afterEach(() => {
	jest.restoreAllMocks();
});

afterAll(async () => {
	await testDb.terminate();
});

describe('InsightsAnalystSeedService', () => {
	it('a field engineer starts n8n on a community laptop after owner setup and gets one populated Demo Operations project', async () => {
		const owner = await createOwner();
		const createTeamProjectSpy = jest.spyOn(ProjectService.prototype, 'createTeamProject');

		await ensureSeeded();

		const teamProjects = await Container.get(ProjectRepository).find({ where: { type: 'team' } });
		expect(teamProjects).toHaveLength(1);
		expect(teamProjects[0]).toMatchObject({
			id: CANONICAL_PROJECT_ID,
			name: 'Demo Operations',
		});
		expect(createTeamProjectSpy).not.toHaveBeenCalled();
		expect(await getProjectRoleForUser(CANONICAL_PROJECT_ID, owner.id)).toBe('project:admin');

		const workflows = await demoWorkflows();
		expect(workflows).toHaveLength(8);
		expect(new Set(workflows.map((workflow) => workflow.id)).size).toBe(8);
		expect(new Set(workflows.map((workflow) => workflow.name)).size).toBe(8);
		for (const workflow of workflows) {
			expect(workflow.settings?.timeSavedPerExecution).toBeGreaterThan(0);
		}

		const metadata = await Container.get(InsightsMetadataRepository).findBy({
			projectId: CANONICAL_PROJECT_ID,
		});
		expect(metadata).toHaveLength(8);

		const periods = await Container.get(InsightsByPeriodRepository).findBy({
			metaId: metadata[0].metaId,
		});
		expect(periods.length).toBeGreaterThan(0);
		expect(new Set(periods.map((row) => row.type))).toEqual(new Set(PERIOD_TYPES));
		expect(periods.every((row) => row.periodUnit === 'day')).toBe(true);
	});

	it('restarting or concurrent overview requests do not duplicate projects, names, metadata, or daily rows', async () => {
		await createOwner();
		await ensureSeeded();

		const otherProject = await createTeamProject('Live Operations');
		const otherWorkflow = await createWorkflow({ name: 'Live operations workflow' }, otherProject);
		await createCompactedInsightsEvent(otherWorkflow, {
			type: 'success',
			value: 424242,
			periodUnit: 'day',
			periodStart: DateTime.utc().minus({ days: 2 }),
		});

		const [canonicalWorkflow] = await demoWorkflows();
		await createCompactedInsightsEvent(canonicalWorkflow, {
			type: 'success',
			value: 900001,
			periodUnit: 'day',
			periodStart: DateTime.utc().minus({ years: 2 }),
		});

		const firstIds = (await demoWorkflows()).map((workflow) => workflow.id).sort();

		await Promise.all([ensureSeeded(), ensureSeeded()]);
		await ensureSeeded();

		expect(await Container.get(ProjectRepository).count({ where: { type: 'team' } })).toBe(2);
		const workflows = await demoWorkflows();
		expect(workflows).toHaveLength(8);
		expect(workflows.map((workflow) => workflow.id).sort()).toEqual(firstIds);
		expect(new Set(workflows.map((workflow) => workflow.name)).size).toBe(8);
		expect(await Container.get(InsightsMetadataRepository).count()).toBe(9);
		expect(
			await Container.get(InsightsByPeriodRepository).findOneBy({ value: 424242 }),
		).not.toBeNull();
		expect(await Container.get(InsightsByPeriodRepository).findOneBy({ value: 900001 })).toBeNull();
	});

	it('startup before owner setup stays retryable (latch unset)', async () => {
		await ensureSeeded();
		expect(
			await Container.get(ProjectRepository).findOneBy({ id: CANONICAL_PROJECT_ID }),
		).toBeNull();

		await createOwner();
		await ensureSeeded();
		expect(
			await Container.get(ProjectRepository).findOneBy({ id: CANONICAL_PROJECT_ID }),
		).toMatchObject({
			name: 'Demo Operations',
		});
	});

	it('a webhook instance never seeds even when ensureSeeded is called directly', async () => {
		await createOwner();
		setInstanceType('webhook');

		await ensureSeeded();

		expect(
			await Container.get(ProjectRepository).findOneBy({ id: CANONICAL_PROJECT_ID }),
		).toBeNull();
		expect(await Container.get(WorkflowRepository).count()).toBe(0);
		expect(await Container.get(InsightsMetadataRepository).count()).toBe(0);
		expect(await Container.get(InsightsByPeriodRepository).count()).toBe(0);
	});

	it('stale noncanonical demo projects identified by reserved relationships are deleted; arbitrary projects that only share the display name are not', async () => {
		await createOwner();
		await ensureSeeded();

		const [reserved] = await demoWorkflows();
		const stale = await createTeamProject('Legacy Insights Demo');
		const sharedWorkflowRepository = Container.get(SharedWorkflowRepository);
		const sharing = await sharedWorkflowRepository.findOneByOrFail({
			workflowId: reserved.id,
			projectId: CANONICAL_PROJECT_ID,
		});
		await sharedWorkflowRepository.delete({
			workflowId: reserved.id,
			projectId: CANONICAL_PROJECT_ID,
		});
		await sharedWorkflowRepository.save(
			sharedWorkflowRepository.create({
				workflowId: reserved.id,
				projectId: stale.id,
				role: sharing.role,
			}),
		);

		const decoy = await createTeamProject('Demo Operations');
		await createWorkflow({ name: 'Customer owned Demo Operations workflow' }, decoy);

		await ensureSeeded();

		expect(await Container.get(ProjectRepository).findOneBy({ id: stale.id })).toBeNull();
		expect(await Container.get(ProjectRepository).findOneBy({ id: decoy.id })).not.toBeNull();
		expect(
			await Container.get(SharedWorkflowRepository).findOneBy({
				workflowId: reserved.id,
				projectId: CANONICAL_PROJECT_ID,
			}),
		).not.toBeNull();
	});
});
