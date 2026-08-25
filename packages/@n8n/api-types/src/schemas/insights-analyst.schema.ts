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

export const insightsAnalystChatRequestSchema = z
	.object({
		question: z.string(),
		suggestedPromptId: z.string().optional(),
	})
	.strict();
export type InsightsAnalystChatRequest = z.infer<typeof insightsAnalystChatRequestSchema>;

export const insightsAnalystChatResponseSchema = z
	.object({
		answer: z.string(),
		citations: z.array(insightsAnalystCitationSchema),
		mode: z.enum(['llm', 'fallback']),
	})
	.strict();
export type InsightsAnalystChatResponse = z.infer<typeof insightsAnalystChatResponseSchema>;

export const insightsAnalystHighlightSchema = z
	.object({
		workflowId: z.string(),
		title: z.string(),
		blurb: z.string(),
		metric: z.string(),
	})
	.strict();
export type InsightsAnalystHighlight = z.infer<typeof insightsAnalystHighlightSchema>;

export const insightsAnalystRankingRowSchema = z
	.object({
		rank: z.number(),
		workflowId: z.string(),
		name: z.string(),
		timeSavedLabel: z.string(),
	})
	.strict();
export type InsightsAnalystRankingRow = z.infer<typeof insightsAnalystRankingRowSchema>;

export const insightsAnalystLowImpactSchema = z
	.object({
		workflowId: z.string(),
		name: z.string(),
		blurb: z.string(),
		timeSavedPerRunLabel: z.string(),
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
