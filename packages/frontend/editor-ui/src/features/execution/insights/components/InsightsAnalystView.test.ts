import { getLocalTimeZone, today } from '@internationalized/date';
import type {
	FrontendModuleSettings,
	InsightsAnalystChatResponse,
	InsightsAnalystOverview,
} from '@n8n/api-types';
import { makeRestApiRequest } from '@n8n/rest-api-client';
import { createTestingPinia } from '@pinia/testing';
import { screen, waitFor, within } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { reactive, ref } from 'vue';

import { defaultSettings } from '@/__tests__/defaults';
import { createComponentRenderer } from '@/__tests__/render';
import { mockedStore, type MockedStore } from '@/__tests__/utils';
import { useInsightsStore } from '@/features/execution/insights/insights.store';
import {
	formatDateRange,
	getAdjustedDateRange,
} from '@/features/execution/insights/insights.utils';
import { useRootStore } from '@n8n/stores/useRootStore';

import InsightsAnalystView from './InsightsAnalystView.vue';

const mockRoute = reactive({
	name: 'InsightsAnalyst',
	params: {},
	query: {},
});

vi.mock('vue-router', () => ({
	useRoute: () => mockRoute,
	useRouter: vi.fn(),
	RouterLink: {
		props: ['to'],
		template:
			'<a data-test-id="insights-summary-link" :data-insight-type="to && to.params && to.params.insightType"><slot /></a>',
	},
}));

vi.mock('vue-chartjs', () => ({
	Bar: {
		template: '<div>Bar</div>',
	},
	Line: {
		template: '<div>Line</div>',
	},
}));

vi.mock('@vueuse/core', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@vueuse/core')>();
	return {
		...actual,
		useSpeechRecognition: () => ({
			isSupported: ref(false),
			isListening: ref(false),
			result: ref(''),
			isFinal: ref(false),
			start: vi.fn(),
			stop: vi.fn(),
		}),
	};
});

vi.mock('@/features/execution/insights/components/InsightsDashboard.vue', () => ({
	default: {
		name: 'InsightsDashboard',
		template: '<div data-test-id="licensed-insights-dashboard" />',
	},
}));

vi.mock('@n8n/rest-api-client', async (importOriginal) => {
	const original = await importOriginal<typeof import('@n8n/rest-api-client')>();
	return {
		...original,
		makeRestApiRequest: vi.fn(),
	};
});

const renderComponent = createComponentRenderer(InsightsAnalystView);

