import { DateTime } from 'luxon';

import {
	INSIGHTS_ANALYST_HISTORY_DAYS,
	INSIGHTS_ANALYST_WORKFLOWS,
	type InsightsAnalystWorkflowSpec,
} from './insights-analyst.constants';

export type InsightsAnalystDayMetrics = {
	dayIndex: number;
	periodStart: Date;
	success: number;
	failure: number;
	runtimeMs: number;
	timeSavedMin: number;
};

/**
 * Daily counts are a pure function of the workflow spec and day index, so a
 * re-seed writes the same totals regardless of the clock.
 */
export function analystDayMetrics(
	spec: InsightsAnalystWorkflowSpec,
	dayIndex: number,
	now: DateTime = DateTime.utc(),
): InsightsAnalystDayMetrics {
	const wave = ((dayIndex * 3 + spec.successBase) % 5) - 2;
	const success = Math.max(0, spec.successBase + wave);
	const failure = Math.max(0, spec.failureBase + (dayIndex % 3 === 0 ? 1 : 0));
	const offsetDays = INSIGHTS_ANALYST_HISTORY_DAYS - 1 - dayIndex;

	return {
		dayIndex,
		periodStart: now.startOf('day').minus({ days: offsetDays }).toJSDate(),
		success,
		failure,
		runtimeMs: spec.runtimeMs * (success + failure),
		timeSavedMin: success * spec.timeSavedPerExecution,
	};
}

export function totalTimeSavedMinutes(): number {
	return sumMetric('timeSavedMin');
}

export function sumMetric(metric: 'success' | 'failure' | 'timeSavedMin' | 'runtimeMs'): number {
	let total = 0;
	for (const spec of workflowSpecs()) {
		for (let dayIndex = 0; dayIndex < INSIGHTS_ANALYST_HISTORY_DAYS; dayIndex++) {
			total += analystDayMetrics(spec, dayIndex)[metric];
		}
	}
	return total;
}

function workflowSpecs(): InsightsAnalystWorkflowSpec[] {
	return INSIGHTS_ANALYST_WORKFLOWS;
}
