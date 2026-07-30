import { createComponentRenderer } from '@/__tests__/render';
import InsightsAnalystPanel from './InsightsAnalystPanel.vue';
import { createTestingPinia } from '@pinia/testing';
import { defaultSettings } from '@/__tests__/defaults';
import { useInsightsStore } from '@/features/execution/insights/insights.store';
import { mockedStore, type MockedStore } from '@/__tests__/utils';
import { screen, waitFor } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import type { InsightsAnalystChatResponse, InsightsByWorkflow } from '@n8n/api-types';
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

const suggestedPrompts = ['Which workflows failed most?'];

const fallbackResponse: InsightsAnalystChatResponse = {
	answer: 'Invoice intake triage had the most failures in this window.',
	mode: 'fallback',
	citations: [
		{
			workflowId: 'workflow-1',
			workflowName: 'Invoice intake triage',
			metric: 'Failed executions',
			value: 5,
			unit: 'count',
		},
	],
};

const llmResponse: InsightsAnalystChatResponse = {
	answer: 'Claude summarized the reliability trend for Demo Operations.',
	mode: 'llm',
	citations: fallbackResponse.citations,
};

const renderComponent = createComponentRenderer(InsightsAnalystPanel, {
	global: {
		stubs: {
			RouterLink: {
				template: '<a><slot /></a>',
			},
			N8nIcon: true,
		},
	},
});

let insightsStore: MockedStore<typeof useInsightsStore>;

function createDeferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

async function submitFreeTextQuestion(question: string) {
	const textarea = screen.getByRole('textbox');
	await userEvent.clear(textarea);
	await userEvent.type(textarea, question);
	await userEvent.click(screen.getByTestId('instance-ai-send-button'));
}

describe('InsightsAnalystPanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		createTestingPinia({
			initialState: { settings: { settings: defaultSettings } },
		});

		insightsStore = mockedStore(useInsightsStore);
		insightsStore.askAnalyst = vi.fn().mockResolvedValue(fallbackResponse);
		insightsStore.streamAnalyst = vi.fn(
			async (
				_question: string,
				onChunk: (chunk: {
					type: 'delta' | 'complete';
					text?: string;
					response?: InsightsAnalystChatResponse;
				}) => void,
			) => {
				onChunk({ type: 'complete', response: fallbackResponse });
			},
		);
	});

	it('asks through the store stream or sync client and shows a typing indicator while waiting', async () => {
		const deferred = createDeferred<InsightsAnalystChatResponse>();

		insightsStore.streamAnalyst = vi.fn(async (_question, onChunk) => {
			const response = await deferred.promise;
			onChunk({ type: 'complete', response });
		});
		insightsStore.askAnalyst = vi.fn(async () => await deferred.promise);

		renderComponent({
			props: {
				suggestedPrompts,
				workflowRows,
			},
		});

		expect(screen.getByTestId('insights-analyst-panel')).toBeInTheDocument();

		await submitFreeTextQuestion('Which workflows failed most?');

		await waitFor(() => {
			expect(screen.getByTestId('chat-typing-indicator')).toBeInTheDocument();
		});

		const usedStream = vi.mocked(insightsStore.streamAnalyst).mock.calls.length > 0;
		const usedSync = vi.mocked(insightsStore.askAnalyst).mock.calls.length > 0;
		expect(usedStream || usedSync).toBe(true);

		if (usedStream) {
			expect(insightsStore.streamAnalyst).toHaveBeenCalledWith(
				'Which workflows failed most?',
				expect.any(Function),
			);
		} else {
			expect(insightsStore.askAnalyst).toHaveBeenCalledWith('Which workflows failed most?');
		}

		deferred.resolve(fallbackResponse);

		await waitFor(() => {
			expect(screen.queryByTestId('chat-typing-indicator')).not.toBeInTheDocument();
			expect(
				screen.getByText('Invoice intake triage had the most failures in this window.'),
			).toBeInTheDocument();
		});
	});

	it('hides Powered by Claude for fallback answers and shows it for llm answers', async () => {
		insightsStore.streamAnalyst = vi.fn(async (_question, onChunk) => {
			onChunk({ type: 'complete', response: fallbackResponse });
		});
		insightsStore.askAnalyst = vi.fn().mockResolvedValue(fallbackResponse);

		const { unmount } = renderComponent({
			props: {
				suggestedPrompts,
				workflowRows,
			},
		});

		await submitFreeTextQuestion('Show me a fallback summary');

		await waitFor(() => {
			expect(
				screen.getByText('Invoice intake triage had the most failures in this window.'),
			).toBeInTheDocument();
		});
		expect(screen.queryByText('Powered by Claude')).not.toBeInTheDocument();

		unmount();

		insightsStore.streamAnalyst = vi.fn(async (_question, onChunk) => {
			onChunk({ type: 'complete', response: llmResponse });
		});
		insightsStore.askAnalyst = vi.fn().mockResolvedValue(llmResponse);

		renderComponent({
			props: {
				suggestedPrompts,
				workflowRows,
			},
		});

		await submitFreeTextQuestion('Show me an llm summary');

		await waitFor(() => {
			expect(
				screen.getByText('Claude summarized the reliability trend for Demo Operations.'),
			).toBeInTheDocument();
			expect(screen.getByText('Powered by Claude')).toBeInTheDocument();
		});
	});

	it('renders citations from the chat response', async () => {
		renderComponent({
			props: {
				suggestedPrompts,
				workflowRows,
			},
		});

		await submitFreeTextQuestion('Cite the failing workflows');

		await waitFor(() => {
			expect(screen.getByText('Invoice intake triage')).toBeInTheDocument();
			expect(screen.getByText(/Failed executions/i)).toBeInTheDocument();
		});
	});

	it('sends a suggested prompt when a pill is clicked', async () => {
		renderComponent({
			props: {
				suggestedPrompts,
				workflowRows,
			},
		});

		const pill = screen.getByRole('button', { name: 'Which workflows failed most?' });
		expect(pill).toBeInTheDocument();

		await userEvent.click(pill);

		await waitFor(() => {
			const usedStream = vi.mocked(insightsStore.streamAnalyst).mock.calls.length > 0;
			const usedSync = vi.mocked(insightsStore.askAnalyst).mock.calls.length > 0;
			expect(usedStream || usedSync).toBe(true);

			if (usedStream) {
				expect(insightsStore.streamAnalyst).toHaveBeenCalledWith(
					'Which workflows failed most?',
					expect.any(Function),
				);
			} else {
				expect(insightsStore.askAnalyst).toHaveBeenCalledWith('Which workflows failed most?');
			}

			expect(
				screen.getByText('Invoice intake triage had the most failures in this window.'),
			).toBeInTheDocument();
		});
	});
});
