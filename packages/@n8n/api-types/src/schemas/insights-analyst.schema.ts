import { z } from 'zod';

import { insightsSummarySchema } from './insights.schema';

export { InsightsDateFilterDto as InsightsAnalystOverviewQueryDto } from '../dto/insights/date-filter.dto';

const insightsAnalystIsoDateSchema = z
	.string()
	.refine((val) => !isNaN(Date.parse(val)) && new Date(val).toISOString() === val, {
		message: 'Invalid date format, must be ISO 8601 format',
	});

export const insightsAnalystHighlightKindSchema = z.enum(['impact', 'efficiency', 'attention']);
export type InsightsAnalystHighlightKind = z.infer<typeof insightsAnalystHighlightKindSchema>;

export const insightsAnalystHighlightSchema = z
	.object({
		kind: insightsAnalystHighlightKindSchema,
		workflowId: z.string(),
		workflowName: z.string(),
		description: z.string(),
		value: z.number(),
	})
	.strict();
export type InsightsAnalystHighlight = z.infer<typeof insightsAnalystHighlightSchema>;

export const insightsAnalystChartPointSchema = z
	.object({
		date: insightsAnalystIsoDateSchema,
		succeeded: z.number(),
		failed: z.number(),
	})
	.strict();
export type InsightsAnalystChartPoint = z.infer<typeof insightsAnalystChartPointSchema>;

export const insightsAnalystRankingRowSchema = z
	.object({
		workflowId: z.string(),
		workflowName: z.string(),
		timeSaved: z.number(),
	})
	.strict();
export type InsightsAnalystRankingRow = z.infer<typeof insightsAnalystRankingRowSchema>;

export const insightsAnalystLowImpactSchema = z
	.object({
		workflowId: z.string(),
		workflowName: z.string(),
		description: z.string(),
		timeSavedPerExecution: z.number(),
	})
	.strict();
export type InsightsAnalystLowImpact = z.infer<typeof insightsAnalystLowImpactSchema>;

export const insightsAnalystCitationSchema = z
	.object({
		workflowId: z.string(),
		workflowName: z.string(),
	})
	.strict();
export type InsightsAnalystCitation = z.infer<typeof insightsAnalystCitationSchema>;

export const insightsAnalystOverviewSchema = z
	.object({
		summary: insightsSummarySchema,
		highlights: z.array(insightsAnalystHighlightSchema).length(3),
		chart: z.array(insightsAnalystChartPointSchema),
		ranking: z.array(insightsAnalystRankingRowSchema).length(5),
		lowImpact: z.array(insightsAnalystLowImpactSchema).length(3),
		citationAllowlist: z.array(insightsAnalystCitationSchema),
	})
	.strict();
export type InsightsAnalystOverview = z.infer<typeof insightsAnalystOverviewSchema>;

export const insightsAnalystChatResponseSchema = z
	.object({
		mode: z.enum(['llm', 'fallback']),
		finding: z.string(),
		evidence: z.string(),
		recommendation: z.string(),
		citations: z.array(insightsAnalystCitationSchema),
	})
	.strict();
export type InsightsAnalystChatResponse = z.infer<typeof insightsAnalystChatResponseSchema>;
