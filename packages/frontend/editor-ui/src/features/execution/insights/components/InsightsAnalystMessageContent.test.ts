import { createComponentRenderer } from '@/__tests__/render';
import InsightsAnalystMessageContent from './InsightsAnalystMessageContent.vue';
import { createTestingPinia } from '@pinia/testing';
import { defaultSettings } from '@/__tests__/defaults';
import { screen } from '@testing-library/vue';
import type { InsightsAnalystCitation, InsightsByWorkflow } from '@n8n/api-types';
import { reactive } from 'vue';
import { vi } from 'vitest';

vi.mock('vue-router', () => ({
	useRouter: () => ({}),
	useRoute: () => reactive({}),
	RouterLink: {
		name: 'RouterLink',
		props: ['to'],
		template: '<a><slot /></a>',
	},
}));

vi.mock('@/features/ai/chatHub/components/ChatMarkdownChunk.vue', () => ({
	default: {
		name: 'ChatMarkdownChunk',
		props: ['source'],
		template: '<div data-test-id="chat-markdown-chunk">{{ source.content }}</div>',
	},
}));

const workflowRows: InsightsByWorkflow['data'] = [
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
];

const citations: InsightsAnalystCitation[] = [
	{
		workflowId: 'workflow-1',
		workflowName: 'Invoice intake triage',
		metric: 'Failed executions',
		value: 5,
		unit: 'count',
	},
	{
		workflowId: 'workflow-2',
		workflowName: 'Vendor onboarding checklist',
		metric: 'Time saved',
		value: 90,
		unit: 'minute',
	},
];

const renderComponent = createComponentRenderer(InsightsAnalystMessageContent, {
	global: {
		stubs: {
			RouterLink: {
				template: '<a><slot /></a>',
			},
			N8nIcon: true,
		},
	},
});

describe('InsightsAnalystMessageContent', () => {
	beforeEach(() => {
		createTestingPinia({
			initialState: { settings: { settings: defaultSettings } },
		});
	});

	it('renders answer text and citation chips from the chat response', () => {
		renderComponent({
			props: {
				content: 'These workflows drove most of the failures and time saved.',
				citations,
				workflowRows,
				isStreaming: false,
			},
		});

		expect(
			screen.getByText('These workflows drove most of the failures and time saved.'),
		).toBeInTheDocument();
		expect(screen.getByText('Invoice intake triage')).toBeInTheDocument();
		expect(screen.getByText(/Failed executions/i)).toBeInTheDocument();
		expect(screen.getByText('Vendor onboarding checklist')).toBeInTheDocument();
		expect(screen.getByText(/Time saved/i)).toBeInTheDocument();
	});

	it('renders without citation chips when the response has none', () => {
		renderComponent({
			props: {
				content: 'No workflow stood out in this window.',
				citations: [],
				workflowRows,
				isStreaming: false,
			},
		});

		expect(screen.getByText('No workflow stood out in this window.')).toBeInTheDocument();
		expect(screen.queryByText('Invoice intake triage')).not.toBeInTheDocument();
		expect(screen.queryByText(/Failed executions/i)).not.toBeInTheDocument();
	});
});
