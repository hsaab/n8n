import type { InsightsAnalystChatRequest, InsightsAnalystChatResponse } from '@n8n/api-types';
import { useRootStore } from '@n8n/stores/useRootStore';
import { ref } from 'vue';

import { sendInsightsAnalystChat } from '../insights.api';

export type InsightsAnalystChatMessage =
	| { role: 'user'; text: string }
	| ({ role: 'assistant' } & InsightsAnalystChatResponse);

export function useInsightsAnalystChat() {
	const rootStore = useRootStore();
	const messages = ref<InsightsAnalystChatMessage[]>([]);
	const sending = ref(false);

	async function send(question: string, suggestedPromptId?: string) {
		const trimmed = question.trim();
		if (!trimmed || sending.value) {
			return;
		}

		sending.value = true;
		messages.value.push({ role: 'user', text: trimmed });

		const body: InsightsAnalystChatRequest = suggestedPromptId
			? { question: trimmed, suggestedPromptId }
			: { question: trimmed };

		try {
			const response = await sendInsightsAnalystChat(rootStore.restApiContext, body);
			messages.value.push({ role: 'assistant', ...response });
		} finally {
			sending.value = false;
		}
	}

	return {
		messages,
		sending,
		send,
	};
}
