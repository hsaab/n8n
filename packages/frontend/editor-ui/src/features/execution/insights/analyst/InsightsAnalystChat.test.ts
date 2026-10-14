import { createComponentRenderer } from '@/__tests__/render';
import InsightsAnalystChat from '@/features/execution/insights/analyst/InsightsAnalystChat.vue';

vi.mock('@/features/ai/shared/components/ChatInputBase.vue', () => ({
	default: { name: 'ChatInputBase', template: '<div data-test-id="chat-input" />' },
}));

const renderComponent = createComponentRenderer(InsightsAnalystChat);

describe('InsightsAnalystChat', () => {
	it('hides the Claude badge when the answer is a fallback', () => {
		const { queryByTestId } = renderComponent({
			props: {
				pending: false,
				messages: [
					{
						id: 'assistant-1',
						role: 'assistant',
						text: 'Invoice reminder saved the most time.',
						response: {
							answer: 'Invoice reminder saved the most time.',
							citations: [],
							mode: 'fallback',
						},
					},
				],
			},
		});

		expect(queryByTestId('insights-analyst-claude-badge')).toBeNull();
	});

	it('bolds cited workflow names inside the answer and lists citations', () => {
		const { container, getByText } = renderComponent({
			props: {
				pending: false,
				messages: [
					{
						id: 'assistant-1',
						role: 'assistant',
						text: 'Support Triage saved the most time in this range.',
						response: {
							answer: 'Support Triage saved the most time in this range.',
							citations: [
								{
									workflowId: 'wf-1',
									workflowName: 'Support Triage',
									metric: 'timeSaved',
									value: 23400,
								},
							],
							mode: 'fallback',
						},
					},
				],
			},
		});

		const boldNames = Array.from(container.querySelectorAll('p strong')).map(
			(node) => node.textContent,
		);
		expect(boldNames).toContain('Support Triage');
		expect(getByText('390h')).toBeTruthy();
	});

	it('shows the typing indicator while a request is pending', () => {
		const { getByTestId } = renderComponent({
			props: {
				pending: true,
				messages: [],
			},
		});

		expect(getByTestId('chat-typing-indicator')).toBeTruthy();
	});
});
