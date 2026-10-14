import type {
	InsightsAnalystChatResponse,
	InsightsAnalystCitation,
	InsightsAnalystCitationMetric,
	InsightsAnalystWorkflowRow,
	InsightsSummary,
} from '@n8n/api-types';

const FAILURE_PATTERN = /fail|error|broke|incident/i;

export function buildAnalystFallback(
	message: string,
	summary: InsightsSummary,
	workflows: InsightsAnalystWorkflowRow[],
): InsightsAnalystChatResponse {
	const rankedByTimeSaved = [...workflows].sort((left, right) => right.timeSaved - left.timeSaved);
	const rankedByFailure = [...workflows].sort(
		(left, right) => right.failureRate - left.failureRate,
	);
	const asksAboutFailures = FAILURE_PATTERN.test(message);
	const focus = asksAboutFailures ? rankedByFailure[0] : rankedByTimeSaved[0];
	const metric: InsightsAnalystCitationMetric = asksAboutFailures ? 'failureRate' : 'timeSaved';

	if (!focus?.workflowId) {
		return {
			answer: 'Demo Operations has no workflow insights for this date range yet.',
			citations: [],
			mode: 'fallback',
		};
	}

	const citation: InsightsAnalystCitation = {
		workflowId: focus.workflowId,
		workflowName: focus.workflowName,
		metric,
		value: metricValue(focus, metric),
	};

	const answer = asksAboutFailures
		? `${focus.workflowName} has the highest failure rate in Demo Operations for this range, with ${summary.failed.value} failed executions overall.`
		: `${focus.workflowName} saved the most time in Demo Operations. The workspace recorded ${summary.total.value} production executions in this range.`;

	return {
		answer,
		citations: [citation],
		mode: 'fallback',
	};
}

function metricValue(
	workflow: InsightsAnalystWorkflowRow,
	metric: InsightsAnalystCitationMetric,
): number {
	switch (metric) {
		case 'total':
			return workflow.total;
		case 'failed':
			return workflow.failed;
		case 'failureRate':
			return workflow.failureRate;
		case 'timeSaved':
			return workflow.timeSaved;
		case 'averageRunTime':
			return workflow.averageRunTime;
	}
}
