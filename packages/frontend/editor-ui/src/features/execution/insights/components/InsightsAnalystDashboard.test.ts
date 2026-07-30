import { createComponentRenderer } from '@/__tests__/render';
import InsightsAnalystDashboard from './InsightsAnalystDashboard.vue';
import { createTestingPinia } from '@pinia/testing';
import { defaultSettings } from '@/__tests__/defaults';
import { useInsightsStore } from '@/features/execution/insights/insights.store';
import { mockedStore, type MockedStore } from '@/__tests__/utils';
import { within, screen, waitFor } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import type { FrontendModuleSettings, InsightsAnalystOverview } from '@n8n/api-types';
import { vi } from 'vitest';

vi.mock('vue-chartjs', () => ({
	Bar: {
		template: '<div>Bar</div>',
	},
	Line: {
		template: '<div>Line</div>',
	},
}));

const mockTelemetry = {
	track: vi.fn(),
};

vi.mock('@/app/composables/useTelemetry', () => ({
	useTelemetry: () => mockTelemetry,
}));

const renderComponent = createComponentRenderer(InsightsAnalystDashboard);

const moduleSettings: FrontendModuleSettings = {
	insights: {
		summary: true,
		dashboard: true,
		dateRanges: [
			{
				key: 'day',
				licensed: true,
				granularity: 'hour',
			},
			{
				key: 'week',
				licensed: true,
				granularity: 'day',
			},
			{
				key: 'month',
				licensed: true,
				granularity: 'day',
			},
			{
				key: 'quarter',
				licensed: false,
				granularity: 'week',
			},
		],
	},
};

const mockOverview: InsightsAnalystOverview = {
	project: { id: 'demo-project', name: 'Demo Operations' },
	// 18-day window so the picker label differs from the default last-30-days tip fallback
	dateRange: {
		startDate: '2000-12-01T00:00:00.000Z',
		endDate: '2000-12-19T00:00:00.000Z',
	},
	summary: {
		total: { value: 1250, deviation: 15, unit: 'count' },
		failed: { value: 23, deviation: -8, unit: 'count' },
		failureRate: { value: 0.0184, deviation: -0.005, unit: 'ratio' },
		timeSaved: { value: 3600, deviation: 20, unit: 'minute' },
		averageRunTime: { value: 15000, deviation: 2000, unit: 'millisecond' },
	},
	byTime: [
		{
			date: '2000-12-01',
			values: {
				total: 100,
				failed: 5,
				failureRate: 5,
				timeSaved: 45,
				averageRunTime: 12,
				succeeded: 95,
			},
		},
		{
			date: '2000-12-02',
			values: {
				total: 120,
				failed: 8,
				failureRate: 6.7,
				timeSaved: 55,
				averageRunTime: 15,
				succeeded: 112,
			},
		},
	],
	byWorkflow: {
		count: 2,
		data: [
			{
				workflowId: 'workflow-1',
				workflowName: 'Invoice intake triage',
				total: 100,
				failed: 5,
				failureRate: 5,
				timeSaved: 45,
				averageRunTime: 12,
				projectId: 'demo-project',
				projectName: 'Demo Operations',
				succeeded: 95,
				runTime: 1200,
			},
			{
				workflowId: 'workflow-2',
				workflowName: 'Vendor onboarding checklist',
				total: 50,
				failed: 2,
				failureRate: 4,
				timeSaved: 20,
				averageRunTime: 8,
				projectId: 'demo-project',
				projectName: 'Demo Operations',
				succeeded: 48,
				runTime: 400,
			},
		],
	},
	highlights: [
		{
			id: 'top-saver',
			title: 'Invoice intake triage leads time saved',
			workflowId: 'workflow-1',
			workflowName: 'Invoice intake triage',
			description: 'Highest time saved in the demo window',
			trend: 'positive',
			value: 150,
			unit: 'minute',
		},
	],
	lowImpactWorkflows: [],
	suggestedPrompts: ['Which workflows failed most?'],
};

let insightsStore: MockedStore<typeof useInsightsStore>;

const date = new Date('2000-12-19T00:00:00.000Z');

const openDatePicker = async (getByRole: (role: string, options?: object) => HTMLElement) => {
	const trigger = getByRole('button', { name: '1 Dec - 19 Dec, 2000' });
	expect(trigger).toBeInTheDocument();
	await userEvent.click(trigger);

	const controllingId = trigger.getAttribute('aria-controls');
	expect(controllingId).toBeDefined();

	const picker = document.getElementById(controllingId as string);
	expect(picker).toBeInTheDocument();

	return picker as HTMLElement;
};

describe('InsightsAnalystDashboard', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.setSystemTime(date);

		createTestingPinia({
			initialState: { settings: { settings: defaultSettings, moduleSettings } },
		});

		insightsStore = mockedStore(useInsightsStore);

		insightsStore.isSummaryEnabled = true;
		insightsStore.isDashboardEnabled = true;
		insightsStore.isInsightsEnabled = true;

		insightsStore.summary = {
			state: [],
			isLoading: false,
			execute: vi.fn(),
			isReady: true,
			error: null,
			then: vi.fn(),
		};

		insightsStore.charts = {
			state: [],
			isLoading: false,
			execute: vi.fn(),
			isReady: true,
			error: null,
			then: vi.fn(),
		};

		insightsStore.table = {
			state: { count: 0, data: [] },
			isLoading: false,
			execute: vi.fn(),
			isReady: true,
			error: null,
			then: vi.fn(),
		};

		insightsStore.analystOverview = {
			state: mockOverview,
			isLoading: false,
			execute: vi.fn(),
			isReady: true,
			error: null,
			then: vi.fn(),
		};
	});

	describe('Overview load and shell', () => {
		it('fetches analyst overview on mount and renders summary, chart, and highlights', async () => {
			renderComponent();

			expect(insightsStore.analystOverview.execute).toHaveBeenCalled();

			await waitFor(() => {
				expect(screen.getByTestId('insights-analyst-dashboard')).toBeInTheDocument();
				expect(screen.getByTestId('insights-summary-tabs')).toBeInTheDocument();
				expect(screen.getByTestId('insights-chart-total')).toBeInTheDocument();
				expect(screen.getByText('Invoice intake triage leads time saved')).toBeInTheDocument();
				expect(screen.getByText('Invoice intake triage')).toBeInTheDocument();
				expect(screen.getByTestId('insights-analyst-panel')).toBeInTheDocument();
			});
		});

		it('does not refetch live Insights list endpoints on mount', () => {
			renderComponent();

			expect(insightsStore.summary.execute).not.toHaveBeenCalled();
			expect(insightsStore.charts.execute).not.toHaveBeenCalled();
			expect(insightsStore.table.execute).not.toHaveBeenCalled();
		});
	});

	describe('Date range picker', () => {
		it('shows the overview date range without triggering live Insights list refetch on change', async () => {
			const { getByRole } = renderComponent();

			await waitFor(() => {
				expect(screen.getByTestId('insights-analyst-dashboard')).toBeInTheDocument();
			});

			vi.clearAllMocks();

			const picker = await openDatePicker(getByRole);
			const dayOption = within(picker).getByText('Last 24 hours');
			await userEvent.click(dayOption);

			expect(insightsStore.summary.execute).not.toHaveBeenCalled();
			expect(insightsStore.charts.execute).not.toHaveBeenCalled();
			expect(insightsStore.table.execute).not.toHaveBeenCalled();
			expect(insightsStore.analystOverview.execute).not.toHaveBeenCalled();
		});
	});
});
