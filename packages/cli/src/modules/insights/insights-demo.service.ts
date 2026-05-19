import type {
	InsightsAnalystChatResponse,
	InsightsAnalystCitation,
	InsightsAnalystHighlight,
	InsightsAnalystOverview,
	InsightsAnalystWorkflow,
	InsightsByTime,
	InsightsByWorkflow,
} from '@n8n/api-types';
import {
	DataSource,
	ExecutionData,
	ExecutionEntity,
	In,
	PROJECT_OWNER_ROLE,
	Project,
	ProjectRelation,
	SharedWorkflow,
	User,
	WorkflowEntity,
} from '@n8n/db';
import { Service } from '@n8n/di';
import { stringify } from 'flatted';
import type { IConnections, INode, IWorkflowBase } from 'n8n-workflow';

import { NotFoundError } from '@/errors/response-errors/not-found.error';

import { InsightsByPeriod } from './database/entities/insights-by-period';
import { InsightsMetadata } from './database/entities/insights-metadata';
import { InsightsRaw } from './database/entities/insights-raw';
import { InsightsAnalystChatService } from './insights-analyst-chat.service';
import { InsightsConfig } from './insights.config';
import { InsightsService } from './insights.service';

const DEMO_PROJECT_ID = 'insights-demo-operations';
const DEMO_PROJECT_NAME = 'Demo Operations';
const DEMO_DAYS = 30;

type DemoTrend = 'improving' | 'degrading' | 'stable';
type DemoRiskLevel = 'low' | 'medium' | 'high';

type DailyMetrics = {
	success: number;
	failure: number;
	averageRuntimeMs: number;
	timeSavedPerExecution: number;
};

type DemoExecutionData = {
	startData: Record<string, never>;
	resultData: {
		runData: Record<
			string,
			Array<{
				startTime: number;
				executionTime: number;
				source: [];
				data: {
					main: Array<Array<{ json: Record<string, string | number | boolean> }>>;
				};
				timeSaved: { minutes: number };
			}>
		>;
		lastNodeExecuted: string;
	};
	executionData: {
		contextData: Record<string, never>;
		nodeExecutionStack: [];
		metadata: Record<string, never>;
		waitingExecution: Record<string, never>;
		waitingExecutionSource: null;
	};
};

type DemoWorkflow = {
	id: string;
	versionId: string;
	name: string;
	description: string;
	timeSavedPerExecution: number;
	trend: DemoTrend;
	riskLevel: DemoRiskLevel;
	story: string;
	dailyMetrics: (dayIndex: number) => DailyMetrics;
};

type InsightsDateFilter = {
	startDate?: Date;
	endDate?: Date;
	projectId?: string;
};

