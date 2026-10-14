import { Logger } from '@n8n/backend-common';
import {
	ExecutionRepository,
	GLOBAL_OWNER_ROLE,
	ProjectRelationRepository,
	ProjectRepository,
	SharedWorkflowRepository,
	UserRepository,
	WorkflowRepository,
} from '@n8n/db';
import { Service } from '@n8n/di';
import { In } from '@n8n/typeorm';
import { DateTime } from 'luxon';

import { InsightsByPeriod } from '../database/entities/insights-by-period';
import { InsightsMetadata } from '../database/entities/insights-metadata';
import type { TypeUnit } from '../database/entities/insights-shared';
import { InsightsByPeriodRepository } from '../database/repositories/insights-by-period.repository';
import { InsightsMetadataRepository } from '../database/repositories/insights-metadata.repository';
import {
	DEMO_AGGREGATE_DAYS,
	DEMO_EXECUTION_DAYS,
	DEMO_PROJECT_ID,
	DEMO_PROJECT_NAME,
	DEMO_WORKFLOW_IDS,
	DEMO_WORKFLOWS,
	type DemoWorkflowSpec,
} from './insights-analyst.constants';

const SAVE_CHUNK = 200;

@Service()
export class InsightsAnalystSeed {
	constructor(
		private readonly logger: Logger,
		private readonly projectRepository: ProjectRepository,
		private readonly projectRelationRepository: ProjectRelationRepository,
		private readonly workflowRepository: WorkflowRepository,
		private readonly sharedWorkflowRepository: SharedWorkflowRepository,
		private readonly executionRepository: ExecutionRepository,
		private readonly userRepository: UserRepository,
		private readonly insightsMetadataRepository: InsightsMetadataRepository,
		private readonly insightsByPeriodRepository: InsightsByPeriodRepository,
	) {
		this.logger = this.logger.scoped('insights');
	}

	async run(): Promise<void> {
		await this.ensureProject();
		await this.ensureWorkflows();
		await this.ensureOwnerRelation();
		await this.replaceInsights();
		await this.replaceExecutions();
		this.logger.info('Insights analyst demo data is ready', { projectId: DEMO_PROJECT_ID });
	}

	private async ensureProject(): Promise<void> {
		const existing = await this.projectRepository.findOneBy({ id: DEMO_PROJECT_ID });
		if (existing) {
			if (existing.name !== DEMO_PROJECT_NAME || existing.type !== 'team') {
				existing.name = DEMO_PROJECT_NAME;
				existing.type = 'team';
				await this.projectRepository.save(existing);
			}
			return;
		}

		await this.projectRepository.save(
			this.projectRepository.create({
				id: DEMO_PROJECT_ID,
				name: DEMO_PROJECT_NAME,
				type: 'team',
				description: 'Seeded workspace for the Insights Analyst demo.',
			}),
		);
	}

	private async ensureWorkflows(): Promise<void> {
		for (const spec of DEMO_WORKFLOWS) {
			const existing = await this.workflowRepository.findOneBy({ id: spec.id });
			if (existing) {
				existing.name = spec.name;
				existing.active = false;
				existing.settings = { timeSavedPerExecution: spec.timeSavedPerExecution };
				await this.workflowRepository.save(existing);
			} else {
				await this.workflowRepository.save(
					this.workflowRepository.create({
						id: spec.id,
						name: spec.name,
						active: false,
						isArchived: false,
						versionId: spec.versionId,
						nodes: [this.scheduleNode(spec)],
						connections: {},
						nodeGroups: [],
						settings: { timeSavedPerExecution: spec.timeSavedPerExecution },
					}),
				);
			}

			const share = await this.sharedWorkflowRepository.findOneBy({
				workflowId: spec.id,
				projectId: DEMO_PROJECT_ID,
			});
			if (!share) {
				await this.sharedWorkflowRepository.save(
					this.sharedWorkflowRepository.create({
						workflowId: spec.id,
						projectId: DEMO_PROJECT_ID,
						role: 'workflow:owner',
					}),
				);
			}
		}
	}

	private scheduleNode(spec: DemoWorkflowSpec) {
		return {
			id: `${spec.id}-trigger`,
			name: 'Schedule Trigger',
			type: 'n8n-nodes-base.scheduleTrigger',
			typeVersion: 1,
			position: [0, 0] as [number, number],
			parameters: {},
		};
	}

	private async ensureOwnerRelation(): Promise<void> {
		const owner = await this.userRepository
			.createQueryBuilder('user')
			.innerJoin('user.role', 'role')
			.where('role.slug = :slug', { slug: GLOBAL_OWNER_ROLE.slug })
			.andWhere('(user.password IS NOT NULL OR user.lastActiveAt IS NOT NULL)')
			.getOne();
		if (!owner) return;

		const relation = await this.projectRelationRepository.findOneBy({
			projectId: DEMO_PROJECT_ID,
			userId: owner.id,
		});
		if (relation) return;

		await this.projectRelationRepository.save(
			this.projectRelationRepository.create({
				projectId: DEMO_PROJECT_ID,
				userId: owner.id,
				role: { slug: 'project:admin' },
			}),
		);
		await this.projectRepository.update({ id: DEMO_PROJECT_ID }, { creatorId: owner.id });
	}

