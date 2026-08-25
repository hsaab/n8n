import { Logger } from '@n8n/backend-common';
import type { User } from '@n8n/db';
import {
	ExecutionRepository,
	GLOBAL_OWNER_ROLE,
	ProjectRepository,
	UserRepository,
	WorkflowEntity,
	WorkflowRepository,
} from '@n8n/db';
import { Service } from '@n8n/di';
import { In, Like } from '@n8n/typeorm';
import { DateTime } from 'luxon';

import { OwnershipService } from '@/services/ownership.service';
import { ProjectService } from '@/services/project.service.ee';
import { WorkflowCreationService } from '@/workflows/workflow-creation.service';

import { InsightsByPeriod } from './database/entities/insights-by-period';
import { InsightsMetadata } from './database/entities/insights-metadata';
import type { TypeUnit } from './database/entities/insights-shared';
import { InsightsByPeriodRepository } from './database/repositories/insights-by-period.repository';
import { InsightsMetadataRepository } from './database/repositories/insights-metadata.repository';
import {
	INSIGHTS_DEMO_PERIOD_TYPES,
	INSIGHTS_DEMO_PROJECT_ID,
	INSIGHTS_DEMO_PROJECT_NAME,
	INSIGHTS_DEMO_SEED_DAYS,
	INSIGHTS_DEMO_WORKFLOW_ID_PREFIX,
	INSIGHTS_DEMO_WORKFLOW_IDS,
	INSIGHTS_DEMO_WORKFLOWS,
	type InsightsDemoWorkflowSpec,
} from './insights-analyst-seed.constants';

const MANUAL_TRIGGER_NODE = {
	id: 'manual-trigger',
	name: 'When clicking ‘Execute workflow’',
	type: 'n8n-nodes-base.manualTrigger',
	typeVersion: 1,
	position: [0, 0] as [number, number],
	parameters: {},
};

@Service()
export class InsightsAnalystSeedService {
	private inFlight: Promise<void> | undefined;

	constructor(
		private readonly ownershipService: OwnershipService,
		private readonly userRepository: UserRepository,
		private readonly projectRepository: ProjectRepository,
		private readonly projectService: ProjectService,
		private readonly workflowCreationService: WorkflowCreationService,
		private readonly workflowRepository: WorkflowRepository,
		private readonly executionRepository: ExecutionRepository,
		private readonly insightsMetadataRepository: InsightsMetadataRepository,
		private readonly insightsByPeriodRepository: InsightsByPeriodRepository,
		private readonly logger: Logger,
	) {
		this.logger = this.logger.scoped('insights');
	}

	async ensureSeeded() {
		this.inFlight ??= this.seedDemoWorkspace();
		try {
			await this.inFlight;
		} finally {
			this.inFlight = undefined;
		}
	}

	private async seedDemoWorkspace() {
		if (!(await this.ownershipService.hasInstanceOwner())) {
			return;
		}

		const owner = await this.userRepository.findOne({
			where: { role: { slug: GLOBAL_OWNER_ROLE.slug } },
			relations: ['role'],
		});
		if (!owner) {
			return;
		}

		await this.removeStaleOwnedProjects();
		await this.ensureDemoProject(owner);
		await this.ensureDemoWorkflows(owner);
		await this.rewriteOwnedInsights();
	}

	/**
	 * Delete leftover seeder-owned Demo Operations projects only.
	 * A customer project with the same name but no insights-demo-* id is left alone.
	 */
	private async removeStaleOwnedProjects() {
		const sameNameProjects = await this.projectRepository.find({
			where: { name: INSIGHTS_DEMO_PROJECT_NAME },
		});

		for (const project of sameNameProjects ?? []) {
			if (
				project.id !== INSIGHTS_DEMO_PROJECT_ID &&
				project.id.startsWith(INSIGHTS_DEMO_WORKFLOW_ID_PREFIX)
			) {
				await this.projectRepository.delete(project.id);
			}
		}
	}

	/**
	 * Community getMaxTeamProjects() is 0, so createTeamProject would throw.
	 * Persist the stable id through ProjectRepository instead.
	 */
	private async ensureDemoProject(owner: User) {
		const existing = await this.projectRepository.findOneBy({ id: INSIGHTS_DEMO_PROJECT_ID });
		if (!existing) {
			await this.projectRepository.save(
				this.projectRepository.create({
					id: INSIGHTS_DEMO_PROJECT_ID,
					name: INSIGHTS_DEMO_PROJECT_NAME,
					type: 'team',
				}),
			);
		}
		await this.projectService.addUser(INSIGHTS_DEMO_PROJECT_ID, {
			userId: owner.id,
			role: 'project:admin',
		});
	}

