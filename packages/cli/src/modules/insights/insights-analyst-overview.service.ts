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
	findInsightsDemoWorkflow,
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

	/**
	 * Ties fall back to workflow id. Without that the order of two equal rows comes
	 * from whatever the Insights query happened to return, so the same instance could
	 * rank them differently between two loads.
	 */
	private demoWorkflows(rows: InsightsByWorkflow['data']): DemoWorkflowRow[] {
		return rows
			.filter((row): row is DemoWorkflowRow => typeof row.workflowId === 'string')
			.slice()
			.sort(
				(left, right) =>
					right.timeSaved - left.timeSaved || left.workflowId.localeCompare(right.workflowId),
			);
	}

	/**
	 * The biggest total saving, the thinnest saving per run, and the most failures,
	 * always in that order. A card is omitted only when no workflow qualifies, which
	 * the seeded catalog never does.
	 */
	private buildHighlights(rows: DemoWorkflowRow[]): InsightsAnalystHighlight[] {
		const byTimeSaved = this.pick(rows, (row) => row.timeSaved, 'max');
		const byPerRun = this.pick(this.rowsWithRuns(rows), (row) => this.timeSavedPerRun(row), 'min');
		const byFailures = this.pick(rows, (row) => row.failed, 'max');

		const highlights: InsightsAnalystHighlight[] = [];

		if (byTimeSaved) {
			highlights.push(this.highlight('impact', byTimeSaved, byTimeSaved.timeSaved));
		}
		if (byPerRun) {
			highlights.push(this.highlight('efficiency', byPerRun, this.timeSavedPerRun(byPerRun)));
		}
		if (byFailures) {
			highlights.push(this.highlight('attention', byFailures, byFailures.failed));
		}

		return highlights;
	}

	private buildRanking(rows: DemoWorkflowRow[]): InsightsAnalystRankingRow[] {
		return rows.map((row, index) => ({
			rank: index + 1,
			workflowId: row.workflowId,
			name: row.workflowName,
			department: findInsightsDemoWorkflow(row.workflowId)?.department ?? '',
			timeSavedMinutes: row.timeSaved,
		}));
	}

	/**
	 * The three thinnest savings per run. There is no minimum threshold: every
	 * seeded workflow saves several minutes per run, so a threshold emptied the list.
	 */
	private buildLowImpact(rows: DemoWorkflowRow[]): InsightsAnalystLowImpact[] {
		return this.rowsWithRuns(rows)
			.sort(
				(left, right) =>
					this.timeSavedPerRun(left) - this.timeSavedPerRun(right) ||
					left.workflowId.localeCompare(right.workflowId),
			)
			.slice(0, 3)
			.map((row) => ({
				workflowId: row.workflowId,
				name: row.workflowName,
				blurb: findInsightsDemoWorkflow(row.workflowId)?.blurb ?? '',
				timeSavedPerRunMinutes: this.timeSavedPerRun(row),
			}));
	}

	private highlight(
		kind: InsightsAnalystHighlight['kind'],
		row: DemoWorkflowRow,
		metricValue: number,
	): InsightsAnalystHighlight {
		return {
			workflowId: row.workflowId,
			kind,
			workflowName: row.workflowName,
			blurb: findInsightsDemoWorkflow(row.workflowId)?.blurb ?? '',
			metricValue,
		};
	}

	/** A workflow with no successful run has no time saved per run, only an unknown one. */
	private rowsWithRuns(rows: DemoWorkflowRow[]) {
		return rows.filter((row) => row.succeeded > 0);
	}

	private pick(
		rows: DemoWorkflowRow[],
		score: (row: DemoWorkflowRow) => number,
		mode: 'max' | 'min',
	): DemoWorkflowRow | undefined {
		return rows.reduce<DemoWorkflowRow | undefined>((best, row) => {
			if (!best) {
				return row;
			}
			const isBetter = mode === 'max' ? score(row) > score(best) : score(row) < score(best);
			return isBetter ? row : best;
		}, undefined);
	}

	private timeSavedPerRun(row: DemoWorkflowRow) {
		return row.timeSaved / row.succeeded;
	}
}
