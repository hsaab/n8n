import type { TypeUnit } from './database/entities/insights-shared';

export const INSIGHTS_DEMO_PROJECT_ID = 'insights-demo-project';
export const INSIGHTS_DEMO_PROJECT_NAME = 'Demo Operations';
export const INSIGHTS_DEMO_WORKFLOW_ID_PREFIX = 'insights-demo-';
export const INSIGHTS_DEMO_SEED_DAYS = 30;

export const INSIGHTS_DEMO_PERIOD_TYPES = [
	'success',
	'failure',
	'runtime_ms',
	'time_saved_min',
] as const satisfies readonly TypeUnit[];

export type InsightsDemoWorkflowSpec = {
	id: `${typeof INSIGHTS_DEMO_WORKFLOW_ID_PREFIX}${string}`;
	name: string;
	timeSavedPerExecution: number;
	avgRuntimeMs: number;
};

export const INSIGHTS_DEMO_WORKFLOWS: readonly InsightsDemoWorkflowSpec[] = [
	{
		id: 'insights-demo-ap-invoice-ingestion',
		name: 'AP invoice ingestion',
		timeSavedPerExecution: 18,
		avgRuntimeMs: 1400,
	},
	{
		id: 'insights-demo-lead-enrichment',
		name: 'Lead enrichment',
		timeSavedPerExecution: 9,
		avgRuntimeMs: 950,
	},
	{
		id: 'insights-demo-order-routing',
		name: 'Order routing',
		timeSavedPerExecution: 6,
		avgRuntimeMs: 720,
	},
	{
		id: 'insights-demo-support-ticket-triage',
		name: 'Support ticket triage',
		timeSavedPerExecution: 11,
		avgRuntimeMs: 1100,
	},
	{
		id: 'insights-demo-inventory-sync',
		name: 'Inventory sync',
		timeSavedPerExecution: 4,
		avgRuntimeMs: 640,
	},
	{
		id: 'insights-demo-customer-onboarding',
		name: 'Customer onboarding',
		timeSavedPerExecution: 22,
		avgRuntimeMs: 1800,
	},
	{
		id: 'insights-demo-refund-processing',
		name: 'Refund processing',
		timeSavedPerExecution: 14,
		avgRuntimeMs: 1250,
	},
	{
		id: 'insights-demo-weekly-exec-digest',
		name: 'Weekly exec digest',
		timeSavedPerExecution: 8,
		avgRuntimeMs: 880,
	},
];

export const INSIGHTS_DEMO_WORKFLOW_IDS = INSIGHTS_DEMO_WORKFLOWS.map((workflow) => workflow.id);