const demoWorkflows: DemoWorkflow[] = [
	{
		id: 'insights-demo-ai-support-triage',
		versionId: '00000000-0000-4000-8000-000000000001',
		name: '[Demo] AI Support Triage',
		description: 'Classifies incoming support requests, drafts replies, and routes escalations.',
		timeSavedPerExecution: 24,
		trend: 'improving',
		riskLevel: 'low',
		story: 'High-impact AI workflow saving the most team time with low failure volume.',
		dailyMetrics: (dayIndex) => ({
			success: dayIndex >= 23 ? 18 : 13,
			failure: dayIndex >= 23 ? 1 : 2,
			averageRuntimeMs: dayIndex >= 23 ? 42_000 : 51_000,
			timeSavedPerExecution: dayIndex >= 23 ? 26 : 21,
		}),
	},
	{
		id: 'insights-demo-invoice-processing',
		versionId: '00000000-0000-4000-8000-000000000002',
		name: '[Demo] Invoice Processing',
		description: 'Extracts invoice data, validates totals, and posts records to finance tools.',
		timeSavedPerExecution: 4,
		trend: 'stable',
		riskLevel: 'medium',
		story:
			'High execution volume, but low time saved per run makes it a weak automation ROI target.',
		dailyMetrics: (dayIndex) => ({
			success: dayIndex >= 23 ? 47 : 42,
			failure: dayIndex >= 23 ? 5 : 4,
			averageRuntimeMs: dayIndex % 7 === 1 ? 210_000 : 88_000,
			timeSavedPerExecution: 4,
		}),
	},
	{
		id: 'insights-demo-customer-onboarding-sync',
		versionId: '00000000-0000-4000-8000-000000000003',
		name: '[Demo] Customer Onboarding Sync',
		description: 'Syncs CRM, billing, and workspace setup for new customers.',
		timeSavedPerExecution: 16,
		trend: 'degrading',
		riskLevel: 'high',
		story: 'Failure rate spiked this week after a downstream CRM schema change.',
		dailyMetrics: (dayIndex) => ({
			success: dayIndex >= 24 ? 12 : 23,
			failure: dayIndex >= 24 ? 8 : 1,
			averageRuntimeMs: dayIndex >= 24 ? 96_000 : 54_000,
			timeSavedPerExecution: 16,
		}),
	},
	{
		id: 'insights-demo-webhook-order-intake',
		versionId: '00000000-0000-4000-8000-000000000004',
		name: '[Demo] Webhook Order Intake',
		description: 'Receives order webhooks, enriches line items, and notifies fulfillment.',
		timeSavedPerExecution: 7,
		trend: 'stable',
		riskLevel: 'medium',
		story: 'High-volume workflow with intermittent webhook failures during traffic bursts.',
		dailyMetrics: (dayIndex) => ({
			success: 64 + (dayIndex % 4) * 3,
			failure: dayIndex % 5 === 0 ? 9 : 3,
			averageRuntimeMs: 33_000 + (dayIndex % 5) * 4_000,
			timeSavedPerExecution: 7,
		}),
	},
	{
		id: 'insights-demo-payment-recovery',
		versionId: '00000000-0000-4000-8000-000000000005',
		name: '[Demo] Failed Payment Recovery',
		description: 'Detects failed payments, updates CRM health, and sends recovery messaging.',
		timeSavedPerExecution: 19,
		trend: 'improving',
		riskLevel: 'low',
		story:
			'Recovery workflow improved after retries were tuned, reducing failures while saving time.',
		dailyMetrics: (dayIndex) => ({
			success: dayIndex >= 23 ? 21 : 15,
			failure: dayIndex >= 23 ? 1 : 5,
			averageRuntimeMs: dayIndex >= 23 ? 46_000 : 78_000,
			timeSavedPerExecution: 19,
		}),
	},
	{
		id: 'insights-demo-slack-incident-router',
		versionId: '00000000-0000-4000-8000-000000000006',
		name: '[Demo] Slack Incident Router',
		description: 'Routes alerts to Slack channels and enriches incident context.',
		timeSavedPerExecution: 11,
		trend: 'degrading',
		riskLevel: 'high',
		story: 'Fast workflow with rising failed executions tied to malformed alert payloads.',
		dailyMetrics: (dayIndex) => ({
			success: dayIndex >= 23 ? 29 : 31,
			failure: dayIndex >= 23 ? 7 : 2,
			averageRuntimeMs: 18_000,
			timeSavedPerExecution: 11,
		}),
	},
	{
		id: 'insights-demo-crm-cleanup',
		versionId: '00000000-0000-4000-8000-000000000007',
		name: '[Demo] Daily CRM Cleanup',
		description: 'Deduplicates CRM records and updates stale lifecycle fields.',
		timeSavedPerExecution: 9,
		trend: 'stable',
		riskLevel: 'low',
		story: 'Healthy scheduled automation with steady reliability and predictable savings.',
		dailyMetrics: () => ({
			success: 9,
			failure: 0,
			averageRuntimeMs: 71_000,
			timeSavedPerExecution: 9,
		}),
	},
	{
		id: 'insights-demo-lead-enrichment',
		versionId: '00000000-0000-4000-8000-000000000008',
		name: '[Demo] Lead Enrichment Pipeline',
		description: 'Enriches new leads, scores fit, and sends qualified leads to sales.',
		timeSavedPerExecution: 13,
		trend: 'stable',
		riskLevel: 'medium',
		story: 'Reliable revenue workflow with occasional provider latency spikes.',
		dailyMetrics: (dayIndex) => ({
			success: 24 + (dayIndex % 3) * 2,
			failure: dayIndex % 6 === 0 ? 4 : 1,
			averageRuntimeMs: dayIndex % 6 === 0 ? 132_000 : 58_000,
			timeSavedPerExecution: 13,
		}),
	},
];

