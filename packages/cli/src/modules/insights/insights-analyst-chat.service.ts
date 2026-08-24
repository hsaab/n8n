import type {
	InsightsAnalystChatRequest,
	InsightsAnalystChatResponse,
	InsightsAnalystCitation,
	InsightsAnalystOverview,
} from '@n8n/api-types';
import { insightsAnalystCitationSchema } from '@n8n/api-types';
import { Logger } from '@n8n/backend-common';
import { Service } from '@n8n/di';
import { z } from 'zod';

import { InsightsAnalystOverviewService } from './insights-analyst-overview.service';
import { InsightsAnalystSeedService } from './insights-analyst-seed.service';
import { InsightsConfig } from './insights.config';

const modelPayloadSchema = z.object({
	answer: z.string().min(1),
	citations: z.array(insightsAnalystCitationSchema),
});

@Service()
export class InsightsAnalystChatService {
	constructor(
		private readonly config: InsightsConfig,
		private readonly seedService: InsightsAnalystSeedService,
		private readonly overviewService: InsightsAnalystOverviewService,
		private readonly logger: Logger,
	) {}

	async chat(request: InsightsAnalystChatRequest): Promise<InsightsAnalystChatResponse> {
		await this.seedService.ensureSeeded();
		const overview = await this.overviewService.getOverview();
		const knownWorkflowIds = this.knownWorkflowIds(overview);

		if (!this.apiKey()) {
			return this.fallbackAnswer(overview, knownWorkflowIds);
		}

		try {
			return await this.askModel(request, overview, knownWorkflowIds);
		} catch {
			this.logger.warn('Insights analyst chat provider failed', {
				model: this.modelId(),
			});
			return this.fallbackAnswer(overview, knownWorkflowIds);
		}
	}

	private async askModel(
		request: InsightsAnalystChatRequest,
		overview: InsightsAnalystOverview,
		knownWorkflowIds: Set<string>,
	): Promise<InsightsAnalystChatResponse> {
		const { createAnthropic } = await import('@ai-sdk/anthropic');
		const { generateText } = await import('ai');

		const provider = createAnthropic({
			apiKey: this.apiKey(),
		});
		const result = await generateText({
			model: provider(this.modelId()),
			prompt: this.buildPrompt(request, overview),
		});

		const parsed = this.parseModelText(result.text);
		if (!parsed) {
			this.logger.warn('Insights analyst chat model returned malformed JSON', {
				model: this.modelId(),
			});
			return this.fallbackAnswer(overview, knownWorkflowIds);
		}

		const citations = parsed.citations.filter((citation) =>
			knownWorkflowIds.has(citation.workflowId),
		);

		this.logger.info('Insights analyst chat completed', {
			model: this.modelId(),
			mode: 'llm',
		});

		return {
			answer: parsed.answer,
			citations,
			mode: 'llm',
		};
	}

	/**
	 * Tests construct InsightsConfig with `new`, which skips the @Config factory
	 * that copies env onto the instance. Fall back to process.env so both paths work.
	 */
	private apiKey() {
		return (
			this.config.analystAnthropicApiKey || process.env.N8N_INSIGHTS_ANALYST_ANTHROPIC_API_KEY || ''
		);
	}

	private modelId() {
		return (
			this.config.analystModel ||
			process.env.N8N_INSIGHTS_ANALYST_MODEL ||
			'claude-sonnet-4-5-20250929'
		);
	}

	private parseModelText(text: string) {
		try {
			const parsed: unknown = JSON.parse(text);
			const result = modelPayloadSchema.safeParse(parsed);
			if (!result.success) {
				return null;
			}
			return result.data;
		} catch {
			return null;
		}
	}

	private fallbackAnswer(
		overview: InsightsAnalystOverview,
		knownWorkflowIds: Set<string>,
	): InsightsAnalystChatResponse {
		const top = overview.ranking[0];
		const highlight = overview.highlights[0];
		const citations: InsightsAnalystCitation[] = [];

		if (top && knownWorkflowIds.has(top.workflowId)) {
			citations.push({
				workflowId: top.workflowId,
				label: top.name,
				metric: top.timeSavedLabel,
			});
		} else if (highlight && knownWorkflowIds.has(highlight.workflowId)) {
			citations.push({
				workflowId: highlight.workflowId,
				label: highlight.title,
				metric: highlight.metric,
			});
		}

		const lead = citations[0];
		const answer = lead
			? `${lead.label} saved the most time this period.`
			: 'No demo workflow data is available yet.';

		return {
			answer,
			citations,
			mode: 'fallback',
		};
	}

	private knownWorkflowIds(overview: InsightsAnalystOverview) {
		return new Set(
			[
				...overview.highlights.map((row) => row.workflowId),
				...overview.ranking.map((row) => row.workflowId),
				...overview.lowImpact.map((row) => row.workflowId),
			].filter((workflowId) => workflowId.length > 0),
		);
	}

	private buildPrompt(request: InsightsAnalystChatRequest, overview: InsightsAnalystOverview) {
		return [
			'Answer the operator question using only this Insights overview JSON.',
			'Return JSON: {"answer": string, "citations": [{"workflowId": string, "label": string, "metric": string}]}.',
			`Question: ${request.question}`,
			request.suggestedPromptId ? `Suggested prompt: ${request.suggestedPromptId}` : '',
			`Overview: ${JSON.stringify({
				summary: overview.summary,
				highlights: overview.highlights,
				ranking: overview.ranking,
				lowImpact: overview.lowImpact,
			})}`,
		]
			.filter(Boolean)
			.join('\n');
	}
}
