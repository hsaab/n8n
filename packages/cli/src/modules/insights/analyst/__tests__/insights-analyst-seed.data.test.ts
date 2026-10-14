import { DateTime } from 'luxon';

import {
	INSIGHTS_ANALYST_HISTORY_DAYS,
	INSIGHTS_ANALYST_WORKFLOWS,
} from '../insights-analyst.constants';
import { analystDayMetrics, sumMetric, totalTimeSavedMinutes } from '../insights-analyst-seed.data';

describe('insights analyst seed data', () => {
	it('uses eight demo workflows and thirty days', () => {
		expect(INSIGHTS_ANALYST_WORKFLOWS).toHaveLength(8);
		expect(INSIGHTS_ANALYST_HISTORY_DAYS).toBe(30);
	});

	it('keeps time saved equal to successes times the workflow estimate', () => {
		const spec = INSIGHTS_ANALYST_WORKFLOWS[0];
		const day = analystDayMetrics(spec, 4, DateTime.utc(2026, 10, 1));
		expect(day.timeSavedMin).toBe(day.success * spec.timeSavedPerExecution);
	});

	it('returns the same totals for two calls', () => {
		expect(totalTimeSavedMinutes()).toBe(sumMetric('timeSavedMin'));
		expect(totalTimeSavedMinutes()).toBeGreaterThan(0);
		expect(sumMetric('success')).toBeGreaterThan(sumMetric('failure'));
	});
});
