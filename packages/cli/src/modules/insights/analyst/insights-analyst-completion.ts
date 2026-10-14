import type {
	InsightsAnalystCitation,
	InsightsAnalystCompletion,
	InsightsAnalystWorkflowRow,
} from '@n8n/api-types';
import { insightsAnalystCompletionSchema } from '@n8n/api-types';

export function parseAnalystCompletion(text: string): InsightsAnalystCompletion | null {
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	if (start < 0 || end <= start) return null;

	try {
		const parsed: unknown = JSON.parse(text.slice(start, end + 1));
		const result = insightsAnalystCompletionSchema.safeParse(parsed);
		return result.success ? result.data : null;
	} catch {
		return null;
	}
}

export function resolveAnalystCitations(
	citations: InsightsAnalystCompletion['citations'],
	workflows: InsightsAnalystWorkflowRow[],
): InsightsAnalystCitation[] {
	const byId = new Map(
		workflows.flatMap((workflow) =>
			workflow.workflowId ? [[workflow.workflowId, workflow] as const] : [],
		),
	);

	const resolved: InsightsAnalystCitation[] = [];
	for (const citation of citations) {
		const workflow = byId.get(citation.workflowId);
		if (!workflow?.workflowId) continue;
		resolved.push({
			workflowId: workflow.workflowId,
			workflowName: workflow.workflowName,
			metric: citation.metric,
			value: metricValue(workflow, citation.metric),
		});
	}
	return resolved;
}

function metricValue(
	workflow: InsightsAnalystWorkflowRow,
	metric: InsightsAnalystCitation['metric'],
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