@Service()
export class InsightsDemoService {
	private hasSeeded = false;

	constructor(
		private readonly dataSource: DataSource,
		private readonly insightsConfig: InsightsConfig,
		private readonly insightsService: InsightsService,
		private readonly insightsAnalystChatService: InsightsAnalystChatService,
	) {}

	async bootstrap() {
		if (!this.insightsConfig.demoAnalyst) return;

		await this.seedDemoData();
	}

	async getOverview(filter: InsightsDateFilter): Promise<InsightsAnalystOverview> {
		await this.ensureEnabledAndSeeded();

		const dateRange = this.getDateRange(filter);
		const projectId = filter.projectId ?? DEMO_PROJECT_ID;
		const [summary, byTime, byWorkflow] = await Promise.all([
			this.insightsService.getInsightsSummary({ ...dateRange, projectId }),
			this.insightsService.getInsightsByTime({ ...dateRange, projectId }),
			this.insightsService.getInsightsByWorkflow({
				...dateRange,
				projectId,
				take: demoWorkflows.length,
				sortBy: 'timeSaved:desc',
			}),
		]);

		const workflows = this.toAnalystWorkflows(byWorkflow);

		return {
			generatedAt: new Date().toISOString(),
			dateRange: {
				startDate: dateRange.startDate.toISOString(),
				endDate: dateRange.endDate.toISOString(),
			},
			summary,
			byTime: this.withCompleteInsightValues(byTime),
			workflows,
			highlights: this.buildHighlights(workflows),
			suggestedPrompts: [
				'Which workflows need attention this week?',
				'Which workflows saved us the most time?',
				'Why did failures increase?',
				'Summarize this for an ops review.',
			],
		};
	}

	async answerQuestion({
		prompt,
		...filter
	}: InsightsDateFilter & { prompt: string }): Promise<InsightsAnalystChatResponse> {
		const overview = await this.getOverview(filter);

		// The chat service decides whether to call Anthropic or fall back to the
		// deterministic templates. Either path returns the same shape with a
		// `mode` flag the UI uses to render the "Powered by Claude" badge.
		return await this.insightsAnalystChatService.answer(prompt, overview, () =>
			this.deterministicAnswer(prompt, overview),
		);
	}

	private deterministicAnswer(
		prompt: string,
		overview: InsightsAnalystOverview,
	): InsightsAnalystChatResponse {
		const normalizedPrompt = prompt.toLowerCase();

		if (normalizedPrompt.includes('time') || normalizedPrompt.includes('saved')) {
			return this.answerTimeSavedQuestion(overview);
		}

		if (normalizedPrompt.includes('fail') || normalizedPrompt.includes('why')) {
			return this.answerFailureQuestion(overview);
		}

		if (normalizedPrompt.includes('attention') || normalizedPrompt.includes('risk')) {
			return this.answerRiskQuestion(overview);
		}

		return this.answerSummaryQuestion(overview);
	}

	private async ensureEnabledAndSeeded() {
		if (!this.insightsConfig.demoAnalyst) {
			throw new NotFoundError('Insights Analyst demo is not enabled');
		}

		if (!this.hasSeeded) {
			await this.seedDemoData();
		}
	}