	private async replaceInsights(): Promise<void> {
		await this.deleteInsights(DEMO_WORKFLOW_IDS);
		const today = DateTime.utc().startOf('day');
		const periods: InsightsByPeriod[] = [];

		for (const spec of DEMO_WORKFLOWS) {
			const metadata = new InsightsMetadata();
			metadata.workflowId = spec.id;
			metadata.workflowName = spec.name;
			metadata.projectId = DEMO_PROJECT_ID;
			metadata.projectName = DEMO_PROJECT_NAME;
			const saved = await this.insightsMetadataRepository.save(metadata);

			for (let age = 0; age < DEMO_AGGREGATE_DAYS; age++) {
				const periodStart = today.minus({ days: age });
				const previousWindow = age >= DEMO_EXECUTION_DAYS;
				const success = this.scaledCount(spec.dailySuccess, previousWindow);
				const failure = this.scaledCount(spec.dailyFailure, previousWindow);
				const totals: Array<{ type: TypeUnit; value: number }> = [
					{ type: 'success', value: success },
					{ type: 'failure', value: failure },
					{ type: 'runtime_ms', value: (success + failure) * spec.runtimeMs },
					{ type: 'time_saved_min', value: success * spec.timeSavedPerExecution },
				];
				for (const total of totals) {
					const row = new InsightsByPeriod();
					row.metaId = saved.metaId;
					row.type = total.type;
					row.periodUnit = 'day';
					row.periodStart = periodStart.toJSDate();
					row.value = total.value;
					periods.push(row);
				}
			}
		}

		await this.saveInChunks(periods, async (chunk) => {
			await this.insightsByPeriodRepository.save(chunk);
		});
	}

	private scaledCount(count: number, previousWindow: boolean): number {
		if (!previousWindow) return count;
		if (count === 0) return 0;
		return Math.max(1, Math.round(count * 0.5));
	}

	private async replaceExecutions(): Promise<void> {
		await this.executionRepository.delete({ workflowId: In(DEMO_WORKFLOW_IDS) });
		const today = DateTime.utc().startOf('day');
		const rows: Array<{
			workflowId: string;
			finished: boolean;
			mode: 'trigger';
			status: 'success' | 'error';
			createdAt: Date;
			startedAt: Date;
			stoppedAt: Date;
		}> = [];

		for (const spec of DEMO_WORKFLOWS) {
			for (let age = 0; age < DEMO_EXECUTION_DAYS; age++) {
				const day = today.minus({ days: age });
				this.pushExecutions(rows, spec, day, spec.dailySuccess, 'success');
				this.pushExecutions(rows, spec, day, spec.dailyFailure, 'error');
			}
		}

		await this.saveInChunks(rows, async (chunk) => {
			await this.executionRepository.save(chunk);
		});
	}

	private pushExecutions(
		rows: Array<{
			workflowId: string;
			finished: boolean;
			mode: 'trigger';
			status: 'success' | 'error';
			createdAt: Date;
			startedAt: Date;
			stoppedAt: Date;
		}>,
		spec: DemoWorkflowSpec,
		day: DateTime,
		count: number,
		status: 'success' | 'error',
	): void {
		for (let index = 0; index < count; index++) {
			const startedAt = day.plus({ hours: index % 20, minutes: index }).toJSDate();
			const stoppedAt = day.plus({ hours: index % 20, minutes: index, seconds: 20 }).toJSDate();
			rows.push({
				workflowId: spec.id,
				finished: true,
				mode: 'trigger',
				status,
				createdAt: startedAt,
				startedAt,
				stoppedAt,
			});
		}
	}

	private async deleteInsights(workflowIds: string[]): Promise<void> {
		if (workflowIds.length === 0) return;
		const metadata = await this.insightsMetadataRepository.find({
			where: { workflowId: In(workflowIds) },
		});
		const metaIds = metadata.map((row) => row.metaId);
		if (metaIds.length > 0) {
			await this.insightsByPeriodRepository.delete({ metaId: In(metaIds) });
		}
		await this.insightsMetadataRepository.delete({ workflowId: In(workflowIds) });
	}

	private async saveInChunks<T>(rows: T[], save: (chunk: T[]) => Promise<unknown>): Promise<void> {
		for (let index = 0; index < rows.length; index += SAVE_CHUNK) {
			await save(rows.slice(index, index + SAVE_CHUNK));
		}
	}
}
