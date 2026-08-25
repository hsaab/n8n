import { z } from 'zod';

import { insightsByTimeSchema, insightsSummarySchema } from './insights.schema';

export const insightsAnalystCitationSchema = z
	.object({
		workflowId: z.string(),
		label: z.string(),
		metric: z.string(),
	})
	.strict();
export type InsightsAnalystCitation = z.infer<typeof insightsAnalystCitationSchema>;

/**
 * Shared with `InsightsAnalystChatRequestDto`. The controller registry only forwards
 * a `@Body` argument whose declared type has `safeParse`, so the route needs the DTO
 * class while the frontend client keeps using the schema.
 */
export const insightsAnalystChatRequestShape = {
	question: z.string().min(1),
	suggestedPromptId: z.string().optional(),
};

export const insightsAnalystChatRequestSchema = z.object(insightsAnalystChatRequestShape).strict();
export type InsightsAnalystChatRequest = z.infer<typeof insightsAnalystChatRequestSchema>;

export const insightsAnalystRecommendationSchema = z
	.object({
		action: z.string().min(1),
		detail: z.string().optional(),
	})
	.strict();
export type InsightsAnalystRecommendation = z.infer<typeof insightsAnalystRecommendationSchema>;

/**
 * Three blocks the rail can render without parsing markdown. The next step
 * lives on `recommendation` so it cannot disappear into a prose paragraph.
 */
export const insightsAnalystChatResponseSchema = z
	.object({
		finding: z.string().min(1),
		evidence: z.array(z.string()),
		recommendation: insightsAnalystRecommendationSchema,
		citations: z.array(insightsAnalystCitationSchema),
		mode: z.enum(['llm', 'fallback']),
	})
	.strict();
export type InsightsAnalystChatResponse = z.infer<typeof insightsAnalystChatResponseSchema>;

/**
 * Which of the three analyst cards a highlight fills. It also decides how
 * `metricValue` is read: total minutes saved for `impact`, minutes saved per run
 * for `efficiency`, and a failed execution count for `attention`.
 */
export const insightsAnalystHighlightKindSchema = z.enum(['impact', 'efficiency', 'attention']);
export type InsightsAnalystHighlightKind = z.infer<typeof insightsAnalystHighlightKindSchema>;

export const insightsAnalystHighlightSchema = z
	.object({
		workflowId: z.string(),
		kind: insightsAnalystHighlightKindSchema,
		workflowName: z.string(),
		blurb: z.string(),
		metricValue: z.number(),
	})
	.strict();
export type InsightsAnalystHighlight = z.infer<typeof insightsAnalystHighlightSchema>;

export const insightsAnalystRankingRowSchema = z
	.object({
		rank: z.number(),
		workflowId: z.string(),
		name: z.string(),
		department: z.string(),
		timeSavedMinutes: z.number(),
	})
	.strict();
export type InsightsAnalystRankingRow = z.infer<typeof insightsAnalystRankingRowSchema>;

export const insightsAnalystLowImpactSchema = z
	.object({
		workflowId: z.string(),
		name: z.string(),
		blurb: z.string(),
		timeSavedPerRunMinutes: z.number(),
	})
	.strict();
export type InsightsAnalystLowImpact = z.infer<typeof insightsAnalystLowImpactSchema>;

export const insightsAnalystOverviewSchema = z
	.object({
		summary: insightsSummarySchema,
		byTime: z.array(insightsByTimeSchema),
		highlights: z.array(insightsAnalystHighlightSchema),
		ranking: z.array(insightsAnalystRankingRowSchema),
		lowImpact: z.array(insightsAnalystLowImpactSchema),
	})
	.strict();
export type InsightsAnalystOverview = z.infer<typeof insightsAnalystOverviewSchema>;