	private async seedDemoData() {
		await this.dataSource.transaction(async (manager) => {
			const existingMetadata = await manager.find(InsightsMetadata, {
				where: { workflowId: In(demoWorkflows.map(({ id }) => id)) },
			});
			const metaIds = existingMetadata.map(({ metaId }) => metaId);
			if (metaIds.length > 0) {
				await manager.delete(InsightsByPeriod, { metaId: In(metaIds) });
				await manager.delete(InsightsRaw, { metaId: In(metaIds) });
				await manager.delete(InsightsMetadata, { metaId: In(metaIds) });
			}

			const existingExecutions = await manager.find(ExecutionEntity, {
				select: { id: true },
				where: { workflowId: In(demoWorkflows.map(({ id }) => id)) },
			});
			const executionIds = existingExecutions.map(({ id }) => id);
			if (executionIds.length > 0) {
				await manager.delete(ExecutionData, { executionId: In(executionIds) });
				await manager.delete(ExecutionEntity, { id: In(executionIds) });
			}

			await manager.delete(SharedWorkflow, { workflowId: In(demoWorkflows.map(({ id }) => id)) });
			await manager.delete(WorkflowEntity, { id: In(demoWorkflows.map(({ id }) => id)) });

			const project = await manager.save(Project, {
				id: DEMO_PROJECT_ID,
				name: DEMO_PROJECT_NAME,
				type: 'team',
				icon: null,
				description: 'Seeded project for the Insights Analyst customer demo.',
				creatorId: null,
			});

			const firstUser = await manager.findOne(User, { where: {}, order: { createdAt: 'ASC' } });
			if (firstUser) {
				await manager.save(ProjectRelation, {
					projectId: project.id,
					userId: firstUser.id,
					role: { slug: PROJECT_OWNER_ROLE.slug },
				});
			}

			for (const demoWorkflow of demoWorkflows) {
				const workflow = await manager.save(WorkflowEntity, {
					id: demoWorkflow.id,
					name: demoWorkflow.name,
					description: demoWorkflow.description,
					active: false,
					isArchived: false,
					nodes: this.createWorkflowNodes(demoWorkflow.name),
					connections: this.createWorkflowConnections(),
					settings: {
						timeSavedMode: 'fixed',
						timeSavedPerExecution: demoWorkflow.timeSavedPerExecution,
					},
					staticData: {},
					meta: { templateId: 'insights-analyst-demo' },
					pinData: {},
					versionId: demoWorkflow.versionId,
					activeVersionId: null,
					versionCounter: 1,
					triggerCount: 1,
				});

				await manager.save(SharedWorkflow, {
					workflowId: workflow.id,
					projectId: project.id,
					role: 'workflow:owner',
				});

				const metadata = await manager.save(InsightsMetadata, {
					workflowId: workflow.id,
					projectId: project.id,
					workflowName: workflow.name,
					projectName: project.name,
				});

				await manager.save(
					InsightsByPeriod,
					this.createInsightsRows(metadata.metaId, demoWorkflow),
				);
				await manager.save(
					ExecutionEntity,
					this.createExecutionRows(workflow, demoWorkflow).map(({ execution }) => execution),
				);

				const insertedExecutions = await manager.find(ExecutionEntity, {
					where: { workflowId: workflow.id },
					order: { startedAt: 'DESC' },
					take: 6,
				});
				const executionPayloads = insertedExecutions.map((execution, index) => ({
					executionId: execution.id,
					workflowVersionId: workflow.versionId,
					workflowData: this.toWorkflowBase(workflow),
					data: stringify(this.createExecutionData(demoWorkflow, index)),
				}));
				await manager.save(ExecutionData, executionPayloads);
			}
		});

		this.hasSeeded = true;
	}

	private createInsightsRows(metaId: number, demoWorkflow: DemoWorkflow) {
		const rows: InsightsByPeriod[] = [];
		const todayStart = this.startOfUtcDay(new Date());

		for (let dayIndex = 0; dayIndex < DEMO_DAYS; dayIndex++) {
			const periodStart = new Date(todayStart);
			periodStart.setUTCDate(todayStart.getUTCDate() - (DEMO_DAYS - 1 - dayIndex));

			const metrics = demoWorkflow.dailyMetrics(dayIndex);
			const total = metrics.success + metrics.failure;
			const runtime = total * metrics.averageRuntimeMs;
			const timeSaved = metrics.success * metrics.timeSavedPerExecution;

			rows.push(this.createInsightRow(metaId, 'success', metrics.success, periodStart));
			rows.push(this.createInsightRow(metaId, 'failure', metrics.failure, periodStart));
			rows.push(this.createInsightRow(metaId, 'runtime_ms', runtime, periodStart));
			rows.push(this.createInsightRow(metaId, 'time_saved_min', timeSaved, periodStart));
		}

		return rows;
	}

	private createInsightRow(
		metaId: number,
		type: 'success' | 'failure' | 'runtime_ms' | 'time_saved_min',
		value: number,
		periodStart: Date,
	) {
		const row = new InsightsByPeriod();
		row.metaId = metaId;
		row.type = type;
		row.periodUnit = 'day';
		row.periodStart = periodStart;
		row.value = Math.round(value);
		return row;
	}

