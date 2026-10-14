import { Logger } from '@n8n/backend-common';
import {
	ExecutionRepository,
	ProjectRelationRepository,
	ProjectRepository,
	SharedWorkflowRepository,
	UserRepository,
	WorkflowRepository,
} from '@n8n/db';
import { Service } from '@n8n/di';
import { In, Like } from '@n8n/typeorm';
import { DateTime } from 'luxon';
import { InstanceSettings } from 'n8n-core';

import { InsightsByPeriod } from '../database/entities/insights-by-period';
import { InsightsMetadata } from '../database/entities/insights-metadata';
import type { TypeUnit } from '../database/entities/insights-shared';
import { InsightsByPeriodRepository } from '../database/repositories/insights-by-period.repository';
import { InsightsMetadataRepository } from '../database/repositories/insights-metadata.repository';
import { InsightsRawRepository } from '../database/repositories/insights-raw.repository';
import {
	INSIGHTS_ANALYST_EXECUTION_KEY_PREFIX,
	INSIGHTS_ANALYST_HISTORY_DAYS,
	INSIGHTS_ANALYST_PROJECT_ID,
	INSIGHTS_ANALYST_PROJECT_MARKER,
	INSIGHTS_ANALYST_PROJECT_NAME,
	INSIGHTS_ANALYST_WORKFLOW_ID_PREFIX,
	INSIGHTS_ANALYST_WORKFLOWS,
} from './insights-analyst.constants';
import { analystDayMetrics } from './insights-analyst-seed.data';

const SAVE_CHUNK_SIZE = 200;

@Service()
export class InsightsAnalystSeedService {
	constructor(
		private readonly instanceSettings: InstanceSettings,
		private readonly logger: Logger,
		private readonly projectRepository: ProjectRepository,
		private readonly projectRelationRepository: ProjectRelationRepository,
		private readonly userRepository: UserRepository,
		private readonly workflowRepository: WorkflowRepository,
		private readonly sharedWorkflowRepository: SharedWorkflowRepository,
		private readonly executionRepository: ExecutionRepository,
		private readonly insightsMetadataRepository: InsightsMetadataRepository,
		private readonly insightsByPeriodRepository: InsightsByPeriodRepository,
		private readonly insightsRawRepository: InsightsRawRepository,
	) {
		this.logger = this.logger.scoped('insights');
	}

	async seed(): Promise<void> {
		if (this.instanceSettings.instanceType !== 'main') return;

		const seededAt = DateTime.utc();
		const staleProjectIds = await this.findStaleProjectIds();
		await this.deleteDemoWorkflowData();
		await this.deleteProjects(staleProjectIds);
		await this.upsertProject();
		await this.attachOwner();
		await this.insertWorkflows(seededAt);
		this.logger.info('Insights analyst demo workspace is ready', {
			projectId: INSIGHTS_ANALYST_PROJECT_ID,
		});
	}

	private async findStaleProjectIds(): Promise<string[]> {
		const candidates = await this.projectRepository.find({
			where: [
				{ description: INSIGHTS_ANALYST_PROJECT_MARKER },
				{ name: INSIGHTS_ANALYST_PROJECT_NAME },
			],
		});
		const staleIds: string[] = [];
		for (const project of candidates) {
			if (project.id === INSIGHTS_ANALYST_PROJECT_ID) continue;
			if (project.description === INSIGHTS_ANALYST_PROJECT_MARKER) {
				staleIds.push(project.id);
				continue;
			}
			const shares = await this.sharedWorkflowRepository.find({
				where: { projectId: project.id },
			});
			if (
				shares.some((share) => share.workflowId.startsWith(INSIGHTS_ANALYST_WORKFLOW_ID_PREFIX))
			) {
				staleIds.push(project.id);
			}
		}
		return staleIds;
	}

	private async deleteDemoWorkflowData(): Promise<void> {
		const demoWorkflows = await this.workflowRepository.find({
			select: ['id'],
			where: { id: Like(`${INSIGHTS_ANALYST_WORKFLOW_ID_PREFIX}%`) },
		});
		const workflowIds = demoWorkflows.map((workflow) => workflow.id);
		if (workflowIds.length === 0) return;

		const metadata = await this.insightsMetadataRepository.find({
			select: ['metaId'],
			where: { workflowId: In(workflowIds) },
		});
		const metaIds = metadata.map((row) => row.metaId);
		if (metaIds.length > 0) {
			await this.insightsRawRepository.delete({ metaId: In(metaIds) });
			await this.insightsByPeriodRepository.delete({ metaId: In(metaIds) });
			await this.insightsMetadataRepository.delete({ metaId: In(metaIds) });
		}

		await this.executionRepository.delete({ workflowId: In(workflowIds) });
		await this.executionRepository.delete({
			deduplicationKey: Like(`${INSIGHTS_ANALYST_EXECUTION_KEY_PREFIX}%`),
		});
		await this.sharedWorkflowRepository.delete({ workflowId: In(workflowIds) });
		await this.workflowRepository.delete({ id: In(workflowIds) });
	}

	private async deleteProjects(projectIds: string[]): Promise<void> {
		if (projectIds.length === 0) return;
		await this.sharedWorkflowRepository.delete({ projectId: In(projectIds) });
		await this.projectRelationRepository.delete({ projectId: In(projectIds) });
		await this.projectRepository.delete({ id: In(projectIds) });
	}

