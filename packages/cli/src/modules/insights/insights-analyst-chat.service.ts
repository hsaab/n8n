import type {
	InsightsAnalystChatMode,
	InsightsAnalystChatResponse,
	InsightsAnalystCitation,
	InsightsAnalystOverview,
	InsightsAnalystWorkflow,
} from '@n8n/api-types';
import { Logger } from '@n8n/backend-common';
import { Service } from '@n8n/di';

import { InsightsConfig } from './insights.config';

/**
 * JSON shape Claude is asked to produce. Kept narrow so we can validate
 * what comes back before passing it to the frontend.
 */
type LlmAnswerShape = {
	answer: string;
	citations?: Array<{
		label: string;
		value: string;
		description?: string;
		workflowId?: string;
	}>;
	followUpPrompts?: string[];
};

const FOLLOW_UP_FALLBACK = [
	'Which workflows need attention this week?',
	'Which workflows saved us the most time?',
	'Summarize this for an ops review.',
];

/**
 * Lazy-loaded Anthropic chat layer for the Insights Analyst demo.
 *
 * - When no `anthropicApiKey` is configured, deterministic templates respond.
 *   This keeps the customer demo working with zero credentials.
 * - When a key is set we call `generateText` from the Vercel AI SDK with a
 *   compact system prompt and the seeded overview JSON as user context.
 *   Claude returns a JSON envelope that we validate before responding.
 *
 * The default model is intentionally Opus 4.7 so the bugbot cost-controls rule
 * fires on the PR and demonstrates the review loop. Production demos should
 * downgrade to a Sonnet-class model via `N8N_INSIGHTS_ANALYST_MODEL`.
 */
@Service()
export class InsightsAnalystChatService {
	constructor(
		private readonly insightsConfig: InsightsConfig,
		private readonly logger: Logger,
	) {}

	get isLlmEnabled(): boolean {
		return this.insightsConfig.anthropicApiKey.trim().length > 0;
	}

	async answer(
		prompt: string,
		overview: InsightsAnalystOverview,
		fallback: () => InsightsAnalystChatResponse,
	): Promise<InsightsAnalystChatResponse> {
		if (!this.isLlmEnabled) {
			return this.toMode(fallback(), 'fallback');
		}

		try {
			const llmResponse = await this.callAnthropic(prompt, overview);
			return this.toMode(llmResponse, 'llm');
		} catch (error) {
			this.logger.warn('Insights Analyst LLM call failed, using deterministic fallback', {
				error: error instanceof Error ? error.message : String(error),
			});
			return this.toMode(fallback(), 'fallback');
		}
	}

	private toMode(
		response: Omit<InsightsAnalystChatResponse, 'mode'> | InsightsAnalystChatResponse,
		mode: InsightsAnalystChatMode,
	): InsightsAnalystChatResponse {
		return {
			answer: response.answer,
			citations: response.citations,
			followUpPrompts: response.followUpPrompts,
			mode,
		};
	}

	private async callAnthropic(
		prompt: string,
		overview: InsightsAnalystOverview,
	): Promise<Omit<InsightsAnalystChatResponse, 'mode'>> {
		// Lazy-load to keep cli startup cheap and to avoid pulling the SDK into
		// processes that never enable the analyst feature.
		const [{ createAnthropic }, { generateText }] = await Promise.all([
			import('@ai-sdk/anthropic'),
			import('ai'),
		]);

		const anthropic = createAnthropic({ apiKey: this.insightsConfig.anthropicApiKey });
		const model = anthropic(this.insightsConfig.anthropicModel);

		const systemPrompt = this.buildSystemPrompt(overview);

		const { text } = await generateText({
			model,
			system: systemPrompt,
			prompt,
		});

		return this.parseLlmResponse(text, overview);
	}