	private createExecutionRows(workflow: WorkflowEntity, demoWorkflow: DemoWorkflow) {
		const executions: Array<{ execution: Partial<ExecutionEntity> }> = [];
		const now = new Date();

		for (let index = 0; index < 6; index++) {
			const metrics = demoWorkflow.dailyMetrics(DEMO_DAYS - 1 - index);
			const startedAt = new Date(now);
			startedAt.setUTCDate(now.getUTCDate() - index);
			startedAt.setUTCHours(14 - index, 0, 0, 0);

			const stoppedAt = new Date(startedAt.getTime() + metrics.averageRuntimeMs);
			const isFailure = index === 0 && metrics.failure > 0 && demoWorkflow.riskLevel !== 'low';

			executions.push({
				execution: {
					finished: !isFailure,
					mode: 'trigger',
					status: isFailure ? 'error' : 'success',
					createdAt: startedAt,
					startedAt,
					stoppedAt,
					workflowId: workflow.id,
					waitTill: null,
					storedAt: 'db',
					tracingContext: null,
					deduplicationKey: `${workflow.id}-${startedAt.toISOString()}`,
				},
			});
		}

		return executions;
	}

	private createExecutionData(
		demoWorkflow: DemoWorkflow,
		executionIndex: number,
	): DemoExecutionData {
		const metrics = demoWorkflow.dailyMetrics(DEMO_DAYS - 1 - executionIndex);

		return {
			startData: {},
			resultData: {
				runData: {
					'Process data': [
						{
							startTime: Date.now(),
							executionTime: metrics.averageRuntimeMs,
							source: [],
							data: {
								main: [
									[
										{
											json: {
												demo: true,
												workflow: demoWorkflow.name,
											},
										},
									],
								],
							},
							timeSaved: {
								minutes: metrics.timeSavedPerExecution,
							},
						},
					],
				},
				lastNodeExecuted: 'Process data',
			},
			executionData: {
				contextData: {},
				nodeExecutionStack: [],
				metadata: {},
				waitingExecution: {},
				waitingExecutionSource: null,
			},
		};
	}

	private createWorkflowNodes(workflowName: string): INode[] {
		return [
			{
				id: `${workflowName}-trigger`,
				name: 'Trigger',
				type: 'n8n-nodes-base.manualTrigger',
				typeVersion: 1,
				position: [240, 300],
				parameters: {},
			},
			{
				id: `${workflowName}-work`,
				name: 'Process data',
				type: 'n8n-nodes-base.set',
				typeVersion: 3,
				position: [460, 300],
				parameters: {
					assignments: {
						assignments: [
							{
								id: `${workflowName}-assignment`,
								name: 'demo',
								value: 'insights',
								type: 'string',
							},
						],
					},
				},
			},
		];
	}

	private createWorkflowConnections(): IConnections {
		return {
			Trigger: {
				main: [
					[
						{
							node: 'Process data',
							type: 'main',
							index: 0,
						},
					],
				],
			},
		};
	}

	private toWorkflowBase(workflow: WorkflowEntity): IWorkflowBase {
		return {
			id: workflow.id,
			name: workflow.name,
			description: workflow.description,
			active: workflow.active,
			isArchived: workflow.isArchived,
			createdAt: workflow.createdAt,
			updatedAt: workflow.updatedAt,
			nodes: workflow.nodes,
			connections: workflow.connections,
			settings: workflow.settings,
			staticData: workflow.staticData,
			pinData: workflow.pinData,
			versionId: workflow.versionId,
			activeVersionId: workflow.activeVersionId,
			versionCounter: workflow.versionCounter,
			meta: workflow.meta,
		};
	}

