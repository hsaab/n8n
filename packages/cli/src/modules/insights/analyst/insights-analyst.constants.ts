export const DEMO_PROJECT_ID = 'insights-demo-project';
export const DEMO_PROJECT_NAME = 'Demo Operations';

/** Aggregates cover the current window plus the previous one so summary deviation is populated. */
export const DEMO_AGGREGATE_DAYS = 60;
export const DEMO_EXECUTION_DAYS = 30;
export const DEMO_DEFAULT_RANGE_DAYS = 30;

export type DemoWorkflowSpec = {
	id: string;
	name: string;
	versionId: string;
	timeSavedPerExecution: number;
	dailySuccess: number;
	dailyFailure: number;
	runtimeMs: number;
	description: string;
};

export const DEMO_WORKFLOWS: DemoWorkflowSpec[] = [
	{
		id: 'insights-demo-workflow-01',
		name: 'Invoice reminder',
		versionId: 'insights-demo-version-01',
		timeSavedPerExecution: 15,
		dailySuccess: 8,
		dailyFailure: 1,
		runtimeMs: 4500,
		description: 'Routes supplier invoices and asks finance to review only the exceptions.',
	},
	{
		id: 'insights-demo-workflow-02',
		name: 'Lead enrichment',
		versionId: 'insights-demo-version-02',
		timeSavedPerExecution: 8,
		dailySuccess: 6,
		dailyFailure: 1,
		runtimeMs: 6200,
		description: 'Scores inbound leads and routes the ones worth a follow-up.',
	},
	{
		id: 'insights-demo-workflow-03',
		name: 'Slack incident digest',
		versionId: 'insights-demo-version-03',
		timeSavedPerExecution: 3,
		dailySuccess: 4,
		dailyFailure: 0,
		runtimeMs: 1800,
		description: 'Posts a short incident summary when production runs fail.',
	},
	{
		id: 'insights-demo-workflow-04',
		name: 'Customer onboarding',
		versionId: 'insights-demo-version-04',
		timeSavedPerExecution: 25,
		dailySuccess: 2,
		dailyFailure: 0,
		runtimeMs: 9000,
		description: 'Nudges owners when onboarding approvals or documents stall.',
	},
	{
		id: 'insights-demo-workflow-05',
		name: 'Renewal outreach',
		versionId: 'insights-demo-version-05',
		timeSavedPerExecution: 10,
		dailySuccess: 3,
		dailyFailure: 1,
		runtimeMs: 5100,
		description: 'Reminds account owners before a renewal date slips.',
	},
	{
		id: 'insights-demo-workflow-06',
		name: 'Support ticket triage',
		versionId: 'insights-demo-version-06',
		timeSavedPerExecution: 6,
		dailySuccess: 7,
		dailyFailure: 3,
		runtimeMs: 3800,
		description: 'Collects delayed tickets and shows where support should intervene first.',
	},
	{
		id: 'insights-demo-workflow-07',
		name: 'Weekly revenue snapshot',
		versionId: 'insights-demo-version-07',
		timeSavedPerExecution: 4,
		dailySuccess: 1,
		dailyFailure: 0,
		runtimeMs: 12000,
		description: "Summarizes the week's revenue for the Monday review.",
	},
	{
		id: 'insights-demo-workflow-08',
		name: 'Failed payment recovery',
		versionId: 'insights-demo-version-08',
		timeSavedPerExecution: 20,
		dailySuccess: 2,
		dailyFailure: 1,
		runtimeMs: 7000,
		description: 'Retries failed payments and flags the ones that still need a person.',
	},
];

export const DEMO_WORKFLOW_IDS = DEMO_WORKFLOWS.map((workflow) => workflow.id);
