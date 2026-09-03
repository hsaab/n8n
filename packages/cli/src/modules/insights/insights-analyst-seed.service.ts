import {
	GLOBAL_OWNER_ROLE,
	Project,
	ProjectRelation,
	ProjectRepository,
	SharedWorkflow,
	UserRepository,
	WorkflowEntity,
} from '@n8n/db';
import { Service } from '@n8n/di';
import { In, Not } from '@n8n/typeorm';
import { DateTime } from 'luxon';
import { InstanceSettings } from 'n8n-core';
import { randomUUID } from 'node:crypto';

import { InsightsByPeriod } from './database/entities/insights-by-period';
import { InsightsMetadata } from './database/entities/insights-metadata';
import type { TypeUnit } from './database/entities/insights-shared';
import {
	INSIGHTS_DEMO_PROJECT_ID,
	INSIGHTS_DEMO_PROJECT_NAME,
	INSIGHTS_DEMO_SEED_DAYS,
	INSIGHTS_DEMO_WORKFLOW_IDS,
	INSIGHTS_DEMO_WORKFLOWS,
} from './insights-analyst-seed-data';

@Service()
export class InsightsAnalystSeedService {
	private seedLock: Promise<void> | undefined;

	constructor(
		private readonly instanceSettings: InstanceSettings,
		private readonly userRepository: UserRepository,
		private readonly projectRepository: ProjectRepository,
	) {}

	async ensureSeeded() {
		if (this.instanceSettings.instanceType !== 'main') {
			return;
		}

		if (this.seedLock) {
			await this.seedLock;
			return;
		}

		this.seedLock = this.seedOnce().finally(() => {
			this.seedLock = undefined;
		});
		await this.seedLock;
	}

	private async seedOnce() {
		const owner = await this.userRepository.findOne({
			where: { role: { slug: GLOBAL_OWNER_ROLE.slug } },
		});
		if (!owner) {
			return;
		}

		await this.projectRepository.manager.transaction(async (trx) => {
			const straySharings = await trx.find(SharedWorkflow, {
				where: {
					workflowId: In(INSIGHTS_DEMO_WORKFLOW_IDS),
					projectId: Not(INSIGHTS_DEMO_PROJECT_ID),
				},
			});
			const staleProjectIds = [...new Set(straySharings.map((sharing) => sharing.projectId))];
			if (straySharings.length > 0) {
				await trx.remove(straySharings);
			}
			if (staleProjectIds.length > 0) {
				await trx.delete(ProjectRelation, { projectId: In(staleProjectIds) });
				await trx.delete(Project, { id: In(staleProjectIds) });
			}

			await trx.save(Project, {
				id: INSIGHTS_DEMO_PROJECT_ID,
				name: INSIGHTS_DEMO_PROJECT_NAME,
				type: 'team',
				creatorId: owner.id,
			});
			await trx.save(ProjectRelation, {
				projectId: INSIGHTS_DEMO_PROJECT_ID,
				userId: owner.id,
				role: { slug: 'project:admin' },
			});

			const metaIds: number[] = [];

			for (const seed of INSIGHTS_DEMO_WORKFLOWS) {
				const existing = await trx.findOne(WorkflowEntity, { where: { id: seed.id } });
				const workflow = await trx.save(
					WorkflowEntity,
					trx.create(WorkflowEntity, {
						id: seed.id,
						name: seed.name,
						active: existing?.active ?? false,
						isArchived: existing?.isArchived ?? false,
						nodes: existing?.nodes ?? [
							{
								id: randomUUID(),
								name: 'Schedule Trigger',
								parameters: {},
								position: [0, 0],
								type: 'n8n-nodes-base.scheduleTrigger',
								typeVersion: 1,
							},
						],
						connections: existing?.connections ?? {},
						nodeGroups: existing?.nodeGroups ?? [],
						versionId: existing?.versionId ?? randomUUID(),
						settings: {
							...existing?.settings,
							timeSavedPerExecution: seed.timeSavedPerExecution,
						},
					}),
				);

				const sharing = await trx.findOne(SharedWorkflow, {
					where: { workflowId: workflow.id, projectId: INSIGHTS_DEMO_PROJECT_ID },
				});
				if (!sharing) {
					await trx.save(
						SharedWorkflow,
						trx.create(SharedWorkflow, {
							workflowId: workflow.id,
							projectId: INSIGHTS_DEMO_PROJECT_ID,
							role: 'workflow:owner',
						}),
					);
				}

				let metadata = await trx.findOne(InsightsMetadata, { where: { workflowId: workflow.id } });
				if (!metadata) {
					metadata = trx.create(InsightsMetadata, {
						workflowId: workflow.id,
						workflowName: workflow.name,
						projectId: INSIGHTS_DEMO_PROJECT_ID,
						projectName: INSIGHTS_DEMO_PROJECT_NAME,
					});
				} else {
					metadata.workflowName = workflow.name;
					metadata.projectId = INSIGHTS_DEMO_PROJECT_ID;
					metadata.projectName = INSIGHTS_DEMO_PROJECT_NAME;
				}
				metadata = await trx.save(InsightsMetadata, metadata);
				metaIds.push(metadata.metaId);
			}

			if (metaIds.length > 0) {
				await trx.delete(InsightsByPeriod, { metaId: In(metaIds) });
			}

			const today = DateTime.utc().startOf('day');
			const periodRows: InsightsByPeriod[] = [];
			for (const [index, seed] of INSIGHTS_DEMO_WORKFLOWS.entries()) {
				const dailyTimeSaved = seed.dailySuccess * seed.timeSavedPerExecution;
				const dailyByType: Record<TypeUnit, number> = {
					success: seed.dailySuccess,
					failure: seed.dailyFailure,
					runtime_ms: seed.dailyRuntimeMs,
					time_saved_min: dailyTimeSaved,
				};
				for (let dayOffset = 0; dayOffset < INSIGHTS_DEMO_SEED_DAYS; dayOffset++) {
					for (const [type, value] of Object.entries(dailyByType) as Array<[TypeUnit, number]>) {
						const row = new InsightsByPeriod();
						row.metaId = metaIds[index];
						row.type = type;
						row.value = value;
						row.periodUnit = 'day';
						row.periodStart = today.minus({ days: dayOffset }).toJSDate();
						periodRows.push(row);
					}
				}
			}
			await trx.save(InsightsByPeriod, periodRows);
		});
	}
}