	private async ensureDemoWorkflows(owner: User) {
		const existing =
			(await this.workflowRepository.find({
				where: { id: Like(`${INSIGHTS_DEMO_WORKFLOW_ID_PREFIX}%`) },
			})) ?? [];
		const existingIds = new Set(existing.map((workflow) => workflow.id));
		const catalogIds = new Set<string>(INSIGHTS_DEMO_WORKFLOW_IDS);

		for (const workflow of existing) {
			if (!catalogIds.has(workflow.id)) {
				await this.workflowRepository.delete(workflow.id);
			}
		}

		for (const spec of INSIGHTS_DEMO_WORKFLOWS) {
			if (existingIds.has(spec.id)) {
				continue;
			}

			const workflow = new WorkflowEntity();
			workflow.id = spec.id;
			workflow.name = spec.name;
			workflow.active = false;
			workflow.isArchived = false;
			workflow.nodes = [MANUAL_TRIGGER_NODE];
			workflow.connections = {};
			workflow.nodeGroups = [];
			workflow.settings = {
				executionOrder: 'v1',
				timeSavedPerExecution: spec.timeSavedPerExecution,
			};

			await this.workflowCreationService.createWorkflow(owner, workflow, {
				projectId: INSIGHTS_DEMO_PROJECT_ID,
			});
		}
	}

	/**
	 * Collection only listens to workflowExecuteAfter, so historical ExecutionEntity
	 * rows never become Insights. Period rows have to be written directly.
	 */
	private async rewriteOwnedInsights() {
		await this.executionRepository.delete({
			workflowId: In([...INSIGHTS_DEMO_WORKFLOW_IDS]),
		});

		const existingMetadata =
			(await this.insightsMetadataRepository.find({
				where: { projectId: INSIGHTS_DEMO_PROJECT_ID },
			})) ?? [];
		const metaIds = existingMetadata
			.map((row) => row.metaId)
			.filter((metaId): metaId is number => typeof metaId === 'number');
		if (metaIds.length > 0) {
			await this.insightsByPeriodRepository.delete({ metaId: In(metaIds) });
		}
		await this.insightsMetadataRepository.delete({ projectId: INSIGHTS_DEMO_PROJECT_ID });

		const savedMetadata = await this.saveMetadata();
		const days = this.seedDays();

		await this.executionRepository.save(this.buildExecutions(days));
		await this.insightsByPeriodRepository.save(this.buildPeriodRows(savedMetadata, days));

		this.logger.info('Seeded Insights analyst demo workspace', {
			projectId: INSIGHTS_DEMO_PROJECT_ID,
			workflowCount: INSIGHTS_DEMO_WORKFLOWS.length,
			days: INSIGHTS_DEMO_SEED_DAYS,
		});
	}

	private async saveMetadata() {
		const metadataRows = INSIGHTS_DEMO_WORKFLOWS.map((spec, index) => {
			const metadata = new InsightsMetadata();
			metadata.metaId = index + 1;
			metadata.workflowId = spec.id;
			metadata.workflowName = spec.name;
			metadata.projectId = INSIGHTS_DEMO_PROJECT_ID;
			metadata.projectName = INSIGHTS_DEMO_PROJECT_NAME;
			return metadata;
		});

		const saved = await this.insightsMetadataRepository.save(metadataRows);
		return Array.isArray(saved) ? saved : [saved];
	}

	private seedDays() {
		const today = DateTime.utc().startOf('day');
		return Array.from({ length: INSIGHTS_DEMO_SEED_DAYS }, (_, offset) =>
			today.minus({ days: offset }),
		);
	}

	private buildExecutions(days: DateTime[]) {
		return days.flatMap((day, dayOffset) =>
			INSIGHTS_DEMO_WORKFLOWS.map((spec, workflowIndex) => {
				const { failure } = this.dailyCounts(spec, workflowIndex, dayOffset);
				const startedAt = day.plus({ hours: 9, minutes: workflowIndex }).toJSDate();
				const failed = failure > 0 && dayOffset % 3 === workflowIndex % 3;

				return {
					workflowId: spec.id,
					finished: true,
					mode: 'trigger' as const,
					status: failed ? ('error' as const) : ('success' as const),
					createdAt: startedAt,
					startedAt,
					stoppedAt: day.plus({ hours: 9, minutes: workflowIndex, seconds: 12 }).toJSDate(),
					storedAt: 'db' as const,
				};
			}),
		);
	}

	private buildPeriodRows(metadataRows: InsightsMetadata[], days: DateTime[]) {
		const metadataByWorkflowId = new Map(metadataRows.map((row) => [row.workflowId, row] as const));

		return days.flatMap((day, dayOffset) =>
			INSIGHTS_DEMO_WORKFLOWS.flatMap((spec, workflowIndex) => {
				const metadata = metadataByWorkflowId.get(spec.id);
				if (!metadata) {
					return [];
				}

				const counts = this.dailyCounts(spec, workflowIndex, dayOffset);
				const values: Record<TypeUnit, number> = {
					success: counts.success,
					failure: counts.failure,
					runtime_ms: counts.runtimeMs,
					time_saved_min: counts.timeSavedMin,
				};

				return INSIGHTS_DEMO_PERIOD_TYPES.map((type) => {
					const row = new InsightsByPeriod();
					row.metaId = metadata.metaId;
					row.type = type;
					row.value = values[type];
					row.periodUnit = 'day';
					row.periodStart = day.toJSDate();
					return row;
				});
			}),
		);
	}

	private dailyCounts(spec: InsightsDemoWorkflowSpec, workflowIndex: number, dayOffset: number) {
		const success = 6 + ((workflowIndex * 3 + dayOffset) % 12);
		const failure = (workflowIndex + dayOffset) % 4;
		return {
			success,
			failure,
			runtimeMs: success * spec.avgRuntimeMs,
			timeSavedMin: success * spec.timeSavedPerExecution,
		};
	}
}