	private toAnalystWorkflows(byWorkflow: InsightsByWorkflow): InsightsAnalystWorkflow[] {
		const demoWorkflowById = new Map(demoWorkflows.map((workflow) => [workflow.id, workflow]));

		return byWorkflow.data
			.filter((workflow) => workflow.workflowId !== null && workflow.projectId !== null)
			.map((workflow) => {
				const demoWorkflow = workflow.workflowId
					? demoWorkflowById.get(workflow.workflowId)
					: undefined;

				return {
					workflowId: workflow.workflowId ?? '',
					workflowName: workflow.workflowName,
					projectId: workflow.projectId ?? DEMO_PROJECT_ID,
					projectName: workflow.projectName,
					total: workflow.total,
					succeeded: workflow.succeeded,
					failed: workflow.failed,
					failureRate: workflow.failureRate,
					runTime: workflow.runTime,
					averageRunTime: workflow.averageRunTime,
					timeSaved: workflow.timeSaved,
					timeSavedPerExecution: demoWorkflow?.timeSavedPerExecution ?? 0,
					trend: demoWorkflow?.trend ?? 'stable',
					riskLevel: demoWorkflow?.riskLevel ?? 'medium',
					story: demoWorkflow?.story ?? 'Seeded workflow contributing to the analyst demo.',
				};
			});
	}

	private withCompleteInsightValues(
		byTime: Array<{ date: string; values: Partial<InsightsByTime['values']> }>,
	): InsightsByTime[] {
		return byTime.map((entry) => ({
			date: entry.date,
			values: {
				total: entry.values.total ?? 0,
				succeeded: entry.values.succeeded ?? 0,
				failed: entry.values.failed ?? 0,
				failureRate: entry.values.failureRate ?? 0,
				averageRunTime: entry.values.averageRunTime ?? 0,
				timeSaved: entry.values.timeSaved ?? 0,
			},
		}));
	}

	private buildHighlights(workflows: InsightsAnalystWorkflow[]): InsightsAnalystHighlight[] {
		const topTimeSaver = [...workflows].sort((a, b) => b.timeSaved - a.timeSaved)[0];
		const weakestTimeSaver = [...workflows]
			.filter((workflow) => workflow.total > 0)
			.sort((a, b) => {
				const aPerExecution = a.timeSaved / a.total;
				const bPerExecution = b.timeSaved / b.total;
				return aPerExecution - bPerExecution;
			})[0];
		const riskiestWorkflow = [...workflows].sort((a, b) => b.failureRate - a.failureRate)[0];

		return [
			{
				id: 'top-time-saver',
				title: 'Highest automation impact',
				value: topTimeSaver?.workflowName ?? 'No workflow',
				description: topTimeSaver
					? `${this.formatMinutes(topTimeSaver.timeSaved)} saved in the selected range.`
					: 'No time-saved data available yet.',
				tone: 'positive',
			},
			{
				id: 'lowest-impact',
				title: 'Lowest time saved per run',
				value: weakestTimeSaver?.workflowName ?? 'No workflow',
				description: weakestTimeSaver
					? `${this.formatMinutes(weakestTimeSaver.timeSaved)} saved across ${weakestTimeSaver.total} executions.`
					: 'No low-impact workflow found.',
				tone: 'warning',
			},
			{
				id: 'highest-risk',
				title: 'Needs attention',
				value: riskiestWorkflow?.workflowName ?? 'No workflow',
				description: riskiestWorkflow
					? `${this.formatPercent(riskiestWorkflow.failureRate)} failure rate this period.`
					: 'No failures found.',
				tone: riskiestWorkflow && riskiestWorkflow.failureRate > 0.1 ? 'warning' : 'neutral',
			},
		];
	}

	private answerTimeSavedQuestion(overview: InsightsAnalystOverview): InsightsAnalystChatResponse {
		const [topWorkflow] = [...overview.workflows].sort((a, b) => b.timeSaved - a.timeSaved);
		const [lowImpactWorkflow] = [...overview.workflows].sort((a, b) => {
			const aPerRun = a.total > 0 ? a.timeSaved / a.total : 0;
			const bPerRun = b.total > 0 ? b.timeSaved / b.total : 0;
			return aPerRun - bPerRun;
		});

		return {
			answer: `${topWorkflow.workflowName} is creating the clearest business impact with ${this.formatMinutes(topWorkflow.timeSaved)} saved. ${lowImpactWorkflow.workflowName} is the lowest-impact automation in this dataset: it ran ${lowImpactWorkflow.total} times but saved only ${this.formatMinutes(lowImpactWorkflow.timeSaved)}. I would use that contrast to show where automation volume and automation value diverge.`,
			citations: [
				this.workflowCitation(topWorkflow, 'Top time saver'),
				this.workflowCitation(lowImpactWorkflow, 'Lowest impact per run'),
			],
			followUpPrompts: ['Which workflows need attention?', 'Summarize this for an ops review.'],
			mode: 'fallback',
		};
	}