	private buildSystemPrompt(overview: InsightsAnalystOverview): string {
		const compactOverview = {
			dateRange: overview.dateRange,
			summary: {
				totalRuns: overview.summary.total.value,
				failedRuns: overview.summary.failed.value,
				failureRate: overview.summary.failureRate.value,
				timeSavedMinutes: overview.summary.timeSaved.value,
				averageRunTimeMs: overview.summary.averageRunTime.value,
			},
			workflows: overview.workflows.map((workflow) => ({
				id: workflow.workflowId,
				name: workflow.workflowName,
				totalRuns: workflow.total,
				failedRuns: workflow.failed,
				failureRate: workflow.failureRate,
				timeSavedMinutes: workflow.timeSaved,
				timeSavedPerExecutionMinutes: workflow.timeSavedPerExecution,
				trend: workflow.trend,
				riskLevel: workflow.riskLevel,
				story: workflow.story,
			})),
			highlights: overview.highlights,
		};

		return [
			'You are the n8n Insights Analyst. Your only data source is the JSON',
			'workspace overview supplied to you below. Do not invent workflows,',
			'metrics, or trends that are not present in that data.',
			'',
			'Answer in 3-6 sentences, mention specific workflow names, and end with',
			'one short follow-up question the user could ask next.',
			'',
			'Respond with a single JSON object that matches this TypeScript type and',
			'nothing else (no markdown fence, no commentary outside the JSON):',
			'{',
			'  "answer": string,',
			'  "citations": Array<{ label: string; value: string; description?: string; workflowId?: string }>,',
			'  "followUpPrompts": string[]',
			'}',
			'',
			'Each citation must reference a metric or workflow that exists in the',
			'overview. When citing a workflow, include its workflowId so the UI can',
			'link to it.',
			'',
			'Workspace overview:',
			JSON.stringify(compactOverview),
		].join('\n');
	}

	private parseLlmResponse(
		text: string,
		overview: InsightsAnalystOverview,
	): Omit<InsightsAnalystChatResponse, 'mode'> {
		const trimmed = text.trim();
		const jsonText = this.extractJson(trimmed);

		if (!jsonText) {
			return this.bareAnswer(trimmed, overview);
		}

		let parsed: LlmAnswerShape;
		try {
			parsed = JSON.parse(jsonText) as LlmAnswerShape;
		} catch {
			return this.bareAnswer(trimmed, overview);
		}

		if (typeof parsed.answer !== 'string' || parsed.answer.length === 0) {
			return this.bareAnswer(trimmed, overview);
		}

		const citations = (parsed.citations ?? [])
			.filter(
				(citation) => typeof citation?.label === 'string' && typeof citation?.value === 'string',
			)
			.map<InsightsAnalystCitation>((citation) => ({
				label: citation.label,
				value: citation.value,
				...(citation.description ? { description: citation.description } : {}),
				...(citation.workflowId &&
				overview.workflows.some(({ workflowId }) => workflowId === citation.workflowId)
					? { workflowId: citation.workflowId }
					: {}),
			}));

		const followUpPrompts =
			Array.isArray(parsed.followUpPrompts) && parsed.followUpPrompts.length > 0
				? parsed.followUpPrompts.filter((p): p is string => typeof p === 'string')
				: FOLLOW_UP_FALLBACK;

		return {
			answer: parsed.answer,
			citations,
			followUpPrompts,
		};
	}

	private extractJson(text: string): string | null {
		// Tolerate fenced or surrounding prose: pull the outermost {...} block.
		const start = text.indexOf('{');
		const end = text.lastIndexOf('}');
		if (start === -1 || end === -1 || end <= start) {
			return null;
		}
		return text.slice(start, end + 1);
	}

	private bareAnswer(
		text: string,
		overview: InsightsAnalystOverview,
	): Omit<InsightsAnalystChatResponse, 'mode'> {
		const fallbackWorkflow: InsightsAnalystWorkflow | undefined = overview.workflows[0];
		const citations: InsightsAnalystCitation[] = fallbackWorkflow
			? [
					{
						label: 'Top workflow',
						value: fallbackWorkflow.workflowName,
						description: `${fallbackWorkflow.total} runs in the selected period.`,
						workflowId: fallbackWorkflow.workflowId,
					},
				]
			: [];

		return {
			answer: text,
			citations,
			followUpPrompts: FOLLOW_UP_FALLBACK,
		};
	}
}
