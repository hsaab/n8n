export const INSIGHTS_DEMO_PROJECT_ID = 'insights-demo-project';
export const INSIGHTS_DEMO_PROJECT_NAME = 'Demo Operations';
export const INSIGHTS_DEMO_SEED_DAYS = 30;

export const INSIGHTS_DEMO_WORKFLOWS = [
	{
		id: 'insights-demo-wf-invoice',
		name: 'Demo: AP invoice ingestion',
		timeSavedPerExecution: 12,
		dailySuccess: 28,
		dailyFailure: 1,
		dailyRuntimeMs: 4200,
	},
	{
		id: 'insights-demo-wf-leads',
		name: 'Demo: Lead enrichment and scoring',
		timeSavedPerExecution: 9,
		dailySuccess: 22,
		dailyFailure: 1,
		dailyRuntimeMs: 3100,
	},
	{
		id: 'insights-demo-wf-orders',
		name: 'Demo: Order routing escalations',
		timeSavedPerExecution: 8,
		dailySuccess: 18,
		dailyFailure: 2,
		dailyRuntimeMs: 2800,
	},
	{
		id: 'insights-demo-wf-it',
		name: 'Demo: New-hire IT provisioning',
		timeSavedPerExecution: 7,
		dailySuccess: 14,
		dailyFailure: 1,
		dailyRuntimeMs: 2500,
	},
	{
		id: 'insights-demo-wf-vendor',
		name: 'Demo: Vendor onboarding nudges',
		timeSavedPerExecution: 5,
		dailySuccess: 10,
		dailyFailure: 1,
		dailyRuntimeMs: 1800,
	},
	{
		id: 'insights-demo-wf-shipments',
		name: 'Demo: Collects delayed shipments',
		timeSavedPerExecution: 6,
		dailySuccess: 16,
		dailyFailure: 2,
		dailyRuntimeMs: 2200,
	},
	{
		id: 'insights-demo-wf-standup',
		name: 'Demo: Daily standup digest',
		timeSavedPerExecution: 7,
		dailySuccess: 8,
		dailyFailure: 0,
		dailyRuntimeMs: 900,
	},
	{
		id: 'insights-demo-wf-survey',
		name: 'Demo: Customer survey follow-up',
		timeSavedPerExecution: 8,
		dailySuccess: 9,
		dailyFailure: 1,
		dailyRuntimeMs: 1100,
	},
];

export const INSIGHTS_DEMO_WORKFLOW_IDS = INSIGHTS_DEMO_WORKFLOWS.map((workflow) => workflow.id);
