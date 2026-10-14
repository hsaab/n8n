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
} from './insights-analyst.constants';

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
			this.insightsService.getInsightsByWorkflow({
				projectId: DEMO_PROJECT_ID,
				startDate,
				endDate,
				skip: 0,
				take: 20,
				sortBy: 'total:desc',
			}),
		]);

		const rows = byWorkflow.data.flatMap((row) => this.toWorkflowRow(row));
		const rankings = [...rows].sort((left, right) => right.timeSaved - left.timeSaved);
		const lowImpact = [...rows].sort((left, right) => left.timeSaved - right.timeSaved).slice(0, 4);

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

	async ask(message: string) {
		const dashboard = await this.getDashboard({});
		return await this.chat.answer(message, dashboard.rankings);
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
		return [
			{
				workflowId: row.workflowId,
				workflowName: row.workflowName,
				total: row.total,
				failed: row.failed,
				failureRate: row.failureRate,
				timeSaved: row.timeSaved,
				averageRunTime: row.averageRunTime,
			},
		];
	}

	private buildHighlights(rows: InsightsAnalystWorkflowRow[]) {
		const byTimeSaved = [...rows].sort((left, right) => right.timeSaved - left.timeSaved)[0];
		const byFailure = [...rows].sort((left, right) => right.failureRate - left.failureRate)[0];
		const byTotal = [...rows].sort((left, right) => right.total - left.total)[0];
		const highlights = [
			byTimeSaved
				? {
						id: 'time-saved',
						workflowId: byTimeSaved.workflowId,
						workflowName: byTimeSaved.workflowName,
						metric: 'timeSaved' as const,
						value: byTimeSaved.timeSaved,
					}
				: null,
			byFailure
				? {
						id: 'failure-rate',
						workflowId: byFailure.workflowId,
						workflowName: byFailure.workflowName,
						metric: 'failureRate' as const,
						value: byFailure.failureRate,
					}
				: null,
			byTotal
				? {
						id: 'total',
						workflowId: byTotal.workflowId,
						workflowName: byTotal.workflowName,
						metric: 'total' as const,
						value: byTotal.total,
					}
				: null,
		];
		const seen = new Set<string>();
		return highlights.flatMap((highlight) => {
			if (!highlight || seen.has(highlight.id)) return [];
			seen.add(highlight.id);
			return [highlight];
		});
	}
}
