import type { InsightsAnalystMetric } from '@n8n/api-types';
import { smartDecimal } from '@n8n/utils/number/smartDecimal';

import type { InsightsTimeSavedUnits } from '@/features/execution/insights/insights.utils';
import { formatInsightsTimeSavedLabel } from '@/features/execution/insights/insights.utils';

type MetricCopy = {
	total: (count: string) => string;
	failed: (count: string) => string;
	failureRate: (rate: string) => string;
	averageRunTime: (seconds: string) => string;
};

export function formatAnalystMetric(
	metric: InsightsAnalystMetric,
	value: number,
	units: InsightsTimeSavedUnits,
	copy: MetricCopy,
): string {
	if (metric === 'timeSaved') {
		return formatInsightsTimeSavedLabel(value, units);
	}
	if (metric === 'failureRate') {
		return copy.failureRate(smartDecimal(value * 100).toLocaleString('en-US'));
	}
	if (metric === 'averageRunTime') {
		return copy.averageRunTime(smartDecimal(value / 1000).toLocaleString('en-US'));
	}
	if (metric === 'failed') {
		return copy.failed(value.toLocaleString('en-US'));
	}
	return copy.total(value.toLocaleString('en-US'));
}
