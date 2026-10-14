import type {
	InsightsAnalystDashboard,
	InsightsAnalystDashboardQueryDto,
	InsightsAnalystWorkflowRow,
} from '@n8n/api-types';
import { insightsAnalystDashboardSchema } from '@n8n/api-types';
import { Service } from '@n8n/di';
import { DateTime } from 'luxon';

import { InsightsService } from '../insights.service';
import { InsightsAnalystChat } from './insights-analyst.chat';
import {
	DEMO_AGGREGATE_DAYS,
	DEMO_DEFAULT_RANGE_DAYS,
	DEMO_PROJECT_ID,
	DEMO_PROJECT_NAME,
	DEMO_WORKFLOWS,
} from './insights-analyst.constants';

const workflowSpecs = new Map(DEMO_WORKFLOWS.map((workflow) => [workflow.id, workflow]));

@Service()
export class InsightsAnalystService {
	constructor(
		private readonly insightsService: InsightsService,
		private readonly chat: InsightsAnalystChat,
	) {}

	async getDashboard(query: InsightsAnalystDashboardQueryDto): Promise<InsightsAnalystDashboard> {
		const { startDate, endDate } = this.resolveRange(query);
		const [summary, byTime, byWorkflow] = await Promise.all([
			this.insightsService.getInsightsSummary({
				projectId: DEMO_PROJECT_ID,
				startDate,
				endDate,
			}),
			this.insightsService.getInsightsByTime({
				projectId: DEMO_PROJECT_ID,
				startDate,
				endDate,
			}),
			this.getByWorkflow(startDate, endDate),
		]);

		const rows = this.toWorkflowRows(byWorkflow);
		const rankings = [...rows].sort((left, right) => right.timeSaved - left.timeSaved).slice(0, 5);
		const lowImpact = [...rows]
			.sort((left, right) => left.timeSavedPerExecution - right.timeSavedPerExecution)
			.slice(0, 3);

		return insightsAnalystDashboardSchema.parse({
			project: { id: DEMO_PROJECT_ID, name: DEMO_PROJECT_NAME },
			summary,
			byTime: byTime.map((row) => ({
				date: new Date(row.date).toISOString(),
				values: {
					total: row.values.total ?? 0,
					succeeded: row.values.succeeded ?? 0,
					failed: row.values.failed ?? 0,
					failureRate: row.values.failureRate ?? 0,
					averageRunTime: row.values.averageRunTime ?? 0,
					timeSaved: row.values.timeSaved ?? 0,
				},
			})),
			byWorkflow,
			highlights: this.buildHighlights(rows),
			rankings,
			lowImpact,
		});
	}

	async ask(message: string, query: InsightsAnalystDashboardQueryDto) {
		const { startDate, endDate } = this.resolveRange(query);
		const byWorkflow = await this.getByWorkflow(startDate, endDate);
		return await this.chat.answer(message, this.toWorkflowRows(byWorkflow));
	}

	private async getByWorkflow(startDate: Date, endDate: Date) {
		return await this.insightsService.getInsightsByWorkflow({
			projectId: DEMO_PROJECT_ID,
			startDate,
			endDate,
			skip: 0,
			take: 20,
			sortBy: 'total:desc',
		});
	}

	private toWorkflowRows(
		byWorkflow: Awaited<ReturnType<InsightsService['getInsightsByWorkflow']>>,
	): InsightsAnalystWorkflowRow[] {
		return byWorkflow.data.flatMap((row) => this.toWorkflowRow(row));
	}

	private resolveRange(query: InsightsAnalystDashboardQueryDto): {
		startDate: Date;
		endDate: Date;
	} {
		const endCap = DateTime.utc();
		const earliest = endCap.minus({ days: DEMO_AGGREGATE_DAYS }).startOf('day');
		let start = query.startDate
			? DateTime.fromJSDate(query.startDate, { zone: 'utc' })
			: endCap.minus({ days: DEMO_DEFAULT_RANGE_DAYS }).startOf('day');
		let end = query.endDate ? DateTime.fromJSDate(query.endDate, { zone: 'utc' }) : endCap;
		if (start < earliest) start = earliest;
		if (end > endCap) end = endCap;
		if (start > end) {
			start = end.minus({ days: DEMO_DEFAULT_RANGE_DAYS }).startOf('day');
		}
		return { startDate: start.toJSDate(), endDate: end.toJSDate() };
	}

	private toWorkflowRow(row: {
		workflowId: string | null;
		workflowName: string;
		total: number;
		failed: number;
		failureRate: number;
		timeSaved: number;
		averageRunTime: number;
	}): InsightsAnalystWorkflowRow[] {
		if (!row.workflowId) return [];
		const spec = workflowSpecs.get(row.workflowId);
		return [
			{
				workflowId: row.workflowId,
				workflowName: row.workflowName,
				total: row.total,
				failed: row.failed,
				failureRate: row.failureRate,
				timeSaved: row.timeSaved,
				averageRunTime: row.averageRunTime,
				timeSavedPerExecution: spec?.timeSavedPerExecution ?? 0,
				description: spec?.description ?? '',
			},
		];
	}

	private buildHighlights(rows: InsightsAnalystWorkflowRow[]) {
		const impact = [...rows].sort((left, right) => right.timeSaved - left.timeSaved)[0];
		const lowPerRun = [...rows].sort(
			(left, right) => left.timeSavedPerExecution - right.timeSavedPerExecution,
		)[0];
		const attention = [...rows].sort((left, right) => right.failed - left.failed)[0];
		const highlights = [
			impact
				? {
						id: 'impact',
						workflowId: impact.workflowId,
						workflowName: impact.workflowName,
						description: impact.description,
						metric: 'timeSaved' as const,
						value: impact.timeSaved,
					}
				: null,
			lowPerRun
				? {
						id: 'low-per-run',
						workflowId: lowPerRun.workflowId,
						workflowName: lowPerRun.workflowName,
						description: lowPerRun.description,
						metric: 'timeSaved' as const,
						value: lowPerRun.timeSavedPerExecution,
					}
				: null,
			attention
				? {
						id: 'attention',
						workflowId: attention.workflowId,
						workflowName: attention.workflowName,
						description: attention.description,
						metric: 'failed' as const,
						value: attention.failed,
					}
				: null,
		];
		return highlights.flatMap((highlight) => (highlight ? [highlight] : []));
	}
}
