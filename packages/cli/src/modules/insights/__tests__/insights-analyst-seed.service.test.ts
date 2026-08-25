import { mockLogger } from '@n8n/backend-test-utils';
import type {
	User,
	WorkflowEntity,
	ExecutionRepository,
	ProjectRepository,
	UserRepository,
	WorkflowRepository,
} from '@n8n/db';
import { GLOBAL_OWNER_ROLE } from '@n8n/db';
import { mock } from 'jest-mock-extended';
import { DateTime } from 'luxon';

import type { OwnershipService } from '@/services/ownership.service';
import type { ProjectService } from '@/services/project.service.ee';
import { TeamProjectOverQuotaError } from '@/services/project.service.ee';
import type { WorkflowCreationService } from '@/workflows/workflow-creation.service';

import { NumberToPeriodUnit, NumberToType } from '../database/entities/insights-shared';
import type { InsightsByPeriodRepository } from '../database/repositories/insights-by-period.repository';
import type { InsightsMetadataRepository } from '../database/repositories/insights-metadata.repository';
import { InsightsAnalystSeedService } from '../insights-analyst-seed.service';

const DEMO_PROJECT_ID = 'insights-demo-project';
const DEMO_PROJECT_NAME = 'Demo Operations';
const CUSTOMER_PROJECT_ID = 'ops-customer-project';

type RecordRow = Record<string, unknown> & { id?: string };

function isFindOperator(value: unknown): value is { _type: string; _value: unknown } {
	return typeof value === 'object' && value !== null && '_type' in value && '_value' in value;
}

function matchesWhere(record: RecordRow, where?: Record<string, unknown>) {
	if (!where) return true;

	return Object.entries(where).every(([key, expected]) => {
		const actual = record[key];
		if (isFindOperator(expected)) {
			if (expected._type === 'like' && typeof expected._value === 'string') {
				const pattern = expected._value.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*');
				return new RegExp(`^${pattern}$`).test(String(actual ?? ''));
			}
			if (expected._type === 'in' && Array.isArray(expected._value)) {
				return expected._value.includes(actual);
			}
		}
		return actual === expected;
	});
}

function installRecordStore(
	repo: {
		create: jest.Mock;
		save: jest.Mock;
		insert: jest.Mock;
		find: jest.Mock;
		findOne: jest.Mock;
		findOneBy: jest.Mock;
		delete: jest.Mock;
		remove: jest.Mock;
	},
	initial: RecordRow[] = [],
) {
	const records = [...initial];

	const persist = async (entity: RecordRow | RecordRow[]) => {
		for (const row of Array.isArray(entity) ? entity : [entity]) {
			const idx = row.id ? records.findIndex((existing) => existing.id === row.id) : -1;
			if (idx === -1) records.push(row);
			else records[idx] = { ...records[idx], ...row };
		}
		return entity;
	};

	repo.create.mockImplementation((data: RecordRow) => data);
	repo.save.mockImplementation(persist);
	repo.insert.mockImplementation(persist);
	repo.find.mockImplementation(async (options?: { where?: Record<string, unknown> }) =>
		records.filter((row) => matchesWhere(row, options?.where)),
	);
	repo.findOne.mockImplementation(async (options?: { where?: Record<string, unknown> }) =>
		records.find((row) => matchesWhere(row, options?.where)),
	);
	repo.findOneBy.mockImplementation(
		async (where?: Record<string, unknown>) =>
			records.find((row) => matchesWhere(row, where)) ?? null,
	);
	repo.delete.mockImplementation(async (criteria: string | Record<string, unknown>) => {
		const where = typeof criteria === 'string' ? { id: criteria } : criteria;
		for (let index = records.length - 1; index >= 0; index--) {
			if (matchesWhere(records[index], where)) records.splice(index, 1);
		}
		return { affected: 1 };
	});
	repo.remove.mockImplementation(async (entity: RecordRow | RecordRow[]) => {
		for (const row of Array.isArray(entity) ? entity : [entity]) {
			const idx = records.findIndex((existing) => existing.id === row.id);
			if (idx !== -1) records.splice(idx, 1);
		}
		return entity;
	});

	return records;
}

function collectWrites<T>(
	repo: { create: jest.Mock; save: jest.Mock; insert: jest.Mock },
	sink: T[],
) {
	repo.create.mockImplementation((data: T) => data);
	const persist = async (entity: T | T[]) => {
		sink.push(...(Array.isArray(entity) ? entity : [entity]));
		return entity;
	};
	repo.save.mockImplementation(persist);
	repo.insert.mockImplementation(persist);
}