const communityModuleSettings: FrontendModuleSettings = {
	insights: {
		summary: true,
		dashboard: false,
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
				licensed: false,
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
	summary: {
		total: { deviation: 10, unit: 'count', value: 1250 },
		failed: { deviation: -8, unit: 'count', value: 23 },
		failureRate: { deviation: -0.005, unit: 'ratio', value: 0.0184 },
		averageRunTime: { deviation: 2, unit: 'millisecond', value: 15000 },
		timeSaved: { deviation: 20, unit: 'minute', value: 180 },
	},
	byTime: [
		{
			date: '2000-12-01T00:00:00.000Z',
			values: {
				total: 100,
				failed: 5,
				failureRate: 0.05,
				timeSaved: 45,
				averageRunTime: 12,
				succeeded: 95,
			},
		},
		{
			date: '2000-12-02T00:00:00.000Z',
			values: {
				total: 120,
				failed: 8,
				failureRate: 0.067,
				timeSaved: 55,
				averageRunTime: 15,
				succeeded: 112,
			},
		},
	],
	highlights: [
		{
			workflowId: 'insights-demo-ap-invoice-ingestion',
			title: 'AP invoice ingestion',
			blurb: 'Saved the most time this month',
			metric: '3h',
		},
	],
	ranking: [
		{
			rank: 1,
			workflowId: 'insights-demo-ap-invoice-ingestion',
			name: 'AP invoice ingestion',
			timeSavedLabel: '3h',
		},
	],
	lowImpact: [
		{
			workflowId: 'insights-demo-inventory-sync',
			name: 'Inventory sync',
			blurb: 'Low time saved per run',
			timeSavedPerRunLabel: '4m',
		},
	],
};

const emptyOverview: InsightsAnalystOverview = {
	summary: {
		total: { deviation: null, unit: 'count', value: 0 },
		failed: { deviation: null, unit: 'count', value: 0 },
		failureRate: { deviation: null, unit: 'ratio', value: 0 },
		averageRunTime: { deviation: null, unit: 'millisecond', value: 0 },
		timeSaved: { deviation: null, unit: 'minute', value: 0 },
	},
	byTime: [],
	highlights: [],
	ranking: [],
	lowImpact: [],
};

const date = new Date('2000-12-19T00:00:00.000Z');

const LICENSED_INSIGHTS_PATHS = new Set([
	'/insights/by-time',
	'/insights/by-workflow',
	'/insights/by-time/time-saved',
	'/insights/summary',
]);

let insightsStore: MockedStore<typeof useInsightsStore>;

const thirtyDayRange = () => {
	const end = today(getLocalTimeZone());
	return {
		start: end.subtract({ days: 30 }),
		end,
	};
};

const weekRange = () => {
	const end = today(getLocalTimeZone());
	return {
		start: end.subtract({ days: 7 }),
		end,
	};
};

const fallbackChat: InsightsAnalystChatResponse = {
	answer: 'AP invoice ingestion saved the most time this month.',
	citations: [
		{
			workflowId: 'insights-demo-ap-invoice-ingestion',
			label: 'AP invoice ingestion',
			metric: '3h',
		},
	],
	mode: 'fallback',
};

const overviewRequests = () =>
	vi
		.mocked(makeRestApiRequest)
		.mock.calls.filter((call) => call[2] === '/insights/analyst/overview');

const chatRequests = () =>
	vi.mocked(makeRestApiRequest).mock.calls.filter((call) => call[2] === '/insights/analyst/chat');

const licensedInsightsRequests = () =>
	vi
		.mocked(makeRestApiRequest)
		.mock.calls.filter((call) => LICENSED_INSIGHTS_PATHS.has(String(call[2])));

const mockAnalystRequests = (chat: InsightsAnalystChatResponse = fallbackChat) => {
	vi.mocked(makeRestApiRequest).mockImplementation(async (_ctx, method, path) => {
		if (path === '/insights/analyst/overview') {
			return mockOverview;
		}
		if (path === '/insights/analyst/chat') {
			return chat;
		}
		throw new Error(`Unexpected ${method} ${path}`);
	});
};

const openDatePicker = async (getByRole: (role: string, options?: object) => HTMLElement) => {
	const trigger = getByRole('button', { name: formatDateRange(thirtyDayRange()) });
	expect(trigger).toBeInTheDocument();
	await userEvent.click(trigger);

	const controllingId = trigger.getAttribute('aria-controls');
	expect(controllingId).toBeDefined();

	const picker = document.getElementById(controllingId as string);
	expect(picker).toBeInTheDocument();

	return picker as HTMLElement;
};

const expectNoLicensedInsightsTraffic = () => {
	expect(licensedInsightsRequests()).toEqual([]);
	expect(insightsStore.summary.execute).not.toHaveBeenCalled();
	expect(insightsStore.charts.execute).not.toHaveBeenCalled();
	expect(insightsStore.table.execute).not.toHaveBeenCalled();
	expect(screen.queryByTestId('licensed-insights-dashboard')).not.toBeInTheDocument();
	expect(
		screen.queryByRole('heading', {
			name: 'Upgrade to access more detailed insights',
		}),
	).not.toBeInTheDocument();
};

describe('InsightsAnalystView', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.setSystemTime(date);

		vi.mocked(makeRestApiRequest).mockResolvedValue(mockOverview);

		createTestingPinia({
			initialState: {
				settings: {
					settings: {
						...defaultSettings,
						activeModules: ['insights'],
						envFeatureFlags: {},
					},
					moduleSettings: communityModuleSettings,
				},
			},
		});

		const rootStore = mockedStore(useRootStore);
		rootStore.restApiContext = {
			baseUrl: 'http://localhost',
			pushRef: 'pushRef',
		};

		insightsStore = mockedStore(useInsightsStore);
		insightsStore.isSummaryEnabled = true;
		insightsStore.isDashboardEnabled = false;
		insightsStore.isInsightsEnabled = true;
		insightsStore.dateRanges = communityModuleSettings.insights?.dateRanges ?? [];
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
	});

	it('field engineer with insights:list opens analyst and sees overview charts without a demo flag or licensed dashboard', async () => {
		renderComponent();

		await waitFor(() => {
			expect(screen.getByTestId('insights-summary-tabs')).toBeInTheDocument();
			expect(screen.getByTestId('insights-chart-total')).toBeInTheDocument();
			expect(screen.getAllByText('AP invoice ingestion').length).toBeGreaterThan(0);
			expect(screen.getAllByText('Inventory sync').length).toBeGreaterThan(0);
		});

		expect(overviewRequests()).toHaveLength(1);
		expect(overviewRequests()[0]?.[1]).toBe('GET');
		expect(overviewRequests()[0]?.[3]).toEqual(
			expect.objectContaining({
				startDate: getAdjustedDateRange(thirtyDayRange()).startDate.toISOString(),
				endDate: getAdjustedDateRange(thirtyDayRange()).endDate.toISOString(),
			}),
		);
		expectNoLicensedInsightsTraffic();
	});

	it('range picker defaults to 30 days and refreshes charts from overview only', async () => {
		const { getByRole } = renderComponent();

		await waitFor(() => {
			expect(getByRole('button', { name: formatDateRange(thirtyDayRange()) })).toBeInTheDocument();
		});

		expect(overviewRequests()).toHaveLength(1);

		const picker = await openDatePicker(getByRole);
		await userEvent.click(within(picker).getByText('Last 7 days'));

		await waitFor(() => {
			expect(overviewRequests()).toHaveLength(2);
		});

		expect(overviewRequests()[1]?.[1]).toBe('GET');
		expect(overviewRequests()[1]?.[3]).toEqual(
			expect.objectContaining({
				startDate: getAdjustedDateRange(weekRange()).startDate.toISOString(),
				endDate: getAdjustedDateRange(weekRange()).endDate.toISOString(),
			}),
		);
		expect(screen.getByTestId('insights-chart-total')).toBeInTheDocument();
		expectNoLicensedInsightsTraffic();
	});

	it('community last-30-days preset does not open the upgrade modal', async () => {
		const { getByRole } = renderComponent();

		await waitFor(() => {
			expect(screen.getByTestId('insights-chart-total')).toBeInTheDocument();
		});

		const picker = await openDatePicker(getByRole);
		await userEvent.click(within(picker).getByText('Last 30 days'));

		expect(screen.queryByText(/Viewing this time period requires an enterprise plan/)).toBeNull();
		expectNoLicensedInsightsTraffic();
	});

	it('summary tiles do not navigate to /insights/timeSaved or other licensed types', async () => {
		const { container } = renderComponent();

		await waitFor(() => {
			expect(screen.getByTestId('insights-summary-tab-timeSaved')).toBeInTheDocument();
			expect(screen.getByTestId('insights-summary-tab-total')).toBeInTheDocument();
		});

		expect(screen.queryAllByTestId('insights-summary-link')).toHaveLength(0);
		expect(container.querySelector('a[href*="timeSaved"]')).toBeNull();
		expect(container.querySelector('a[href*="insights"]')).toBeNull();
		expect(mockRoute.params).toEqual({});
	});

	it('empty overview still shows the page without licensed insights requests', async () => {
		vi.mocked(makeRestApiRequest).mockResolvedValue(emptyOverview);

		renderComponent();

		await waitFor(() => {
			expect(screen.getByTestId('insights-summary-tabs')).toBeInTheDocument();
		});

		expect(overviewRequests()).toHaveLength(1);
		expect(overviewRequests()[0]?.[1]).toBe('GET');
		expect(overviewRequests()[0]?.[2]).toBe('/insights/analyst/overview');
		expectNoLicensedInsightsTraffic();
	});

	it('right rail sits beside the dashboard and stacks under it on a narrow layout', async () => {
		renderComponent();

		await waitFor(() => {
			expect(screen.getByTestId('insights-chart-total')).toBeInTheDocument();
		});

		const layout = screen.getByTestId('insights-analyst-layout');
		const dashboard = screen.getByTestId('insights-analyst-dashboard');
		const rail = screen.getByTestId('insights-analyst-chat-rail');

		expect(layout).toContainElement(dashboard);
		expect(layout).toContainElement(rail);
		expect(
			Boolean(dashboard.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING),
		).toBe(true);
	});

	it('pill submit on the analyst page shows a user bubble then an answer', async () => {
		mockAnalystRequests();
		renderComponent();

		await waitFor(() => {
			expect(screen.getByTestId('insights-chart-total')).toBeInTheDocument();
		});

		expect(screen.getByTestId('insights-analyst-chat-rail')).toBeInTheDocument();

		await userEvent.click(screen.getByTestId('insights-analyst-suggested-prompt-time-saved'));

		await waitFor(() => {
			expect(screen.getByTestId('insights-analyst-chat-user-bubble')).toBeInTheDocument();
			expect(screen.getByText(fallbackChat.answer)).toBeInTheDocument();
		});

		expect(chatRequests()).toHaveLength(1);
		expect(chatRequests()[0]?.[1]).toBe('POST');
		expect(chatRequests()[0]?.[2]).toBe('/insights/analyst/chat');
		expect(chatRequests()[0]?.[3]).toEqual(
			expect.objectContaining({
				question: expect.any(String),
				suggestedPromptId: 'time-saved',
			}),
		);
		expectNoLicensedInsightsTraffic();
	});

	it('chat rail lives only on InsightsAnalystView so unauthenticated users never reach it', async () => {
		renderComponent();

		await waitFor(() => {
			expect(screen.getByTestId('insights-chart-total')).toBeInTheDocument();
		});

		expect(screen.getByTestId('insights-analyst-chat-rail')).toBeInTheDocument();
		expect(screen.queryByTestId('licensed-insights-dashboard')).not.toBeInTheDocument();
		expectNoLicensedInsightsTraffic();
	});
});
