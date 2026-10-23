import type { InsightsAnalystCitation, InsightsAnalystWorkflowRow } from '@n8n/api-types';
import { insightsAnalystModelResponseSchema } from '@n8n/api-types';
import { Logger } from '@n8n/backend-common';
import { Service } from '@n8n/di';

import { InsightsAnalystConfig } from './insights-analyst.config';

export type AnalystChatResult = {
	answer: string;
	citations: InsightsAnalystCitation[];
	mode: 'llm' | 'fallback';
};

@Service()
export class InsightsAnalystChat {
	constructor(
		private readonly config: InsightsAnalystConfig,
		private readonly logger: Logger,
	) {
		this.logger = this.logger.scoped('insights');
	}

	async answer(
		message: string,
		workflows: InsightsAnalystWorkflowRow[],
	): Promise<AnalystChatResult> {
		if (!this.config.anthropicApiKey) {
			return this.fallback(message, workflows);
		}

		try {
			const text = await this.complete(message, workflows);
			const parsed = this.parseModelText(text, workflows);
			if (!parsed) {
				return this.fallback(message, workflows);
			}
			return { ...parsed, mode: 'llm' };
		} catch (error: unknown) {
			this.logger.error('Insights analyst model call failed', {
				model: this.config.anthropicModel,
				message: error instanceof Error ? error.message : 'unknown',
			});
			return this.fallback(message, workflows);
		}
	}

	/**
	 * Lazy-loads the SDK so cli startup does not pay for it.
	 * Tests replace this method to simulate success and failure.
	 */
	async complete(message: string, workflows: InsightsAnalystWorkflowRow[]): Promise<string> {
		const [{ createAnthropic }, { generateText }] = await Promise.all([
			import('@ai-sdk/anthropic'),
			import('ai'),
		]);
		const model = createAnthropic({ apiKey: this.config.anthropicApiKey })(
			this.config.anthropicModel,
		);
		const result = await generateText({
			model,
			prompt: this.buildPrompt(message, workflows),
		});
		return result.text;
	}

	private parseModelText(text: string, workflows: InsightsAnalystWorkflowRow[]) {
		const jsonText = text
			.trim()
			.replace(/^```json\s*/i, '')
			.replace(/```$/, '')
			.trim();
		let raw: unknown;
		try {
			raw = JSON.parse(jsonText);
		} catch {
			return null;
		}
		const parsed = insightsAnalystModelResponseSchema.safeParse(raw);
		if (!parsed.success) return null;

		const known = new Map(workflows.map((workflow) => [workflow.workflowId, workflow]));
		const citations = parsed.data.citations.flatMap((citation) => {
			const workflow = known.get(citation.workflowId);
			if (!workflow) return [];
			return [
				{
					...citation,
					workflowName: workflow.workflowName,
				},
			];
		});
		return { answer: parsed.data.answer, citations };
	}

	private fallback(message: string, workflows: InsightsAnalystWorkflowRow[]): AnalystChatResult {
		const ranked = [...workflows].sort((left, right) => right.timeSaved - left.timeSaved);
		const busiest = [...workflows].sort((left, right) => right.total - left.total);
		const flakiest = [...workflows].sort((left, right) => right.failureRate - left.failureRate);
		const top = ranked[0];
		const busy = busiest[0];
		const flaky = flakiest[0];
		if (!top || !busy || !flaky) {
			return {
				answer: 'Demo Operations does not have workflow metrics for this range yet.',
				citations: [],
				mode: 'fallback',
			};
		}

		const asksAboutFailures = /fail|error|broken|unreliable/i.test(message);
		if (asksAboutFailures) {
			return {
				answer: `${flaky.workflowName} has the highest failure rate in Demo Operations for this range.`,
				citations: [
					{
						workflowId: flaky.workflowId,
						workflowName: flaky.workflowName,
						metric: 'failureRate',
						value: flaky.failureRate,
					},
				],
				mode: 'fallback',
			};
		}

		const asksAboutTime = /time|save|hour|minute/i.test(message);
		if (asksAboutTime) {
			return {
				answer: `${top.workflowName} saved the most time in Demo Operations for this range.`,
				citations: [
					{
						workflowId: top.workflowId,
						workflowName: top.workflowName,
						metric: 'timeSaved',
						value: top.timeSaved,
					},
				],
				mode: 'fallback',
			};
		}

		return {
			answer: `${top.workflowName} leads time saved, and ${busy.workflowName} has the most production runs.`,
			citations: [
				{
					workflowId: top.workflowId,
					workflowName: top.workflowName,
					metric: 'timeSaved',
					value: top.timeSaved,
				},
				{
					workflowId: busy.workflowId,
					workflowName: busy.workflowName,
					metric: 'total',
					value: busy.total,
				},
			],
			mode: 'fallback',
		};
	}

	private buildPrompt(message: string, workflows: InsightsAnalystWorkflowRow[]): string {
		return [
			'You are the n8n Insights Analyst for the Demo Operations project.',
			'Answer using only the workflow metrics below. Do not invent workflows.',
			'Reply with JSON only: {"answer": string, "citations": [{"workflowId": string, "workflowName": string, "metric": "timeSaved"|"total"|"failed"|"failureRate"|"averageRunTime", "value": number}]}',
			'value for timeSaved is minutes. failureRate is a ratio between 0 and 1. averageRunTime is milliseconds.',
			JSON.stringify(workflows),
			`Question: ${message}`,
		].join('\n');
	}
}
