import type {
	InsightsAnalystChatRequest,
	InsightsAnalystChatResponse,
	InsightsAnalystOverview,
} from '@n8n/api-types';
import { insightsAnalystCitationSchema, insightsAnalystRecommendationSchema } from '@n8n/api-types';
import { Logger } from '@n8n/backend-common';
import { Service } from '@n8n/di';
import { z } from 'zod';

import { buildAnalystChatPrompt, fallbackAnalystChat } from './insights-analyst-chat.format';
import { InsightsAnalystOverviewService } from './insights-analyst-overview.service';
import { InsightsAnalystSeedService } from './insights-analyst-seed.service';
import { InsightsConfig } from './insights.config';

const modelPayloadSchema = z.object({
	finding: z.string().min(1),
	evidence: z.array(z.string().min(1)).min(1).max(5),
	recommendation: insightsAnalystRecommendationSchema,
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
			return fallbackAnalystChat(request, overview, knownWorkflowIds, (minutes) =>
				this.timeSavedLabel(minutes),
			);
		}

		try {
			return await this.askModel(request, overview, knownWorkflowIds);
		} catch (error) {
			// The reason goes in the message because the console transport drops metadata,
			// and without it a degraded answer is indistinguishable from having no API key.
			this.logger.warn(
				`Insights analyst chat provider ${this.modelId()} failed, answering from seeded data instead: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			return fallbackAnalystChat(request, overview, knownWorkflowIds, (minutes) =>
				this.timeSavedLabel(minutes),
			);
		}
	}

	private async askModel(
		request: InsightsAnalystChatRequest,
		overview: InsightsAnalystOverview,
		knownWorkflowIds: Set<string>,
	): Promise<InsightsAnalystChatResponse> {
		const { createAnthropic } = await import('@ai-sdk/anthropic');
		const { generateObject } = await import('ai');

		const provider = createAnthropic({
			apiKey: this.apiKey(),
		});
		/**
		 * `generateObject` rather than `generateText`: asking for JSON in the prompt and
		 * parsing the reply fails whenever the model wraps it in prose or a code fence,
		 * which sends every answer to the fallback. This constrains the model instead.
		 */
		const result = await generateObject({
			model: provider(this.modelId()),
			schema: modelPayloadSchema,
			prompt: buildAnalystChatPrompt(request, overview),
		});

		const citations = result.object.citations.filter((citation) =>
			knownWorkflowIds.has(citation.workflowId),
		);

		this.logger.info('Insights analyst chat completed', {
			model: this.modelId(),
			mode: 'llm',
		});

		return {
			finding: result.object.finding,
			evidence: result.object.evidence,
			recommendation: result.object.recommendation,
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

	/**
	 * Mirrors `transformInsightsTimeSaved` in the editor so a citation reads the same
	 * way as the tile beside it: under an hour stays in minutes, otherwise whole hours.
	 */
	private timeSavedLabel(minutes: number) {
		return Math.abs(minutes) < 60 ? `${Math.round(minutes)} min` : `${Math.round(minutes / 60)} hr`;
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
}
