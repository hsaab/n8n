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
	/** Rendered next to the name in the ranking, as "Order routing escalations (Operations)". */
	department: string;
	/** One sentence describing what the workflow does, shown on the analyst cards. */
	blurb: string;
	timeSavedPerExecution: number;
	dailyExecutions: number;
	dailyFailures: number;
	avgRuntimeMs: number;
};

/**
 * Volumes are chosen so the seeded 30-day window reproduces the analyst design:
 * the first five workflows rank highest by total time saved, the three cheapest
 * per run are vendor onboarding, standup digest and survey follow-up, and
 * delayed shipment triage carries the most failures.
 */
export const INSIGHTS_DEMO_WORKFLOWS: readonly InsightsDemoWorkflowSpec[] = [
	{
		id: 'insights-demo-ap-invoice-ingestion',
		name: 'AP invoice ingestion',
		department: 'Finance',
		blurb: 'Routes supplier invoices, extracts totals, and asks finance to review only exceptions.',
		timeSavedPerExecution: 15,
		dailyExecutions: 18,
		dailyFailures: 1,
		avgRuntimeMs: 42000,
	},
	{
		id: 'insights-demo-lead-enrichment',
		name: 'Lead enrichment & scoring',
		department: 'Revenue Ops',
		blurb: 'Enriches inbound leads with firmographics and scores them before sales picks them up.',
		timeSavedPerExecution: 12,
		dailyExecutions: 15,
		dailyFailures: 1,
		avgRuntimeMs: 30000,
	},
	{
		id: 'insights-demo-order-routing',
		name: 'Order routing escalations',
		department: 'Operations',
		blurb: 'Escalates orders that miss their routing window to the regional operations queue.',
		// 10 rather than 8 so this does not tie with the survey follow-up, whose place
		// among the three lowest per run would then depend on sort order alone.
		timeSavedPerExecution: 10,
		dailyExecutions: 16,
		dailyFailures: 1,
		avgRuntimeMs: 22000,
	},
	{
		id: 'insights-demo-new-hire-provisioning',
		name: 'New-hire IT provisioning',
		department: 'People',
		blurb: 'Creates accounts, assigns licences, and raises hardware requests for every new hire.',
		timeSavedPerExecution: 12,
		dailyExecutions: 9,
		dailyFailures: 0,
		avgRuntimeMs: 55000,
	},
	{
		id: 'insights-demo-vendor-onboarding',
		name: 'Vendor onboarding nudges',
		department: 'Procurement',
		blurb: 'Keeps vendor onboarding moving by nudging owners when approvals stall.',
		timeSavedPerExecution: 5,
		dailyExecutions: 12,
		dailyFailures: 0,
		avgRuntimeMs: 16000,
	},
	{
		id: 'insights-demo-standup-digest',
		name: 'Daily standup digest',
		department: 'Operations',
		blurb: 'Summarizes overnight executions for the morning operations standup.',
		timeSavedPerExecution: 7,
		dailyExecutions: 8,
		dailyFailures: 0,
		avgRuntimeMs: 11000,
	},
	{
		id: 'insights-demo-survey-follow-up',
		name: 'Customer survey follow-up',
		department: 'Customer Success',
		blurb: 'Follows up with respondents whose NPS dropped week-over-week.',
		timeSavedPerExecution: 8,
		dailyExecutions: 6,
		dailyFailures: 1,
		avgRuntimeMs: 19000,
	},
	{
		id: 'insights-demo-delayed-shipment-triage',
		name: 'Delayed shipment triage',
		department: 'Operations',
		blurb: 'Collects delayed shipments and summarizes where operations should intervene first.',
		timeSavedPerExecution: 9,
		dailyExecutions: 5,
		dailyFailures: 2,
		avgRuntimeMs: 47000,
	},
];

export const INSIGHTS_DEMO_WORKFLOW_IDS = INSIGHTS_DEMO_WORKFLOWS.map((workflow) => workflow.id);

const workflowsById = new Map(INSIGHTS_DEMO_WORKFLOWS.map((spec) => [spec.id as string, spec]));

export const findInsightsDemoWorkflow = (
	workflowId: string,
): InsightsDemoWorkflowSpec | undefined => workflowsById.get(workflowId);
