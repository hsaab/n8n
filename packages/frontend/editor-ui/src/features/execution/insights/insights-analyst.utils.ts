import type {
	InsightsAnalystCitation,
	InsightsAnalystCitationMetric,
	InsightsAnalystWorkflowRow,
} from '@n8n/api-types';
import { smartDecimal } from '@n8n/utils/number/smartDecimal';

import { formatInsightsTimeSavedLabel } from '@/features/execution/insights/insights.utils';

export function formatAnalystMetricLabel(
	metric: InsightsAnalystCitationMetric,
	value: number,
): string {
	if (metric === 'timeSaved') return formatInsightsTimeSavedLabel(value);
	if (metric === 'failureRate') return `${smartDecimal(value * 100)}%`;
	if (metric === 'averageRunTime') return `${smartDecimal(value / 1000)}s`;
	return String(smartDecimal(value));
}

export function formatAnalystCitation(citation: InsightsAnalystCitation): string {
	return formatAnalystMetricLabel(citation.metric, citation.value);
}

export function workflowsByTimeSaved(
	workflows: InsightsAnalystWorkflowRow[],
): InsightsAnalystWorkflowRow[] {
	return [...workflows].sort((left, right) => right.timeSaved - left.timeSaved);
}
