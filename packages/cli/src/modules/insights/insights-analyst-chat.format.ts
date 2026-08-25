import type {
	InsightsAnalystChatRequest,
	InsightsAnalystChatResponse,
	InsightsAnalystCitation,
	InsightsAnalystOverview,
} from '@n8n/api-types';

const OVERVIEW_LIMITATION_DETAIL =
	"The overview doesn't include error messages, so the execution log is the next place to look.";

function isFailuresQuestion(request: InsightsAnalystChatRequest) {
	return request.suggestedPromptId === 'failures' || /\bfail/i.test(request.question);
}

export function buildAnalystChatPrompt(
	request: InsightsAnalystChatRequest,
	overview: InsightsAnalystOverview,
) {
	return [
		'Answer the operator question using only this Insights overview JSON.',
		'Cite a workflow only by a workflowId that appears in the overview.',
		'Write plain text. Do not use markdown, headings, or bullet characters inside any field.',
		'finding: one sentence that answers the question. Lead with the fact. Do not open with what the data cannot explain.',
		'evidence: 2-4 short bullets of numbers from the overview.',
		'recommendation.action: start with a verb and name the workflow to open.',
		'recommendation.detail: one sentence of context after the action. If the overview has no root cause (no error messages, node names, or per-workflow daily failures), say that here — never in the finding.',
		'Time values are in minutes. Write them as hours once they reach 60, e.g. 8100 is "135 hr".',
		'A highlight metricValue means minutes saved for kind "impact", minutes saved per run for "efficiency", and a count of failed executions for "attention".',
		'summary.failed.deviation is the absolute change in failed executions compared to the previous period of the same length. Positive means more failures.',
		`Question: ${request.question}`,
		request.suggestedPromptId ? `Suggested prompt: ${request.suggestedPromptId}` : '',
		`Overview: ${JSON.stringify({
			summary: overview.summary,
			byTime: overview.byTime,
			highlights: overview.highlights,
			ranking: overview.ranking,
			lowImpact: overview.lowImpact,
		})}`,
	]
		.filter(Boolean)
		.join('\n');
}

export function fallbackAnalystChat(
	request: InsightsAnalystChatRequest,
	overview: InsightsAnalystOverview,
	knownWorkflowIds: Set<string>,
	timeSavedLabel: (minutes: number) => string,
): InsightsAnalystChatResponse {
	if (isFailuresQuestion(request)) {
		return failuresFallback(overview, knownWorkflowIds);
	}

	return timeSavedFallback(overview, knownWorkflowIds, timeSavedLabel);
}

function timeSavedFallback(
	overview: InsightsAnalystOverview,
	knownWorkflowIds: Set<string>,
	timeSavedLabel: (minutes: number) => string,
): InsightsAnalystChatResponse {
	const top = overview.ranking[0];
	/**
	 * Only the impact card can be cited here. Its metricValue is minutes saved,
	 * while the attention card's is a failure count that must never be read as time.
	 */
	const impact = overview.highlights.find((row) => row.kind === 'impact');
	const citations: InsightsAnalystCitation[] = [];

	if (top && knownWorkflowIds.has(top.workflowId)) {
		citations.push({
			workflowId: top.workflowId,
			label: top.name,
			metric: timeSavedLabel(top.timeSavedMinutes),
		});
	} else if (impact && knownWorkflowIds.has(impact.workflowId)) {
		citations.push({
			workflowId: impact.workflowId,
			label: impact.workflowName,
			metric: timeSavedLabel(impact.metricValue),
		});
	}

	const lead = citations[0];
	if (!lead) {
		return {
			finding: 'No demo workflow data is available yet.',
			evidence: [],
			recommendation: {
				action: 'Reload the Insights analyst page after the demo workspace has seeded.',
			},
			citations,
			mode: 'fallback',
		};
	}

	return {
		finding: `${lead.label} saved the most time this period.`,
		evidence: [`${lead.label} saved ${lead.metric}.`],
		recommendation: {
			action: `Open ${lead.label} to see where the time is saved.`,
			detail: 'Compare it with the rest of the ranking for a broader ops view.',
		},
		citations,
		mode: 'fallback',
	};
}

function failuresFallback(
	overview: InsightsAnalystOverview,
	knownWorkflowIds: Set<string>,
): InsightsAnalystChatResponse {
	const attention = overview.highlights.find((row) => row.kind === 'attention');
	const failed = overview.summary.failed;
	const citations: InsightsAnalystCitation[] = [];

	if (attention && knownWorkflowIds.has(attention.workflowId)) {
		citations.push({
			workflowId: attention.workflowId,
			label: attention.workflowName,
			metric: `${Math.round(attention.metricValue)} failed executions`,
		});
	}

	const evidence = [failedChangeEvidence(failed.value, failed.deviation)];
	if (attention) {
		evidence.unshift(
			`${Math.round(attention.metricValue)} failed executions on ${attention.workflowName}.`,
		);
	}

	if (!attention) {
		return {
			finding: 'Failed executions changed this period, but no workflow stands out in the overview.',
			evidence,
			recommendation: {
				action: 'Open the ranking and inspect recent failed executions.',
				detail: OVERVIEW_LIMITATION_DETAIL,
			},
			citations,
			mode: 'fallback',
		};
	}

	return {
		finding: `${attention.workflowName} has the most failed executions this period.`,
		evidence,
		recommendation: {
			action: `Open ${attention.workflowName} and inspect recent failed executions.`,
			detail: OVERVIEW_LIMITATION_DETAIL,
		},
		citations,
		mode: 'fallback',
	};
}

function failedChangeEvidence(value: number, deviation: number | null) {
	if (deviation === null) {
		return `Failed executions this period: ${value}.`;
	}
	if (deviation > 0) {
		return `Failed executions this period: ${value}, ${deviation} more than the previous period.`;
	}
	if (deviation < 0) {
		return `Failed executions this period: ${value}, ${Math.abs(deviation)} fewer than the previous period.`;
	}
	return `Failed executions this period: ${value}, unchanged compared to the previous period.`;
}