	private async upsertProject(): Promise<void> {
		const existing = await this.projectRepository.findOneBy({ id: INSIGHTS_ANALYST_PROJECT_ID });
		if (existing) {
			existing.name = INSIGHTS_ANALYST_PROJECT_NAME;
			existing.description = INSIGHTS_ANALYST_PROJECT_MARKER;
			existing.type = 'team';
			await this.projectRepository.save(existing);
			return;
		}

		await this.projectRepository.save(
			this.projectRepository.create({
				id: INSIGHTS_ANALYST_PROJECT_ID,
				name: INSIGHTS_ANALYST_PROJECT_NAME,
				description: INSIGHTS_ANALYST_PROJECT_MARKER,
				type: 'team',
				icon: null,
			}),
		);
	}

	private async attachOwner(): Promise<void> {
		const owner = await this.userRepository.findOne({
			where: { role: { slug: 'global:owner' } },
		});
		if (!owner) return;

		const existing = await this.projectRelationRepository.findOneBy({
			projectId: INSIGHTS_ANALYST_PROJECT_ID,
			userId: owner.id,
		});
		if (existing) return;

		try {
			await this.projectRelationRepository.save({
				projectId: INSIGHTS_ANALYST_PROJECT_ID,
				userId: owner.id,
				role: { slug: 'project:admin' },
			});
		} catch (error) {
			this.logger.warn('Insights analyst could not attach the instance owner', {
				errorName: error instanceof Error ? error.name : 'unknown',
			});
		}
	}

	private async insertWorkflows(seededAt: DateTime): Promise<void> {
		const periodRows: InsightsByPeriod[] = [];
		const executions = [];

		for (const spec of INSIGHTS_ANALYST_WORKFLOWS) {
			const workflow = await this.workflowRepository.save(
				this.workflowRepository.create({
					id: spec.id,
					name: spec.name,
					active: false,
					isArchived: false,
					nodes: [
						{
							id: `${spec.id}-trigger`,
							name: 'Manual Trigger',
							type: 'n8n-nodes-base.manualTrigger',
							typeVersion: 1,
							position: [0, 0],
							parameters: {},
						},
					],
					connections: {},
					nodeGroups: [],
					settings: { timeSavedPerExecution: spec.timeSavedPerExecution },
					versionId: spec.versionId,
				}),
			);

			await this.sharedWorkflowRepository.save(
				this.sharedWorkflowRepository.create({
					workflowId: workflow.id,
					projectId: INSIGHTS_ANALYST_PROJECT_ID,
					role: 'workflow:owner',
				}),
			);

			const metadata = new InsightsMetadata();
			metadata.workflowId = workflow.id;
			metadata.workflowName = workflow.name;
			metadata.projectId = INSIGHTS_ANALYST_PROJECT_ID;
			metadata.projectName = INSIGHTS_ANALYST_PROJECT_NAME;
			const savedMetadata = await this.insightsMetadataRepository.save(metadata);

			for (let dayIndex = 0; dayIndex < INSIGHTS_ANALYST_HISTORY_DAYS; dayIndex++) {
				const day = analystDayMetrics(spec, dayIndex, seededAt);
				periodRows.push(
					periodRow(savedMetadata.metaId, 'success', day.success, day.periodStart),
					periodRow(savedMetadata.metaId, 'failure', day.failure, day.periodStart),
					periodRow(savedMetadata.metaId, 'runtime_ms', day.runtimeMs, day.periodStart),
					periodRow(savedMetadata.metaId, 'time_saved_min', day.timeSavedMin, day.periodStart),
				);

				const status = day.failure > day.success ? 'error' : 'success';
				const dayKey = DateTime.fromJSDate(day.periodStart, { zone: 'utc' }).toISODate();
				executions.push(
					this.executionRepository.create({
						finished: status === 'success',
						mode: 'manual',
						status,
						createdAt: day.periodStart,
						startedAt: day.periodStart,
						stoppedAt: new Date(day.periodStart.getTime() + spec.runtimeMs),
						workflowId: workflow.id,
						deduplicationKey: `${INSIGHTS_ANALYST_EXECUTION_KEY_PREFIX}${workflow.id}:${dayKey ?? dayIndex}`,
					}),
				);
			}
		}

		await this.saveInChunks(this.insightsByPeriodRepository, periodRows);
		await this.saveInChunks(this.executionRepository, executions);
	}

	private async saveInChunks<Entity>(
		repository: { save: (rows: Entity[]) => Promise<unknown> },
		rows: Entity[],
	): Promise<void> {
		for (let index = 0; index < rows.length; index += SAVE_CHUNK_SIZE) {
			await repository.save(rows.slice(index, index + SAVE_CHUNK_SIZE));
		}
	}
}

function periodRow(
	metaId: number,
	type: TypeUnit,
	value: number,
	periodStart: Date,
): InsightsByPeriod {
	const row = new InsightsByPeriod();
	row.metaId = metaId;
	row.type = type;
	row.value = value;
	row.periodUnit = 'day';
	row.periodStart = periodStart;
	return row;
}