	private answerFailureQuestion(overview: InsightsAnalystOverview): InsightsAnalystChatResponse {
		const [riskiestWorkflow] = [...overview.workflows].sort(
			(a, b) => b.failureRate - a.failureRate,
		);

		return {
			answer: `${riskiestWorkflow.workflowName} explains most of the reliability concern: it has a ${this.formatPercent(riskiestWorkflow.failureRate)} failure rate and is trending ${riskiestWorkflow.trend}. The seeded story points to a recent integration or payload change, so this is the workflow I would inspect before tuning lower-impact automations.`,
			citations: [this.workflowCitation(riskiestWorkflow, 'Highest failure rate')],
			followUpPrompts: ['Which workflows saved the most time?', 'What changed this week?'],
			mode: 'fallback',
		};
	}

	private answerRiskQuestion(overview: InsightsAnalystOverview): InsightsAnalystChatResponse {
		const riskyWorkflows = overview.workflows
			.filter((workflow) => workflow.riskLevel === 'high')
			.sort((a, b) => b.failureRate - a.failureRate)
			.slice(0, 2);

		return {
			answer: `I would prioritize ${riskyWorkflows.map(({ workflowName }) => workflowName).join(' and ')}. They combine elevated failure rates with degrading trends, which means they are more likely to affect customers than the healthy high-volume workflows. After that, review the low-impact workflows to decide whether they are worth maintaining.`,
			citations: riskyWorkflows.map((workflow) =>
				this.workflowCitation(workflow, 'Needs attention'),
			),
			followUpPrompts: ['Why did failures increase?', 'Which workflows saved the most time?'],
			mode: 'fallback',
		};
	}

	private answerSummaryQuestion(overview: InsightsAnalystOverview): InsightsAnalystChatResponse {
		const totalRuns = overview.summary.total.value;
		const failureRate = overview.summary.failureRate.value;
		const timeSaved = overview.summary.timeSaved.value;
		const [topWorkflow] = [...overview.workflows].sort((a, b) => b.timeSaved - a.timeSaved);

		return {
			answer: `For the selected period, this workspace ran ${totalRuns.toLocaleString('en-US')} production executions with a ${this.formatPercent(failureRate)} failure rate and saved ${this.formatMinutes(timeSaved)}. ${topWorkflow.workflowName} is the strongest value story, while the high-risk workflows give you a crisp reliability follow-up for the demo.`,
			citations: [
				{ label: 'Production executions', value: totalRuns.toLocaleString('en-US') },
				{ label: 'Failure rate', value: this.formatPercent(failureRate) },
				{ label: 'Time saved', value: this.formatMinutes(timeSaved) },
				this.workflowCitation(topWorkflow, 'Top value driver'),
			],
			followUpPrompts: [
				'Which workflows need attention?',
				'Which workflows saved us the most time?',
			],
			mode: 'fallback',
		};
	}

	private workflowCitation(
		workflow: InsightsAnalystWorkflow,
		label: string,
	): InsightsAnalystCitation {
		return {
			label,
			value: workflow.workflowName,
			description: `${workflow.total} runs, ${this.formatPercent(workflow.failureRate)} failure rate, ${this.formatMinutes(workflow.timeSaved)} saved.`,
			workflowId: workflow.workflowId,
		};
	}

	private getDateRange({ startDate, endDate }: InsightsDateFilter) {
		const end = endDate ?? new Date();
		const start = startDate ?? new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

		return {
			startDate: start,
			endDate: end,
		};
	}

	private startOfUtcDay(date: Date) {
		const start = new Date(date);
		start.setUTCHours(0, 0, 0, 0);
		return start;
	}

	private formatPercent(value: number) {
		return `${Math.round(value * 1000) / 10}%`;
	}

	private formatMinutes(value: number) {
		if (Math.abs(value) < 60) return `${Math.round(value)} minutes`;

		return `${Math.round((value / 60) * 10) / 10} hours`;
	}
}