function toUtcDateKey(value: unknown): string | undefined {
	if (!value) return undefined;
	if (DateTime.isDateTime(value)) return value.toUTC().toISODate() ?? undefined;
	const date = value instanceof Date ? value : new Date(String(value));
	if (Number.isNaN(date.getTime())) return undefined;
	return DateTime.fromJSDate(date, { zone: 'utc' }).toISODate() ?? undefined;
}

function periodUnitOf(row: Record<string, unknown>) {
	const value = row.periodUnit ?? row.periodUnit_;
	if (value === 'day' || value === 1) return 'day';
	if (typeof value === 'number') return NumberToPeriodUnit[value as 0 | 1 | 2];
	return value;
}

function periodTypeOf(row: Record<string, unknown>) {
	const value = row.type ?? row.type_;
	if (typeof value === 'number') return NumberToType[value as 0 | 1 | 2 | 3];
	return value;
}

describe('InsightsAnalystSeedService', () => {
	const owner = mock<User>({
		id: 'instance-owner-id',
		role: GLOBAL_OWNER_ROLE,
	});

	const ownershipService = mock<OwnershipService>();
	const userRepository = mock<UserRepository>();
	const projectRepository = mock<ProjectRepository>();
	const projectService = mock<ProjectService>();
	const workflowCreationService = mock<WorkflowCreationService>();
	const workflowRepository = mock<WorkflowRepository>();
	const executionRepository = mock<ExecutionRepository>();
	const insightsMetadataRepository = mock<InsightsMetadataRepository>();
	const insightsByPeriodRepository = mock<InsightsByPeriodRepository>();
	const logger = mockLogger();

	const createdWorkflows: WorkflowEntity[] = [];
	const executions: Array<Record<string, unknown>> = [];
	const metadataRows: Array<Record<string, unknown>> = [];
	const periodRows: Array<Record<string, unknown>> = [];
	let projects: RecordRow[] = [];

	const buildSeeder = () =>
		new InsightsAnalystSeedService(
			ownershipService,
			userRepository,
			projectRepository,
			projectService,
			workflowCreationService,
			workflowRepository,
			executionRepository,
			insightsMetadataRepository,
			insightsByPeriodRepository,
			logger,
		);

	beforeEach(() => {
		jest.clearAllMocks();
		createdWorkflows.length = 0;
		executions.length = 0;
		metadataRows.length = 0;
		periodRows.length = 0;

		ownershipService.hasInstanceOwner.mockResolvedValue(true);
		ownershipService.getInstanceOwner.mockRejectedValue(
			new Error('getInstanceOwner uses findOneOrFail'),
		);
		userRepository.findOne.mockResolvedValue(owner);
		userRepository.findOneBy.mockResolvedValue(owner);
		userRepository.findOneOrFail.mockRejectedValue(new Error('findOneOrFail is not allowed'));

		projectService.createTeamProject.mockImplementation(async () => {
			throw new TeamProjectOverQuotaError(0);
		});
		projectService.addUser.mockResolvedValue(mock());

		projects = installRecordStore(projectRepository);
		installRecordStore(workflowRepository);
		collectWrites(executionRepository, executions);
		collectWrites(insightsMetadataRepository, metadataRows);
		collectWrites(insightsByPeriodRepository, periodRows);

		workflowCreationService.createWorkflow.mockImplementation(async (_user, workflow) => {
			createdWorkflows.push(workflow);
			return workflow;
		});
	});

	function createdWorkflowIds() {
		return createdWorkflows.map((workflow) => workflow.id);
	}

	function uniqueExecutionDays() {
		return new Set(
			executions.map((row) => toUtcDateKey(row.startedAt ?? row.createdAt)).filter(Boolean),
		);
	}

	function uniquePeriodDays() {
		return new Set(periodRows.map((row) => toUtcDateKey(row.periodStart)).filter(Boolean));
	}

	it('first start with an owner writes the full demo set', async () => {
		await buildSeeder().ensureSeeded();

		expect(ownershipService.hasInstanceOwner).toHaveBeenCalled();
		expect(ownershipService.getInstanceOwner).not.toHaveBeenCalled();
		expect(userRepository.findOneOrFail).not.toHaveBeenCalled();
		expect(userRepository.findOne).toHaveBeenCalledWith({
			where: { role: { slug: GLOBAL_OWNER_ROLE.slug } },
			relations: ['role'],
		});
		expect(projectService.createTeamProject).not.toHaveBeenCalled();

		expect(projects).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: DEMO_PROJECT_ID,
					name: DEMO_PROJECT_NAME,
					type: 'team',
				}),
			]),
		);
		expect(
			projectService.addUser.mock.calls.some(
				([projectId, relation]) =>
					projectId === DEMO_PROJECT_ID &&
					relation.userId === owner.id &&
					relation.role === 'project:admin',
			),
		).toBe(true);

		expect(createdWorkflows).toHaveLength(8);
		expect(new Set(createdWorkflowIds()).size).toBe(8);
		for (const [user, workflow, options] of workflowCreationService.createWorkflow.mock.calls) {
			expect(user).toBe(owner);
			expect(workflow.id).toMatch(/^insights-demo-/);
			expect(workflow.name.length).toBeGreaterThan(3);
			expect(workflow.settings?.timeSavedPerExecution).toBeGreaterThan(0);
			expect(options?.projectId).toBe(DEMO_PROJECT_ID);
		}

		expect(uniqueExecutionDays().size).toBe(30);
		expect(executions.length).toBeGreaterThanOrEqual(30);
		expect(metadataRows).toHaveLength(8);
		expect(metadataRows.every((row) => row.projectId === DEMO_PROJECT_ID)).toBe(true);

		expect(periodRows.every((row) => periodUnitOf(row) === 'day')).toBe(true);
		expect(uniquePeriodDays().size).toBe(30);
		expect(new Set(periodRows.map((row) => periodTypeOf(row)))).toEqual(
			new Set(['success', 'failure', 'runtime_ms', 'time_saved_min']),
		);
	});

	it('second start keeps the same ids and counts', async () => {
		const seeder = buildSeeder();
		await seeder.ensureSeeded();

		const firstWorkflowIds = [...new Set(createdWorkflowIds())].sort();
		const firstExecutionDays = uniqueExecutionDays().size;
		const firstPeriodDays = uniquePeriodDays().size;
		const firstPeriodTypes = new Set(periodRows.map((row) => periodTypeOf(row)));

		await seeder.ensureSeeded();

		expect(projects.filter((project) => project.id === DEMO_PROJECT_ID)).toHaveLength(1);
		expect([...new Set(createdWorkflowIds())].sort()).toEqual(firstWorkflowIds);
		expect(new Set(createdWorkflowIds()).size).toBe(8);
		expect(uniqueExecutionDays().size).toBe(firstExecutionDays);
		expect(uniquePeriodDays().size).toBe(firstPeriodDays);
		expect(new Set(periodRows.map((row) => periodTypeOf(row)))).toEqual(firstPeriodTypes);
	});

	it('a customer Demo Operations project without the insights-demo marker is untouched', async () => {
		projects.push({
			id: CUSTOMER_PROJECT_ID,
			name: DEMO_PROJECT_NAME,
			type: 'team',
		});

		await buildSeeder().ensureSeeded();

		expect(projects.some((project) => project.id === CUSTOMER_PROJECT_ID)).toBe(true);
		expect(projects.some((project) => project.id === DEMO_PROJECT_ID)).toBe(true);
		expect(projectRepository.delete).not.toHaveBeenCalledWith(CUSTOMER_PROJECT_ID);
		expect(projectRepository.delete).not.toHaveBeenCalledWith(
			expect.objectContaining({ id: CUSTOMER_PROJECT_ID }),
		);
	});

	it('init before owner setup is a no-op', async () => {
		ownershipService.hasInstanceOwner.mockResolvedValue(false);
		userRepository.findOne.mockResolvedValue(null);
		userRepository.findOneBy.mockResolvedValue(null);

		await expect(buildSeeder().ensureSeeded()).resolves.toBeUndefined();

		expect(ownershipService.hasInstanceOwner).toHaveBeenCalled();
		expect(ownershipService.getInstanceOwner).not.toHaveBeenCalled();
		expect(userRepository.findOneOrFail).not.toHaveBeenCalled();
		expect(projectService.createTeamProject).not.toHaveBeenCalled();
		expect(projectRepository.save).not.toHaveBeenCalled();
		expect(workflowCreationService.createWorkflow).not.toHaveBeenCalled();
		expect(executionRepository.save).not.toHaveBeenCalled();
		expect(insightsByPeriodRepository.save).not.toHaveBeenCalled();
	});

	it('seed works when getMaxTeamProjects is 0', async () => {
		await expect(buildSeeder().ensureSeeded()).resolves.toBeUndefined();

		expect(projectService.createTeamProject).not.toHaveBeenCalled();
		expect(projects).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: DEMO_PROJECT_ID,
					name: DEMO_PROJECT_NAME,
					type: 'team',
				}),
			]),
		);
	});
});
