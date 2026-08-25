import type { InsightsAnalystChatResponse, InsightsAnalystRankingRow } from '@n8n/api-types';
import { makeRestApiRequest } from '@n8n/rest-api-client';
import { createTestingPinia } from '@pinia/testing';
import { screen, waitFor, within } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { ref } from 'vue';

import { defaultSettings } from '@/__tests__/defaults';
import { createComponentRenderer } from '@/__tests__/render';
import { mockedStore } from '@/__tests__/utils';
import { useRootStore } from '@n8n/stores/useRootStore';

import InsightsAnalystChatRail from './InsightsAnalystChatRail.vue';

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

vi.mock('@n8n/rest-api-client', async (importOriginal) => {
	const original = await importOriginal<typeof import('@n8n/rest-api-client')>();
	return {
		...original,
		makeRestApiRequest: vi.fn(),
	};
});

const renderComponent = createComponentRenderer(InsightsAnalystChatRail);

const ranking: InsightsAnalystRankingRow[] = [
	{
		rank: 1,
		workflowId: 'insights-demo-ap-invoice-ingestion',
		name: 'AP invoice ingestion',
		department: 'Finance',
		timeSavedMinutes: 180,
	},
];

const fallbackChat: InsightsAnalystChatResponse = {
	finding: 'AP invoice ingestion saved the most time this month.',
	evidence: ['AP invoice ingestion saved 3h.'],
	recommendation: {
		action: 'Open AP invoice ingestion to see where the time is saved.',
		detail: 'Compare it with the rest of the ranking for a broader ops view.',
	},
	citations: [
		{
			workflowId: 'insights-demo-ap-invoice-ingestion',
			label: 'Invoice bot',
			metric: '3h',
		},
	],
	mode: 'fallback',
};

const llmChat: InsightsAnalystChatResponse = {
	...fallbackChat,
	finding: 'AP invoice ingestion is the time-saved leader this period.',
	mode: 'llm',
};

const typedQuestion = 'Which workflows are failing this week?';

const chatRequests = () =>
	vi.mocked(makeRestApiRequest).mock.calls.filter((call) => call[2] === '/insights/analyst/chat');

const setupRail = () => {
	createTestingPinia({
		initialState: {
			settings: {
				settings: defaultSettings,
			},
		},
	});

	const rootStore = mockedStore(useRootStore);
	rootStore.restApiContext = {
		baseUrl: 'http://localhost',
		pushRef: 'pushRef',
	};

	return renderComponent({
		props: { ranking },
	});
};

describe('InsightsAnalystChatRail', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(makeRestApiRequest).mockResolvedValue(fallbackChat);
	});

	it('field engineer clicks a suggested prompt and sees their question then an answer', async () => {
		setupRail();

		await userEvent.click(screen.getByTestId('insights-analyst-suggested-prompt-time-saved'));

		await waitFor(() => {
			expect(screen.getByTestId('insights-analyst-chat-user-bubble')).toHaveTextContent(
				'Which workflows saved us the most time?',
			);
			expect(screen.getByTestId('insights-analyst-finding')).toHaveTextContent(
				fallbackChat.finding,
			);
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
		expect(typeof chatRequests()[0]?.[3]).toBe('object');
		expect(screen.getByTestId('instance-ai-send-button')).toBeInTheDocument();
	});

	it('field engineer types a question and sees their bubble then an answer while the request is in flight', async () => {
		let resolveChat!: (value: InsightsAnalystChatResponse) => void;
		vi.mocked(makeRestApiRequest).mockImplementation(async (_ctx, method, path) => {
			if (path === '/insights/analyst/chat') {
				return await new Promise<InsightsAnalystChatResponse>((resolve) => {
					resolveChat = resolve;
				});
			}

			throw new Error(`Unexpected ${method} ${path}`);
		});

		setupRail();

		await userEvent.type(screen.getByRole('textbox'), typedQuestion);
		await userEvent.click(screen.getByTestId('instance-ai-send-button'));

		await waitFor(() => {
			expect(screen.getByTestId('insights-analyst-chat-user-bubble')).toHaveTextContent(
				typedQuestion,
			);
			expect(screen.getByTestId('chat-typing-indicator')).toBeInTheDocument();
		});

		resolveChat(fallbackChat);

		await waitFor(() => {
			expect(screen.queryByTestId('chat-typing-indicator')).not.toBeInTheDocument();
			expect(screen.getByTestId('insights-analyst-finding')).toHaveTextContent(
				fallbackChat.finding,
			);
		});

		expect(chatRequests()).toHaveLength(1);
		expect(chatRequests()[0]?.[1]).toBe('POST');
		expect(chatRequests()[0]?.[3]).toEqual(
			expect.objectContaining({
				question: typedQuestion,
			}),
		);
	});

	it('fallback answer hides Claude branding', async () => {
		vi.mocked(makeRestApiRequest).mockResolvedValue(fallbackChat);
		setupRail();

		await userEvent.click(screen.getByTestId('insights-analyst-suggested-prompt-time-saved'));

		await waitFor(() => {
			expect(screen.getByTestId('insights-analyst-finding')).toHaveTextContent(
				fallbackChat.finding,
			);
		});

		expect(screen.queryByTestId('insights-analyst-powered-by-claude')).not.toBeInTheDocument();
		expect(screen.queryByText('Powered by Claude')).not.toBeInTheDocument();
	});

	it('llm answer shows Powered by Claude', async () => {
		vi.mocked(makeRestApiRequest).mockResolvedValue(llmChat);
		setupRail();

		await userEvent.click(screen.getByTestId('insights-analyst-suggested-prompt-time-saved'));

		await waitFor(() => {
			expect(screen.getByTestId('insights-analyst-finding')).toHaveTextContent(llmChat.finding);
		});

		const badge = screen.getByTestId('insights-analyst-powered-by-claude');
		expect(badge).toBeInTheDocument();
		expect(badge).toHaveTextContent('Powered by Claude');
	});

	it('citation card maps to a ranked workflow from the overview', async () => {
		setupRail();

		await userEvent.click(screen.getByTestId('insights-analyst-suggested-prompt-time-saved'));

		await waitFor(() => {
			expect(screen.getByTestId('insights-analyst-citation')).toBeInTheDocument();
		});

		const card = screen.getByTestId('insights-analyst-citation');
		expect(card).toHaveAttribute('data-workflow-id', 'insights-demo-ap-invoice-ingestion');
		expect(within(card).getByText('AP invoice ingestion')).toBeInTheDocument();
	});

	it('renders finding, evidence, and next step as separate blocks', async () => {
		setupRail();

		await userEvent.click(screen.getByTestId('insights-analyst-suggested-prompt-time-saved'));

		await waitFor(() => {
			expect(screen.getByTestId('insights-analyst-recommendation')).toBeInTheDocument();
		});

		expect(screen.getByTestId('insights-analyst-finding')).toHaveTextContent(fallbackChat.finding);
		expect(screen.getByTestId('insights-analyst-evidence')).toHaveTextContent(
			'What the data shows',
		);
		expect(screen.getByTestId('insights-analyst-evidence')).toHaveTextContent(
			fallbackChat.evidence[0] ?? '',
		);

		const recommendation = screen.getByTestId('insights-analyst-recommendation');
		expect(recommendation).toHaveTextContent('Next step');
		expect(recommendation).toHaveTextContent(fallbackChat.recommendation.action);
		expect(recommendation).toHaveTextContent(fallbackChat.recommendation.detail ?? '');
	});
});
