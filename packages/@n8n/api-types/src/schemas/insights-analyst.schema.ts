import { z } from 'zod';

import {
	insightsByTimeSchema,
	insightsByWorkflowSchema,
	insightsSummarySchema,
} from './insights.schema';

export const insightsAnalystMetricSchema = z.enum([
	'timeSaved',
	'total',
	'failed',
	'failureRate',
	'averageRunTime',
]);
export type InsightsAnalystMetric = z.infer<typeof insightsAnalystMetricSchema>;

export const insightsAnalystCitationSchema = z
	.object({
		workflowId: z.string(),
		workflowName: z.string(),
		metric: insightsAnalystMetricSchema,
		value: z.number(),
	})
	.strict();
export type InsightsAnalystCitation = z.infer<typeof insightsAnalystCitationSchema>;

export const insightsAnalystHighlightSchema = z
	.object({
		id: z.string(),
		workflowId: z.string(),
		workflowName: z.string(),
		description: z.string(),
		metric: insightsAnalystMetricSchema,
		value: z.number(),
	})
	.strict();
export type InsightsAnalystHighlight = z.infer<typeof insightsAnalystHighlightSchema>;

export const insightsAnalystWorkflowRowSchema = z
	.object({
		workflowId: z.string(),
		workflowName: z.string(),
		total: z.number(),
		failed: z.number(),
		failureRate: z.number(),
		timeSaved: z.number(),
		averageRunTime: z.number(),
		timeSavedPerExecution: z.number(),
		description: z.string(),
	})
	.strict();
export type InsightsAnalystWorkflowRow = z.infer<typeof insightsAnalystWorkflowRowSchema>;

export const insightsAnalystDashboardSchema = z
	.object({
		project: z.object({ id: z.string(), name: z.string() }).strict(),
		summary: insightsSummarySchema,
		byTime: z.array(insightsByTimeSchema),
		byWorkflow: insightsByWorkflowSchema,
		highlights: z.array(insightsAnalystHighlightSchema),
		rankings: z.array(insightsAnalystWorkflowRowSchema),
		lowImpact: z.array(insightsAnalystWorkflowRowSchema),
	})
	.strict();
export type InsightsAnalystDashboard = z.infer<typeof insightsAnalystDashboardSchema>;

export const insightsAnalystChatModeSchema = z.enum(['llm', 'fallback']);
export type InsightsAnalystChatMode = z.infer<typeof insightsAnalystChatModeSchema>;

/** Shape the model must return. `mode` is added by the server after validation. */
export const insightsAnalystModelResponseSchema = z
	.object({
		answer: z.string().min(1),
		citations: z.array(insightsAnalystCitationSchema).max(6),
	})
	.strict();
export type InsightsAnalystModelResponse = z.infer<typeof insightsAnalystModelResponseSchema>;

export const insightsAnalystChatResponseSchema = insightsAnalystModelResponseSchema
	.extend({
		mode: insightsAnalystChatModeSchema,
	})
	.strict();
export type InsightsAnalystChatResponse = z.infer<typeof insightsAnalystChatResponseSchema>;
