import { z } from 'zod';

import {
	insightsByTimeSchema,
	insightsByWorkflowSchema,
	insightsSummarySchema,
} from './insights.schema';

export const insightsAnalystWorkflowRowSchema = insightsByWorkflowSchema.shape.data.element;

export const insightsAnalystDashboardSchema = z
	.object({
		project: z
			.object({
				id: z.string(),
				name: z.string(),
			})
			.nullable(),
		summary: insightsSummarySchema,
		byTime: z.array(insightsByTimeSchema),
		workflows: z.array(insightsAnalystWorkflowRowSchema),
	})
	.strict();

export type InsightsAnalystDashboard = z.infer<typeof insightsAnalystDashboardSchema>;
export type InsightsAnalystWorkflowRow = z.infer<typeof insightsAnalystWorkflowRowSchema>;

export const insightsAnalystCitationMetricSchema = z.enum([
	'total',
	'failed',
	'failureRate',
	'timeSaved',
	'averageRunTime',
]);

export type InsightsAnalystCitationMetric = z.infer<typeof insightsAnalystCitationMetricSchema>;

export const insightsAnalystCitationSchema = z
	.object({
		workflowId: z.string(),
		workflowName: z.string(),
		metric: insightsAnalystCitationMetricSchema,
		value: z.number(),
	})
	.strict();

export type InsightsAnalystCitation = z.infer<typeof insightsAnalystCitationSchema>;

export const insightsAnalystChatModeSchema = z.enum(['llm', 'fallback']);

export const insightsAnalystChatResponseSchema = z
	.object({
		answer: z.string(),
		citations: z.array(insightsAnalystCitationSchema),
		mode: insightsAnalystChatModeSchema,
	})
	.strict();

export type InsightsAnalystChatResponse = z.infer<typeof insightsAnalystChatResponseSchema>;

/** Shape requested from the model. Values are filled from workspace data after validation. */
export const insightsAnalystCompletionSchema = z
	.object({
		answer: z.string().trim().min(1),
		citations: z.array(
			z
				.object({
					workflowId: z.string(),
					metric: insightsAnalystCitationMetricSchema,
				})
				.strict(),
		),
	})
	.strict();

export type InsightsAnalystCompletion = z.infer<typeof insightsAnalystCompletionSchema>;
