import type {
	InsightsAnalystChatResponse,
	InsightsAnalystDashboard,
	InsightsAnalystDashboardQueryDto,
	InsightsAnalystChatRequestDto,
	InsightsByTime,
	InsightsSummary,
} from '@n8n/api-types';
import { Logger } from '@n8n/backend-common';
import { ProjectRepository } from '@n8n/db';
import { Service } from '@n8n/di';
import { DateTime } from 'luxon';

import { BadRequestError } from '@/errors/response-errors/bad-request.error';

import { InsightsService } from '../insights.service';
import { InsightsAnalystConfig } from './insights-analyst.config';
import {
	INSIGHTS_ANALYST_PROJECT_ID,
	INSIGHTS_ANALYST_PROJECT_NAME,
} from './insights-analyst.constants';
import { parseAnalystCompletion, resolveAnalystCitations } from './insights-analyst-completion';
import { buildAnalystFallback } from './insights-analyst-fallback';

const ANALYST_SYSTEM_PROMPT = [
	'You are the n8n Insights Analyst for the Demo Operations workspace.',
	'Answer using only the JSON workspace data in the user message.',
	'Reply with JSON only: {"answer": string, "citations": [{"workflowId": string, "metric": "total" | "failed" | "failureRate" | "timeSaved" | "averageRunTime"}]}.',
	'Cite workflow ids from the data. Do not invent workflows or metrics.',
].join('\n');

const EMPTY_SUMMARY: InsightsSummary = {
	total: { value: 0, deviation: null, unit: 'count' },
	failed: { value: 0, deviation: null, unit: 'count' },
	failureRate: { value: 0, deviation: null, unit: 'ratio' },
	timeSaved: { value: 0, deviation: null, unit: 'minute' },
	averageRunTime: { value: 0, deviation: null, unit: 'millisecond' },
};

@Service()
export class InsightsAnalystService {
	constructor(
		private readonly insightsService: InsightsService,
		private readonly projectRepository: ProjectRepository,
		private readonly config: InsightsAnalystConfig,
		private readonly logger: Logger,
	) {
		this.logger = this.logger.scoped('insights');
	}

	async getDashboard(
		query: Pick<InsightsAnalystDashboardQueryDto, 'startDate' | 'endDate'> = {},
	): Promise<InsightsAnalystDashboard> {
		const range = this.resolveRange(query.startDate, query.endDate);
		const project = await this.projectRepository.findOneBy({ id: INSIGHTS_ANALYST_PROJECT_ID });
		if (!project) {
			return { project: null, summary: EMPTY_SUMMARY, byTime: [], workflows: [] };
		}

		const [summary, byTime, byWorkflow] = await Promise.all([
			this.insightsService.getInsightsSummary({ projectId: project.id, ...range }),
			this.insightsService.getInsightsByTime({ projectId: project.id, ...range }),
			this.insightsService.getInsightsByWorkflow({
				projectId: project.id,
				skip: 0,
				take: 8,
				sortBy: 'timeSaved:desc',
				...range,
			}),
		]);

		return {
			project: { id: project.id, name: project.name || INSIGHTS_ANALYST_PROJECT_NAME },
			summary,
			byTime: toInsightsByTime(byTime),
			workflows: byWorkflow.data,
		};
	}

	async chat(body: InsightsAnalystChatRequestDto): Promise<InsightsAnalystChatResponse> {
		const dashboard = await this.getDashboard(body);
		const fallback = buildAnalystFallback(body.message, dashboard.summary, dashboard.workflows);
		if (!this.config.anthropicApiKey) return fallback;

		try {
			const text = await this.complete(body.message, dashboard);
			const parsed = parseAnalystCompletion(text);
			if (!parsed) {
				this.logger.warn('Insights analyst model returned an unusable response', {
					model: this.config.anthropicModel,
				});
				return fallback;
			}
			return {
				answer: parsed.answer,
				citations: resolveAnalystCitations(parsed.citations, dashboard.workflows),
				mode: 'llm',
			};
		} catch {
			this.logger.error('Insights analyst model call failed', {
				model: this.config.anthropicModel,
			});
			return fallback;
		}
	}

	private resolveRange(startDate?: Date, endDate?: Date): { startDate: Date; endDate: Date } {
		const end = endDate ?? new Date();
		const start = startDate ?? DateTime.fromJSDate(end).minus({ days: 30 }).toJSDate();
		if (start > end) {
			throw new BadRequestError('endDate must be the same as or after startDate');
		}
		return { startDate: start, endDate: end };
	}

	private async complete(message: string, dashboard: InsightsAnalystDashboard): Promise<string> {
		const [{ createAnthropic }, { generateText }] = await Promise.all([
			import('@ai-sdk/anthropic'),
			import('ai'),
		]);
		const anthropic = createAnthropic({ apiKey: this.config.anthropicApiKey });
		const result = await generateText({
			model: anthropic(this.config.anthropicModel),
			system: ANALYST_SYSTEM_PROMPT,
			prompt: JSON.stringify({
				question: message,
				summary: dashboard.summary,
				workflows: dashboard.workflows.map((workflow) => ({
					workflowId: workflow.workflowId,
					workflowName: workflow.workflowName,
					total: workflow.total,
					failed: workflow.failed,
					failureRate: workflow.failureRate,
					timeSavedMinutes: workflow.timeSaved,
					averageRunTimeMs: workflow.averageRunTime,
				})),
			}),
		});
		this.logger.info('Insights analyst model call succeeded', {
			model: this.config.anthropicModel,
		});
		return result.text;
	}
}

function toInsightsByTime(
	rows: Awaited<ReturnType<InsightsService['getInsightsByTime']>>,
): InsightsByTime[] {
	return rows.map((row) => ({
		date: toIsoTimestamp(row.date),
		values: {
			total: row.values.total ?? 0,
			succeeded: row.values.succeeded ?? 0,
			failed: row.values.failed ?? 0,
			failureRate: row.values.failureRate ?? 0,
			averageRunTime: row.values.averageRunTime ?? 0,
			timeSaved: row.values.timeSaved ?? 0,
		},
	}));
}

function toIsoTimestamp(value: string | null): string {
	if (!value) return new Date(0).toISOString();
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return new Date(0).toISOString();
	return parsed.toISOString();
}
