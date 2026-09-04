import type {
	InsightsAnalystOverview,
	InsightsDateFilterDto,
	InsightsSummary,
} from '@n8n/api-types';
import { Service } from '@n8n/di';
import { And, LessThan, MoreThanOrEqual } from '@n8n/typeorm';
import { DateTime } from 'luxon';

import { InsightsByPeriod } from './database/entities/insights-by-period';
import type { TypeUnit } from './database/entities/insights-shared';
import { InsightsByPeriodRepository } from './database/repositories/insights-by-period.repository';
import { INSIGHTS_DEMO_PROJECT_ID, INSIGHTS_DEMO_WORKFLOWS } from './insights-analyst-seed-data';
import { InsightsAnalystSeedService } from './insights-analyst-seed.service';

type WorkflowTotals = {
	workflowId: string;
	workflowName: string;
	success: number;
	failure: number;
	timeSaved: number;
	runtimeMs: number;
	timeSavedPerExecution: number;
};

const seedById = new Map(INSIGHTS_DEMO_WORKFLOWS.map((workflow) => [workflow.id, workflow]));

@Service()
export class InsightsAnalystOverviewService {
	constructor(
		private readonly seedService: InsightsAnalystSeedService,
		private readonly insightsByPeriodRepository: InsightsByPeriodRepository,
	) {}

	async getOverview(query: InsightsDateFilterDto): Promise<InsightsAnalystOverview> {
		await this.seedService.ensureSeeded();

		const { startDate, endDate } = this.normalizeWindow(query);
		const durationMs = endDate.getTime() - startDate.getTime();
		const previousStart = new Date(startDate.getTime() - durationMs);

		const [currentRows, previousRows] = await Promise.all([
			this.loadPeriodRows(startDate, endDate),
			this.loadPeriodRows(previousStart, startDate),
		]);

		const currentByWorkflow = this.totalsByWorkflow(currentRows);
		const previousTotals = this.sumTypes(previousRows);
		const currentTotals = this.sumTypes(currentRows);
		const workflows = [...currentByWorkflow.values()];

		const impact = [...workflows].sort((left, right) => right.timeSaved - left.timeSaved)[0];
		const efficiency = [...workflows]
			.filter((workflow) => workflow.workflowId !== impact?.workflowId)
			.sort((left, right) => right.timeSavedPerExecution - left.timeSavedPerExecution)[0];
		const attention = [...workflows].sort((left, right) => right.failure - left.failure)[0];

		const ranking = [...workflows]
			.sort((left, right) => right.timeSaved - left.timeSaved)
			.slice(0, 5)
			.map((workflow) => ({
				workflowId: workflow.workflowId,
				workflowName: workflow.workflowName,
				timeSaved: workflow.timeSaved,
			}));

		const lowImpact = [...workflows]
			.sort((left, right) => left.timeSaved - right.timeSaved)
			.slice(0, 3)
			.map((workflow) => ({
				workflowId: workflow.workflowId,
				workflowName: workflow.workflowName,
				description: workflow.workflowName,
				timeSavedPerExecution: workflow.timeSavedPerExecution,
			}));

		return {
			summary: this.toSummary(currentTotals, previousTotals),
			highlights: [
				{
					kind: 'impact',
					workflowId: impact?.workflowId ?? '',
					workflowName: impact?.workflowName ?? '',
					description: impact?.workflowName ?? '',
					value: impact?.timeSaved ?? 0,
				},
				{
					kind: 'efficiency',
					workflowId: efficiency?.workflowId ?? '',
					workflowName: efficiency?.workflowName ?? '',
					description: efficiency?.workflowName ?? '',
					value: efficiency?.timeSavedPerExecution ?? 0,
				},
				{
					kind: 'attention',
					workflowId: attention?.workflowId ?? '',
					workflowName: attention?.workflowName ?? '',
					description: attention?.workflowName ?? '',
					value: attention?.failure ?? 0,
				},
			],
			chart: this.toChart(currentRows),
			ranking,
			lowImpact,
			citationAllowlist: workflows.map((workflow) => ({
				workflowId: workflow.workflowId,
				workflowName: workflow.workflowName,
			})),
		};
	}

