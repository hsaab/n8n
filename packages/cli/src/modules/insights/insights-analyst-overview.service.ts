import type {
	InsightsAnalystHighlight,
	InsightsAnalystLowImpact,
	InsightsAnalystOverview,
	InsightsAnalystRankingRow,
	InsightsByTime,
	InsightsByWorkflow,
	InsightsDateFilterDto,
} from '@n8n/api-types';
import { Service } from '@n8n/di';
import { DateTime } from 'luxon';

import {
	INSIGHTS_DEMO_PROJECT_ID,
	INSIGHTS_DEMO_SEED_DAYS,
} from './insights-analyst-seed.constants';
import { InsightsAnalystSeedService } from './insights-analyst-seed.service';
import { InsightsService } from './insights.service';

type DemoWorkflowRow = InsightsByWorkflow['data'][number] & { workflowId: string };

@Service()
export class InsightsAnalystOverviewService {
	constructor(
		private readonly seedService: InsightsAnalystSeedService,
		private readonly insightsService: InsightsService,
	) {}

	async getOverview(query: InsightsDateFilterDto = {}): Promise<InsightsAnalystOverview> {
		await this.seedService.ensureSeeded();

		const { startDate, endDate } = this.resolveWindow(query);
		const projectId = INSIGHTS_DEMO_PROJECT_ID;

		const [summary, byWorkflow, byTime] = await Promise.all([
			this.insightsService.getInsightsSummary({ startDate, endDate, projectId }),
			this.insightsService.getInsightsByWorkflow({
				startDate,
				endDate,
				projectId,
				skip: 0,
				take: 50,
				sortBy: 'timeSaved:desc',
			}),
			this.insightsService.getInsightsByTime({ startDate, endDate, projectId }),
		]);

		const rankedWorkflows = this.demoWorkflows(byWorkflow.data);

		return {
			summary,
			byTime: byTime as InsightsByTime[],
			highlights: this.buildHighlights(rankedWorkflows),
			ranking: this.buildRanking(rankedWorkflows),
			lowImpact: this.buildLowImpact(rankedWorkflows),
		};
	}

	/**
	 * Always read the demo project. A client-supplied projectId would otherwise
	 * ungate another project's Insights through this ungated route.
	 * Default is 30 days. Older starts are clamped so community never 403s.
	 */
	private resolveWindow(query: InsightsDateFilterDto) {
		const end = query.endDate ? DateTime.fromJSDate(query.endDate) : DateTime.now();
		const requestedStart = query.startDate
			? DateTime.fromJSDate(query.startDate)
			: end.minus({ days: INSIGHTS_DEMO_SEED_DAYS });
		const earliest = end.minus({ days: INSIGHTS_DEMO_SEED_DAYS });
		const start = requestedStart < earliest ? earliest : requestedStart;

		return {
			startDate: start.toJSDate(),
			endDate: end.toJSDate(),
		};
	}

	private demoWorkflows(rows: InsightsByWorkflow['data']): DemoWorkflowRow[] {
		return rows
			.filter((row): row is DemoWorkflowRow => typeof row.workflowId === 'string')
			.slice()
			.sort((left, right) => right.timeSaved - left.timeSaved);
	}

	private buildHighlights(rows: DemoWorkflowRow[]): InsightsAnalystHighlight[] {
		return rows.slice(0, 3).map((row) => ({
			workflowId: row.workflowId,
			title: row.workflowName,
			blurb:
				row === rows[0]
					? 'Saved the most time this month'
					: row.failed > 0
						? 'Worth a closer look this period'
						: 'Steady time saved this period',
			metric: this.minutesLabel(row.timeSaved),
		}));
	}

	private buildRanking(rows: DemoWorkflowRow[]): InsightsAnalystRankingRow[] {
		return rows.map((row, index) => ({
			rank: index + 1,
			workflowId: row.workflowId,
			name: row.workflowName,
			timeSavedLabel: this.minutesLabel(row.timeSaved),
		}));
	}

	private buildLowImpact(rows: DemoWorkflowRow[]): InsightsAnalystLowImpact[] {
		return rows
			.slice()
			.sort((left, right) => this.timeSavedPerRun(left) - this.timeSavedPerRun(right))
			.filter((row) => this.timeSavedPerRun(row) <= 4)
			.slice(0, 3)
			.map((row) => ({
				workflowId: row.workflowId,
				name: row.workflowName,
				blurb: 'Low time saved per run',
				timeSavedPerRunLabel: this.minutesLabel(this.timeSavedPerRun(row)),
			}));
	}

	private timeSavedPerRun(row: DemoWorkflowRow) {
		if (row.succeeded <= 0) {
			return 0;
		}
		return row.timeSaved / row.succeeded;
	}

	private minutesLabel(minutes: number) {
		return `${Math.round(minutes)} min`;
	}
}
