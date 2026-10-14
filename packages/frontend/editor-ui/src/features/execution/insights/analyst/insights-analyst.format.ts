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

export type AnalystTextSegment = { text: string; emphasized: boolean };

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Splits an answer into plain and emphasized segments so cited workflow names
 * can be rendered in bold. Longer names are matched first to avoid partial hits.
 */
export function emphasizeWorkflowNames(text: string, names: string[]): AnalystTextSegment[] {
	const uniqueNames = [...new Set(names.filter((name) => name.trim().length > 0))].sort(
		(a, b) => b.length - a.length,
	);
	if (uniqueNames.length === 0) return [{ text, emphasized: false }];

	const matcher = new RegExp(`(${uniqueNames.map(escapeRegExp).join('|')})`, 'g');
	return text
		.split(matcher)
		.filter((segment) => segment.length > 0)
		.map((segment) => ({ text: segment, emphasized: uniqueNames.includes(segment) }));
}

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