	private normalizeWindow(query: InsightsDateFilterDto) {
		const endDate = query.endDate ?? DateTime.utc().toJSDate();
		const startDate =
			query.startDate ?? DateTime.fromJSDate(endDate).minus({ days: 30 }).toJSDate();
		return { startDate, endDate };
	}

	private async loadPeriodRows(startDate: Date, endDate: Date) {
		return await this.insightsByPeriodRepository.find({
			where: {
				periodStart: And(MoreThanOrEqual(startDate), LessThan(endDate)),
				metadata: { projectId: INSIGHTS_DEMO_PROJECT_ID },
			},
			relations: { metadata: true },
		});
	}

	private totalsByWorkflow(rows: InsightsByPeriod[]) {
		const totals = new Map<string, WorkflowTotals>();
		for (const row of rows) {
			const workflowId = row.metadata.workflowId;
			const seed = seedById.get(workflowId);
			const current = totals.get(workflowId) ?? {
				workflowId,
				workflowName: row.metadata.workflowName,
				success: 0,
				failure: 0,
				timeSaved: 0,
				runtimeMs: 0,
				timeSavedPerExecution: seed?.timeSavedPerExecution ?? 0,
			};
			if (row.type === 'success') current.success += row.value;
			if (row.type === 'failure') current.failure += row.value;
			if (row.type === 'time_saved_min') current.timeSaved += row.value;
			if (row.type === 'runtime_ms') current.runtimeMs += row.value;
			totals.set(workflowId, current);
		}
		return totals;
	}

	private sumTypes(rows: InsightsByPeriod[]) {
		const byType: Record<TypeUnit, number> = {
			success: 0,
			failure: 0,
			runtime_ms: 0,
			time_saved_min: 0,
		};
		for (const row of rows) {
			byType[row.type] += row.value;
		}
		return byType;
	}

	private toSummary(
		current: Record<TypeUnit, number>,
		previous: Record<TypeUnit, number>,
	): InsightsSummary {
		const currentTotal = current.success + current.failure;
		const previousTotal = previous.success + previous.failure;
		const currentFailureRate =
			currentTotal > 0 ? Math.round((current.failure / currentTotal) * 1000) / 1000 : 0;
		const previousFailureRate =
			previousTotal > 0 ? Math.round((previous.failure / previousTotal) * 1000) / 1000 : 0;
		const currentAvgRuntime =
			currentTotal > 0 ? Math.round((current.runtime_ms / currentTotal) * 100) / 100 : 0;
		const previousAvgRuntime =
			previousTotal > 0 ? Math.round((previous.runtime_ms / previousTotal) * 100) / 100 : 0;
		const deviation = (value: number, previousValue: number) =>
			previousTotal === 0 ? null : value - previousValue;

		return {
			total: {
				value: currentTotal,
				unit: 'count',
				deviation: deviation(currentTotal, previousTotal),
			},
			failed: {
				value: current.failure,
				unit: 'count',
				deviation: deviation(current.failure, previous.failure),
			},
			failureRate: {
				value: currentFailureRate,
				unit: 'ratio',
				deviation: deviation(currentFailureRate, previousFailureRate),
			},
			timeSaved: {
				value: current.time_saved_min,
				unit: 'minute',
				deviation: deviation(current.time_saved_min, previous.time_saved_min),
			},
			averageRunTime: {
				value: currentAvgRuntime,
				unit: 'millisecond',
				deviation: deviation(currentAvgRuntime, previousAvgRuntime),
			},
		};
	}

	private toChart(rows: InsightsByPeriod[]) {
		const byDay = new Map<string, { succeeded: number; failed: number }>();
		for (const row of rows) {
			const date = new Date(row.periodStart).toISOString();
			const point = byDay.get(date) ?? { succeeded: 0, failed: 0 };
			if (row.type === 'success') point.succeeded += row.value;
			if (row.type === 'failure') point.failed += row.value;
			byDay.set(date, point);
		}
		return [...byDay.entries()]
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([date, values]) => ({ date, ...values }));
	}
}
