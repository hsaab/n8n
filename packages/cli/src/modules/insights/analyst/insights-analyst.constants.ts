export const INSIGHTS_ANALYST_PROJECT_ID = 'insights-demo-project';
export const INSIGHTS_ANALYST_PROJECT_NAME = 'Demo Operations';
export const INSIGHTS_ANALYST_PROJECT_MARKER = 'insights-analyst-demo';
export const INSIGHTS_ANALYST_WORKFLOW_ID_PREFIX = 'insights-demo-';
export const INSIGHTS_ANALYST_EXECUTION_KEY_PREFIX = 'insights-demo:';
export const INSIGHTS_ANALYST_HISTORY_DAYS = 30;

export type InsightsAnalystWorkflowSpec = {
	id: string;
	name: string;
	timeSavedPerExecution: number;
	successBase: number;
	failureBase: number;
	runtimeMs: number;
	versionId: string;
};

export const INSIGHTS_ANALYST_WORKFLOWS: InsightsAnalystWorkflowSpec[] = [
	{
		id: 'insights-demo-invoice',
		name: 'Invoice Intake',
		timeSavedPerExecution: 12,
		successBase: 48,
		failureBase: 1,
		runtimeMs: 1_800,
		versionId: '11111111-1111-4111-8111-111111111101',
	},
	{
		id: 'insights-demo-leads',
		name: 'Lead Routing',
		timeSavedPerExecution: 8,
		successBase: 36,
		failureBase: 2,
		runtimeMs: 2_400,
		versionId: '11111111-1111-4111-8111-111111111102',
	},
	{
		id: 'insights-demo-support',
		name: 'Support Triage',
		timeSavedPerExecution: 15,
		successBase: 52,
		failureBase: 4,
		runtimeMs: 3_200,
		versionId: '11111111-1111-4111-8111-111111111103',
	},
	{
		id: 'insights-demo-revenue',
		name: 'Daily Revenue Sync',
		timeSavedPerExecution: 6,
		successBase: 20,
		failureBase: 1,
		runtimeMs: 9_000,
		versionId: '11111111-1111-4111-8111-111111111104',
	},
	{
		id: 'insights-demo-renewals',
		name: 'Contract Renewal Reminders',
		timeSavedPerExecution: 20,
		successBase: 10,
		failureBase: 1,
		runtimeMs: 1_500,
		versionId: '11111111-1111-4111-8111-111111111105',
	},
	{
		id: 'insights-demo-inventory',
		name: 'Inventory Reconciliation',
		timeSavedPerExecution: 4,
		successBase: 6,
		failureBase: 2,
		runtimeMs: 12_000,
		versionId: '11111111-1111-4111-8111-111111111106',
	},
	{
		id: 'insights-demo-onboarding',
		name: 'Onboarding Checklist',
		timeSavedPerExecution: 3,
		successBase: 4,
		failureBase: 0,
		runtimeMs: 2_000,
		versionId: '11111111-1111-4111-8111-111111111107',
	},
	{
		id: 'insights-demo-payments',
		name: 'Failed Payment Recovery',
		timeSavedPerExecution: 10,
		successBase: 8,
		failureBase: 14,
		runtimeMs: 4_500,
		versionId: '11111111-1111-4111-8111-111111111108',
	},
];
